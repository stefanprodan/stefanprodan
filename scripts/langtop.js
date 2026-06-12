#!/usr/bin/env bun
/*
Copyright 2026 Stefan Prodan.
SPDX-License-Identifier: Apache-2.0

langtop - lists the top processes by memory and CPU usage, and detects
the language/runtime each binary was built with, plus its version.

Works on macOS (libproc via bun:ffi) and Linux (/proc). No subprocesses:
language detection only reads files, streaming binaries in small chunks
(never fully loaded) so memory stays flat:

  1. Known interpreters (node, python, java...) get their version from
     the resolved executable path, embedded version strings, or the
     runtime dylib they link against.
  2. The binary is scanned for runtime signatures: Go buildinfo, Rust
     panic symbols, Bun/Node/Electron version strings, .NET target
     frameworks, GraalVM, Haskell, OCaml, and Free Pascal markers.
  3. The Mach-O or ELF header is parsed (in JS, no otool/readelf) to
     inspect linked runtimes: JVM, Python, Ruby, Perl, Mono, Julia, Lua,
     R, Electron, Swift, ObjC, C++.

Note: macOS only reports task memory for your own processes (without
root), so other users' processes are not listed there.

Usage:

  bun langtop.js [filter] [-n count] [--watch[=seconds]]

    filter                 only show processes whose name contains this
    -n, --limit=count      how many processes to show (default: 10)
    -w, --watch[=seconds]  refresh continuously (default interval: 2s)

To try it on Linux inside Docker (for testing):

  docker run --rm -v "$PWD/langtop.js:/langtop.js:ro" \
    oven/bun:1 bun /langtop.js -n 10

Detecting a Python process:

  docker run --rm -v "$PWD/langtop.js:/langtop.js:ro" oven/bun:1 bash -c '
    apt-get update -qq >/dev/null && apt-get install -y -qq python3 >/dev/null 2>&1
    python3 -c "import time; time.sleep(60)" &
    sleep 1 && bun /langtop.js python'

Detecting a Java process:

  docker run --rm -v "$PWD/langtop.js:/langtop.js:ro" oven/bun:1 bash -c '
    apt-get update -qq >/dev/null && apt-get install -y -qq default-jdk-headless >/dev/null 2>&1
    echo "public class S{public static void main(String[] a)throws Exception{Thread.sleep(60000);}}" > /S.java
    java /S.java &
    sleep 8 && bun /langtop.js java'
*/

import {
  readdirSync,
  readFileSync,
  readlinkSync,
  realpathSync,
} from "node:fs";

const HELP = `\x1b[1mlangtop\x1b[0m - top processes by memory and CPU, with language/runtime detection

\x1b[1mUsage:\x1b[0m
  bun langtop.js [filter] [options]

\x1b[1mArguments:\x1b[0m
  filter                 only show processes whose name contains this

\x1b[1mOptions:\x1b[0m
  -n, --limit=count      number of processes to show (default: 10)
  -w, --watch[=seconds]  refresh continuously (default interval: 2s)
  -h, --help             show this help

\x1b[1mExamples:\x1b[0m
  bun langtop.js -n 20
  bun langtop.js chrome
  bun langtop.js helper -n 5 --watch=1`;

function fail(message) {
  console.error(`error: ${message}\n\n${HELP}`);
  process.exit(1);
}

let count = 10;
let filter = null;
let watchSecs = null;
const args = Bun.argv.slice(2);
for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (arg === "-h" || arg === "--help") {
    console.log(HELP);
    process.exit(0);
  } else if (arg === "-w" || arg === "--watch") {
    watchSecs = 2;
  } else if (arg.startsWith("--watch=")) {
    watchSecs = Number(arg.slice(8));
    if (!(watchSecs > 0)) fail(`invalid watch interval: ${arg.slice(8)}`);
  } else if (arg === "-n" || arg === "--limit" || arg.startsWith("--limit=")) {
    const value = arg.startsWith("--limit=") ? arg.slice(8) : args[++i];
    count = Number(value);
    if (!Number.isInteger(count) || count < 1) {
      fail(`invalid limit: ${value ?? "(missing value)"}`);
    }
  } else if (arg.startsWith("-")) {
    fail(`unknown option: ${arg}`);
  } else if (filter === null) {
    filter = arg.toLowerCase();
  } else {
    fail(`unexpected argument: ${arg} (filter is already "${filter}")`);
  }
}

const MAX_SCAN_BYTES = 512 * 1024 * 1024;
// signatures are short; this much overlap means none can straddle a chunk
const CHUNK_OVERLAP = 4096;

// --- Process listing: macOS (libproc FFI) ---------------------------------

let listAllProcesses;

