#!/usr/bin/env node
/**
 * 把站点里的占位地址 https://USERNAME.github.io/REPO 换成真实 GitHub Pages 地址。
 *
 * 用法（在站点根目录执行）：
 *   node tools/set-site-url.mjs --user 你的用户名 --repo 仓库名
 *   node tools/set-site-url.mjs --user 你的用户名 --repo 你的用户名.github.io
 *   node tools/set-site-url.mjs --user 你的用户名 --repo 仓库名 --dry-run
 *
 * 只改 .html / .xml / .txt / .md，跳过 video、hero、tests 与 .git。
 * 运行后会自动检查 canonical / og:url / sitemap 是否全部指向新地址。
 */
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const ROOT = path.resolve(import.meta.dirname, '..');
const args = process.argv.slice(2);
function arg(name) {
  const i = args.indexOf('--' + name);
  return i >= 0 ? args[i + 1] : '';
}
const dryRun = args.includes('--dry-run');
const user = arg('user').trim();
const repo = arg('repo').trim();

if (!/^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/.test(user)) {
  console.error('用户名不合法。GitHub 用户名只能是字母、数字、连字符，且不能以连字符开头/结尾。');
  process.exit(2);
}
if (!/^[A-Za-z0-9._-]{1,100}$/.test(repo)) {
  console.error('仓库名不合法。只能包含字母、数字、点、下划线、连字符。');
  process.exit(2);
}

const isUserSite = repo.toLowerCase() === `${user.toLowerCase()}.github.io`;
const base = isUserSite
  ? `https://${user}.github.io/`
  : `https://${user}.github.io/${repo}/`;
const token = 'https://USERNAME.github.io/REPO';

const SKIP_DIRS = new Set(['.git', 'video', 'hero', 'tests', '_离线归档-原图']);
const EXTS = new Set(['.html', '.xml', '.txt', '.md']);

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.') && entry.name !== '.nojekyll') continue;
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) walk(p, out);
    } else if (EXTS.has(path.extname(entry.name).toLowerCase())) {
      out.push(p);
    }
  }
  return out;
}

const files = walk(ROOT);
let changed = 0, occurrences = 0;
for (const p of files) {
  const before = fs.readFileSync(p, 'utf8');
  if (!before.includes(token)) continue;
  const n = before.split(token).length - 1;
  const after = before.split(token).join(base.slice(0, -1));
  if (!dryRun) fs.writeFileSync(p, after, 'utf8');
  changed++; occurrences += n;
  console.log(`${dryRun ? '[dry-run] ' : ''}${path.relative(ROOT, p).padEnd(42)} ${n} 处`);
}

console.log(`\n${dryRun ? '将修改' : '已修改'} ${changed} 个文件，共 ${occurrences} 处。`);
console.log(`站点地址：${base}`);

// ---------- 验证 ----------
if (dryRun) {
  console.log('\n[dry-run] 未写入文件，跳过验证。');
  process.exit(0);
}
const report = [];
for (const rel of ['index.html', 'database.html', ...fs.readdirSync(path.join(ROOT, 'themes')).filter(f => f.endsWith('.html')).map(f => 'themes/' + f)]) {
  const p = path.join(ROOT, rel);
  if (!fs.existsSync(p)) continue;
  const html = fs.readFileSync(p, 'utf8');
  const canon = (html.match(/<link rel="canonical" href="([^"]*)"/) || [])[1] || '';
  const ogUrl = (html.match(/<meta property="og:url" content="([^"]*)"/) || [])[1] || '';
  const ok = canon.startsWith(base) && ogUrl.startsWith(base);
  report.push({ rel, canon, ogUrl, ok });
}
const bad = report.filter(r => !r.ok);
console.log('\ncanonical / og:url 检查：');
for (const r of report) console.log(`  ${r.ok ? 'OK  ' : 'FAIL'} ${r.rel.padEnd(30)} ${r.canon}`);

const sitemap = fs.readFileSync(path.join(ROOT, 'sitemap.xml'), 'utf8');
const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);
const badLocs = locs.filter(u => !u.startsWith(base));
const robots = fs.readFileSync(path.join(ROOT, 'robots.txt'), 'utf8');

console.log(`\nsitemap：${locs.length} 条，指向新地址 ${locs.length - badLocs.length} 条`);
if (badLocs.length) badLocs.forEach(u => console.log('  FAIL ' + u));
console.log(`robots：${robots.includes(`Sitemap: ${base}sitemap.xml`) ? 'OK' : 'FAIL'} Sitemap 行`);

const leftovers = [];
for (const p of files) {
  const s = fs.readFileSync(p, 'utf8');
  if (s.includes('USERNAME.github.io') || s.includes('/REPO/')) leftovers.push(path.relative(ROOT, p));
}
if (leftovers.length) {
  console.log('\n仍含占位符的文件：');
  leftovers.forEach(f => console.log('  ' + f));
}

if (bad.length || badLocs.length || leftovers.length) process.exitCode = 1;
