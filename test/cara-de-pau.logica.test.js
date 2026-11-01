'use strict';
// node test/cara-de-pau.logica.test.js — regras do Cara de Pau.
const assert = require('assert');
const L = require('../cara-de-pau/logica');

let passed = 0;
function test(name, fn) {
  try { fn(); passed++; } catch (e) { console.error(`FALHOU: ${name}\n`, e); process.exitCode = 1; }
}

// Partida com mãos e vez definidas para o teste.
function setup(hands, opts = {}) {
  const ids = hands.map((_, i) => 'p' + i);
  const g = L.newGame(ids, { rnd: () => 0, ...opts });
  hands.forEach((h, i) => { g.players[i].cards = h.map((c) => ({ c, lost: false })); });
  g.turn = 0; g.phase = 'turn'; g.waiting = ['p0'];
  return g;
}
const pl = (g, id) => g.players.find((p) => p.id === id);
const passAll = (g) => { for (const id of g.waiting.slice()) L.act(g, id, { t: 'passar' }); };

test('bico dá 1 moeda e passa a vez', () => {
  const g = setup([['prefeito', 'agiota'], ['delegada', 'fofoqueira']]);
  L.act(g, 'p0', { t: 'acao', a: 'bico' });
  assert.equal(pl(g, 'p0').coins, 3);
  assert.equal(g.phase, 'turn');
  assert.deepEqual(g.waiting, ['p1']);
});

test('verba verdadeira sem dúvida: +3 e sem lábia', () => {
  const g = setup([['prefeito', 'agiota'], ['delegada', 'fofoqueira']]);
  L.act(g, 'p0', { t: 'acao', a: 'verba' });
  assert.equal(g.phase, 'react');
  passAll(g);
  assert.equal(pl(g, 'p0').coins, 5);
  assert.equal(pl(g, 'p0').labia, 0);
});

test('blefe que cola dá lábia', () => {
  const g = setup([['agiota', 'agiota'], ['delegada', 'fofoqueira']]);
  L.act(g, 'p0', { t: 'acao', a: 'verba' });
  passAll(g);
  assert.equal(pl(g, 'p0').coins, 5);
  assert.equal(pl(g, 'p0').labia, 1);
});

test('duvidar de blefe: blefador perde segredo, zera lábia e ação não acontece', () => {
  const g = setup([['agiota', 'agiota'], ['delegada', 'fofoqueira'], ['prefeito', 'benzedeira']]);
  pl(g, 'p0').labia = 2;
  L.act(g, 'p0', { t: 'acao', a: 'verba' });
  L.act(g, 'p1', { t: 'duvidar' });
  assert.equal(g.phase, 'lose');
  assert.equal(g.loser, 'p0');
  L.act(g, 'p0', { t: 'perder', idx: 1 });
  assert.equal(pl(g, 'p0').coins, 2);
  assert.equal(pl(g, 'p0').labia, 0);
  assert.ok(pl(g, 'p0').cards[1].lost);
  assert.deepEqual(g.waiting, ['p1']);
});

test('duvidar de quem tinha a carta: quem duvidou perde e a carta é trocada', () => {
  const g = setup([['prefeito', 'agiota'], ['delegada', 'fofoqueira']]);
  L.act(g, 'p0', { t: 'acao', a: 'verba' });
  L.act(g, 'p1', { t: 'duvidar' });
  assert.equal(g.loser, 'p1');
  L.act(g, 'p1', { t: 'perder', idx: 0 });
  assert.equal(pl(g, 'p0').coins, 5);
  assert.equal(pl(g, 'p0').cards.filter((c) => !c.lost).length, 2);
  assert.equal(g.phase, 'turn');
});

test('fofoca pode ser bloqueada pela benzedeira', () => {
  const g = setup([['fofoqueira', 'agiota'], ['benzedeira', 'prefeito']]);
  pl(g, 'p0').coins = 3;
  L.act(g, 'p0', { t: 'acao', a: 'fofoca', target: 'p1' });
  assert.equal(pl(g, 'p0').coins, 0);
  L.act(g, 'p1', { t: 'bloquear' });
  assert.equal(g.claim.kind, 'bloqueio');
  passAll(g);
  assert.equal(pl(g, 'p1').cards.filter((c) => c.lost).length, 0);
  assert.equal(g.turn, 1);
});

