// Tiny static server for local tests only (no deps). Serves the test build in .test-dist on localhost.
import http from 'http';
import fs from 'fs';
import path from 'path';
const root = path.resolve(process.argv[2] || '.test-dist');
const port = Number(process.argv[3] || 8811);
const types = { '.css': 'text/css', '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.txt': 'text/plain' };
http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p.endsWith('/')) p += 'index.html';
  const f = path.join(root, path.normalize(p));
  if (!f.startsWith(root)) { res.writeHead(403).end(); return; }
  fs.readFile(f, (err, buf) => {
    if (err) { res.writeHead(404).end('not found'); return; }
    res.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream', 'cache-control': 'no-cache' }).end(buf);
  });
}).listen(port, '127.0.0.1', () => console.log('serving', root, 'on', port));
