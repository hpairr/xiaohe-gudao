#!/usr/bin/env node
/**
 * 上线前静态自查：本地资源是否存在、SEO 标签是否齐全、有没有残留占位符。
 * 用法（在任意目录）：node tools/check-site.mjs
 * 退出码 0 = 通过；1 = 有需要修的问题。
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const pages = [
  'index.html',
  'database.html',
  '404.html',
  ...fs.readdirSync(path.join(ROOT, 'themes')).filter(f => f.endsWith('.html')).sort().map(f => 'themes/' + f),
];

const skip = /^(?:https?:|data:|mailto:|tel:|javascript:|#|\/\/|%23)/i;
const placeholder = /USERNAME|REPO\//;

const problems = [];
const rows = [];

for (const rel of pages) {
  const file = path.join(ROOT, rel);
  const html = fs.readFileSync(file, 'utf8');
  const dir = path.dirname(file);
  const refs = new Set();
  for (const m of html.matchAll(/\b(?:href|src|poster)\s*=\s*"([^"]*)"/gi)) refs.add(m[1]);
  for (const m of html.matchAll(/\bsrcset\s*=\s*"([^"]*)"/gi)) {
    for (const part of m[1].split(',')) {
      const u = part.trim().split(/\s+/)[0];
      if (u) refs.add(u);
    }
  }
  for (const m of html.matchAll(/url\(\s*['"]?([^'")]+)['"]?\s*\)/gi)) refs.add(m[1]);

  let checked = 0, missing = 0;
  for (const raw of refs) {
    const u = raw.trim();
    if (!u || skip.test(u) || /\$\{|\+'|\+"|%23/.test(u)) continue;
    if (/^https?:/i.test(u)) continue;
    const target = path.resolve(dir, decodeURI(u.split('#')[0].split('?')[0]));
    if (!target.startsWith(ROOT)) continue;
    checked++;
    if (!fs.existsSync(target)) {
      missing++;
      problems.push(`${rel}: 缺文件 ${u}`);
    }
  }

  const title = (html.match(/<title>([\s\S]*?)<\/title>/) || [])[1]?.trim() || '';
  const desc = (html.match(/<meta\s+name="description"\s+content="([^"]*)"/i) || [])[1] || '';
  const canon = (html.match(/<link\s+rel="canonical"\s+href="([^"]*)"/i) || [])[1] || '';
  const ogTitle = (html.match(/<meta\s+property="og:title"\s+content="([^"]*)"/i) || [])[1] || '';
  const ogImage = (html.match(/<meta\s+property="og:image"\s+content="([^"]*)"/i) || [])[1] || '';
  const lang = (html.match(/<html\b[^>]*\blang="([^"]*)"/i) || [])[1] || '';
  const h1 = [...html.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi)].length;
  const imgs = [...html.matchAll(/<img\b[^>]*>/gi)].map(m => m[0]);
  const noAlt = imgs.filter(t => !/\balt\s*=/.test(t)).length;

  if (!title) problems.push(`${rel}: 缺 <title>`);
  if (!desc) problems.push(`${rel}: 缺 description`);
  if (rel !== '404.html' && !canon) problems.push(`${rel}: 缺 canonical`);
  if (rel !== '404.html' && !ogTitle) problems.push(`${rel}: 缺 og:title`);
  if (rel !== '404.html' && !ogImage) problems.push(`${rel}: 缺 og:image`);
  if (!lang) problems.push(`${rel}: <html> 缺 lang`);
  if (h1 === 0) problems.push(`${rel}: 缺 h1`);
  // database.html 是单页应用，每个路由视图各有一个 h1，同时只有一个可见，属预期结构。
  if (h1 > 1 && rel !== 'database.html') problems.push(`${rel}: h1 数量 = ${h1}（应为 1）`);
  if (noAlt) problems.push(`${rel}: ${noAlt} 张图片缺 alt`);
  if (placeholder.test(html)) problems.push(`${rel}: 仍有 USERNAME/REPO 占位符`);

  rows.push({ rel, checked, missing, title, desc: desc.length, canon: canon ? 'yes' : 'no', h1 });
}

console.log('页面'.padEnd(26), '本地引用', '缺失', '标题', '描述', 'canonical', 'h1');
for (const r of rows) {
  console.log(r.rel.padEnd(28), String(r.checked).padStart(6), String(r.missing).padStart(6), String(r.title.length).padStart(6), String(r.desc).padStart(6), r.canon.padStart(8), String(r.h1).padStart(4));
}

const sitemap = fs.readFileSync(path.join(ROOT, 'sitemap.xml'), 'utf8');
if (placeholder.test(sitemap)) problems.push('sitemap.xml: 仍有 USERNAME/REPO 占位符');
if (!/Sitemap:\s*https:\/\/\S+/.test(fs.readFileSync(path.join(ROOT, 'robots.txt'), 'utf8'))) {
  problems.push('robots.txt: 缺 Sitemap 行');
}

console.log(`\n共 ${pages.length} 页；问题 ${problems.length} 条。`);
for (const p of problems) console.log('  ✗ ' + p);
if (!problems.length) console.log('  ✓ 全部通过');
process.exitCode = problems.length ? 1 : 0;
