/* 从 index.html 的真实数据生成《视频外链对照表》
   用法:node docs/_tools/regen-video-table.js   (在哪个目录下执行都可以,路径按本文件位置解析) */
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..', '..');   /* 站点根目录 */
const P = path.join(ROOT, 'index.html');
const h = fs.readFileSync(P, 'utf8');

/* 1. 声音条目 */
const sounds = [];
const reS = /{\s*id:'([^']+)',\s*name:'([^']*)',\s*platform:'([^']*)',\s*bvid:'([^']*)',\s*url:'([^']*)'/g;
let m; while ((m = reS.exec(h))) sounds.push({ id: m[1], name: m[2], platform: m[3], bvid: m[4], url: m[5] });

/* 2. 分组归属 */
const groupOf = {};
const reG = /{\s*name:'([^']+)',[^}]*?items:\[([^\]]+)\]/g;
const groups = [];
while ((m = reG.exec(h))) {
  const ids = m[2].split(',').map(s => s.trim().replace(/'/g, '')).filter(Boolean);
  groups.push({ name: m[1], ids });
  ids.forEach(id => { groupOf[id] = m[1]; });
}

/* 3. VIDEO_URLS 现状 */
const blk = h.match(/const VIDEO_URLS = \{([\s\S]*?)\n\};/);
const ext = {};
if (blk) { const reE = /'([A-Za-z0-9]+)'\s*:\s*'([^']*)'/g; while ((m = reE.exec(blk[1]))) ext[m[1]] = m[2]; }

/* 4. 本地文件现状 */
const dir = path.join(ROOT, 'video');
const local = {};
if (fs.existsSync(dir)) fs.readdirSync(dir).forEach(f => {
  if (/\.mp4$/i.test(f)) local[f.replace(/\.mp4$/i, '')] = fs.statSync(path.join(dir, f)).size;
});

const fmt = n => (n / 1024 / 1024).toFixed(1) + ' MB';
const order = [];
groups.forEach(g => g.ids.forEach(id => { if (!order.includes(id)) order.push(id); }));
sounds.forEach(s => { if (!order.includes(s.id)) order.push(s.id); });

let out = '';
out += '# 视频外链对照表\n\n';
out += '> 用途：把每条视频换成自己的链接时，只需在 `index.html` 里搜索「视频外链配置」，\n';
out += '> 把网址填到 `VIDEO_URLS` 对应行的引号里即可。**不要改其它代码。**\n\n';
out += '> 本表由 `docs/_tools/regen-video-table.js` 从页面真实数据生成，改过 `VIDEO_URLS` 后重跑一次即可刷新。\n\n';
out += '| 分类 | id | 名称 | 本地文件 | 当前播放 | 原片出处（B 站） | 你要填的网址 |\n';
out += '| --- | --- | --- | --- | --- | --- | --- |\n';

let nLocal = 0, nExt = 0, nMiss = 0, mbLocal = 0;
for (const id of order) {
  const s = sounds.find(x => x.id === id) || { id, name: '(页面数据里未找到)', bvid: '', url: '' };
  const hasLocal = Object.prototype.hasOwnProperty.call(local, id);
  const myUrl = ext[id] || '';
  if (hasLocal) { nLocal++; mbLocal += local[id]; }
  let play;
  if (myUrl) { play = '**平台外链**'; nExt++; }
  else if (hasLocal) play = '本地 `video/' + id + '.mp4`';
  else { play = '⚠️ 本地缺失'; nMiss++; }
  const localCell = hasLocal ? fmt(local[id]) : '—';
  const src = s.bvid ? '`' + s.bvid + '`' : '—';
  const fill = myUrl ? '✅ 已填（指向来源平台）' : '⬜ 待填';
  out += '| ' + (groupOf[id] || '—') + ' | `' + id + '` | ' + s.name + ' | ' + localCell + ' | ' + play + ' | ' + src + ' | ' + fill + ' |\n';
}
out += '\n## 统计\n\n';
out += '- 条目总数：**' + order.length + '**（页面 `SOUNDS` 数组）\n';
out += '- 平台外链：**' + nExt + '** 条（原片体积过大，本地文件已移到 `../_离线归档-大视频未上传/`）\n';
out += '- 本地播放：**' + nLocal + '** 条，合计 ' + fmt(mbLocal) + '（`video/`，不进仓库）\n';
if (nMiss) out += '- ⚠️ 本地缺失且未填链接：**' + nMiss + '** 条\n';
out += '\n## 填网址的三种写法\n\n';
out += '| 你填的内容 | 页面表现 |\n| --- | --- |\n';
out += '| `https://www.bilibili.com/video/BV1xx411c7mD/`（可带 `?p=3` 分 P） | 内嵌 B 站官方播放器 |\n';
out += '| `https://你的存储地址/xx.mp4` | 原生 `<video>` 播放器 |\n';
out += '| 其它任意网页地址 | 显示「前往平台观看」按钮 |\n';
out += '| 留空（空字符串） | 用本地 `video/{id}.mp4`；本地缺失时自动回到来源平台链接 |\n';
out += '\n## 注意\n\n';
out += '- 本地文件（`video/`）**不会**随 GitHub 仓库上传，线上播放全靠这张表或自动回退到来源平台。\n';
out += '- 换自己的剪辑版时，建议先上传到 B 站（或对象存储拿直链），再把网址填回上表。\n';
out += '- 平台链接可能因原视频下架而失效，定期抽查一次即可。\n';

const OUT = path.join(ROOT, 'docs', '视频外链对照表.md');
fs.writeFileSync(OUT, out, 'utf8');
console.log('条目数: ' + order.length + ' / 外链: ' + nExt + ' / 本地: ' + nLocal + ' (' + fmt(mbLocal) + ') / 缺失: ' + nMiss);
console.log('写出: ' + OUT + '  ' + Buffer.byteLength(out, 'utf8') + ' bytes');
