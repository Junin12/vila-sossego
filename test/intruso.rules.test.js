// Regras do Intruso via HTTP + SSE no servidor da Vila. Rode: node test/intruso.rules.test.js
process.env.SEC_MS = '40'; process.env.INTRO_MS = '60';
const http = require('http'); const assert = require('assert');
const { server } = require('../server.js')   // servidor da Vila: o Intruso fica em /intruso/;
let port, fails = 0;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const post = (p, b) => new Promise((res) => {
  const d = JSON.stringify(b);
  const r = http.request({ port, path: p, method: 'POST', headers: { 'Content-Type': 'application/json' } }, (x) => { let t = ''; x.on('data', (c) => t += c); x.on('end', () => res({ s: x.statusCode, ...JSON.parse(t) })); });
  r.end(d);
});
class P {
  constructor(name, code, pid) { this.name = name; this.code = code; this.pid = pid; this.v = null; this.req = null; }
  connect() { return new Promise((res) => { this.req = http.get({ port, path: `/intruso/api/events?code=${this.code}&pid=${this.pid}` }, (x) => { let buf = ''; x.on('data', (c) => { buf += c; let i; while ((i = buf.indexOf('\n\n')) >= 0) { const m = buf.slice(0, i); buf = buf.slice(i + 2); if (m.startsWith('data: ')) { this.v = JSON.parse(m.slice(6)); res(); } } }); }); }); }
  act(o) { return post('/intruso/api/act', { code: this.code, pid: this.pid, ...o }); }
  drop() { this.req.destroy(); }
}
async function room(n, opts = {}) {
  const c = await post('/intruso/api/create', { name: 'P1' });
  const ps = [new P('P1', c.code, c.pid)];
  for (let i = 2; i <= n; i++) { const j = await post('/intruso/api/join', { code: c.code, name: 'P' + i }); ps.push(new P('P' + i, c.code, j.pid)); }
  for (const p of ps) await p.connect();
  await sleep(30);
  return ps;
}
const test = async (name, fn) => { try { await fn(); console.log('ok  ', name); } catch (e) { fails++; console.log('FAIL', name, '\n    ', e.message); } };
const byId = (ps, id) => ps.find((p) => p.pid === id);
async function toVote(ps) {
  await ps[0].act({ type: 'start' }); await sleep(120);
  for (let i = 0; i < ps[0].v.totalTurns; i++) { const cur = byId(ps, ps[0].v.order[ps[0].v.turn % ps[0].v.order.length]); await cur.act({ type: 'clue', text: 'dica' + i }); await sleep(15); }
  assert.strictEqual(ps[0].v.phase, 'vote');
}
const imps = (ps) => ps.filter((p) => p.v.role === 'impostor');

