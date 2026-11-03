'use strict';
// node test/nuvem.test.js — Vila online: passaporte na nuvem, ranking, A Turma (hall da fama e rivalidades) e convites.
const assert = require('assert');
const os = require('os');
const path = require('path');
const fs = require('fs');
process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'vila-nuvem-'));
process.env.SEC_MS = '4';
delete process.env.SUPABASE_URL;
const { criarNuvem } = require('../nuvem');

// armazém em memória (o mesmo contrato do arquivo/Supabase)
function memoria() {
  const d = {};
  return { tipo: 'memoria', async get(k) { return d[k] === undefined ? null : JSON.parse(JSON.stringify(d[k])); }, async set(k, v) { d[k] = v; }, flush() {} };
}
const perfil = (xp) => ({ xp, partidas: 1 });

let passed = 0;
async function test(name, fn) { try { await fn(); passed++; } catch (e) { console.error(`FALHOU: ${name}\n`, e); process.exitCode = 1; } }

(async () => {
  const N = criarNuvem({ armazem: memoria() });
  const R = N.ROTAS;
  const COD_A = 'AAAAbbbbCCCCdddd1111', COD_B = 'BBBBccccDDDDeeee2222', COD_C = 'CCCCddddEEEEffff3333';

  await test('salva e carrega o passaporte pelo código; outro passaporte não sobrescreve', async () => {
    await R['/api/passaporte/salvar']({ codigo: COD_A, pp: 'aaaa1111', nome: 'Ana', avatar: 2, perfil: perfil(100) });
    const c = await R['/api/passaporte/carregar']({ codigo: COD_A });
    assert.equal(c.pp, 'aaaa1111'); assert.equal(c.perfil.xp, 100); assert.equal(c.nome, 'Ana');
    await assert.rejects(R['/api/passaporte/salvar']({ codigo: COD_A, pp: 'zzzz9999', nome: 'X', perfil: perfil(1) }), /outro passaporte/);
    await assert.rejects(R['/api/passaporte/carregar']({ codigo: 'nadaNADAnadaNADA0000' }), /Não achei/);
    await assert.rejects(R['/api/passaporte/salvar']({ codigo: 'curto', pp: 'aaaa1111', perfil: perfil(1) }), /inválido/);
  });

  await test('ranking da semana: só o XP ganho na semana conta; amigos e geral', async () => {
    await R['/api/passaporte/salvar']({ codigo: COD_A, pp: 'aaaa1111', nome: 'Ana', perfil: perfil(160) });   // +60
    await R['/api/passaporte/salvar']({ codigo: COD_B, pp: 'bbbb2222', nome: 'Beto', perfil: perfil(500) }); // novo: 0 na semana
    await R['/api/passaporte/salvar']({ codigo: COD_B, pp: 'bbbb2222', nome: 'Beto', perfil: perfil(530) }); // +30
    const r = await R['/api/ranking']({ pps: ['aaaa1111', 'bbbb2222', 'naoexiste'] });
    assert.deepEqual(r.amigos.map((x) => [x.nome, x.xpSemana]), [['Ana', 60], ['Beto', 30]]);
    assert.equal(r.geral[0].nome, 'Ana');
  });

  await test('indique e ganhe: quem convidou ganha +1 convite quando o novo salva pela 1ª vez', async () => {
    const s = await R['/api/passaporte/salvar']({ codigo: COD_C, pp: 'cccc3333', nome: 'Caio', perfil: perfil(20), ref: 'aaaa1111' });
    assert.ok(s.ok);
    await R['/api/passaporte/salvar']({ codigo: COD_C, pp: 'cccc3333', nome: 'Caio', perfil: perfil(40), ref: 'aaaa1111' });
    assert.equal((await R['/api/passaporte/carregar']({ codigo: COD_A })).convites, 1, 'conta uma vez só');
  });

  await test('A Turma: criar, entrar, partidas contam no hall da fama e nas rivalidades', async () => {
    const t = await R['/api/turma/criar']({ pp: 'aaaa1111', nome: 'Família Silva' });
    assert.match(t.id, /^[A-Z0-9]{6}$/);
    await R['/api/turma/entrar']({ pp: 'bbbb2222', id: t.id.toLowerCase() });
    await assert.rejects(R['/api/turma/entrar']({ pp: 'bbbb2222', id: 'ZZZZZZ' }), /não encontrada/);
    await N.registrarPartida('cara-de-pau', [{ pp: 'aaaa1111', nome: 'Ana', venceu: true }, { pp: 'bbbb2222', nome: 'Beto', venceu: false }, { pp: null, nome: 'Zé Bot', bot: true }]);
    await N.registrarPartida('intruso', [{ pp: 'aaaa1111', nome: 'Ana', venceu: true }, { pp: 'bbbb2222', nome: 'Beto', venceu: false }]);
    await N.registrarPartida('intruso', [{ pp: 'aaaa1111', nome: 'Ana', venceu: true }]);   // sozinha: não conta
    const v = await R['/api/turma/ver']({ id: t.id });
    assert.equal(v.nome, 'Família Silva');
    assert.deepEqual(v.membros.map((m) => [m.nome, m.partidas, m.vitorias]), [['Ana', 2, 2], ['Beto', 2, 0]]);
    assert.deepEqual(v.rivalidade, { vencedor: 'Ana', perdedor: 'Beto', vezes: 2 });
    assert.equal(v.hist.length, 2);
    assert.equal((await R['/api/turma/minhas']({ pp: 'bbbb2222' })).turmas[0].id, t.id);
  });

  // pelo servidor (arquivo em pasta temporária) e com partida de verdade alimentando a turma
  await test('rotas no servidor e partida real conta para a turma', async () => {
    const { server, GAMES, nuvem } = require('../server');
    await new Promise((r) => server.listen(0, '127.0.0.1', r));
    const base = `http://127.0.0.1:${server.address().port}`;
    const post = async (p, b) => { const r = await fetch(base + p, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) }); return { status: r.status, body: await r.json() }; };
    assert.equal((await post('/api/passaporte/salvar', { codigo: COD_A, pp: 'aaaa1111', nome: 'Ana', perfil: perfil(10) })).status, 200);
    assert.equal((await post('/api/passaporte/carregar', { codigo: 'x' })).status, 400);
    const t = (await post('/api/turma/criar', { pp: 'aaaa1111', nome: 'Turma do Teste' })).body;
    await post('/api/turma/entrar', { pp: 'bbbb2222', id: t.id });
    const a = (await post('/cara-de-pau/api/create', { name: 'Ana', pp: 'aaaa1111', bots: 1 })).body;
    await post('/cara-de-pau/api/join', { code: a.code, name: 'Beto', pp: 'bbbb2222' });
    await post('/cara-de-pau/api/act', { code: a.code, pid: a.pid, type: 'start' });
    const room = GAMES['cara-de-pau'].rooms.get(a.code);
    for (let i = 0; i < 400 && !room.counted; i++) await new Promise((r) => setTimeout(r, 50));
    assert.ok(room.counted, 'partida terminou');
    await new Promise((r) => setTimeout(r, 100));
    const v = (await post('/api/turma/ver', { id: t.id })).body;
    assert.equal(v.membros.reduce((s, m) => s + m.partidas, 0), 2, 'Ana e Beto ganharam 1 partida cada no hall');
    nuvem.flush();
    server.close();
    if (server.closeAllConnections) server.closeAllConnections();
  });

  console.log(`Vila online: ${passed} testes passaram`);
  process.exit(process.exitCode || 0);
})();