if (process.platform === "darwin") {
    const { dlopen, ptr, FFIType } = await import("bun:ffi");

  const PROC_PIDTASKINFO = 4; // struct proc_taskinfo, 96 bytes
  const PROC_PIDTBSDINFO = 3; // struct proc_bsdinfo, 136 bytes
  const CTL_KERN = 1;
  const KERN_PROCARGS2 = 49;

  const libproc = dlopen("/usr/lib/libproc.dylib", {
    proc_listallpids: {
      args: [FFIType.ptr, FFIType.i32],
      returns: FFIType.i32,
    },
    proc_pidpath: {
      args: [FFIType.i32, FFIType.ptr, FFIType.u32],
      returns: FFIType.i32,
    },
    proc_name: {
      args: [FFIType.i32, FFIType.ptr, FFIType.u32],
      returns: FFIType.i32,
    },
    proc_pidinfo: {
      args: [FFIType.i32, FFIType.i32, FFIType.u64, FFIType.ptr, FFIType.i32],
      returns: FFIType.i32,
    },
  });

  const libc = dlopen("/usr/lib/libSystem.B.dylib", {
    sysctl: {
      args: [
        FFIType.ptr, // int *name
        FFIType.u32, // u_int namelen
        FFIType.ptr, // void *oldp
        FFIType.ptr, // size_t *oldlenp
        FFIType.ptr, // void *newp
        FFIType.u64, // size_t newlen
      ],
      returns: FFIType.i32,
    },
    mach_timebase_info: { args: [FFIType.ptr], returns: FFIType.i32 },
  });

  // task CPU times are in mach time units, not nanoseconds
  const machTimebase = new Uint32Array(2); // { numer, denom }
  libc.symbols.mach_timebase_info(ptr(machTimebase));
  const machToSec = machTimebase[0] / machTimebase[1] / 1e9;

  // argv[0] is how the process was invoked, often friendlier than the exe
  // name (the claude CLI runs from a file named after its version). Layout
  // of KERN_PROCARGS2: argc (i32), exec path, NUL padding, then argv.
  const argsBuf = new Uint8Array(8192);
  const procArgv0 = (pid) => {
    const mib = new Int32Array([CTL_KERN, KERN_PROCARGS2, pid]);
    const size = new BigUint64Array([BigInt(argsBuf.byteLength)]);
    const r = libc.symbols.sysctl(
      ptr(mib),
      3,
      ptr(argsBuf),
      ptr(size),
      null,
      0n,
    );
    if (r !== 0) return null;
    const raw = new TextDecoder("latin1").decode(
      argsBuf.slice(4, Number(size[0])),
    );
    const start = raw.indexOf("\0");
    if (start < 0) return null;
    const argv0 = raw.slice(start).replace(/^\0+/, "");
    const end = argv0.indexOf("\0");
    if (end < 0) return null;
    return argv0.slice(0, end) || null;
  };

  listAllProcesses = () => {
    const pids = new Int32Array(16384);
    const n = libproc.symbols.proc_listallpids(ptr(pids), pids.byteLength);

    const taskInfo = new Uint8Array(96);
    const taskView = new DataView(taskInfo.buffer);
    const bsdInfo = new Uint8Array(136);
    const bsdView = new DataView(bsdInfo.buffer);
    const cstr = new Uint8Array(4096);
    const readCstr = (len) =>
      len > 0 ? new TextDecoder().decode(cstr.slice(0, len)) : null;

    const nowSec = Date.now() / 1000;
    const procs = [];
    for (let i = 0; i < n; i++) {
      const pid = pids[i];
      if (pid <= 0) continue;
      // fails (returns 0) for other users' processes; skip those
      const got = libproc.symbols.proc_pidinfo(
        pid,
        PROC_PIDTASKINFO,
        0n,
        ptr(taskInfo),
        taskInfo.byteLength,
      );
      if (got < 96) continue;
      const rss = Number(taskView.getBigUint64(8, true)); // pti_resident_size
      const cpuSec = // pti_total_user + pti_total_system
        (Number(taskView.getBigUint64(16, true)) +
          Number(taskView.getBigUint64(24, true))) *
        machToSec;

      // process start time: pbi_start_tvsec, at offset 120
      let elapsedSec = 0;
      const gotBsd = libproc.symbols.proc_pidinfo(
        pid,
        PROC_PIDTBSDINFO,
        0n,
        ptr(bsdInfo),
        bsdInfo.byteLength,
      );
      if (gotBsd >= 128) {
        elapsedSec = nowSec - Number(bsdView.getBigUint64(120, true));
      }

      const path = readCstr(
        libproc.symbols.proc_pidpath(pid, ptr(cstr), cstr.byteLength),
      );
      const name =
        procArgv0(pid)?.split("/").pop() ??
        readCstr(libproc.symbols.proc_name(pid, ptr(cstr), cstr.byteLength));
      procs.push({ pid, rss, cpuSec, elapsedSec, path, name: name ?? path ?? "?" });
    }
    return procs;
  };
}

// --- Process listing: Linux (/proc) ----------------------------------------

if (process.platform === "linux") {
  const CLK_TCK = 100; // USER_HZ, fixed on every mainstream architecture

  listAllProcesses = () => {
    const uptimeSec = Number.parseFloat(readFileSync("/proc/uptime", "utf8"));
    const procs = [];
    for (const entry of readdirSync("/proc")) {
      if (!/^\d+$/.test(entry)) continue;
      const pid = Number(entry);
      try {
        const status = readFileSync(`/proc/${pid}/status`, "utf8");
        const rssKb = Number(status.match(/^VmRSS:\s+(\d+) kB/m)?.[1] ?? 0);
        if (!rssKb) continue; // kernel thread

        // /proc/pid/stat: "pid (comm) state ..."; comm can contain spaces,
        // so split after the closing paren. utime/stime are fields 14/15,
        // starttime (ticks since boot) is field 22.
        const stat = readFileSync(`/proc/${pid}/stat`, "utf8");
        const f = stat.slice(stat.lastIndexOf(")") + 2).split(" ");
        const cpuSec = (Number(f[11]) + Number(f[12])) / CLK_TCK;
        const elapsedSec = uptimeSec - Number(f[19]) / CLK_TCK;

        let path = null;
        try {
          path = readlinkSync(`/proc/${pid}/exe`).replace(/ \(deleted\)$/, "");
        } catch {} // not ours to inspect

        const argv0 = readFileSync(`/proc/${pid}/cmdline`, "latin1").split(
          "\0",
        )[0];
        const name =
          argv0?.split("/").pop() ||
          status.match(/^Name:\s+(.+)$/m)?.[1] ||
          "?";
        procs.push({ pid, rss: rssKb * 1024, cpuSec, elapsedSec, path, name });
      } catch {} // process exited mid-scan
    }
    return procs;
  };
}