test('bloqueio de mentira desmascarado: bloqueador perde e a fofoca acontece', () => {
  const g = setup([['fofoqueira', 'agiota'], ['prefeito', 'prefeito']]);
  pl(g, 'p0').coins = 3;
  L.act(g, 'p0', { t: 'acao', a: 'fofoca', target: 'p1' });
  L.act(g, 'p1', { t: 'bloquear' });
  L.act(g, 'p0', { t: 'duvidar' });
  L.act(g, 'p1', { t: 'perder', idx: 0 });   // perde pelo bloqueio falso
  assert.equal(g.phase, 'end');              // e a fofoca leva o último segredo
  assert.equal(g.winner, 'p0');
});

test('depois de provar a ação, o alvo ainda pode bloquear', () => {
  const g = setup([['agiota', 'prefeito'], ['delegada', 'fofoqueira'], ['benzedeira', 'prefeito']]);
  L.act(g, 'p0', { t: 'acao', a: 'cobranca', target: 'p1' });
  L.act(g, 'p2', { t: 'duvidar' });
  L.act(g, 'p2', { t: 'perder', idx: 0 });
  assert.equal(g.phase, 'react');
  assert.deepEqual(g.waiting, ['p1']);
  L.act(g, 'p1', { t: 'bloquear' });
  passAll(g);
  assert.equal(pl(g, 'p1').coins, 2);
});

test('cobrança tira até 2 moedas', () => {
  const g = setup([['agiota', 'prefeito'], ['delegada', 'fofoqueira']]);
  pl(g, 'p1').coins = 1;
  L.act(g, 'p0', { t: 'acao', a: 'cobranca', target: 'p1' });
  passAll(g);
  assert.equal(pl(g, 'p1').coins, 0);
  assert.equal(pl(g, 'p0').coins, 3);
});

test('preso não reage e na vez só faz bico', () => {
  const g = setup([['delegada', 'prefeito'], ['fofoqueira', 'agiota'], ['benzedeira', 'agiota']]);
  pl(g, 'p0').coins = 3;
  L.act(g, 'p0', { t: 'acao', a: 'prisao', target: 'p1' });
  passAll(g);
  assert.ok(pl(g, 'p1').preso);
  assert.throws(() => L.act(g, 'p1', { t: 'acao', a: 'verba' }), /preso/);
  L.act(g, 'p1', { t: 'acao', a: 'bico' });
  assert.ok(!pl(g, 'p1').preso);
});

test('preso fica de fora da janela de reação', () => {
  const g = setup([['prefeito', 'agiota'], ['fofoqueira', 'agiota'], ['benzedeira', 'agiota']]);
  pl(g, 'p1').preso = true;
  L.act(g, 'p0', { t: 'acao', a: 'verba' });
  assert.deepEqual(g.waiting, ['p2']);
});

test('com 10 moedas o escândalo é obrigatório', () => {
  const g = setup([['prefeito', 'agiota'], ['delegada', 'fofoqueira']]);
  pl(g, 'p0').coins = 10;
  assert.throws(() => L.act(g, 'p0', { t: 'acao', a: 'bico' }), /Escândalo/);
  L.act(g, 'p0', { t: 'acao', a: 'escandalo', target: 'p1' });
  assert.equal(pl(g, 'p0').coins, 3);
  assert.equal(g.phase, 'lose');
});

test('reza recupera segredo perdido', () => {
  const g = setup([['benzedeira', 'agiota'], ['delegada', 'fofoqueira']]);
  pl(g, 'p0').cards[1].lost = true;
  pl(g, 'p0').coins = 5;
  L.act(g, 'p0', { t: 'acao', a: 'reza' });
  passAll(g);
  assert.equal(pl(g, 'p0').cards.filter((c) => !c.lost).length, 2);
  assert.equal(pl(g, 'p0').coins, 0);
});

