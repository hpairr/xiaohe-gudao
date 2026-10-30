#!/usr/bin/env node
/**
 * 本地预览服务器（零依赖，支持 HTTP Range）
 * ------------------------------------------------------------
 * 用法：node tools/preview.mjs [端口]     默认 http://127.0.0.1:8080/
 *
 * 为什么要单独写一个：python -m http.server 不支持 Range，视频不能 seek，
 * 专题页「点动作跳转」会失效（视频只能从头播）。这里补上 206 分段响应，
 * 本地预览的行为与 GitHub Pages 一致。
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const PORT = Number(process.argv[2]) || 8080;

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.mp4': 'video/mp4',
  '.m4a': 'audio/mp4',
  '.mp3': 'audio/mpeg',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
};

function fail(res, code, text) {
  res.writeHead(code, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end(text);
}

const server = http.createServer((req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return fail(res, 405, '只支持 GET / HEAD');
  }

  let pathname;
  try {
    pathname = decodeURIComponent((req.url || '/').split('?')[0]);
  } catch {
    return fail(res, 400, 'URL 编码有问题');
  }
  if (pathname === '/') pathname = '/index.html';

  const file = path.resolve(ROOT, '.' + pathname);
  if (file !== ROOT && !file.startsWith(ROOT + path.sep)) {
    return fail(res, 403, 'Forbidden');
  }

  fs.stat(file, (err, stat) => {
    if (err || !stat.isFile()) return fail(res, 404, 'Not Found: ' + pathname);

    const type = TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream';
    const size = stat.size;
    const range = req.headers.range;

    if (range) {
      const match = /^bytes=(\d*)-(\d*)$/.exec(range.trim());
      if (!match) return fail(res, 416, 'Range 不合法');
      let start;
      let end;
      if (!match[1] && match[2]) {
        // bytes=-500：最后 500 字节
        start = Math.max(0, size - Number(match[2]));
        end = size - 1;
      } else {
        start = Number(match[1] || 0);
        end = match[2] ? Number(match[2]) : size - 1;
      }
      end = Math.min(end, size - 1);
      if (start > end || start >= size) {
        res.writeHead(416, { 'Content-Range': 'bytes */' + size });
        return res.end();
      }
      const length = end - start + 1;
      res.writeHead(206, {
        'Content-Type': type,
        'Content-Range': 'bytes ' + start + '-' + end + '/' + size,
        'Content-Length': length,
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'no-cache',
      });
      if (req.method === 'HEAD') return res.end();
      fs.createReadStream(file, { start, end }).pipe(res);
      return;
    }

    res.writeHead(200, {
      'Content-Type': type,
      'Content-Length': size,
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'no-cache',
    });
    if (req.method === 'HEAD') return res.end();
    fs.createReadStream(file).pipe(res);
  });
});

server.listen(PORT, '127.0.0.1', () => {
  console.log('潇贺古道站点预览 → http://127.0.0.1:' + PORT + '/');
  console.log('专题页 → http://127.0.0.1:' + PORT + '/themes/04-%E9%95%BF%E9%BC%93%E8%88%9E.html');
  console.log('Ctrl+C 停止');
});
