'use strict';
// node test/api.test.js — sobe o servidor e joga partidas inteiras pela API, com bots, nos dois jogos.
process.env.SEC_MS = '4';   // 1 "segundo" do jogo = 4 ms
const assert = require('assert');
const { server, GAMES } = require('../server');

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const post = async (path, body) => {
    const r = await fetch(base + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    return { status: r.status, body: await r.json() };
  };
  const get = async (path) => { const r = await fetch(base + path); return { status: r.status, text: await r.text() }; };

  // páginas
  for (const p of ['/', '/cara-de-pau/', '/ninguem-dorme/', '/intruso/', '/intruso/words.js', '/intruso/privacidade.html', '/tv/', '/tv/tv.js', '/comum/prendas.js', '/comum/vila.js', '/cara-de-pau/moradores.js', '/ninguem-dorme/papeis.js']) {
    assert.equal((await get(p)).status, 200, p);
  }
  assert.equal((await get('/../server.js')).status, 404);
  for (const p of ['/tv', '/intruso', '/cara-de-pau']) assert.equal((await fetch(base + p + '?sala=AB', { redirect: 'manual' })).headers.get('location'), p + '/?sala=AB', 'sem barra vai para a pasta');
  assert.equal((await get('/healthz')).text, 'ok');

  for (const [slug, nBots, extra] of [['cara-de-pau', 3, { key: 'eventos', value: 1 }], ['ninguem-dorme', 6, { key: 'diaSecs', value: 60 }]]) {
    const api = (p, b) => post(`/${slug}/api/${p}`, b);
    const host = await api('create', { name: 'Ana', avatar: 3 });
    assert.equal(host.status, 200, slug);
    const { code, pid } = host.body;
    const act = (b) => api('act', { code, pid, ...b });
    // entrar pelo código (minúsculo e com espaço também)
    const guest = await api('join', { code: ` ${code.toLowerCase()}`, name: 'Beto' });
    assert.equal(guest.status, 200, 'entra com código minúsculo');
    assert.equal((await api('join', { code: 'ZZZZ', name: 'X' })).status, 404);
    assert.equal((await api('join', { code, name: 'ana' })).status, 400, 'nome repetido');
    assert.equal((await api('act', { code, pid: guest.body.pid, type: 'start' })).status, 400, 'só o anfitrião começa');
    for (let i = 0; i < nBots; i++) assert.equal((await act({ type: 'addBot' })).status, 200);
    assert.equal((await act({ type: 'setting', ...extra })).status, 200);
    assert.equal((await act({ type: 'setting', key: 'nada', value: 1 })).status, 400);
    assert.equal((await act({ type: 'chat', text: 'oi gente' })).status, 200);
    assert.equal((await act({ type: 'react', i: 0 })).status, 200);
    assert.equal((await act({ type: 'start' })).status, 200);
    const room = GAMES[slug].rooms.get(code);
    assert.ok(room.g, 'partida começou');
    // ninguém humano conectado: o relógio joga por eles e os bots jogam sozinhos
    let ms = 0;
    while (!GAMES[slug].rooms.get(code).counted && ms < 20000) { await wait(50); ms += 50; }
    assert.ok(room.counted, `${slug}: a partida terminou sozinha (bots + tempo)`);
    const winners = room.players.filter((p) => p.wins > 0);
    assert.ok(winners.length >= 1, 'alguém venceu');
    // revanche direto
    assert.equal((await act({ type: 'start' })).status, 200);
    assert.equal(room.round, 2);
    console.log(`${slug}: partida inteira com ${nBots} bots em ${ms} ms`);
  }

  // "Jogar agora com bots": a sala nasce com bots; duplas com número errado dá erro amigável; duplas jogam até o fim
  {
    const api = (p, b) => post(`/cara-de-pau/api/${p}`, b);
    const solo = await api('create', { name: 'Solo', bots: 2, pp: 'abcd2345' });
    const room = GAMES['cara-de-pau'].rooms.get(solo.body.code);
    assert.equal(room.players.length, 3, 'criou com 2 bots');
    assert.equal(room.players[0].pp, 'abcd2345');
    assert.equal((await api('create', { name: 'Muitos', bots: 99 })).status, 200);
    const act = (b) => api('act', { code: solo.body.code, pid: solo.body.pid, ...b });
    assert.equal((await act({ type: 'setting', key: 'duplas', value: 1 })).status, 200);
    const r = await act({ type: 'start' });
    assert.equal(r.status, 400, 'duplas com 3 dá erro');
    assert.match(r.body.error, /Duplas/);
    assert.equal(room.round, 0, 'não contou rodada');
    await act({ type: 'addBot' });
    for (const [key, value] of [['feira', 1], ['cartas', 1]]) assert.equal((await act({ type: 'setting', key, value })).status, 200);
    assert.equal((await act({ type: 'start' })).status, 200);
    let ms = 0;
    while (!room.counted && ms < 20000) { await wait(50); ms += 50; }
    assert.ok(room.counted, 'partida de duplas terminou');
    assert.equal(room.players.filter((p) => p.wins > 0).length, 2, 'a dupla inteira ganha');
    console.log(`cara-de-pau duplas relâmpago com feira em ${ms} ms`);
  }

  server.close();
  if (server.closeAllConnections) server.closeAllConnections();
  console.log('API ok');
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
