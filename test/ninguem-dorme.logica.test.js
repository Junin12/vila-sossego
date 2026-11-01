'use strict';
// node test/ninguem-dorme.logica.test.js — regras do Ninguém Dorme.
const assert = require('assert');
const L = require('../ninguem-dorme/logica');
const { distribuir } = require('../public/ninguem-dorme/papeis');

let passed = 0;
function test(name, fn) {
  try { fn(); passed++; } catch (e) { console.error(`FALHOU: ${name}\n`, e); process.exitCode = 1; }
}

// Partida com papéis definidos: papeis[i] vai para 'p' + i.
function setup(papeis, opts = {}) {
  const ids = papeis.map((_, i) => 'p' + i);
  const g = L.newGame(ids, { rnd: () => 0, ...opts });
  papeis.forEach((r, i) => { g.players[i].papel = r; });
  return g;
}
const pl = (g, id) => g.players.find((p) => p.id === id);
const sleepAll = (g) => { for (const id of L.waiting(g)) L.act(g, id, { t: 'noite' }); };

test('distribuição de papéis por tamanho', () => {
  for (let n = 4; n <= 12; n++) {
    const d = distribuir(n);
    assert.equal(d.length, n);
    const caps = d.filter((x) => x === 'capanga').length;
    assert.ok(caps >= 1 && caps < n - caps, `n=${n}`);
    assert.ok(d.includes('delegada') && d.includes('benzedeira'));
  }
});

test('capanga faz alguém sumir', () => {
  const g = setup(['capanga', 'delegada', 'benzedeira', 'morador', 'morador']);
  L.act(g, 'p0', { t: 'noite', alvo: 'p3' });
  L.act(g, 'p1', { t: 'noite', alvo: 'p4' });
  L.act(g, 'p2', { t: 'noite', alvo: 'p1' });
  L.act(g, 'p3', { t: 'noite' });
  L.act(g, 'p4', { t: 'noite' });
  assert.equal(g.fase, 'amanhecer');
  assert.equal(g.anuncio.sumiu, 'p3');
  assert.ok(!pl(g, 'p3').vivo);
  assert.equal(g.anuncio.papel, 'morador');
});

test('Vó Zefa salva quem foi atacado', () => {
  const g = setup(['capanga', 'delegada', 'benzedeira', 'morador', 'morador']);
  L.act(g, 'p0', { t: 'noite', alvo: 'p3' });
  L.act(g, 'p2', { t: 'noite', alvo: 'p3' });
  sleepAll(g);
  assert.equal(g.anuncio.sumiu, null);
  assert.ok(g.anuncio.salvo);
  assert.ok(pl(g, 'p3').vivo);
});

test('Vó Zefa não benze a mesma pessoa duas noites seguidas', () => {
  const g = setup(['capanga', 'delegada', 'benzedeira', 'morador', 'morador']);
  L.act(g, 'p2', { t: 'noite', alvo: 'p3' });
  L.act(g, 'p0', { t: 'noite', alvo: 'p4' });
  sleepAll(g);
  L.timeout(g); L.timeout(g); L.timeout(g); L.timeout(g);   // amanhecer → dia → votação → veredito → noite
  assert.equal(g.fase, 'noite');
  assert.throws(() => L.act(g, 'p2', { t: 'noite', alvo: 'p3' }), /válido/);
});

test('delegada descobre capanga em segredo', () => {
  const g = setup(['capanga', 'delegada', 'benzedeira', 'morador', 'morador']);
  L.act(g, 'p1', { t: 'noite', alvo: 'p0' });
  L.act(g, 'p0', { t: 'noite', alvo: 'p4' });
  sleepAll(g);
  const v = L.viewFor(g, 'p1');
  assert.deepEqual(v.me.priv[0], { noite: 1, alvo: 'p0', capanga: true });
  assert.equal(L.viewFor(g, 'p3').me.priv.length, 0);
});

test('fofoqueira espalha quem saiu de casa', () => {
  const g = setup(['capanga', 'delegada', 'benzedeira', 'fofoqueira', 'morador', 'morador']);
  L.act(g, 'p3', { t: 'noite', alvo: 'p0' });
  L.act(g, 'p0', { t: 'noite', alvo: 'p5' });
  sleepAll(g);
  assert.deepEqual(g.anuncio.fofoca, { alvo: 'p0', saiu: true });
  const g2 = setup(['capanga', 'delegada', 'benzedeira', 'fofoqueira', 'morador', 'morador']);
  L.act(g2, 'p3', { t: 'noite', alvo: 'p4' });
  sleepAll(g2);
  assert.deepEqual(g2.anuncio.fofoca, { alvo: 'p4', saiu: false });
});

test('capanga não ataca capanga e vê o parceiro', () => {
  const g = setup(['capanga', 'capanga', 'delegada', 'benzedeira', 'morador', 'morador']);
  assert.throws(() => L.act(g, 'p0', { t: 'noite', alvo: 'p1' }));
  const v = L.viewFor(g, 'p0');
  assert.equal(v.players[1].papel, 'capanga');
  assert.equal(L.viewFor(g, 'p4').players[0].papel, null);
});