test('mudança troca o segredo escolhido', () => {
  const g = setup([['prefeito', 'agiota'], ['delegada', 'fofoqueira']]);
  const before = g.deck.length;
  L.act(g, 'p0', { t: 'acao', a: 'mudanca', idx: 0 });
  assert.equal(pl(g, 'p0').coins, 1);
  assert.equal(g.deck.length, before);
});

test('vitória na lábia', () => {
  const g = setup([['agiota', 'agiota'], ['delegada', 'fofoqueira']], { labia: 2 });
  assert.throws(() => L.act(g, 'p0', { t: 'acao', a: 'labia' }), /lábia/);
  pl(g, 'p0').labia = 2;
  L.act(g, 'p0', { t: 'acao', a: 'labia' });
  assert.equal(g.winner, 'p0');
  assert.equal(g.how, 'labia');
});

test('lábia desligada não deixa vencer assim', () => {
  const g = setup([['agiota', 'agiota'], ['delegada', 'fofoqueira']], { labia: 0 });
  pl(g, 'p0').labia = 9;
  assert.throws(() => L.act(g, 'p0', { t: 'acao', a: 'labia' }));
});

test('visão esconde segredos e lábia dos outros', () => {
  const g = setup([['prefeito', 'agiota'], ['delegada', 'fofoqueira']]);
  pl(g, 'p1').labia = 3;
  const v = L.viewFor(g, 'p0');
  assert.equal(v.players[0].cards[0].c, 'prefeito');
  assert.equal(v.players[1].cards[0].c, null);
  assert.equal(v.players[1].labia, null);
});

test('não age fora da vez', () => {
  const g = setup([['prefeito', 'agiota'], ['delegada', 'fofoqueira']]);
  assert.throws(() => L.act(g, 'p1', { t: 'acao', a: 'bico' }), /vez/);
});

test('partidas aleatórias com timeout sempre terminam', () => {
  for (let s = 0; s < 300; s++) {
    let seed = s + 1;
    const rnd = (n) => { seed = (seed * 16807) % 2147483647; return seed % n; };
    const n = 2 + (s % 5);
    const g = L.newGame(Array.from({ length: n }, (_, i) => 'j' + i), { rnd, labia: s % 2 ? 4 : 0, eventos: s % 3 === 0 });
    const acts = ['bico', 'verba', 'cobranca', 'prisao', 'fofoca', 'reza', 'mudanca', 'escandalo', 'labia'];
    let steps = 0;
    while (g.phase !== 'end' && steps++ < 5000) {
      const id = g.waiting[rnd(g.waiting.length)];
      const r = rnd(10);
      try {
        if (g.phase === 'turn') {
          const others = g.players.filter((p) => !p.out && p.id !== id);
          L.act(g, id, { t: 'acao', a: acts[rnd(acts.length)], target: others[rnd(others.length)].id, idx: rnd(2) });
        } else if (g.phase === 'react') {
          L.act(g, id, { t: r < 2 ? 'duvidar' : r < 4 ? 'bloquear' : 'passar' });
        } else {
          L.act(g, id, { t: 'perder', idx: rnd(2) });
        }
      } catch (e) {
        if (!(e instanceof L.RuleError)) throw e;
        if (r < 3) L.timeout(g);
      }
      const cards = g.deck.length + g.players.reduce((s2, p) => s2 + p.cards.length, 0);
      assert.equal(cards, 15, 'baralho não pode perder cartas');
      assert.ok(g.players.every((p) => p.coins >= 0));
    }
    assert.equal(g.phase, 'end', `partida ${s} não terminou`);
  }
});

test('modo eventos: sorteia evento a cada volta e aplica custo', () => {
  const g = setup([['prefeito', 'agiota'], ['delegada', 'fofoqueira']], { eventos: true });
  assert.ok(g.evento, 'primeira volta já tem evento');
  g.evento = 'eleicao';
  pl(g, 'p0').coins = 5;
  L.act(g, 'p0', { t: 'acao', a: 'escandalo', target: 'p1' });
  assert.equal(pl(g, 'p0').coins, 0);
});

