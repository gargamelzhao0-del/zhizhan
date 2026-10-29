// Preserve the named mobile library byte-for-byte. Never rebuild or edit the source here.
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { parse } from 'parse5';
const root = path.resolve(import.meta.dirname, '..');
const source = path.resolve(process.env.ZHIZHAN_MOBILE_LIBRARY || 'C:/Users/Administrator/Documents/work/手机端书库');
const destination = path.join(root, 'public/original-library');
const check = process.argv.includes('--check');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const versionBytes = await fs.readFile(path.join(source, 'content-version.json'));
const sourceVersion = JSON.parse(versionBytes);
const catalog = JSON.parse(await fs.readFile(path.join(root, 'content/textbooks/catalog.json'), 'utf8'));
const files = [], books = [], downloads = {};
for (const [relative, expected] of Object.entries(sourceVersion.public_hashes)) {
  if (path.isAbsolute(relative) || relative.split(/[\\/]/).some(s => s === '..') || relative.includes('\\')) throw Error(`Invalid original path: ${relative}`);
  const bytes = await fs.readFile(path.join(source, relative));
  if (sha(bytes) !== expected) throw Error(`Original source changed without updating its manifest: ${relative}`);
  const target = path.join(destination, relative);
  if (check) {
    if (sha(await fs.readFile(target)) !== expected) throw Error(`Original copy differs: ${relative}`);
  } else {
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, bytes);
  }
  files.push({ path: relative, bytes: bytes.length, sha256: expected });
  // Capacitor routes extensionless paths to the application shell. Keep an
  // additional, byte-identical download URL for Makefile, LICENSE, etc.
  if (!path.extname(relative)) {
    const alias = `downloads/${expected}.bin`;
    downloads[relative] = alias;
    if (check) {
      if (sha(await fs.readFile(path.join(destination, alias))) !== expected) throw Error(`Download alias differs: ${relative}`);
    } else {
      await fs.mkdir(path.join(destination, 'downloads'), { recursive: true });
      await fs.writeFile(path.join(destination, alias), bytes);
    }
  }
}
const walk = (node, fn) => { fn(node); (node.childNodes || []).forEach(n => walk(n, fn)); };
const attr = (node, key) => node.attrs?.find(a => a.name === key)?.value;
const plain = node => node.nodeName === '#text' ? node.value : (node.childNodes || []).map(plain).join('');
for (const book of catalog.books) {
  const relative = `books/${book.id}.html`, entry = files.find(f => f.path === relative);
  if (!entry) throw Error(`Original book missing: ${book.id}`);
  const document = parse(await fs.readFile(path.join(source, relative), 'utf8'));
  let chapters;
  walk(document, node => { if (attr(node, 'id') === 'mChapters') chapters = JSON.parse(plain(node)); });
  if (!chapters?.length) throw Error(`Original directory missing: ${book.id}`);
  books.push({ id: book.id, shelfId: book.shelfId, name: book.name, ...entry,
    chapters: chapters.map(c => ({ id: c.id, title: c.title })) });
}
const manifest = { source: source.replaceAll('\\', '/'), sourceManifestSha256: sha(versionBytes), books, files, downloads };
const target = path.join(root, 'content/original-library.json');
if (check) {
  if (JSON.stringify(JSON.parse(await fs.readFile(target, 'utf8'))) !== JSON.stringify(manifest)) throw Error('Original library index is stale');
} else {
  await fs.writeFile(target, JSON.stringify(manifest, null, 2) + '\n');
  await fs.writeFile(path.join(destination, 'content-version.json'), versionBytes);
}
console.log(`${check ? 'Verified' : 'Bundled'} ${books.length} original books and ${files.length} public files, unchanged from the mobile library.`);