function listProcesses() {
  if (!listAllProcesses) {
    console.error(
      `error: unsupported platform: ${process.platform} (only macOS and Linux are supported)`,
    );
    process.exit(1);
  }
  let procs = listAllProcesses();
  if (filter) {
    procs = procs.filter((p) => p.name.toLowerCase().includes(filter));
  }
  return procs.sort((a, b) => b.rss - a.rss).slice(0, count);
}

// --- Binary scanning ------------------------------------------------------

// Read the string-bearing parts of a binary as decoded text windows,
// skipping machine-code ranges (strings can't live there) and holding
// only one chunk (plus a small overlap) in memory at a time.
// Note: chunked slice().arrayBuffer() reads, because slice().stream()
// hangs in Bun 1.3.
const SCAN_CHUNK = 4 * 1024 * 1024;

async function* textWindows(path, fileSize) {
  const skip = ((await codeRanges(path)) ?? []).sort(
    (a, b) => a.start - b.start,
  );
  const ranges = [];
  let pos = 0;
  for (const r of skip) {
    if (r.start > pos) ranges.push({ start: pos, end: r.start });
    pos = Math.max(pos, r.end);
  }
  if (pos < fileSize) ranges.push({ start: pos, end: fileSize });

  // latin1 maps bytes 1:1 to code points, so byte patterns match exactly
  const decoder = new TextDecoder("latin1");
  const file = Bun.file(path);
  for (const range of ranges) {
    let carry = "";
    for (let at = range.start; at < range.end; at += SCAN_CHUNK) {
      const buf = await file
        .slice(at, Math.min(at + SCAN_CHUNK, range.end))
        .arrayBuffer();
      const text = carry + decoder.decode(buf);
      yield { text, bytes: buf.byteLength };
      carry = text.slice(-CHUNK_OVERLAP);
    }
  }
}

// Return the first match for each named pattern.
async function scanStrings(path, patterns) {
  const file = Bun.file(path);
  if (!(await file.exists()) || file.size === 0) return {};
  const keys = Object.keys(patterns);
  const found = {};
  let scanned = 0;
  try {
    for await (const { text, bytes } of textWindows(path, file.size)) {
      for (const key of keys) {
        if (!found[key]) {
          const m = text.match(patterns[key]);
          if (m) found[key] = m;
        }
      }
      if (keys.every((key) => found[key])) break;
      scanned += bytes;
      if (scanned > MAX_SCAN_BYTES) break;
    }
  } catch {
    return {}; // unreadable (permissions)
  }
  return found;
}

// Read a byte range of a file without loading the rest.
async function readSlice(path, start, length) {
  try {
    const buf = await Bun.file(path)
      .slice(start, start + length)
      .arrayBuffer();
    return {
      view: new DataView(buf),
      strings: new TextDecoder("latin1").decode(buf),
    };
  } catch {
    return null;
  }
}

// --- Executable format parsing (linked libraries) --------------------------

// Ceiling for header-driven read sizes, so a corrupt header (huge
// sizeofcmds, phnum, filesz, strsz...) can't force a giant allocation.
const MAX_HEADER_READ = 4 * 1024 * 1024;
const clampRead = (n) => Math.min(n, MAX_HEADER_READ);

// Returns [{ name, version }] for every shared library the binary links
// against, reading only headers (a few KB). Returns null if the format is
// unknown, [] for a valid static binary.
async function parseBinaryDeps(path) {
  if (!path) return null;
  try {
    const head = await readSlice(path, 0, 64);
    if (!head || head.view.byteLength < 64) return null;
    const beMagic = head.view.getUint32(0, false);
    if (beMagic === 0x7f454c46) return await parseElfDeps(path, head);
    return await parseMachODeps(path, beMagic);
  } catch {
    return null; // corrupt/truncated header
  }
}

const MH_MAGIC_64 = 0xfeedfacf;
const MH_MAGIC_32 = 0xfeedface;
const FAT_MAGIC = 0xcafebabe;
const FAT_MAGIC_64 = 0xcafebabf;
const CPU_TYPE_ARM64 = 0x0100000c;
const LC_LOAD_DYLIB = 0xc;
const LC_LOAD_WEAK_DYLIB = 0x80000018;
const LC_REEXPORT_DYLIB = 0x8000001f;

function dylibVersion(v) {
  return `${v >>> 16}.${(v >>> 8) & 0xff}.${v & 0xff}`;
}

