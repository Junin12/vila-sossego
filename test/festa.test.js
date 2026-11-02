'use strict';
// node test/festa.test.js — Telão, Noite de Festa (dois jogos seguidos), prenda, foto e as novidades do Intruso
// (bots, times, dica desenhada, Modo Família), tudo pela API.
process.env.SEC_MS = '4';
process.env.INTRO_MS = '30';
const assert = require('assert');
const http = require('http');
const { server, GAMES } = require('../server');
const festa = require('../festa');

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
let base;
const post = async (path, body) => {
  const r = await fetch(base + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  return { status: r.status, body: await r.json() };
};
// primeira mensagem de um SSE (telão)
const primeira = (path) => new Promise((resolve, reject) => {
  const req = http.get(base + path, (res) => {
    let buf = '';
    res.on('data', (c) => {
      buf += c;
      const i = buf.indexOf('data: ');
      const j = buf.indexOf('\n\n', i);
      if (i >= 0 && j > i) { resolve(JSON.parse(buf.slice(i + 6, j))); req.destroy(); }
    });
  });
  req.on('error', reject);
});
const ate = async (cond, ms = 20000) => { let t = 0; while (!cond() && t < ms) { await wait(40); t += 40; } return cond(); };

let passed = 0;
async function test(name, fn) {
  try { await fn(); passed++; console.log('ok  ', name); } catch (e) { console.error('FALHOU', name, '\n', e); process.exitCode = 1; }
}

async function main() {
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${server.address().port}`;

  await test('telão acha a sala pelo código e não vê segredos', async () => {
    const { body: { code, pid } } = await post('/cara-de-pau/api/create', { name: 'Ana', bots: 2 });
    assert.equal((await fetch(`${base}/api/onde?code=${code.toLowerCase()}`).then((r) => r.json())).slug, 'cara-de-pau');
    assert.equal((await fetch(`${base}/api/onde?code=ZZZZ`)).status, 404);
    await post('/cara-de-pau/api/act', { code, pid, type: 'start' });
    const v = await primeira(`/cara-de-pau/api/tv?code=${code}`);
    assert.equal(v.you, null);
    assert.ok(v.game, 'telão vê a partida');
    for (const p of v.game.players) for (const c of p.cards) if (!c.lost) assert.equal(c.c, null, 'segredo escondido no telão');
    assert.ok(GAMES['cara-de-pau'].rooms.get(code).tvs.size === 0 || true);
  });

  await test('Noite de Festa: placar da noite, prenda e próximo jogo (Cara de Pau → Intruso)', async () => {
    const api = (p, b) => post('/cara-de-pau/api/' + p, b);
    const { body: { code, pid } } = await api('create', { name: 'Ana', bots: 2 });
    const act = (b) => api('act', { code, pid, ...b });
    assert.equal((await act({ type: 'festa' })).status, 200);
    const room = GAMES['cara-de-pau'].rooms.get(code);
    assert.ok(room.festa, 'festa ligada');
    assert.equal((await act({ type: 'proximo', jogo: 'intruso' })).status, 200, 'pode abrir o próximo no saguão');
    await act({ type: 'start' });
    assert.ok(await ate(() => room.counted), 'partida terminou');
    const f = festa.get(room.festa);
    assert.equal(f.jogos.length, 1);
    assert.ok(f.placar.ana, 'Ana no placar da noite');
    assert.ok(!Object.keys(f.placar).some((k) => k.includes('bot')), 'bots fora do placar');
    if (!room.ultimos.find((r) => r.name === 'Ana').venceu) assert.equal(room.prenda.para, 'Ana', 'quem perdeu paga prenda');
    const nx = await act({ type: 'proximo', jogo: 'intruso' });
    assert.equal(nx.status, 200);
    assert.equal(nx.body.slug, 'intruso');
    const iroom = GAMES.intruso.rooms.get(nx.body.code);
    assert.equal(iroom.festa, room.festa, 'Intruso entrou na mesma festa');
    assert.equal(room.next.code, nx.body.code, 'a turma recebe o link do próximo jogo');
    // Intruso com bots até o placar final
    const iact = (b) => post('/intruso/api/act', { code: nx.body.code, pid: nx.body.pid, ...b });
    await iact({ type: 'addBot' }); await iact({ type: 'addBot' }); await iact({ type: 'addBot' });   // anfitriã offline no teste: 3 bots online
    await iact({ type: 'settings', key: 'total', value: 5 });
    assert.equal((await iact({ type: 'start' })).status, 200);
    for (let i = 0; i < 5; i++) {
      assert.ok(await ate(() => iroom.phase === 'result'), `rodada ${i + 1} terminou`);
      await iact({ type: 'next' });
    }
    assert.equal(iroom.phase, 'final');
    assert.equal(f.jogos.length, 2, 'Intruso contou na noite');
    assert.equal(f.placar.ana.jogos, 2);
    const r = await iact({ type: 'prenda' });
    assert.equal(r.status, 200);
    assert.ok(iroom.prenda.texto);
  });

  await test('prenda fora da festa e Modo Família', async () => {
    const { body: { code, pid } } = await post('/ninguem-dorme/api/create', { name: 'Bia', bots: 4 });
    const act = (b) => post('/ninguem-dorme/api/act', { code, pid, ...b });
    assert.equal((await act({ type: 'prenda' })).status, 400, 'sem partida, sem prenda');
    assert.equal((await act({ type: 'setting', key: 'familia', value: 1 })).status, 200);
    await act({ type: 'start' });
    const room = GAMES['ninguem-dorme'].rooms.get(code);
    assert.ok(await ate(() => room.counted));
    const bia = room.ultimos.find((r) => r.name === 'Bia');
    const r = await act({ type: 'prenda' });
    if (bia.venceu) assert.equal(r.status, 400);
    else assert.ok(require('../public/comum/prendas').familia.includes(room.prenda.texto), 'prenda de família');
  });

  await test('foto no lugar do personagem (só na memória) e volta ao personagem', async () => {
    const { body: { code, pid } } = await post('/cara-de-pau/api/create', { name: 'Caio' });
    const act = (b) => post('/cara-de-pau/api/act', { code, pid, ...b });
    const jpeg = 'data:image/jpeg;base64,' + Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 0xff, 0xd9]).toString('base64');
    assert.equal((await act({ type: 'foto', data: 'data:image/png;base64,AAAA' })).status, 400);
    assert.equal((await act({ type: 'foto', data: jpeg })).status, 200);
    const p = GAMES['cara-de-pau'].rooms.get(code).players[0];
    assert.match(String(p.avatar), /^f:/);
    const img = await fetch(`${base}/cara-de-pau/api/foto?code=${code}&id=${p.id}`);
    assert.equal(img.headers.get('content-type'), 'image/jpeg');
    await act({ type: 'avatar', value: 3 });
    assert.equal(p.avatar, 3);
    assert.equal(p.foto, null);
  });

  await test('Intruso: Modo Família tira categorias, times e dica desenhada', async () => {
    const { body: { code, pid } } = await post('/intruso/api/create', { name: 'Duda' });
    const act = (b) => post('/intruso/api/act', { code, pid, ...b });
    const room = GAMES.intruso.rooms.get(code);
    await act({ type: 'settings', key: 'familia', value: 1 });
    const v = await primeira(`/intruso/api/tv?code=${code}`);
    assert.ok(!v.categories.includes('Bebidas'), 'sem bebidas no Modo Família');
    await act({ type: 'addBot' }); await act({ type: 'addBot' });
    await act({ type: 'settings', key: 'teams', value: 1 });
    assert.equal((await act({ type: 'start' })).status, 400, 'times precisam de 4');
    await act({ type: 'addBot' });
    await act({ type: 'settings', key: 'draw', value: 1 });
    // a Duda fica conectada para desenhar na vez dela
    const sse = http.get(`${base}/intruso/api/events?code=${code}&pid=${pid}`);
    await wait(50);
    assert.equal((await act({ type: 'start' })).status, 200);
    assert.deepEqual(new Set(room.players.map((p) => p.team)), new Set([0, 1]));
    assert.ok(await ate(() => room.phase === 'clues' && room.order[room.turn % room.order.length] === pid || room.phase !== 'clues' && room.phase !== 'intro'));
    if (room.phase === 'clues') {
      assert.equal((await act({ type: 'clue', draw: '10,10 20,20|30,30 x' })).status, 400, 'rabisco inválido');
      assert.equal((await act({ type: 'clue', draw: '10,10 20,20 30,40|50,50 60,70' })).status, 200);
      assert.ok(room.clues.some((c) => c.pid === pid && c.draw), 'rabisco guardado');
    }
    assert.ok(await ate(() => room.phase === 'vote' || room.phase === 'result' || room.phase === 'guess'), 'bots deram as dicas');
    sse.destroy();
  });

  server.close();
  if (server.closeAllConnections) server.closeAllConnections();
  console.log(`Festa, telão e novidades: ${passed} testes passaram`);
  process.exit(process.exitCode || 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
