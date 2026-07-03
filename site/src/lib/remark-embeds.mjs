import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/* Turns a bare URL on its own line into an embed:
     https://youtu.be/<id>                     -> YouTube player (nocookie)
     https://speakerdeck.com/<user>/<deck>     -> Speaker Deck player
   Speaker Deck player IDs come from src/data/speakerdeck.json; unknown decks
   are resolved via the oEmbed API at build time and appended to the file
   (commit it so builds stay offline). */

const CACHE_PATH = fileURLToPath(new URL('../data/speakerdeck.json', import.meta.url));

const YOUTUBE = /^https?:\/\/(?:www\.)?(?:youtube(?:-nocookie)?\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([\w-]{6,})/;
const SPEAKERDECK = /^https?:\/\/speakerdeck\.com\/[\w-]+\/[\w-]+\/?$/;

function escapeAttr(value) {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

function youtubeEmbed(id) {
  return (
    `<iframe src="https://www.youtube-nocookie.com/embed/${id}" title="YouTube video player" ` +
    'frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; ' +
    'picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>'
  );
}

function speakerdeckEmbed(deck) {
  return (
    `<iframe src="https://speakerdeck.com/player/${deck.id}" ` +
    `title="${escapeAttr(deck.title)} slides" frameborder="0" allowfullscreen></iframe>`
  );
}

async function resolveDeck(url, cache) {
  const key = url.replace(/\/$/, '');
  if (cache[key]) return cache[key];
  const res = await fetch(`https://speakerdeck.com/oembed.json?url=${encodeURIComponent(key)}`);
  if (!res.ok) throw new Error(`Speaker Deck oEmbed failed for ${key}: HTTP ${res.status}`);
  const data = await res.json();
  const id = data.html?.match(/player\/([0-9a-f]+)/)?.[1];
  if (!id) throw new Error(`No player id in Speaker Deck oEmbed response for ${key}`);
  cache[key] = { id, title: data.title ?? 'Presentation' };
  writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2) + '\n');
  return cache[key];
}

/* A paragraph that holds nothing but an autolinked URL. */
function bareUrl(node) {
  if (node.type !== 'paragraph' || node.children.length !== 1) return null;
  const link = node.children[0];
  if (link.type !== 'link' || link.children.length !== 1) return null;
  const text = link.children[0];
  if (text.type !== 'text' || text.value.trim() !== link.url.trim()) return null;
  return link.url.trim();
}

export default function remarkEmbeds() {
  return async (tree) => {
    const targets = [];
    const walk = (node) => {
      for (const child of node.children ?? []) {
        const url = bareUrl(child);
        if (url && (YOUTUBE.test(url) || SPEAKERDECK.test(url))) targets.push({ node: child, url });
        else walk(child);
      }
    };
    walk(tree);
    if (targets.length === 0) return;

    const cache = JSON.parse(readFileSync(CACHE_PATH, 'utf8'));
    for (const target of targets) {
      const youtube = target.url.match(YOUTUBE);
      const html = youtube
        ? youtubeEmbed(youtube[1])
        : speakerdeckEmbed(await resolveDeck(target.url, cache));
      target.node.type = 'html';
      target.node.value = html;
      delete target.node.children;
    }
  };
}