async function parseMachODeps(path, beMagic) {
  let bin = await readSlice(path, 0, 4096);
  if (!bin || bin.view.byteLength < 32) return null;

  // Universal (fat) binary: pick the arm64 slice, or the first one.
  let base = 0;
  if (beMagic === FAT_MAGIC || beMagic === FAT_MAGIC_64) {
    const is64 = beMagic === FAT_MAGIC_64;
    const archSize = is64 ? 32 : 20;
    const nArch = bin.view.getUint32(4, false);
    const slices = [];
    for (let i = 0; i < nArch && 8 + (i + 1) * archSize <= bin.view.byteLength; i++) {
      const at = 8 + i * archSize;
      slices.push({
        cputype: bin.view.getUint32(at, false),
        offset: is64
          ? Number(bin.view.getBigUint64(at + 8, false))
          : bin.view.getUint32(at + 8, false),
      });
    }
    if (slices.length === 0) return null;
    base = (slices.find((s) => s.cputype === CPU_TYPE_ARM64) ?? slices[0])
      .offset;
    bin = await readSlice(path, base, 4096);
    if (!bin || bin.view.byteLength < 32) return null;
  }

  const magic = bin.view.getUint32(0, true);
  if (magic !== MH_MAGIC_64 && magic !== MH_MAGIC_32) return null;
  const headerSize = magic === MH_MAGIC_64 ? 32 : 28;
  const ncmds = bin.view.getUint32(16, true);
  const sizeofcmds = bin.view.getUint32(20, true);

  // re-read if the load commands extend past the first 4KB
  if (headerSize + sizeofcmds > bin.view.byteLength) {
    bin = await readSlice(path, base, clampRead(headerSize + sizeofcmds));
    if (!bin) return null;
  }

  const deps = [];
  let lc = headerSize;
  for (let i = 0; i < ncmds && lc + 8 <= bin.view.byteLength; i++) {
    const cmd = bin.view.getUint32(lc, true);
    const cmdsize = bin.view.getUint32(lc + 4, true);
    if (cmdsize < 8) break;
    if ([LC_LOAD_DYLIB, LC_LOAD_WEAK_DYLIB, LC_REEXPORT_DYLIB].includes(cmd)) {
      const nameOffset = bin.view.getUint32(lc + 8, true);
      const current = bin.view.getUint32(lc + 16, true);
      const nameStart = lc + nameOffset;
      const nameEnd = bin.strings.indexOf("\0", nameStart);
      deps.push({
        name: bin.strings.slice(
          nameStart,
          nameEnd < 0 ? lc + cmdsize : nameEnd,
        ),
        version: dylibVersion(current),
      });
    }
    lc += cmdsize;
  }
  return deps;
}

const LC_SEGMENT_64 = 0x19;
const S_ATTR_CODE = 0x80000400; // PURE_INSTRUCTIONS | SOME_INSTRUCTIONS

const PT_LOAD = 1;
const PT_DYNAMIC = 2;
const PF_X = 1;
const PF_W = 2;
const DT_NEEDED = 1;
const DT_STRTAB = 5;
const DT_STRSZ = 10;

// 64-bit little-endian ELF only (x86_64, arm64).
async function parseElfDeps(path, head) {
  if (head.view.getUint8(4) !== 2 || head.view.getUint8(5) !== 1) return null;
  const phoff = Number(head.view.getBigUint64(0x20, true));
  const phentsize = head.view.getUint16(0x36, true);
  const phnum = head.view.getUint16(0x38, true);

  const ph = await readSlice(path, phoff, clampRead(phentsize * phnum));
  if (!ph) return null;
  let dynamic = null;
  const loads = [];
  for (let i = 0; i < phnum && (i + 1) * phentsize <= ph.view.byteLength; i++) {
    const at = i * phentsize;
    const type = ph.view.getUint32(at, true);
    const offset = Number(ph.view.getBigUint64(at + 0x08, true));
    const vaddr = Number(ph.view.getBigUint64(at + 0x10, true));
    const filesz = Number(ph.view.getBigUint64(at + 0x20, true));
    if (type === PT_DYNAMIC) dynamic = { offset, filesz };
    if (type === PT_LOAD) loads.push({ offset, vaddr, filesz });
  }
  if (!dynamic) return []; // statically linked

  const dyn = await readSlice(path, dynamic.offset, clampRead(dynamic.filesz));
  if (!dyn) return null;
  const needed = [];
  let strtabVaddr = null;
  let strsz = 0;
  for (let at = 0; at + 16 <= dyn.view.byteLength; at += 16) {
    const tag = Number(dyn.view.getBigInt64(at, true));
    const val = Number(dyn.view.getBigUint64(at + 8, true));
    if (tag === 0) break; // DT_NULL
    if (tag === DT_NEEDED) needed.push(val);
    if (tag === DT_STRTAB) strtabVaddr = val;
    if (tag === DT_STRSZ) strsz = val;
  }
  if (strtabVaddr === null || needed.length === 0) return [];

  // DT_STRTAB is a virtual address; map it to a file offset via PT_LOAD
  const seg = loads.find(
    (l) => strtabVaddr >= l.vaddr && strtabVaddr < l.vaddr + l.filesz,
  );
  if (!seg) return [];
  const strtab = await readSlice(
    path,
    seg.offset + (strtabVaddr - seg.vaddr),
    clampRead(strsz || 65536),
  );
  if (!strtab) return null;
  return needed.map((off) => {
    const end = strtab.strings.indexOf("\0", off);
    return {
      name: strtab.strings.slice(off, end < 0 ? undefined : end),
      version: null, // ELF DT_NEEDED has no version field
    };
  });
}