test('apagão: ninguém duvida e o blefe passa direto', () => {
  const g = setup([['agiota', 'agiota'], ['delegada', 'fofoqueira']], { eventos: true });
  g.evento = 'apagao';
  L.act(g, 'p0', { t: 'acao', a: 'verba' });
  assert.equal(g.phase, 'turn');
  assert.equal(pl(g, 'p0').coins, 5);
  assert.equal(pl(g, 'p0').stats.blefes, 1);
});

test('volta completa sorteia novo evento', () => {
  const g = setup([['prefeito', 'agiota'], ['delegada', 'fofoqueira']], { eventos: true });
  g.first = 0;
  const v = g.volta;
  L.act(g, 'p0', { t: 'acao', a: 'bico' });
  L.act(g, 'p1', { t: 'acao', a: 'bico' });
  assert.equal(g.volta, v + 1);
});

test('estatísticas de dúvida', () => {
  const g = setup([['agiota', 'agiota'], ['delegada', 'fofoqueira']]);
  L.act(g, 'p0', { t: 'acao', a: 'verba' });
  L.act(g, 'p1', { t: 'duvidar' });
  assert.equal(pl(g, 'p1').stats.acertos, 1);
  assert.equal(pl(g, 'p0').stats.pego, 1);
});

test('feira desligada: ações da expansão não existem', () => {
  const g = setup([['prefeito', 'agiota'], ['delegada', 'fofoqueira']]);
  assert.ok(!g.moradores.includes('padre'));
  assert.throws(() => L.act(g, 'p0', { t: 'acao', a: 'pechincha' }), /desconhecida/);
  assert.equal(L.blockerOf('prisao', g), null, 'sem padre, prisão não tem bloqueio');
});

test('pechincha: 1 moeda de cada mais rico (até 3)', () => {
  const g = setup([['feirante', 'agiota'], ['delegada', 'fofoqueira'], ['prefeito', 'padre'], ['agiota', 'agiota']], { feira: true });
  pl(g, 'p0').coins = 1; pl(g, 'p1').coins = 5; pl(g, 'p2').coins = 1; pl(g, 'p3').coins = 3;
  L.act(g, 'p0', { t: 'acao', a: 'pechincha' });
  passAll(g);
  assert.equal(pl(g, 'p0').coins, 3);
  assert.equal(pl(g, 'p1').coins, 4);
  assert.equal(pl(g, 'p2').coins, 1, 'quem não é mais rico não paga');
});

test('confissão: espia um segredo, só quem fez vê', () => {
  const g = setup([['padre', 'agiota'], ['delegada', 'fofoqueira'], ['prefeito', 'agiota']], { feira: true });
  L.act(g, 'p0', { t: 'acao', a: 'confissao', target: 'p1' });
  passAll(g);
  const v = L.viewFor(g, 'p0');
  assert.equal(v.priv.length, 1);
  assert.equal(v.priv[0].alvo, 'p1');
  assert.ok(['delegada', 'fofoqueira'].includes(v.priv[0].c));
  assert.equal(L.viewFor(g, 'p2').priv.length, 0);
});

test('padre bloqueia a prisão', () => {
  const g = setup([['delegada', 'agiota'], ['padre', 'fofoqueira']], { feira: true });
  pl(g, 'p0').coins = 3;
  L.act(g, 'p0', { t: 'acao', a: 'prisao', target: 'p1' });
  assert.ok(L.viewFor(g, 'p1').canBlock);
  L.act(g, 'p1', { t: 'bloquear' });
  L.act(g, 'p0', { t: 'passar' });
  assert.ok(!pl(g, 'p1').preso);
});

