import { cpSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();
const inputDir = path.join(repoRoot, 'docs/blog/posts');
const outputDir = path.join(repoRoot, 'site/src/content/blog');
const urlsPath = path.join(repoRoot, 'scripts/urls.txt');

const postFiles = readdirSync(inputDir)
  .filter((name) => name.endsWith('.md'))
  .sort();

const urlPaths = new Set(
  readFileSync(urlsPath, 'utf8')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => /^\/blog\/\d{4}\/[^/]+\/$/.test(line)),
);

function splitFrontmatter(filePath, content) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!match) {
    throw new Error(`${filePath}: missing YAML frontmatter`);
  }

  return {
    frontmatter: match[1].replace(/\r\n/g, '\n'),
    body: content.slice(match[0].length).replace(/\r\n/g, '\n'),
  };
}

function getRequiredLine(filePath, frontmatter, key, pattern) {
  const line = frontmatter
    .split('\n')
    .find((item) => item.match(new RegExp(`^${key}:`)));
  const match = line?.match(pattern);
  if (!match) {
    throw new Error(`${filePath}: missing or invalid ${key}`);
  }
  return match[1];
}

function getBlock(filePath, frontmatter, key) {
  const lines = frontmatter.split('\n');
  const start = lines.findIndex((line) => line.startsWith(`${key}:`));
  if (start === -1) {
    throw new Error(`${filePath}: missing ${key} block`);
  }

  let end = start + 1;
  while (end < lines.length && !/^[A-Za-z0-9_-]+:/.test(lines[end])) {
    end += 1;
  }

  return lines.slice(start, end).join('\n');
}

function getOptionalScalar(frontmatter, key) {
  const line = frontmatter
    .split('\n')
    .find((item) => item.match(new RegExp(`^${key}:`)));
  if (!line) {
    return undefined;
  }

  const value = line.slice(line.indexOf(':') + 1).trim();
  const quoted = value.match(/^(['"])(.*)\1$/);
  return quoted ? quoted[2] : value;
}

function slugify(title) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9 -]/g, '')
    .replace(/ /g, '-');
}

function escapeDoubleQuoted(value) {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function removeTitle(filePath, body) {
  const lines = body.split('\n');
  const titleIndex = lines.findIndex((line) => line.startsWith('# '));
  if (titleIndex === -1) {
    throw new Error(`${filePath}: missing H1 title`);
  }

  const title = lines[titleIndex].slice(2).trim();
  let deleteCount = 1;
  while (lines[titleIndex + deleteCount] === '') {
    deleteCount += 1;
  }
  lines.splice(titleIndex, deleteCount);

  return {
    title,
    body: lines.join('\n'),
  };
}

function rewriteBody(body) {
  return body
    .replaceAll('{% raw %}', '')
    .replaceAll('{% endraw %}', '')
    .replace(/\]\(assets\//g, '](/blog/assets/')
    .replace(/\]\(presentations\//g, '](/blog/presentations/')
    .replace(/src="assets\//g, 'src="/blog/assets/')
    .replace(/src="presentations\//g, 'src="/blog/presentations/')
    .replace(/src='assets\//g, "src='/blog/assets/")
    .replace(/src='presentations\//g, "src='/blog/presentations/")
    .replace(/!\[([^\]\n]*)\]\(([^)\n]+)\)\{ width="([^"\n]+)" \}/g, (_, alt, src, width) => {
      return `<img src="${escapeDoubleQuoted(src)}" alt="${escapeDoubleQuoted(alt)}" width="${escapeDoubleQuoted(width)}">`;
    });
}

function copyDir(source, destination) {
  mkdirSync(path.dirname(destination), { recursive: true });
  cpSync(source, destination, {
    recursive: true,
    force: true,
    filter: (sourcePath) => path.basename(sourcePath) !== '.DS_Store',
  });
}

const posts = [];
const slugMismatches = [];
const admonitionFiles = [];

for (const fileName of postFiles) {
  const inputPath = path.join(inputDir, fileName);
  const input = readFileSync(inputPath, 'utf8');
  const { frontmatter, body } = splitFrontmatter(inputPath, input);
  const date = getRequiredLine(inputPath, frontmatter, 'date', /^date:\s*([0-9]{4}-[0-9]{2}-[0-9]{2})\s*$/);
  const year = date.slice(0, 4);
  const descriptionBlock = getBlock(inputPath, frontmatter, 'description');
  const categoriesBlock = getBlock(inputPath, frontmatter, 'categories');
  const { title, body: bodyWithoutTitle } = removeTitle(inputPath, body);
  const slug = getOptionalScalar(frontmatter, 'slug') ?? slugify(title);
  const expectedUrl = `/blog/${year}/${slug}/`;

  if (!urlPaths.has(expectedUrl)) {
    slugMismatches.push(`${fileName}: ${expectedUrl}`);
  }

  const transformedBody = rewriteBody(bodyWithoutTitle);
  if (transformedBody.includes('!!!')) {
    admonitionFiles.push(fileName);
  }

  const output = [
    '---',
    `title: "${escapeDoubleQuoted(title)}"`,
    descriptionBlock,
    `date: ${date}`,
    `slug: ${slug}`,
    categoriesBlock,
    '---',
  ].join('\n') + transformedBody;

  posts.push({
    fileName,
    outputPath: path.join(outputDir, fileName),
    output,
  });
}

if (slugMismatches.length > 0) {
  console.log(`Files written: 0 (aborted)`);
  console.log(`Slug verification: FAILED (${postFiles.length - slugMismatches.length}/${postFiles.length} URLs matched scripts/urls.txt)`);
  console.log('MkDocs admonitions needing manual conversion:');
  for (const fileName of admonitionFiles) {
    console.log(`- ${fileName}`);
  }
  console.log('Slug mismatches:');
  for (const mismatch of slugMismatches) {
    console.log(`- ${mismatch}`);
  }
  process.exit(1);
}

mkdirSync(outputDir, { recursive: true });
for (const post of posts) {
  writeFileSync(post.outputPath, post.output, 'utf8');
}

copyDir(path.join(inputDir, 'assets'), path.join(repoRoot, 'site/public/blog/assets'));
copyDir(path.join(inputDir, 'presentations'), path.join(repoRoot, 'site/public/blog/presentations'));

console.log(`Files written: ${posts.length}`);
for (const post of posts) {
  console.log(`- ${path.relative(repoRoot, post.outputPath)}`);
}
console.log(`Slug verification: OK (${posts.length}/${posts.length} URLs matched scripts/urls.txt)`);
console.log('Copied directories:');
console.log('- site/public/blog/assets');
console.log('- site/public/blog/presentations');
console.log(`MkDocs admonitions needing manual conversion: ${admonitionFiles.length}`);
for (const fileName of admonitionFiles) {
  console.log(`- ${fileName}`);
}