// --- Machine-code ranges (skipped when scanning for strings) ---------------

// Returns [{ start, end }] file ranges holding machine code, or null when
// the format is unknown (callers then scan the whole file).
async function codeRanges(path) {
  const head = await readSlice(path, 0, 64);
  if (!head || head.view.byteLength < 64) return null;
  const beMagic = head.view.getUint32(0, false);
  if (beMagic === 0x7f454c46) return elfCodeRanges(path, head);
  return machOCodeRanges(path, beMagic);
}

// Mach-O: sections flagged as instructions, across every fat slice.
async function machOCodeRanges(path, beMagic) {
  const bases = [];
  if (beMagic === FAT_MAGIC || beMagic === FAT_MAGIC_64) {
    const head = await readSlice(path, 0, 4096);
    if (!head) return null;
    const is64 = beMagic === FAT_MAGIC_64;
    const archSize = is64 ? 32 : 20;
    const nArch = head.view.getUint32(4, false);
    for (let i = 0; i < nArch && 8 + (i + 1) * archSize <= head.view.byteLength; i++) {
      const at = 8 + i * archSize;
      bases.push(
        is64
          ? Number(head.view.getBigUint64(at + 8, false))
          : head.view.getUint32(at + 8, false),
      );
    }
  } else {
    bases.push(0);
  }

  const ranges = [];
  for (const base of bases) {
    let bin = await readSlice(path, base, 4096);
    if (!bin || bin.view.byteLength < 32) continue;
    // 64-bit only; anything else is simply not skipped
    if (bin.view.getUint32(0, true) !== MH_MAGIC_64) continue;
    const ncmds = bin.view.getUint32(16, true);
    const sizeofcmds = bin.view.getUint32(20, true);
    if (32 + sizeofcmds > bin.view.byteLength) {
      bin = await readSlice(path, base, clampRead(32 + sizeofcmds));
      if (!bin) continue;
    }
    let lc = 32;
    for (let i = 0; i < ncmds && lc + 8 <= bin.view.byteLength; i++) {
      const cmd = bin.view.getUint32(lc, true);
      const cmdsize = bin.view.getUint32(lc + 4, true);
      if (cmdsize < 8) break;
      if (cmd === LC_SEGMENT_64) {
        const nsects = bin.view.getUint32(lc + 64, true);
        // section_64 structs (80 bytes) follow the segment command
        for (let s = 0; s < nsects && 72 + (s + 1) * 80 <= cmdsize; s++) {
          const at = lc + 72 + s * 80;
          const size = Number(bin.view.getBigUint64(at + 40, true));
          const offset = bin.view.getUint32(at + 48, true);
          const flags = bin.view.getUint32(at + 64, true);
          if (size > 0 && offset > 0 && flags & S_ATTR_CODE) {
            ranges.push({ start: base + offset, end: base + offset + size });
          }
        }
      }
      lc += cmdsize;
    }
  }
  return ranges;
}

// ELF: executable PT_LOAD segments — but only when read-only data has its
// own segment; old single-segment layouts keep .rodata next to the code.
async function elfCodeRanges(path, head) {
  if (head.view.getUint8(4) !== 2 || head.view.getUint8(5) !== 1) return null;
  const phoff = Number(head.view.getBigUint64(0x20, true));
  const phentsize = head.view.getUint16(0x36, true);
  const phnum = head.view.getUint16(0x38, true);
  const ph = await readSlice(path, phoff, clampRead(phentsize * phnum));
  if (!ph) return null;

  const loads = [];
  for (let i = 0; i < phnum && (i + 1) * phentsize <= ph.view.byteLength; i++) {
    const at = i * phentsize;
    if (ph.view.getUint32(at, true) !== PT_LOAD) continue;
    loads.push({
      flags: ph.view.getUint32(at + 4, true),
      offset: Number(ph.view.getBigUint64(at + 0x08, true)),
      filesz: Number(ph.view.getBigUint64(at + 0x20, true)),
    });
  }
  const hasRoSegment = loads.some((l) => !(l.flags & (PF_X | PF_W)));
  if (!hasRoSegment) return [];
  return loads
    .filter((l) => l.flags & PF_X && l.filesz > 0)
    .map((l) => ({ start: l.offset, end: l.offset + l.filesz }));
}

// --- Language signatures --------------------------------------------------

