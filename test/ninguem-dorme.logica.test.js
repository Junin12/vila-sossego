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

test('expansão: papéis novos entram pelo tamanho da vila', () => {
  assert.ok(!distribuir(12).includes('vigia'), 'sem expansão não entra');
  assert.ok(distribuir(7, { extras: true }).includes('vigia'));
  assert.ok(distribuir(9, { extras: true }).includes('bebado'));
  assert.ok(!distribuir(12, { extras: true, revelar: true }).includes('coveiro'), 'coveiro só no modo segredo');
  assert.ok(distribuir(10, { extras: true, revelar: false }).includes('coveiro'));
  for (let n = 4; n <= 12; n++) {
    const d = distribuir(n, { extras: true, revelar: false });
    assert.equal(d.length, n);
    assert.ok(d.includes('delegada') && d.includes('benzedeira'), `n=${n}`);
  }
});

test('vigia vê quem bateu na casa', () => {
  const g = setup(['capanga', 'delegada', 'benzedeira', 'vigia', 'morador', 'morador']);
  L.act(g, 'p0', { t: 'noite', alvo: 'p4' });
  L.act(g, 'p1', { t: 'noite', alvo: 'p4' });
  L.act(g, 'p3', { t: 'noite', alvo: 'p4' });
  sleepAll(g);
  assert.deepEqual(L.viewFor(g, 'p3').me.priv[0], { noite: 1, alvo: 'p4', visitas: ['p0', 'p1'] });
});

test('Zé Pinguço se vê como Delegada e chuta', () => {
  const g = setup(['capanga', 'bebado', 'benzedeira', 'morador', 'morador']);
  const v = L.viewFor(g, 'p1');
  assert.equal(v.me.papel, 'delegada');
  assert.equal(v.players[1].papel, 'delegada');
  L.act(g, 'p1', { t: 'noite', alvo: 'p3' });   // rnd 0 → diz que é capanga (mentira)
  sleepAll(g);
  assert.equal(L.viewFor(g, 'p1').me.priv[0].capanga, true);
  g.fase = 'fim';
  assert.equal(L.viewFor(g, 'p1').players[1].papel, 'bebado');
});

test('coveiro vê o papel de quem saiu no modo segredo', () => {
  const g = setup(['capanga', 'delegada', 'benzedeira', 'coveiro', 'morador', 'morador'], { revelar: false });
  L.act(g, 'p0', { t: 'noite', alvo: 'p4' });
  sleepAll(g);
  assert.equal(L.viewFor(g, 'p3').players[4].papel, 'morador');
  assert.equal(L.viewFor(g, 'p3').anuncio.papel, 'morador');
  assert.equal(L.viewFor(g, 'p5').players[4].papel, null);
  assert.equal(L.viewFor(g, 'p5').anuncio.papel, null);
});

test('casal apaixonado sai junto', () => {
  const g = setup(['capanga', 'delegada', 'benzedeira', 'morador', 'morador', 'morador']);
  g.casal = ['p3', 'p4'];
  assert.equal(L.viewFor(g, 'p3').me.par, 'p4');
  assert.equal(L.viewFor(g, 'p5').casal, null, 'os outros não sabem');
  L.act(g, 'p0', { t: 'noite', alvo: 'p3' });
  sleepAll(g);
  assert.equal(g.anuncio.sumiu, 'p3');
  assert.equal(g.anuncio.saudade, 'p4');
  assert.ok(!pl(g, 'p4').vivo);
});

test('casal escolhido entre a vila quando a expansão está ligada', () => {
  for (let s = 0; s < 30; s++) {
    let seed = s + 3;
    const rnd = (n) => { seed = (seed * 16807) % 2147483647; return seed % n; };
    const g = L.newGame(Array.from({ length: 8 }, (_, i) => 'j' + i), { rnd, extras: true });
    assert.equal(g.casal.length, 2);
    assert.ok(g.casal.every((id) => !L.isCap(pl(g, id))));
  }
  assert.equal(L.newGame(['a', 'b', 'c', 'd', 'e', 'f']).casal, null);
});

