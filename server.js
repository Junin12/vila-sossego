'use strict';
// Servidor da Vila Sossego: os jogos Cara de Pau e Ninguém Dorme num processo só, sem dependências.
// /<jogo>/api/... vai para as salas do jogo; o resto é arquivo estático de public/.

const http = require('http');
const fs = require('fs');
const path = require('path');
const { createRooms, GameError } = require('./salas');

const PORT = process.env.PORT || Number(process.argv[2]) || 3000;
const PUBLIC = path.join(__dirname, 'public');

const GAMES = {
  'cara-de-pau': createRooms(require('./cara-de-pau/jogo')),
  'ninguem-dorme': createRooms(require('./ninguem-dorme/jogo')),
};

function readJson(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > 4096) { reject(new GameError('Requisição grande demais.')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => {
      try { resolve(JSON.parse(Buffer.concat(chunks).toString() || '{}')); }
      catch { reject(new GameError('JSON inválido.')); }
    });
    req.on('error', reject);
  });
}

function send(res, status, obj) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(obj));
}

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json; charset=utf-8', '.webmanifest': 'application/manifest+json' };

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const m = url.pathname.match(/^\/([a-z-]+)\/api(\/[a-z]+)$/);
  if (m && GAMES[m[1]]) {
    GAMES[m[1]].handle(req, res, url, m[2], readJson)
      .then((out) => { if (out) send(res, 200, out); })
      .catch((e) => {
        if (!(e instanceof GameError)) console.error(e);
        if (!res.headersSent) send(res, e instanceof GameError ? (/^Sala não encontrada/.test(e.message) ? 404 : 400) : 500,
          { error: e instanceof GameError ? e.message : 'Erro interno.' });
      });
    return;
  }
  if (url.pathname === '/healthz') { res.writeHead(200); res.end('ok'); return; }
  // /cara-de-pau sem barra → com barra (os caminhos da página são relativos)
  if (GAMES[url.pathname.slice(1)]) { res.writeHead(301, { Location: url.pathname + '/' + url.search }); res.end(); return; }
  let rel = decodeURIComponent(url.pathname).replace(/^\/+/, '');
  if (rel === '' || rel.endsWith('/')) rel += 'index.html';
  const file = path.join(PUBLIC, rel);
  if (file.startsWith(PUBLIC + path.sep) && MIME[path.extname(file)]) {
    fs.readFile(file, (err, data) => {
      if (err) { res.writeHead(404); res.end('Não encontrado'); return; }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(file)], 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff' });
      res.end(data);
    });
    return;
  }
  res.writeHead(404); res.end('Não encontrado');
});

if (require.main === module) {
  server.listen(PORT, '0.0.0.0', () => console.log(`Vila Sossego rodando em http://localhost:${PORT}`));
}
module.exports = { server, GAMES };