// All runtime signatures combined into one named-group alternation, so
// every chunk is scanned in a single regex pass instead of one per
// signature. The named group captures the version where one exists.
const SIGNATURES_RE = new RegExp(
  [
    // Go buildinfo header: 14-byte magic, ptrSize, flags, two pointer
    // fields, then (since Go 1.18) a uvarint length and the version
    "\\xff Go buildinf:[\\s\\S]{18}[\\s\\S]go(?<goVersion>\\d+\\.\\d+(?:\\.\\d+)?\\w*)",
    "(?<goBuildId>go\\.buildid)",
    "Bun v(?<bun>\\d+\\.\\d+\\.\\d+)",
    "(?<jvm>JNI_CreateJavaVM)", // any launcher hosting a JVM in-process
    "Electron/(?<electron>\\d+\\.\\d+\\.\\d+)",
    "node\\.js/v(?<node>\\d+\\.\\d+\\.\\d+)",
    "\\.NETCoreApp,Version=v(?<dotnetTfm>\\d+\\.\\d+)", // .NET apphost
    "(?<dotnet>hostfxr|hostpolicy)",
    "(?<rust>rust_panic|rust_begin_unwind|/rustc/)",
    "rustc version (?<rustVersion>\\d+\\.\\d+\\.\\d+)",
    "(?<graal>Substrate VM)", // GraalVM native-image
    "GraalVM (?:CE |EE )?(?<graalVersion>\\d+[\\d.]*\\d)",
    "(?<haskell>ghczmprim|GHC\\.IO\\.Exception)",
    "ghc-(?<haskellVersion>\\d+\\.\\d+\\.\\d+)",
    "(?<ocaml>OCAMLRUNPARAM)",
    "FPC (?<pascal>\\d+\\.\\d+[\\d.]*)", // Free Pascal embeds its version
    "(?<swift5>__swift5_)",
  ].join("|"),
  "g",
);

// Finding one of these ends the scan early: they carry a version and
// nothing that could still appear later would take precedence.
const DECISIVE = ["goVersion", "bun", "electron", "dotnetTfm"];

async function scanSignatures(path) {
  const file = Bun.file(path);
  if (!(await file.exists()) || file.size === 0) return {};
  const found = {};
  let scanned = 0;
  try {
    for await (const { text, bytes } of textWindows(path, file.size)) {
      SIGNATURES_RE.lastIndex = 0;
      let m;
      while ((m = SIGNATURES_RE.exec(text))) {
        for (const [key, value] of Object.entries(m.groups)) {
          if (value !== undefined) found[key] ??= value;
        }
      }
      if (DECISIVE.some((key) => found[key])) break;
      scanned += bytes;
      if (scanned > MAX_SCAN_BYTES) break;
    }
  } catch {
    return {}; // unreadable (permissions)
  }
  return found;
}

// Interpreters, by basename: version comes from the resolved path
// (e.g. /opt/homebrew/Cellar/node/26.0.0/bin/node) or embedded strings.
const INTERPRETERS = [
  [/^node$/, "Node.js", /node\.js\/v(\d+\.\d+\.\d+)/i],
  [/^bun$/, "Bun", /Bun v(\d+\.\d+\.\d+)/],
  [/^deno$/, "Deno", /deno\/(\d+\.\d+\.\d+)/],
  [/^java$/, "Java", /jdk[-/](\d+[\d.]*)/i],
  [/^dotnet$/, ".NET", /\.NETCoreApp,Version=v(\d+\.\d+)/],
  [/^beam(\.smp)?$/, "Erlang", /Erlang\/OTP[ -]?(\d+)/],
  [/^julia$/, "Julia", /julia version (\d+\.\d+\.\d+)/],
  [/^lua(jit)?[\d.]*$/, "Lua", /Lua(?:JIT)? (\d+\.\d+[\d.]*)/i],
  [/^ruby(\d|$)/, "Ruby", /ruby (\d+\.\d+\.\d+)/],
  [/^perl(5|$)/, "Perl", /perl5?[/ ]v?(5\.\d+(\.\d+)?)/],
  [/^php(\d|$)/, "PHP", /PHP\/(\d+\.\d+\.\d+)/],
  // Py_GetVersion() banner: "3.12.12 (main, Oct  8 2025, ...) [GCC ...]"
  [/^[Pp]ython(\d(\.\d+)?)?$/, "Python", /(\d+\.\d+\.\d+) \((?:main|default)/],
];

// Most specific dotted version anywhere in the path, e.g. Cellar/node/26.0.0
function versionFromPath(path) {
  const matches = path.match(/\d+\.\d+(\.\d+)*/g) ?? [];
  return matches.sort((a, b) => b.split(".").length - a.split(".").length)[0];
}

// Some interpreter executables are thin launchers (Homebrew's node is 67KB)
// whose version string lives in the runtime library they link against.
const RUNTIME_LIBS = {
  "Node.js": "libnode",
  Ruby: "libruby",
  Python: "python", // libpython3.12.so or Python3.framework
  Perl: "libperl",
};

async function runtimeLibVersion(exePath, lang, versionRe) {
  const libName = RUNTIME_LIBS[lang];
  if (!libName) return null;
  const dep = ((await parseBinaryDeps(exePath)) ?? []).find((d) =>
    d.name.toLowerCase().includes(libName),
  );
  if (!dep) return null;
  const exeDir = exePath.slice(0, exePath.lastIndexOf("/"));
  const base = dep.name.split("/").pop();
  const candidates = [
    ...(dep.name.startsWith("/") ? [dep.name] : []), // absolute install name
    `${exeDir}/${base}`, // common rpath locations
    `${exeDir}/../lib/${base}`,
  ];
  for (const candidate of candidates) {
    if (await Bun.file(candidate).exists()) {
      const found = await scanStrings(candidate, { v: versionRe });
      if (found.v) return found.v[1];
    }
  }
  return null;
}

// Java runtimes ship a "release" file with JAVA_VERSION="21.0.2". Look for
// it near the executable, covering plain JDKs (release above bin/java),
// JetBrains apps (jbr/), and jpackage apps (runtime/). No exec needed.
const JAVA_RELEASE_LOCATIONS = [
  "release",
  "jbr/Contents/Home/release",
  "jbr/release",
  "jre/Contents/Home/release",
  "jre/release",
  "runtime/Contents/Home/release",
  "lib/runtime/release",
];

async function javaReleaseVersion(exePath) {
  let dir = exePath;
  for (let i = 0; i < 6 && dir.includes("/"); i++) {
    dir = dir.slice(0, dir.lastIndexOf("/"));
    for (const location of JAVA_RELEASE_LOCATIONS) {
      const release = Bun.file(`${dir}/${location}`);
      if (await release.exists()) {
        try {
          const m = (await release.text()).match(/JAVA_VERSION="([^"]+)"/);
          if (m) return m[1];
        } catch {}
      }
    }
  }
  return null;
}