test('lua cheia: capanga ataca duas pessoas', () => {
  const g = setup(['capanga', 'delegada', 'benzedeira', 'morador', 'morador', 'morador', 'morador']);
  g.especial = 'lua';
  assert.equal(L.viewFor(g, 'p0').me.max, 2);
  assert.throws(() => L.act(g, 'p1', { t: 'noite', alvos: ['p3', 'p4'] }), /válido/, 'só capanga escolhe dois');
  L.act(g, 'p0', { t: 'noite', alvos: ['p3', 'p4'] });
  L.act(g, 'p2', { t: 'noite', alvo: 'p4' });
  sleepAll(g);
  assert.equal(g.anuncio.sumiu, 'p3');
  assert.equal(g.anuncio.sumiu2, null, 'a Vó Zefa salvou o segundo');
  assert.ok(g.anuncio.salvo);
  assert.ok(!pl(g, 'p3').vivo && pl(g, 'p4').vivo);
});

test('festa junina: ninguém sai de casa', () => {
  const g = setup(['capanga', 'delegada', 'benzedeira', 'morador', 'morador']);
  g.especial = 'festa';
  assert.deepEqual(L.waiting(g), []);
  assert.throws(() => L.act(g, 'p0', { t: 'noite', alvo: 'p3' }), /festa/);
  L.timeout(g);
  assert.equal(g.anuncio.sumiu, null);
  assert.equal(g.anuncio.especial, 'festa');
});

test('neblina: voto secreto até o veredito', () => {
  const g = setup(['capanga', 'delegada', 'benzedeira', 'morador', 'morador']);
  g.especial = 'neblina';
  sleepAll(g);
  L.timeout(g); L.timeout(g);   // amanhecer → dia → votação
  assert.equal(g.fase, 'votacao');
  L.act(g, 'p1', { t: 'voto', alvo: 'p0' });
  L.act(g, 'p3', { t: 'voto', alvo: 'p0' });
  assert.deepEqual(L.viewFor(g, 'p3').votos, { p3: 'p0' });
  assert.ok(L.viewFor(g, 'p3').votoSecreto);
  L.timeout(g);
  assert.equal(g.fase, 'veredito');
  assert.equal(Object.keys(L.viewFor(g, 'p3').veredito.votos).length, 2);
});

test('noites especiais só aparecem com a opção ligada', () => {
  let seed = 11;
  const rnd = (n) => { seed = (seed * 16807) % 2147483647; return seed % n; };
  const g = L.newGame(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'], { rnd, especiais: true });
  const vistas = new Set();
  for (let i = 0; i < 60; i++) {
    g.fase = 'veredito';
    for (const p of g.players) p.vivo = true;
    L.timeout(g);
    if (g.especial) vistas.add(g.especial);
  }
  assert.ok(vistas.size >= 2, 'sorteou noites especiais');
  const g2 = L.newGame(['a', 'b', 'c', 'd', 'e'], { rnd });
  for (let i = 0; i < 20; i++) { g2.fase = 'veredito'; for (const p of g2.players) p.vivo = true; L.timeout(g2); assert.equal(g2.especial, null); }
});

test('partidas aleatórias com a expansão sempre terminam', () => {
  for (let s = 0; s < 300; s++) {
    let seed = s + 99;
    const rnd = (n) => { seed = (seed * 16807) % 2147483647; return seed % n; };
    const n = 4 + (s % 9);
    const g = L.newGame(Array.from({ length: n }, (_, i) => 'j' + i), { rnd, revelar: s % 2 === 0, extras: true, especiais: true });
    let steps = 0;
    while (g.fase !== 'fim' && steps++ < 3000) {
      const w = L.waiting(g);
      if (!w.length || rnd(6) === 0) { L.timeout(g); continue; }
      const id = w[rnd(w.length)];
      const p = g.players.find((x) => x.id === id);
      try {
        if (g.fase === 'noite') {
          const a = L.alvosNoite(g, p);
          const m = L.viewFor(g, id).me.max;
          L.act(g, id, m === 2 && a.length > 1 ? { t: 'noite', alvos: [a[0], a[1]] } : { t: 'noite', alvo: a[rnd(Math.max(1, a.length))] });
        } else if (g.fase === 'dia') L.act(g, id, { t: 'pronto' });
        else if (g.fase === 'votacao') { const v = L.vivos(g).filter((x) => x.id !== id); L.act(g, id, { t: 'voto', alvo: rnd(5) ? v[rnd(v.length)].id : 'pular' }); }
      } catch (e) { if (!(e instanceof L.RuleError)) throw e; }
      for (const x of g.players) L.viewFor(g, x.id);
    }
    assert.equal(g.fase, 'fim', `partida ${s} não terminou`);
  }
});

console.log(`Ninguém Dorme: ${passed} testes de regras passaram`);
