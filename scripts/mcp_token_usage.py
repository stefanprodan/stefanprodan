#!/usr/bin/env python3
"""Calculate the LLM token usage of every MCP server in an MCP config file.

Connects to each configured MCP server (remote HTTP or local stdio), fetches
its `instructions` and `tools/list`, and reports chars + tokens per entry.

Two config formats are auto-detected:

opencode (~/.config/opencode/opencode.jsonc):
    {"mcp": {"<name>": {"type": "remote", "url": "https://..."}
                      | {"type": "local", "command": ["bin", "arg"],
                         "environment": {"K": "V"}}}}

.mcp.json (project-level MCP config):
    {"mcpServers": {"<name>": {"type": "http", "url": "https://..."}
                             | {"type": "stdio", "command": "bin",
                                "args": ["arg"], "env": {"K": "V"}}}}

Usage:
    uv run --with tiktoken python scripts/mcp_token_usage.py \
        --config ~/.config/opencode/opencode.jsonc

    uv run --with tiktoken python scripts/mcp_token_usage.py \
        --config .mcp.json --encoding cl100k_base

    uv run --with tiktoken python scripts/mcp_token_usage.py \
        --config .mcp.json --report mcp_tokens.json
"""
import argparse
import json
import os
import subprocess
import urllib.request

INIT = {
    "jsonrpc": "2.0",
    "id": 0,
    "method": "initialize",
    "params": {
        "protocolVersion": "2025-11-25",
        "capabilities": {},
        "clientInfo": {"name": "mcp-token-usage", "version": "1.0"},
    },
}
INITED = {"jsonrpc": "2.0", "method": "notifications/initialized"}
TOOLS_LIST = {"jsonrpc": "2.0", "id": 1, "method": "tools/list", "params": {}}


def parse_jsonc(text):
    out = []
    i, n = 0, len(text)
    in_str = False
    while i < n:
        c = text[i]
        if in_str:
            out.append(c)
            if c == "\\" and i + 1 < n:
                out.append(text[i + 1])
                i += 2
                continue
            if c == '"':
                in_str = False
            i += 1
            continue
        if c == '"':
            in_str = True
            out.append(c)
            i += 1
            continue
        if c == "/" and i + 1 < n and text[i + 1] == "/":
            while i < n and text[i] != "\n":
                i += 1
            continue
        if c == "/" and i + 1 < n and text[i + 1] == "*":
            i += 2
            while i + 1 < n and not (text[i] == "*" and text[i + 1] == "/"):
                i += 1
            i += 2
            continue
        out.append(c)
        i += 1
    return json.loads("".join(out))


def normalize_servers(config):
    """Normalize opencode (`mcp`) and .mcp.json (`mcpServers`) configs into
    {name: {"url": ...} | {"command": [...], "env": {...}}}."""
    servers = {}
    for name, spec in config.get("mcp", {}).items():
        if spec.get("type") == "remote" or "url" in spec:
            servers[name] = {"url": spec["url"]}
        else:
            servers[name] = {"command": spec["command"],
                             "env": spec.get("environment", {})}
    for name, spec in config.get("mcpServers", {}).items():
        stype = spec.get("type")
        if stype in ("http", "sse", "streamable-http") or "url" in spec:
            servers[name] = {"url": spec["url"]}
        else:
            cmd = [spec["command"]] + list(spec.get("args", []))
            servers[name] = {"command": cmd, "env": spec.get("env", {})}
    return servers


def expand_env(value):
    for key, val in os.environ.items():
        value = value.replace("{env:%s}" % key, val)
    return os.path.expanduser(value)


def parse_body(body):
    body = body.strip()
    if not body:
        return None
    try:
        return json.loads(body)
    except json.JSONDecodeError:
        result = None
        for line in body.splitlines():
            if line.strip().startswith("data:"):
                try:
                    msg = json.loads(line.strip()[5:])
                    if msg.get("id") in (0, 1):
                        result = msg
                except json.JSONDecodeError:
                    pass
        return result


def http_post(url, payload, session=None):
    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode(),
        headers={
            "Content-Type": "application/json",
            "Accept": "application/json, text/event-stream",
            "User-Agent": "mcp-token-usage/1.0 (curl-compatible)",
        },
        method="POST",
    )
    resp = urllib.request.urlopen(req, timeout=60)
    sid = resp.headers.get("mcp-session-id") or session
    return parse_body(resp.read().decode()), sid


def connect_http(url):
    init, sid = http_post(url, INIT)
    try:
        http_post(url, INITED, sid)
    except Exception:
        pass
    resp, _ = http_post(url, TOOLS_LIST, sid)
    if not resp or "result" not in resp:
        raise RuntimeError("bad tools/list response: %s" % str(resp)[:300])
    instructions = (init or {}).get("result", {}).get("instructions") or ""
    return instructions, resp["result"].get("tools", [])


