'use strict';
// node test/perfil.test.js — Passaporte da Vila (XP, conquistas, personagens, desafio do dia).
const assert = require('assert');
const Perfil = require('../public/comum/perfil');

let passed = 0;
function test(name, fn) {
  try { fn(); passed++; } catch (e) { console.error(`FALHOU: ${name}\n`, e); process.exitCode = 1; }
}

test('partida de Cara de Pau dá XP, conquistas e conta blefes', () => {
  const p = Perfil.blank();
  const r = Perfil.onGame(p, { jogo: 'cdp', won: true, blefes: 4, duvidasCertas: 1, labiaWin: true }, '2026-11-01');
  assert.equal(p.cdp.blefes, 4);
  assert.equal(p.cdp.labia, 1);
  assert.ok(r.xp >= Perfil.XP.partida + Perfil.XP.vitoria + Perfil.XP.labia);
  assert.ok(r.ach.some((a) => a.id === 'estreia'));
  assert.ok(r.ach.some((a) => a.id === 'labia'));
  assert.ok(r.avatars.includes(19), 'vitória na lábia libera personagem');
});

test('Ninguém Dorme como capanga', () => {
  const p = Perfil.blank();
  Perfil.onGame(p, { jogo: 'nd', won: true, team: 'capangas', survived: true, votosCertos: 0 }, '2026-11-01');
  assert.equal(p.nd.vitCapanga, 1);
  assert.equal(p.nd.sobreviveu, 1);
  assert.ok(Perfil.unlocked(p, 14));
  assert.ok(!Perfil.unlocked(p, 15));
});

test('desafio do dia completa uma vez e dá bônus', () => {
  const p = Perfil.blank();
  const day = '2026-11-01';
  Perfil.touch(p, day);
  p.daily.id = 'play2';
  const r1 = Perfil.onGame(p, { jogo: 'cdp', won: false }, day);
  assert.ok(!r1.dailyDone);
  const r2 = Perfil.onGame(p, { jogo: 'nd', won: false, team: 'vila' }, day);
  assert.ok(r2.dailyDone);
  assert.equal(p.dailyDone, 1);
  const r3 = Perfil.onGame(p, { jogo: 'nd', won: false, team: 'vila' }, day);
  assert.ok(!r3.dailyDone);
  assert.ok(p.ach.os2, 'jogou os dois jogos');
});

test('sequência de vitórias e níveis', () => {
  const p = Perfil.blank();
  for (let i = 0; i < 3; i++) Perfil.onGame(p, { jogo: 'cdp', won: true }, '2026-11-01');
  assert.equal(p.bestStreak, 3);
  assert.ok(p.ach.st3);
  assert.ok(Perfil.levelInfo(p.xp).level >= 2);
  Perfil.onGame(p, { jogo: 'cdp', won: false }, '2026-11-01');
  assert.equal(p.streak, 0);
});

test('perfil antigo/incompleto é completado', () => {
  const p = { xp: 10 };
  Perfil.touch(p, '2026-11-01');
  assert.equal(p.cdp.blefes, 0);
  assert.ok(p.daily);
  assert.equal(p.temp.id, '2026-11');
});

test('temporada: 3 metas diferentes por mês, iguais para todos', () => {
  for (const mes of ['2026-11', '2026-12', '2027-01', '2027-06']) {
    const t = Perfil.temporada(mes);
    assert.equal(t.metas.length, 3);
    assert.equal(new Set(t.metas.map((m) => m.id)).size, 3, mes);
    assert.deepEqual(Perfil.temporada(mes).metas.map((m) => m.id), t.metas.map((m) => m.id));
  }
  assert.equal(Perfil.temporada('2026-12').nome, 'Natal na Vila');
});

test('temporada completa dá XP, selo e conquista uma vez só', () => {
  const p = Perfil.blank();
  const day = '2026-11-05';
  Perfil.touch(p, day);
  let done = null;
  const evento = { jogo: 'nd', won: true, team: 'capangas', blefes: 3, duvidasCertas: 2, votosCertos: 2, survived: true };
  for (let i = 0; i < 40 && !done; i++) {
    const r = Perfil.onGame(p, { ...evento, jogo: i % 2 ? 'nd' : 'cdp', team: i % 4 === 1 ? 'capangas' : 'vila' }, day);
    if (r.seasonDone) done = r;
  }
  assert.ok(done, 'completou a temporada');
  assert.ok(p.temp.done);
  assert.equal(p.temporadas['2026-11'], 'Novembro dos Mistérios');
  assert.ok(p.ach.temp1);
  const r = Perfil.onGame(p, evento, day);
  assert.ok(!r.seasonDone, 'não completa de novo');
  Perfil.touch(p, '2026-12-01');
  assert.equal(p.temp.id, '2026-12');
  assert.ok(!p.temp.done, 'mês novo, temporada nova');
});

console.log(`Passaporte: ${passed} testes passaram`);