// .NET: an apphost keeps its target framework in the adjacent
// runtimeconfig.json; the dotnet muxer ships runtimes under shared/.
function dotnetRuntimeVersion(exePath) {
  try {
    const config = readFileSync(`${exePath}.runtimeconfig.json`, "utf8");
    const m =
      config.match(/"tfm":\s*"net(\d+\.\d+)"/) ??
      config.match(/"version":\s*"(\d+\.\d+)[^"]*"/);
    if (m) return m[1];
  } catch {}
  try {
    const dir = exePath.slice(0, exePath.lastIndexOf("/"));
    const versions = readdirSync(`${dir}/shared/Microsoft.NETCore.App`);
    return (
      versions.sort((a, b) =>
        a.localeCompare(b, undefined, { numeric: true }),
      ).at(-1) ?? null
    );
  } catch {}
  return null;
}

// Runtime libraries that identify the language of an otherwise native
// binary; the version often rides in the library name or its path.
const DEP_LANGS = [
  ["libjvm", "Java"],
  ["libpython", "Python"],
  ["Python.framework", "Python"],
  ["Python3.framework", "Python"],
  ["libruby", "Ruby"],
  ["libperl", "Perl"],
  ["libmono", ".NET (Mono)"],
  ["monosgen", ".NET (Mono)"],
  ["libjulia", "Julia"],
  ["libluajit", "Lua (LuaJIT)"],
  ["liblua", "Lua"],
  ["libR.", "R"],
  ["libgo.so", "Go"], // gccgo
];

// The Electron version is not in the macOS helper executable; it lives in
// the app bundle's Electron Framework binary. Walk up from the exe.
async function electronFrameworkVersion(exePath) {
  let dir = exePath;
  while (dir.includes("/")) {
    dir = dir.slice(0, dir.lastIndexOf("/"));
    const fw = `${dir}/Frameworks/Electron Framework.framework/Versions/A/Electron Framework`;
    if (await Bun.file(fw).exists()) {
      const found = await scanStrings(fw, { v: /Electron\/(\d+\.\d+\.\d+)/ });
      return found.v?.[1] ?? null;
    }
  }
  return null;
}

async function detectLanguage(path) {
  if (!path) return { lang: "?", version: null };
  let realPath = path;
  try {
    realPath = realpathSync(path);
  } catch {}
  const base = realPath.split("/").pop() ?? realPath;

  const interp = INTERPRETERS.find(([re]) => re.test(base));
  if (interp) {
    const [, lang, stringsRe] = interp;
    let version = versionFromPath(realPath);
    // a partial path version (python3.12) may have a fuller embedded one
    if (!version || version.split(".").length < 3) {
      const scanned =
        (await scanStrings(realPath, { v: stringsRe })).v?.[1] ??
        (await runtimeLibVersion(realPath, lang, stringsRe));
      if (scanned && (!version || scanned.startsWith(version))) {
        version = scanned;
      } else if (version) {
        // last resort: the exact patch version as a standalone
        // NUL-delimited string (how CPython stores PY_VERSION)
        const exact = new RegExp(
          `\\0(${version.replace(/\./g, "\\.")}\\.\\d+)\\0`,
        );
        version =
          (await scanStrings(realPath, { v: exact })).v?.[1] ??
          (await runtimeLibVersion(realPath, lang, exact)) ??
          version;
      }
    }
    if (!version && lang === "Java") {
      version = await javaReleaseVersion(realPath);
    }
    if (!version && lang === ".NET") {
      version = dotnetRuntimeVersion(realPath);
    }
    return { lang, version };
  }

  const sig = await scanSignatures(realPath);
  if (sig.goVersion) return { lang: "Go", version: sig.goVersion };
  if (sig.goBuildId) return { lang: "Go", version: null };
  if (sig.bun) return { lang: "Bun", version: sig.bun };
  // before Rust: JetBrains-style native launchers host a JVM in-process,
  // and the Java workload is more telling than the launcher's language
  if (sig.jvm) {
    return { lang: "Java", version: await javaReleaseVersion(realPath) };
  }
  // Electron/Node before Rust (Chromium ships Rust code), and Electron
  // before Node (Electron binaries embed both version strings)
  if (sig.electron) return { lang: "Electron", version: sig.electron };
  if (sig.node) return { lang: "Node.js", version: sig.node };
  if (sig.dotnetTfm) return { lang: ".NET", version: sig.dotnetTfm };
  if (sig.dotnet) {
    return { lang: ".NET", version: dotnetRuntimeVersion(realPath) };
  }
  if (sig.rust) return { lang: "Rust", version: sig.rustVersion ?? null };
  if (sig.graal) {
    return { lang: "Java (GraalVM)", version: sig.graalVersion ?? null };
  }
  if (sig.haskell) {
    return { lang: "Haskell", version: sig.haskellVersion ?? null };
  }
  if (sig.ocaml) return { lang: "OCaml", version: null };
  if (sig.pascal) return { lang: "Pascal", version: sig.pascal };

  const deps = (await parseBinaryDeps(realPath)) ?? [];
  const find = (s) => deps.find((d) => d.name.includes(s));
  const realVersion = (d) => (d?.version === "0.0.0" ? null : d?.version);

  const electron = find("Electron Framework");
  if (electron) {
    return {
      lang: "Electron",
      version:
        realVersion(electron) ?? (await electronFrameworkVersion(realPath)),
    };
  }

  for (const [marker, lang] of DEP_LANGS) {
    const dep = find(marker);
    if (!dep) continue;
    let version = realVersion(dep) ?? versionFromPath(dep.name) ?? null;
    if (lang === "Java") {
      version = (await javaReleaseVersion(realPath)) ?? version;
    }
    return { lang, version };
  }

  const swift = find("libswiftCore");
  if (swift || sig.swift5) {
    return { lang: "Swift", version: realVersion(swift) };
  }
  if (find("libobjc.")) return { lang: "Objective-C", version: null };
  if (find("libc++.") || find("libstdc++.")) {
    return { lang: "C++", version: null };
  }
  if (deps.length > 0) return { lang: "C/native", version: null };

  return { lang: "?", version: null };
}

