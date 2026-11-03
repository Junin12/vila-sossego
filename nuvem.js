'use strict';
// Vila online: passaporte salvo na nuvem (pelo código secreto), ranking da semana (amigos e geral), "A Turma"
// (grupo fixo com hall da fama e rivalidades, alimentado pelo próprio servidor no fim das partidas) e "indique e ganhe".
//
// Armazenamento chave → valor (JSON), em dois sabores:
//  - Supabase (SUPABASE_URL + SUPABASE_SERVICE_KEY no ambiente): tabela vila_kv (ver supabase/vila_kv.sql). Persistente.
//  - Arquivo (padrão): DATA_DIR/vila-dados.json. Na hospedagem grátis do Render o disco some a cada atualização.
// Nada aqui é dinheiro: é diversão; o código secreto só protege o passaporte de ser sobrescrito por outra pessoa.

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

class NuvemErro extends Error {}
const falha = (m) => { throw new NuvemErro(m); };
const hash = (s) => crypto.createHash('sha256').update(String(s)).digest('hex').slice(0, 40);
const limpa = (s, max) => String(s == null ? '' : s).replace(/\s+/g, ' ').trim().slice(0, max);
const PP = /^[a-z0-9]{8}$/;
const CODIGO = /^[A-Za-z0-9]{16,40}$/;
const TURMA_LETRAS = 'ABCDEFGHJKLMNPQRSTUVXZ23456789';

// semana ISO (ex.: 2026-W45): o ranking zera toda segunda
function semana(d = new Date()) {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dia = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - dia);
  const ano = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return `${t.getUTCFullYear()}-W${String(Math.ceil(((t - ano) / 86400000 + 1) / 7)).padStart(2, '0')}`;
}

// ---------- armazenamento ----------
function armazemArquivo(dir) {
  const arq = path.join(dir, 'vila-dados.json');
  let dados = {};
  try { dados = JSON.parse(fs.readFileSync(arq, 'utf8')); } catch { dados = {}; }
  let timer = null;
  const gravar = () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      try { fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(arq + '.tmp', JSON.stringify(dados)); fs.renameSync(arq + '.tmp', arq); }
      catch (e) { console.error('nuvem: não gravou', e.message); }
    }, 300);
    if (timer.unref) timer.unref();
  };
  return {
    tipo: 'arquivo',
    async get(k) { return dados[k] === undefined ? null : JSON.parse(JSON.stringify(dados[k])); },
    async set(k, v) { dados[k] = v; gravar(); },
    flush() { clearTimeout(timer); try { fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(arq, JSON.stringify(dados)); } catch { /* ok */ } },
  };
}

function armazemSupabase(url, chave) {
  const base = `${url.replace(/\/$/, '')}/rest/v1/vila_kv`;
  const cab = { apikey: chave, Authorization: `Bearer ${chave}`, 'Content-Type': 'application/json' };
  return {
    tipo: 'supabase',
    async get(k) {
      const r = await fetch(`${base}?k=eq.${encodeURIComponent(k)}&select=v`, { headers: cab });
      if (!r.ok) throw new Error(`supabase ${r.status}`);
      const rows = await r.json();
      return rows.length ? rows[0].v : null;
    },
    async set(k, v) {
      const r = await fetch(base, { method: 'POST', headers: { ...cab, Prefer: 'resolution=merge-duplicates' }, body: JSON.stringify({ k, v, atualizado: new Date().toISOString() }) });
      if (!r.ok) throw new Error(`supabase ${r.status}`);
    },
    flush() {},
  };
}

