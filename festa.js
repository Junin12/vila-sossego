'use strict';
// Noite de Festa: várias partidas, de qualquer jogo da vila, com um placar único da noite e prendas para quem perde.
// Cada jogo avisa quando uma partida acaba (registrar) e pode abrir a sala do próximo jogo (proximo).
// Fica em memória, como as salas: some depois de 12 horas sem uso.

const crypto = require('crypto');
const PRENDAS = require('./public/comum/prendas');

const PRAZO_MS = 12 * 60 * 60 * 1000;
const JOGOS = { 'cara-de-pau': 'Cara de Pau', 'ninguem-dorme': 'Ninguém Dorme', intruso: 'Intruso' };
const PONTOS = { vitoria: 3, presenca: 1 };

const festas = new Map();
const abridores = {};   // slug → (host, festaId) => { code, pid }
const rnd = (n) => crypto.randomInt(n);
const norm = (s) => String(s || '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

function criar(familia) {
  const f = { id: crypto.randomBytes(6).toString('hex'), familia: !!familia, jogos: [], placar: {}, prenda: null, uso: Date.now() };
  festas.set(f.id, f);
  return f;
}

const get = (id) => { const f = id && festas.get(id); if (f) f.uso = Date.now(); return f || null; };

// resultado: [{ name, avatar, venceu, bot }]. Bots não entram no placar da noite nem pagam prenda.
function registrar(id, slug, resultado) {
  const f = get(id);
  if (!f) return null;
  const gente = resultado.filter((r) => !r.bot);
  if (!gente.length) return null;
  for (const r of gente) {
    const k = norm(r.name);
    const p = f.placar[k] || (f.placar[k] = { name: r.name, avatar: r.avatar, pontos: 0, vitorias: 0, jogos: 0 });
    p.name = r.name; p.avatar = r.avatar; p.jogos += 1;
    p.pontos += r.venceu ? PONTOS.vitoria : PONTOS.presenca;
    if (r.venceu) p.vitorias += 1;
  }
  f.jogos.push({ slug, vencedores: gente.filter((r) => r.venceu).map((r) => r.name) });
  const perdedores = gente.filter((r) => !r.venceu);
  f.prenda = perdedores.length ? { para: perdedores[rnd(perdedores.length)].name, texto: PRENDAS.sortear(f.familia, rnd), n: f.jogos.length } : null;
  return f;
}

function resumo(f) {
  if (!f) return null;
  const placar = Object.values(f.placar).sort((a, b) => b.pontos - a.pontos || b.vitorias - a.vitorias).slice(0, 12);
  return { id: f.id, familia: f.familia, jogos: f.jogos.length, ultimo: f.jogos[f.jogos.length - 1] || null, placar, prenda: f.prenda, nomes: JOGOS };
}

// Abre a sala do próximo jogo da noite com o anfitrião dentro; os outros entram pelo link (state.next).
function proximo(id, slug, host) {
  const f = get(id);
  if (!f) throw new Error('Essa noite de festa acabou.');
  if (!abridores[slug]) throw new Error('Jogo desconhecido.');
  return abridores[slug](host, f.id);
}

const registrarJogo = (slug, abrir) => { abridores[slug] = abrir; };

setInterval(() => {
  for (const [id, f] of festas) if (Date.now() - f.uso > PRAZO_MS) festas.delete(id);
}, 30 * 60 * 1000).unref();

module.exports = { criar, get, registrar, resumo, proximo, registrarJogo, JOGOS, PONTOS, festas };