// --- Output ---------------------------------------------------------------

function formatMem(bytes) {
  const mb = bytes / 1024 / 1024;
  return mb >= 1024 ? `${(mb / 1024).toFixed(2)} GB` : `${mb.toFixed(0)} MB`;
}

// Helpers of the same app share a binary; detect each one only once.
const detectCache = new Map();
function detectLanguageCached(exe) {
  if (!detectCache.has(exe)) {
    detectCache.set(
      exe,
      detectLanguage(exe).catch(() => ({ lang: "?", version: null })),
    );
  }
  return detectCache.get(exe);
}

// %CPU: like top, the delta between two samples (watch refreshes); on the
// first sample it falls back to the average since the process started.
const cpuSamples = new Map(); // pid -> { cpuSec, atMs }
function cpuPercent(p) {
  const now = Date.now();
  const prev = cpuSamples.get(p.pid);
  cpuSamples.set(p.pid, { cpuSec: p.cpuSec, atMs: now });
  if (prev && now - prev.atMs > 200) {
    // clamp: cpuSec can drop after PID reuse, yielding a negative delta
    return Math.max(0, ((p.cpuSec - prev.cpuSec) / ((now - prev.atMs) / 1000)) * 100);
  }
  return p.elapsedSec > 0 ? (p.cpuSec / p.elapsedSec) * 100 : 0;
}

const cols = [
  ["pid", "PID"],
  ["mem", "MEM"],
  ["cpu", "CPU"],
  ["name", "NAME"],
  ["lang", "LANG"],
  ["version", "VERSION"],
];

async function renderTable() {
  const procs = listProcesses();

  // drop samples of processes that left the table, so the map stays small
  const current = new Set(procs.map((p) => p.pid));
  for (const pid of cpuSamples.keys()) {
    if (!current.has(pid)) cpuSamples.delete(pid);
  }

  const rows = await Promise.all(
    procs.map(async (p) => {
      const { lang, version } = await detectLanguageCached(p.path);
      return {
        pid: String(p.pid),
        mem: formatMem(p.rss),
        cpu: `${cpuPercent(p).toFixed(1)}%`,
        name: p.name.slice(0, 36),
        lang,
        version: version ?? "-",
      };
    }),
  );

  const widths = cols.map(([key, header]) =>
    Math.max(header.length, ...rows.map((r) => r[key].length)),
  );
  const line = (vals) => vals.map((v, i) => v.padEnd(widths[i])).join("  ");

  return [
    `\x1b[1m${line(cols.map(([, h]) => h))}\x1b[0m`,
    ...rows.map((r) => line(cols.map(([key]) => r[key]))),
  ].join("\n");
}

if (watchSecs === null) {
  console.log(await renderTable());
} else {
  // Draw on the alternate screen buffer (like top/htop) so refreshes
  // replace in place instead of piling up in the scrollback, and the
  // original terminal contents come back on exit.
  process.stdout.write("\x1b[?1049h\x1b[H");
  // leave the alternate screen on any exit (clean quit, signal, or crash)
  process.on("exit", () => process.stdout.write("\x1b[?1049l"));
  process.on("SIGINT", () => process.exit(0));
  process.on("SIGTERM", () => process.exit(0));

  while (true) {
    const table = await renderTable();
    const footer = `\x1b[2mevery ${watchSecs}s  ${new Date().toLocaleTimeString()}  Ctrl+C to quit\x1b[0m`;
    // home the cursor, overdraw, then erase whatever is left below
    process.stdout.write(`\x1b[H${table}\n\n${footer}\x1b[J`);
    await Bun.sleep(watchSecs * 1000);
  }
}