function criarNuvem(opts = {}) {
  const env = opts.env || process.env;
  const db = opts.armazem || (env.SUPABASE_URL && env.SUPABASE_SERVICE_KEY
    ? armazemSupabase(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY)
    : armazemArquivo(env.DATA_DIR || path.join(__dirname, 'dados')));
  // fila simples para não perder atualizações simultâneas da mesma chave (um processo só)
  const filas = new Map();
  function emFila(k, fn) {
    const ant = filas.get(k) || Promise.resolve();
    const prox = ant.then(fn, fn);
    filas.set(k, prox.catch(() => {}));
    return prox;
  }
  const mudar = (k, fn) => emFila(k, async () => { const v = await db.get(k); const n = fn(v); await db.set(k, n); return n; });

  // ---------- passaporte ----------
  async function salvarPassaporte(b) {
    if (!CODIGO.test(b.codigo || '')) falha('Código do passaporte inválido.');
    if (!PP.test(b.pp || '')) falha('Passaporte inválido.');
    const perfil = b.perfil && typeof b.perfil === 'object' ? b.perfil : null;
    if (!perfil || typeof perfil.xp !== 'number' || perfil.xp < 0) falha('Passaporte inválido.');
    const nome = limpa(b.nome, 14) || 'Morador';
    const avatar = typeof b.avatar === 'number' ? b.avatar : 0;
    const kp = 'p:' + hash(b.codigo);
    let novo = false, anterior = 0;
    const doc = await mudar(kp, (v) => {
      if (v && v.pp !== b.pp) falha('Esse código pertence a outro passaporte.');
      novo = !v;
      anterior = v ? v.xp : perfil.xp;
      return { pp: b.pp, nome, avatar, perfil, xp: perfil.xp, convidadoPor: v ? v.convidadoPor : (PP.test(b.ref || '') && b.ref !== b.pp ? b.ref : null), at: Date.now() };
    });
    const sem = semana();
    const ganho = Math.max(0, Math.min(5000, perfil.xp - anterior));   // limite contra exagero
    const pub = await mudar('pp:' + b.pp, (v) => {
      const p = v || { convites: 0 };
      const xpSemana = p.semana === sem ? p.xpSemana + ganho : ganho;
      return { ...p, nome, avatar, xp: perfil.xp, semana: sem, xpSemana, at: Date.now() };
    });
    if (novo && doc.convidadoPor) await mudar('pp:' + doc.convidadoPor, (v) => (v ? { ...v, convites: (v.convites || 0) + 1 } : v));
    await mudar('top:' + sem, (v) => {
      const lista = (v || []).filter((x) => x.pp !== b.pp);
      lista.push({ pp: b.pp, nome, avatar, xpSemana: pub.xpSemana });
      return lista.sort((a, c) => c.xpSemana - a.xpSemana).slice(0, 50);
    });
    return { ok: true, xpSemana: pub.xpSemana, convites: pub.convites || 0 };
  }

  async function carregarPassaporte(b) {
    if (!CODIGO.test(b.codigo || '')) falha('Código do passaporte inválido.');
    const doc = await db.get('p:' + hash(b.codigo));
    if (!doc) falha('Não achei nenhum passaporte com esse código.');
    const pub = (await db.get('pp:' + doc.pp)) || {};
    return { pp: doc.pp, nome: doc.nome, avatar: doc.avatar, perfil: doc.perfil, convites: pub.convites || 0 };
  }

  async function ranking(b) {
    const sem = semana();
    const pps = Array.isArray(b.pps) ? b.pps.filter((x) => PP.test(x)).slice(0, 60) : [];
    const amigos = [];
    for (const pp of pps) {
      const v = await db.get('pp:' + pp);
      if (v) amigos.push({ pp, nome: v.nome, avatar: v.avatar, xpSemana: v.semana === sem ? v.xpSemana : 0, xp: v.xp });
    }
    amigos.sort((a, c) => c.xpSemana - a.xpSemana || c.xp - a.xp);
    return { semana: sem, amigos, geral: ((await db.get('top:' + sem)) || []).slice(0, 20) };
  }

  // ---------- A Turma ----------
  async function criarTurma(b) {
    if (!PP.test(b.pp || '')) falha('Passaporte inválido.');
    const nome = limpa(b.nome, 24);
    if (!nome) falha('Dê um nome para a turma.');
    let id = '';
    for (let i = 0; i < 20; i++) {
      id = Array.from({ length: 6 }, () => TURMA_LETRAS[crypto.randomInt(TURMA_LETRAS.length)]).join('');
      if (!(await db.get('t:' + id))) break;
    }
    await db.set('t:' + id, { id, nome, membros: [b.pp], criada: Date.now(), stats: {}, riv: {}, hist: [] });
    await mudar('tp:' + b.pp, (v) => [...new Set([id, ...(v || [])])].slice(0, 5));
    return { id, nome };
  }

  async function entrarTurma(b) {
    if (!PP.test(b.pp || '')) falha('Passaporte inválido.');
    const id = limpa(b.id, 6).toUpperCase();
    const t = await mudar('t:' + id, (v) => {
      if (!v) falha('Turma não encontrada. Confira o código.');
      if (!v.membros.includes(b.pp)) {
        if (v.membros.length >= 30) falha('Essa turma já tem 30 pessoas.');
        v.membros.push(b.pp);
      }
      return v;
    });
    await mudar('tp:' + b.pp, (v) => [...new Set([id, ...(v || [])])].slice(0, 5));
    return { id: t.id, nome: t.nome };
  }

  async function verTurma(b) {
    const id = limpa(b.id, 6).toUpperCase();
    const t = await db.get('t:' + id);
    if (!t) falha('Turma não encontrada.');
    const membros = [];
    for (const pp of t.membros) {
      const v = (await db.get('pp:' + pp)) || {};
      const s = t.stats[pp] || { partidas: 0, vitorias: 0, porJogo: {} };
      membros.push({ pp, nome: v.nome || 'Morador', avatar: v.avatar || 0, ...s });
    }
    membros.sort((a, c) => c.vitorias - a.vitorias || c.partidas - a.partidas);
    // maior rivalidade: quem mais venceu alguém da turma
    let rival = null;
    for (const [a, alvos] of Object.entries(t.riv)) for (const [bb, n] of Object.entries(alvos)) if (!rival || n > rival.n) rival = { a, b: bb, n };
    const nomeDe = (pp) => (membros.find((m) => m.pp === pp) || { nome: 'alguém' }).nome;
    return { id: t.id, nome: t.nome, membros, hist: t.hist.slice(-15).reverse(),
      rivalidade: rival ? { vencedor: nomeDe(rival.a), perdedor: nomeDe(rival.b), vezes: rival.n } : null };
  }

  async function minhasTurmas(b) {
    if (!PP.test(b.pp || '')) falha('Passaporte inválido.');
    const ids = (await db.get('tp:' + b.pp)) || [];
    const out = [];
    for (const id of ids) { const t = await db.get('t:' + id); if (t) out.push({ id, nome: t.nome, membros: t.membros.length }); }
    return { turmas: out };
  }

  // Fim de partida (chamado pelos jogos): conta para toda turma que tenha 2+ membros na mesa
  async function registrarPartida(slug, jogadores) {
    const gente = jogadores.filter((j) => PP.test(j.pp || '') && !j.bot);
    if (gente.length < 2) return;
    const turmas = new Set();
    for (const j of gente) for (const id of (await db.get('tp:' + j.pp)) || []) turmas.add(id);
    for (const id of turmas) {
      await mudar('t:' + id, (t) => {
        if (!t) return t;
        const dentro = gente.filter((j) => t.membros.includes(j.pp));
        if (dentro.length < 2) return t;
        for (const j of dentro) {
          const s = t.stats[j.pp] || (t.stats[j.pp] = { partidas: 0, vitorias: 0, porJogo: {} });
          const pj = s.porJogo[slug] || (s.porJogo[slug] = { p: 0, v: 0 });
          s.partidas++; pj.p++;
          if (j.venceu) { s.vitorias++; pj.v++; }
        }
        for (const w of dentro.filter((j) => j.venceu)) {
          for (const l of dentro.filter((j) => !j.venceu)) { const r = t.riv[w.pp] || (t.riv[w.pp] = {}); r[l.pp] = (r[l.pp] || 0) + 1; }
        }
        t.hist.push({ jogo: slug, quando: Date.now(), vencedores: dentro.filter((j) => j.venceu).map((j) => j.nome), jogadores: dentro.length });
        if (t.hist.length > 200) t.hist.splice(0, t.hist.length - 200);
        return t;
      });
    }
  }

  const ROTAS = {
    '/api/passaporte/salvar': salvarPassaporte, '/api/passaporte/carregar': carregarPassaporte, '/api/ranking': ranking,
    '/api/turma/criar': criarTurma, '/api/turma/entrar': entrarTurma, '/api/turma/ver': verTurma, '/api/turma/minhas': minhasTurmas,
  };
  return { ROTAS, registrarPartida, tipo: db.tipo, flush: () => db.flush(), NuvemErro, semana };
}

module.exports = { criarNuvem, NuvemErro, semana };
