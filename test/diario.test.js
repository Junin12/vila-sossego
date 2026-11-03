'use strict';
// node test/diario.test.js — Intruso Diário: desafios bem formados, sorteio igual para todos e XP no passaporte.
const assert = require('assert');
const D = require('../public/diario/desafios');
const Perfil = require('../public/comum/perfil');
const norm = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

let passed = 0;
function test(name, fn) { try { fn(); passed++; } catch (e) { console.error(`FALHOU: ${name}\n`, e); process.exitCode = 1; } }

test('todo desafio é jogável e justo', () => {
  for (const [cat, palavra, outras, sabem, blefe] of D.D) {
    assert.ok(cat && palavra, palavra);
    assert.equal(outras.length, 3, palavra);
    assert.equal(new Set([palavra, ...outras].map(norm)).size, 4, `opções repetidas em ${palavra}`);
    assert.equal(sabem.length, 4, palavra);
    for (const d of [...sabem, blefe]) {
      assert.equal(d.length, 2, palavra);
      for (const x of d) assert.ok(!norm(x).includes(norm(palavra)), `dica entrega a palavra: ${palavra} / ${x}`);
    }
  }
});

test('desafio do dia: igual para todos, 1 intruso, sem repetir por 45 dias', () => {
  const vistos = new Set();
  for (let n = 1; n <= D.D.length; n++) {
    const a = D.doDia(n), b = D.doDia(n);
    assert.deepEqual(a, b, 'mesmo dia, mesmo desafio');
    assert.equal(a.suspeitos.filter((s) => s.intruso).length, 1);
    assert.equal(new Set(a.suspeitos.map((s) => s.nome)).size, 5);
    assert.ok(a.opcoes.includes(a.palavra));
    vistos.add(a.palavra);
  }
  assert.equal(vistos.size, D.D.length);
  assert.equal(D.numero(new Date(2026, 10, 1)), 1);
  assert.equal(D.numero(new Date(2026, 11, 1)), 31);
});

test('quadradinhos para compartilhar', () => {
  const t = D.resultadoTexto(7, { tentativas: 2, palavra: false, estrela: false, sequencia: 1 });
  assert.match(t, /#7/);
  assert.match(t, /Intruso: 🟨/);
  assert.match(t, /Palavra: 🟥/);
  assert.ok(!t.includes('⭐') && !t.includes('🔥'));
});

test('Intruso Diário dá XP e conquistas no passaporte', () => {
  const p = Perfil.blank();
  const r = Perfil.onDiario(p, { intruso: true, palavra: true, estrela: true, sequencia: 1 }, '2026-11-03');
  assert.equal(r.xp, 10 + 20 + 10 + 10 + 2);
  assert.ok(p.ach.diario1);
  Perfil.onDiario(p, { intruso: true, sequencia: 7 }, '2026-11-09');
  assert.ok(p.ach.diario7);
  assert.equal(p.partidas, 0, 'desafio sozinho não conta como partida');
});

console.log(`Intruso Diário: ${passed} testes passaram`);