test('relâmpago: um segredo só e 3 moedas', () => {
  const g = L.newGame(['a', 'b', 'c'], { rnd: () => 0, cartas: 1 });
  assert.ok(g.players.every((p) => p.cards.length === 1 && p.coins === 3));
  const g2 = setup([['prefeito'], ['delegada'], ['agiota']], { cartas: 1 });
  pl(g2, 'p0').coins = 7;
  L.act(g2, 'p0', { t: 'acao', a: 'escandalo', target: 'p1' });
  assert.ok(pl(g2, 'p1').out, 'perdeu o único segredo e saiu');
});

test('duplas: precisa de 4 ou 6, não ataca a dupla e vê os segredos dela', () => {
  assert.throws(() => L.newGame(['a', 'b', 'c'], { duplas: true }), /Duplas/);
  const g = setup([['prefeito', 'agiota'], ['delegada', 'fofoqueira'], ['benzedeira', 'agiota'], ['delegada', 'prefeito']], { duplas: true });
  assert.ok(L.parceiros(g, pl(g, 'p0'), pl(g, 'p2')));
  pl(g, 'p0').coins = 7;
  assert.throws(() => L.act(g, 'p0', { t: 'acao', a: 'escandalo', target: 'p2' }), /dupla/);
  const v = L.viewFor(g, 'p0');
  assert.equal(v.players[2].cards[0].c, 'benzedeira', 'vê a dupla');
  assert.equal(v.players[1].cards[0].c, null, 'não vê o adversário');
});

test('duplas: a dupla vence junta quando só ela sobra', () => {
  const g = setup([['prefeito', 'agiota'], ['delegada', 'fofoqueira'], ['benzedeira', 'agiota'], ['delegada', 'prefeito']], { duplas: true });
  pl(g, 'p1').cards[0].lost = true;
  pl(g, 'p3').cards[0].lost = true;
  pl(g, 'p3').cards[1].lost = true; pl(g, 'p3').out = true;
  pl(g, 'p0').coins = 7;
  L.act(g, 'p0', { t: 'acao', a: 'escandalo', target: 'p1' });
  assert.equal(g.phase, 'end');
  assert.deepEqual(g.winners.sort(), ['p0', 'p2']);
});

test('partidas aleatórias com feira, relâmpago e duplas sempre terminam', () => {
  for (let s = 0; s < 300; s++) {
    let seed = s + 41;
    const rnd = (n) => { seed = (seed * 16807) % 2147483647; return seed % n; };
    const duplas = s % 3 === 0;
    const n = duplas ? (s % 2 ? 4 : 6) : 2 + (s % 5);
    const cartas = s % 4 === 1 ? 1 : 2;
    const g = L.newGame(Array.from({ length: n }, (_, i) => 'j' + i), { rnd, labia: s % 2 ? 4 : 0, eventos: s % 5 === 0, feira: true, cartas, duplas });
    const acts = ['bico', 'verba', 'cobranca', 'prisao', 'fofoca', 'reza', 'mudanca', 'escandalo', 'labia', 'pechincha', 'confissao'];
    let steps = 0;
    while (g.phase !== 'end' && steps++ < 5000) {
      const id = g.waiting[rnd(g.waiting.length)];
      const r = rnd(10);
      try {
        if (g.phase === 'turn') {
          const others = g.players.filter((p) => !p.out && p.id !== id);
          L.act(g, id, { t: 'acao', a: acts[rnd(acts.length)], target: others[rnd(others.length)].id, idx: rnd(cartas) });
        } else if (g.phase === 'react') {
          L.act(g, id, { t: r < 2 ? 'duvidar' : r < 4 ? 'bloquear' : 'passar' });
        } else {
          L.act(g, id, { t: 'perder', idx: rnd(cartas) });
        }
      } catch (e) {
        if (!(e instanceof L.RuleError)) throw e;
        if (r < 3) L.timeout(g);
      }
      const cards = g.deck.length + g.players.reduce((s2, p) => s2 + p.cards.length, 0);
      assert.equal(cards, 21, 'baralho com a feira tem 21 cartas');
    }
    assert.equal(g.phase, 'end', `partida ${s} não terminou`);
    assert.ok(g.winners.length === (duplas ? 2 : 1));
  }
});

console.log(`Cara de Pau: ${passed} testes de regras passaram`);