test('votação expulsa o mais votado; prefeito vale 2', () => {
  const g = setup(['capanga', 'delegada', 'benzedeira', 'prefeito', 'morador', 'morador', 'morador', 'morador']);
  g.fase = 'votacao'; g.votos = {};
  L.act(g, 'p0', { t: 'voto', alvo: 'p4' });
  L.act(g, 'p1', { t: 'voto', alvo: 'p4' });
  L.act(g, 'p3', { t: 'voto', alvo: 'p0' });   // prefeito: 2
  L.act(g, 'p2', { t: 'voto', alvo: 'p0' });   // capanga com 3
  L.act(g, 'p4', { t: 'voto', alvo: 'pular' });
  L.act(g, 'p5', { t: 'voto', alvo: 'pular' });
  L.act(g, 'p6', { t: 'voto', alvo: 'pular' });
  L.act(g, 'p7', { t: 'voto', alvo: 'pular' });
  assert.equal(g.fase, 'veredito');
  assert.equal(g.veredito.expulso, null, 'pular (4) ganhou do capanga (3)');
});

test('expulsar o último capanga dá vitória à vila', () => {
  const g = setup(['capanga', 'delegada', 'benzedeira', 'morador', 'morador']);
  g.fase = 'votacao'; g.votos = {};
  for (const id of ['p1', 'p2', 'p3', 'p4']) L.act(g, id, { t: 'voto', alvo: 'p0' });
  L.act(g, 'p0', { t: 'voto', alvo: 'p1' });
  assert.equal(g.veredito.expulso, 'p0');
  assert.equal(pl(g, 'p1').stats.votosCertos, 1);
  L.timeout(g);
  assert.equal(g.fase, 'fim');
  assert.equal(g.vencedor, 'vila');
});

test('empate não expulsa ninguém', () => {
  const g = setup(['capanga', 'delegada', 'benzedeira', 'morador']);
  g.fase = 'votacao'; g.votos = {};
  L.act(g, 'p0', { t: 'voto', alvo: 'p1' });
  L.act(g, 'p1', { t: 'voto', alvo: 'p0' });
  L.act(g, 'p2', { t: 'voto', alvo: 'p1' });
  L.act(g, 'p3', { t: 'voto', alvo: 'p0' });
  assert.equal(g.veredito.expulso, null);
  assert.ok(g.veredito.empate);
});

test('capangas vencem quando empatam em número', () => {
  const g = setup(['capanga', 'delegada', 'benzedeira', 'morador']);
  L.act(g, 'p0', { t: 'noite', alvo: 'p1' });
  sleepAll(g);
  assert.equal(g.fase, 'amanhecer');
  g.fase = 'votacao'; g.votos = {};
  L.act(g, 'p0', { t: 'voto', alvo: 'p2' });
  L.act(g, 'p2', { t: 'voto', alvo: 'p3' });
  L.act(g, 'p3', { t: 'voto', alvo: 'p2' });
  L.timeout(g);
  assert.equal(g.vencedor, 'capangas');
});

test('fantasma não age e vê todos os papéis', () => {
  const g = setup(['capanga', 'delegada', 'benzedeira', 'morador', 'morador']);
  L.act(g, 'p0', { t: 'noite', alvo: 'p3' });
  sleepAll(g);
  assert.throws(() => L.act(g, 'p3', { t: 'pronto' }), /assiste/);
  assert.equal(L.viewFor(g, 'p3').players[0].papel, 'capanga');
});

test('dia termina quando todos estão prontos', () => {
  const g = setup(['capanga', 'delegada', 'benzedeira', 'morador']);
  sleepAll(g);
  L.timeout(g);
  assert.equal(g.fase, 'dia');
  for (const id of L.waiting(g)) L.act(g, id, { t: 'pronto' });
  assert.equal(g.fase, 'votacao');
});

test('partidas aleatórias sempre terminam', () => {
  for (let s = 0; s < 300; s++) {
    let seed = s + 7;
    const rnd = (n) => { seed = (seed * 16807) % 2147483647; return seed % n; };
    const n = 4 + (s % 9);
    const g = L.newGame(Array.from({ length: n }, (_, i) => 'j' + i), { rnd, revelar: s % 2 === 0 });
    let steps = 0;
    while (g.fase !== 'fim' && steps++ < 3000) {
      const w = L.waiting(g);
      if (!w.length || rnd(6) === 0) { L.timeout(g); continue; }
      const id = w[rnd(w.length)];
      const p = g.players.find((x) => x.id === id);
      try {
        if (g.fase === 'noite') { const a = L.alvosNoite(g, p); L.act(g, id, { t: 'noite', alvo: a[rnd(Math.max(1, a.length))] }); }
        else if (g.fase === 'dia') L.act(g, id, { t: 'pronto' });
        else if (g.fase === 'votacao') { const v = L.vivos(g).filter((x) => x.id !== id); L.act(g, id, { t: 'voto', alvo: rnd(5) ? v[rnd(v.length)].id : 'pular' }); }
      } catch (e) { if (!(e instanceof L.RuleError)) throw e; }
    }
    assert.equal(g.fase, 'fim', `partida ${s} não terminou`);
    assert.ok(['vila', 'capangas'].includes(g.vencedor));
  }
});

console.log(`Ninguém Dorme: ${passed} testes de regras passaram`);