def connect_stdio(cmd, env_extra=None):
    env = dict(os.environ)
    for k, v in (env_extra or {}).items():
        env[expand_env(k)] = expand_env(v)
    proc = subprocess.Popen(
        cmd, stdin=subprocess.PIPE, stdout=subprocess.PIPE,
        stderr=subprocess.DEVNULL, env=env, text=True, bufsize=1)

    def send(m):
        proc.stdin.write(json.dumps(m) + "\n")
        proc.stdin.flush()

    def recv_until(ids):
        while True:
            line = proc.stdout.readline()
            if not line:
                raise RuntimeError("stdio closed before response")
            try:
                m = json.loads(line)
            except json.JSONDecodeError:
                continue
            if m.get("id") in ids and ("result" in m or "error" in m):
                return m

    send(INIT)
    init = recv_until({0})
    send(INITED)
    send(TOOLS_LIST)
    resp = recv_until({1})
    proc.terminate()
    if "error" in resp:
        raise RuntimeError("tools/list error: %s" % resp["error"])
    instructions = init.get("result", {}).get("instructions") or ""
    return instructions, resp["result"].get("tools", [])


def measure(name, text, enc):
    return {
        "name": name,
        "chars": len(text),
        "tokens": len(enc.encode(text)),
    }


def serialize_tool(tool):
    return "%s: %s" % (
        tool.get("name", "?"),
        json.dumps({
            "description": tool.get("description", ""),
            "parameters": tool.get("inputSchema", {}),
        }, separators=(",", ":")),
    )


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--config", required=True,
                    help="MCP config file (opencode.jsonc or .mcp.json)")
    ap.add_argument("--encoding", default="o200k_base",
                    choices=["o200k_base", "cl100k_base"])
    ap.add_argument("--report", metavar="PATH",
                    help="optional path to write the JSON report to")
    args = ap.parse_args()

    import tiktoken
    enc = tiktoken.get_encoding(args.encoding)

    config = parse_jsonc(open(os.path.expanduser(args.config)).read())
    servers = normalize_servers(config)

    rows = []
    grand_chars = grand_tokens = 0

    for name, spec in sorted(servers.items()):
        print("=" * 76)
        try:
            if "url" in spec:
                url = spec["url"]
                print("%s  (%s)" % (name, url))
                instructions, tools = connect_http(url)
            else:
                cmd = [expand_env(c) for c in spec["command"]]
                print("%s  (%s)" % (name, " ".join(cmd)))
                instructions, tools = connect_stdio(cmd, spec.get("env"))
        except Exception as e:
            print("  ERROR: %s" % e)
            continue

        sub_chars = sub_tokens = 0
        items = [measure("<instructions>", instructions, enc)]
        items += [measure(t.get("name", "?"), serialize_tool(t), enc)
                  for t in tools]
        for it in items:
            sub_chars += it["chars"]
            sub_tokens += it["tokens"]
            rows.append((name, it))
            print("  %-38s chars=%7d  tokens=%6d"
                  % (it["name"], it["chars"], it["tokens"]))
        print("  %-38s chars=%7d  tokens=%6d"
              % ("SUBTOTAL (%d tools)" % len(tools), sub_chars, sub_tokens))
        grand_chars += sub_chars
        grand_tokens += sub_tokens

    print("=" * 76)
    summary = {}
    order = []
    for srv, it in rows:
        if srv not in summary:
            summary[srv] = {"instr_tokens": 0, "tool_tokens": 0,
                            "tools": 0}
            order.append(srv)
        if it["name"] == "<instructions>":
            summary[srv]["instr_tokens"] = it["tokens"]
        else:
            summary[srv]["tool_tokens"] += it["tokens"]
            summary[srv]["tools"] += 1

    print("%-24s %6s %14s %12s %10s"
          % ("server", "tools", "instr tokens", "tools tokens", "total"))
    print("-" * 76)
    for srv in order:
        s = summary[srv]
        print("%-24s %6d %14d %12d %10d"
              % (srv, s["tools"], s["instr_tokens"], s["tool_tokens"],
                 s["instr_tokens"] + s["tool_tokens"]))
    tot_instr = sum(s["instr_tokens"] for s in summary.values())
    tot_tools = sum(s["tool_tokens"] for s in summary.values())
    n_tools = sum(s["tools"] for s in summary.values())
    print("-" * 76)
    print("%-24s %6d %14d %12d %10d"
          % ("TOTAL", n_tools, tot_instr, tot_tools, tot_instr + tot_tools))
    print("%d servers, %d entries" % (len(servers), len(rows)))
    print("encoding=%s  total chars=%d  total tokens=%d"
          % (args.encoding, grand_chars, grand_tokens))

    if args.report:
        report = os.path.expanduser(args.report)
        report_dir = os.path.dirname(report)
        if report_dir:
            os.makedirs(report_dir, exist_ok=True)
        with open(report, "w") as f:
            json.dump({"encoding": args.encoding, "servers": [
                {"server": s, "entry": it["name"], "chars": it["chars"],
                 "tokens": it["tokens"]} for s, it in rows],
                "totals": {"chars": grand_chars, "tokens": grand_tokens}},
                f, indent=2)
        print("report -> %s" % report)


if __name__ == "__main__":
    main()