(async () => {
  await new Promise((r) => server.listen(0, r)); port = server.address().port;

  await test('um intruso com 4, dois com 7; palavra oculta ao intruso', async () => {
    let ps = await room(4); await ps[0].act({ type: 'start' }); await sleep(20);
    assert.strictEqual(imps(ps).length, 1); assert.strictEqual(imps(ps)[0].v.word, null);
    assert.ok(ps.filter((p) => p.v.role === 'crew').every((p) => p.v.word));
    ps = await room(7); await ps[0].act({ type: 'start' }); await sleep(20);
    assert.strictEqual(imps(ps).length, 2);
    assert.deepStrictEqual(imps(ps)[0].v.partnerIds, [imps(ps)[1].pid]);
  });

  await test('intruso pego e erra o palpite: tripulação +1', async () => {
    const ps = await room(4); await toVote(ps);
    const imp = imps(ps)[0];
    for (const p of ps) await p.act({ type: 'vote', target: p === imp ? ps.find((x) => x !== imp).pid : imp.pid });
    await sleep(20); assert.strictEqual(ps[0].v.phase, 'guess');
    await imp.act({ type: 'guess', text: 'xxxx' }); await sleep(20);
    assert.strictEqual(ps[0].v.phase, 'result'); assert.strictEqual(ps[0].v.result.impostorWins, false);
    assert.strictEqual(ps.find((p) => p !== imp).v.players.find((x) => x.id === imp.pid).score, 0);
  });

  await test('intruso pego mas acerta: intruso +2', async () => {
    const ps = await room(4); await toVote(ps);
    const imp = imps(ps)[0], crew = ps.find((p) => p !== imp);
    for (const p of ps) await p.act({ type: 'vote', target: p === imp ? crew.pid : imp.pid });
    await imp.act({ type: 'guess', text: crew.v.word.toUpperCase() }); await sleep(20);
    assert.strictEqual(ps[0].v.result.reason, 'guessed');
    assert.strictEqual(ps[0].v.players.find((x) => x.id === imp.pid).score, 2);
  });

  await test('intruso escapa: quem votou nele certo ganha +1', async () => {
    const ps = await room(5); await toVote(ps);
    const imp = imps(ps)[0], [a, b, c, d] = ps.filter((p) => p !== imp);
    for (const p of [a, b]) await p.act({ type: 'vote', target: imp.pid });
    for (const p of [imp, c, d]) await p.act({ type: 'vote', target: a.pid });
    await sleep(20);
    assert.strictEqual(ps[0].v.result.reason, 'escaped');
    const sc = (p) => ps[0].v.players.find((x) => x.id === p.pid).score;
    assert.deepStrictEqual([sc(imp), sc(a), sc(b), sc(c), sc(d)], [2, 1, 1, 0, 0]);
  });

  await test('palavra parecida: intruso recebe outra palavra e se vê como tripulante', async () => {
    const ps = await room(4); await ps[0].act({ type: 'settings', key: 'mode', value: 1 }); await toVote(ps);
    assert.ok(ps.every((p) => p.v.role === 'crew' && p.v.word && p.v.similar));
    const words = ps.map((p) => p.v.word);
    const imp = ps.find((p) => words.filter((w) => w === p.v.word).length === 1);
    assert.ok(imp, 'um jogador com palavra diferente');
    const crewWord = ps.find((p) => p !== imp).v.word;
    for (const p of ps) await p.act({ type: 'vote', target: p === imp ? ps.find((x) => x !== imp).pid : imp.pid });
    await sleep(20); assert.strictEqual(ps[0].v.phase, 'guess');
    assert.strictEqual(imp.v.role, 'impostor'); assert.strictEqual(imp.v.word, null);
    await imp.act({ type: 'guess', text: crewWord }); await sleep(20);
    assert.strictEqual(ps[0].v.result.reason, 'guessed');
    assert.strictEqual(ps[0].v.word, crewWord); assert.ok(ps[0].v.altWord && ps[0].v.altWord !== crewWord);
  });

  await test('cúmplice: sabe quem é o intruso e vence junto', async () => {
    const ps = await room(6); await ps[0].act({ type: 'settings', key: 'accomplice', value: 1 }); await toVote(ps);
    const imp = imps(ps)[0], acc = ps.find((p) => p.v.role === 'accomplice');
    assert.ok(acc, 'tem cúmplice'); assert.deepStrictEqual(acc.v.knownImpostors, [imp.pid]); assert.ok(acc.v.word);
    assert.strictEqual(imp.v.knownImpostors, undefined);
    const others = ps.filter((p) => p !== imp && p !== acc);
    for (const p of [imp, ...others]) await p.act({ type: 'vote', target: acc.pid });
    await acc.act({ type: 'vote', target: others[0].pid }); await sleep(20);
    assert.strictEqual(ps[0].v.result.reason, 'escaped'); assert.strictEqual(ps[0].v.accompliceId, acc.pid);
    const sc = (p) => ps[0].v.players.find((x) => x.id === p.pid).score;
    assert.deepStrictEqual([sc(imp), sc(acc), ...others.map(sc)], [2, 2, 0, 0, 0, 0]);
    const few = await room(5); await few[0].act({ type: 'settings', key: 'accomplice', value: 1 }); await few[0].act({ type: 'start' }); await sleep(20);
    assert.ok(few.every((p) => p.v.role !== 'accomplice'), 'com 5 jogadores não tem cúmplice');
  });

  await test('lista personalizada: só o anfitrião, mínimo para começar, palavra vem da lista', async () => {
    const ps = await room(3);
    assert.strictEqual((await ps[1].act({ type: 'customWords', words: 'a,b' })).s, 400);
    await ps[0].act({ type: 'category', value: 'Personalizada' });
    await ps[0].act({ type: 'customWords', words: 'Fusca azul, Churrasco do Zé' + String.fromCharCode(10) + 'Reunião, reunião' });
    await sleep(20); assert.strictEqual(ps[1].v.customCount, 3); assert.strictEqual(ps[1].v.customWords, undefined);
    assert.strictEqual((await ps[0].act({ type: 'start' })).s, 400);
    const list = ['Fusca azul', 'Churrasco do Zé', 'Reunião', 'Café da firma', 'Planilha', 'Crachá'];
    await ps[0].act({ type: 'customWords', words: list.join(',') });
    assert.ok((await ps[0].act({ type: 'start' })).ok); await sleep(20);
    const crew = ps.find((p) => p.v.role === 'crew');
    assert.ok(list.includes(crew.v.word)); assert.strictEqual(crew.v.wordCategory, 'Personalizada');
  });

  await test('dois intrusos: precisa pegar os dois', async () => {
    const ps = await room(7); await toVote(ps);
    const [a, b] = imps(ps); const inn = ps.filter((p) => p !== a && p !== b);
    // só um é o mais votado -> escapam
    for (const p of ps) await p.act({ type: 'vote', target: p === a ? inn[0].pid : a.pid });
    await sleep(20); assert.strictEqual(ps[0].v.phase, 'result'); assert.strictEqual(ps[0].v.result.impostorWins, true);
    const ps2 = await room(7); await toVote(ps2);
    const [c, d] = imps(ps2);
    ps2.forEach((p, i) => p.act({ type: 'vote', target: (i % 2 ? c : d) === p ? (p === c ? d : c).pid : (i % 2 ? c : d).pid }));
    await sleep(60);
    assert.strictEqual(ps2[0].v.phase, 'guess', 'fase ' + ps2[0].v.phase);
  });

  await test('tempo de dica esgota e passa a vez; votação esgota e encerra', async () => {
    const ps = await room(3); await ps[0].act({ type: 'settings', key: 'clueSecs', value: 10 });
    await ps[0].act({ type: 'settings', key: 'voteSecs', value: 30 });
    await ps[0].act({ type: 'start' }); await sleep(100);
    assert.strictEqual(ps[0].v.phase, 'clues');
    await sleep(10 * 40 + 80);
    assert.ok(ps[0].v.turn >= 1, 'turn ' + ps[0].v.turn);
    await sleep(6 * 10 * 40 + 300);
    assert.strictEqual(ps[0].v.phase, 'vote');
    await sleep(30 * 40 + 150);
    assert.ok(['result'].includes(ps[0].v.phase), ps[0].v.phase);
  });

  await test('só o anfitrião muda ajustes; valores inválidos recusados', async () => {
    const ps = await room(3);
    assert.strictEqual((await ps[1].act({ type: 'settings', key: 'total', value: 10 })).s, 400);
    assert.strictEqual((await ps[0].act({ type: 'settings', key: 'total', value: 7 })).s, 400);
    assert.strictEqual((await ps[0].act({ type: 'settings', key: 'total', value: 10 })).s, 200);
    await sleep(20); assert.strictEqual(ps[2].v.settings.total, 10);
  });

  await test('partida de 5 rodadas termina em final com prêmios; palavras não repetem', async () => {
    const ps = await room(3);
    await ps[0].act({ type: 'settings', key: 'clueSecs', value: 0 }); await ps[0].act({ type: 'settings', key: 'voteSecs', value: 0 });
    await ps[0].act({ type: 'category', value: 'Marcas' });
    const words = new Set();
    for (let r = 1; r <= 5; r++) {
      await ps[0].act({ type: r === 1 ? 'start' : 'next' }); await sleep(30);
      await ps[0].act({ type: 'skip' }); await sleep(20);
      assert.strictEqual(ps[0].v.matchRound, r);
      words.add(ps.find((p) => p.v.role === 'crew').v.word);
      for (let i = 0; i < ps[0].v.totalTurns; i++) { await byId(ps, ps[0].v.order[ps[0].v.turn % 3]).act({ type: 'clue', text: 'x' + i }); await sleep(10); }
      const imp = imps(ps)[0];
      for (const p of ps) await p.act({ type: 'vote', target: p === imp ? ps.find((x) => x !== imp).pid : imp.pid });
      await sleep(20);
      if (ps[0].v.phase === 'guess') { await imp.act({ type: 'guess', text: 'nada' }); await sleep(20); }
      assert.strictEqual(ps[0].v.phase, 'result'); assert.strictEqual(ps[0].v.result.last, r === 5);
    }
    assert.strictEqual(words.size, 5, 'palavras repetidas');
    await ps[0].act({ type: 'next' }); await sleep(30);
    assert.strictEqual(ps[0].v.phase, 'final'); assert.ok(ps[0].v.awards.detective);
    await ps[0].act({ type: 'rematch' }); await sleep(20);
    assert.strictEqual(ps[0].v.phase, 'lobby'); assert.ok(ps[0].v.players.every((p) => p.score === 0));
  });

  await test('entrada no meio da partida: espectador sem palavra', async () => {
    const ps = await room(3); await ps[0].act({ type: 'start' }); await sleep(100);
    const j = await post('/intruso/api/join', { code: ps[0].code, name: 'Tarde' }); assert.ok(j.pid);
    const late = new P('Tarde', ps[0].code, j.pid); await late.connect();
    assert.strictEqual(late.v.role, 'spectator'); assert.strictEqual(late.v.word, null);
    assert.strictEqual((await late.act({ type: 'vote', target: ps[0].pid })).s, 400);
  });

  server.close(); setTimeout(() => process.exit(fails ? 1 : 0), 50);
})();
