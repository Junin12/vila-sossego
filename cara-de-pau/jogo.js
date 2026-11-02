'use strict';
// Cara de Pau dentro das salas da Vila Sossego: opções, relógio de cada fase e os bots.

const crypto = require('crypto');
const L = require('./logica');
const { ACOES, COPIAS } = require('../public/cara-de-pau/moradores');

const rnd = (n) => crypto.randomInt(n);
const chance = (pct) => rnd(100) < pct;
const pickOne = (arr) => arr[rnd(arr.length)];

const OPTIONS = { labia: [0, 3, 4, 5], reactSecs: [8, 12, 20], eventos: [0, 1], feira: [0, 1], cartas: [2, 1], duplas: [0, 1], torneio: [0, 1] };
const DEFAULTS = { labia: 4, reactSecs: 12, eventos: 1, feira: 1, cartas: 2, duplas: 0, torneio: 0 };
const TORNEIO_JOGOS = 3;
const { MORADORES } = require('../public/cara-de-pau/moradores');
const limpa = (s, max) => String(s == null ? '' : s).replace(/\s+/g, ' ').trim().slice(0, max);
const TURN_SECS = 45;
const LOSE_SECS = 20;
const VALUE = { fofoqueira: 5, prefeito: 4, feirante: 3, benzedeira: 3, delegada: 3, padre: 2, agiota: 2 };   // o que o bot prefere guardar

const P = (g, id) => g.players.find((p) => p.id === id);

// Quantas cópias de cada morador já estão à vista (perdidas na mesa).
function seen(g) {
  const c = {};
  for (const p of g.players) for (const x of p.cards) if (x.lost) c[x.c] = (c[x.c] || 0) + 1;
  return c;
}

function botTurn(g, p) {
  const others = g.players.filter((x) => !x.out && x.id !== p.id && !L.parceiros(g, p, x));
  const mine = new Set(L.alive(p).map((x) => x.c));
  const can = (a) => (!ACOES[a].carta || g.moradores.includes(ACOES[a].carta)) && p.coins >= L.custo(g, a);
  const ricos = others.filter((x) => x.coins > p.coins).length;
  const threat = (x) => L.alive(x).length * 10 + x.coins;
  const strongest = others.slice().sort((a, b) => threat(b) - threat(a))[0];
  const target = () => (chance(65) ? strongest : pickOne(others));
  const richest = others.slice().sort((a, b) => b.coins - a.coins)[0];
  const move = (a, t) => ({ t: 'acao', a, target: t && t.id });

  if (g.labiaWin && p.labia >= g.labiaWin) return { t: 'acao', a: 'labia' };
  if (p.coins >= 10 || (can('escandalo') && chance(85))) return move('escandalo', target());
  if (p.preso) return { t: 'acao', a: 'bico' };

  const known = seen(g);
  const opts = [];
  if (mine.has('fofoqueira') && can('fofoca')) opts.push([9, move('fofoca', target())]);
  if (mine.has('benzedeira') && can('reza') && p.cards.some((c) => c.lost)) opts.push([8, { t: 'acao', a: 'reza' }]);
  if (mine.has('prefeito')) opts.push([6, { t: 'acao', a: 'verba' }]);
  if (mine.has('agiota') && richest.coins >= 2) opts.push([6, move('cobranca', richest)]);
  if (mine.has('delegada') && can('prisao') && chance(35)) opts.push([5, move('prisao', target())]);
  if (mine.has('feirante') && ricos >= 2) opts.push([7, { t: 'acao', a: 'pechincha' }]);
  if (mine.has('padre') && can('confissao') && chance(30)) opts.push([4, move('confissao', target())]);
  // blefe: mais ousado quando a lábia vale vitória; evita mentir sobre carta que já está quase toda à vista
  if (chance(g.labiaWin ? 38 : 25)) {
    const lies = ['verba', 'cobranca', 'fofoca', 'pechincha'].filter((a) => can(a) && !mine.has(ACOES[a].carta) && (known[ACOES[a].carta] || 0) < COPIAS - 1);
    const a = lies.length ? pickOne(lies) : null;
    if (a === 'cobranca' && richest.coins > 0) opts.push([7, move('cobranca', richest)]);
    else if (a === 'fofoca') opts.push([7, move('fofoca', target())]);
    else if (a === 'verba') opts.push([7, { t: 'acao', a: 'verba' }]);
    else if (a === 'pechincha' && ricos >= 2) opts.push([7, { t: 'acao', a: 'pechincha' }]);
  }
  if (!opts.length) {
    if (can('mudanca') && chance(15)) {
      const worst = p.cards.map((c, i) => ({ c, i })).filter((x) => !x.c.lost).sort((a, b) => VALUE[a.c.c] - VALUE[b.c.c])[0];
      return { t: 'acao', a: 'mudanca', idx: worst.i };
    }
    return { t: 'acao', a: 'bico' };
  }
  opts.sort((a, b) => b[0] + rnd(4) - (a[0] + rnd(4)));
  return opts[0][1];
}

function botReact(g, p) {
  const c = g.claim;
  const lives = L.alive(p).length;
  const mineSame = L.alive(p).filter((x) => x.c === c.card).length;
  const impossible = (seen(g)[c.card] || 0) + mineSame >= COPIAS;
  const doubtOk = !c.verified && !c.noDoubt;
  const blocker = c.kind === 'acao' && g.pend.target === p.id ? L.blockerOf(g.pend.a, g) : null;
  const claimant = g.players.find((x) => x.id === c.by);
  if (claimant && L.parceiros(g, p, claimant)) return { t: 'passar' };   // não duvida da própria dupla
  if (doubtOk && impossible) return { t: 'duvidar' };
  if (blocker) {
    if (L.alive(p).some((x) => x.c === blocker)) return { t: 'bloquear' };
    if (g.pend.a === 'fofoca' && chance(lives === 1 ? 70 : 45)) return { t: 'bloquear' };
    if (g.pend.a === 'cobranca' && chance(25)) return { t: 'bloquear' };
  }
  if (!doubtOk) return { t: 'passar' };
  let pct = 7;
  if (c.kind === 'acao' && g.pend.target === p.id) pct += g.pend.a === 'fofoca' ? 25 : 12;
  if (c.kind === 'bloqueio' && g.pend.actor === p.id) pct += 25;
  pct += mineSame * 15;
  if (lives === 1) pct = Math.round(pct / 2);
  return chance(pct) ? { t: 'duvidar' } : { t: 'passar' };
}

function botLose(p) {
  const live = p.cards.map((c, i) => ({ c, i })).filter((x) => !x.c.lost).sort((a, b) => VALUE[a.c.c] - VALUE[b.c.c]);
  return { t: 'perder', idx: live[0].i };
}

const LINES = {
  turn: ['Agora é comigo! 😎', 'Segura essa, vila!', 'Hoje eu tô com sorte.', 'Ninguém me segura!', 'Vou contar até três…'],
  react: ['Hmm… sei não 🤨', 'Esse aí tá blefando!', 'Confio… por enquanto.', 'Que cara de pau! 😂', 'Tá bom, tá bom…', 'Você? Sério?'],
  lose: ['Ai, minha reputação! 😭', 'Isso não vai ficar assim!', 'Eu vou lembrar disso…', 'Golpe baixo!'],
};

module.exports = {
  id: 'cara-de-pau', min: 2, max: 6, options: OPTIONS, defaults: DEFAULTS, RuleError: L.RuleError,
  start(room) {
    const s = room.settings;
    // torneio de família: série de 3 partidas; começa outra quando a anterior acabou
    if (!s.torneio) room.serie = null;
    else if (!room.serie || room.serie.fim) room.serie = { n: 0, total: TORNEIO_JOGOS, pontos: {}, blefes: {}, fim: false, campeao: null };
    room.g = L.newGame(room.players.map((p) => p.id), { labia: s.labia, eventos: !!s.eventos, feira: !!s.feira, cartas: s.cartas, duplas: !!s.duplas, rnd });
  },
  move(room, pid, m) { L.act(room.g, pid, m); },
  view(room, pid) { return { ...L.viewFor(room.g, pid), serie: room.serie || null }; },
  extra(room) { return { apelidos: room.apelidos || {}, serie: room.serie || null }; },
  participants(room) { return room.g.players.map((p) => p.id); },
  onEnd(room, ws) {
    const se = room.serie;
    if (!se || se.fim) return;
    se.n += 1;
    for (const p of room.g.players) {
      se.pontos[p.id] = (se.pontos[p.id] || 0) + (ws.includes(p.id) ? 1 : 0);
      se.blefes[p.id] = (se.blefes[p.id] || 0) + p.stats.blefes;
    }
    if (se.n >= se.total) {
      se.fim = true;
      const ids = Object.keys(se.pontos).sort((a, b) => se.pontos[b] - se.pontos[a] || se.blefes[b] - se.blefes[a]);
      se.campeao = ids[0] || null;
    }
  },
  // cartas da casa: a família dá nome a um morador ("Tio Zé, o Churrasqueiro"); a ação continua a mesma
  custom(room, player, body) {
    if (body.acao !== 'apelido') throw new L.RuleError('Ação desconhecida.');
    if (player.id !== room.hostId) throw new L.RuleError('Só quem criou a sala dá nome às cartas.');
    if (room.phase === 'game' && room.g && room.g.phase !== 'end') throw new L.RuleError('Mude as cartas entre as partidas.');
    if (!MORADORES[body.carta]) throw new L.RuleError('Carta inválida.');
    const nome = limpa(body.nome, 16);
    room.apelidos = room.apelidos || {};
    if (nome) room.apelidos[body.carta] = nome; else delete room.apelidos[body.carta];
    return null;
  },
  inGame(room, pid) { const p = P(room.g, pid); return !!p && !p.out; },
  wait(room) {
    const g = room.g;
    if (g.phase === 'end') return null;
    const secs = g.phase === 'react' ? room.settings.reactSecs : g.phase === 'lose' ? LOSE_SECS : TURN_SECS;
    return { key: `${room.round}|${g.phase}|${g.seq}`, ids: g.waiting.slice(), secs };
  },
  timeout(room) { L.timeout(room.g); },
  winners(room) { return room.g && room.g.phase === 'end' ? room.g.winners : null; },
  chat() { return 'sala'; },
  canSee() { return true; },
  bot(room, id) {
    const g = room.g;
    const p = P(g, id);
    if (!p || p.out) return null;
    if (g.phase === 'turn') return botTurn(g, p);
    if (g.phase === 'react') return botReact(g, p);
    if (g.phase === 'lose') return botLose(p);
    return null;
  },
  botDelay(room) {
    const ph = room.g.phase;
    return ph === 'turn' ? 1600 + rnd(2200) : ph === 'react' ? 1300 + rnd(3200) : 900 + rnd(1300);
  },
  botLine(room) {
    if (!chance(15)) return null;
    const ph = room.g.phase;
    return pickOne(LINES[ph === 'turn' ? 'turn' : ph === 'react' ? 'react' : 'lose']);
  },
  botReply(room, player, text) {
    const t = String(text).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    const b = room.players.find((x) => x.bot && x.id !== player.id && t.includes(x.name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').split(' ')[0]));
    if (!b) return [];
    return [{ id: b.id, text: pickOne(['Eu? Sou um santo! 😇', `Fala baixo, ${player.name}…`, 'Duvida então! 😏', 'Tá com medo de mim, é?', 'Cara de pau é você! 😂']) }];
  },
  // exportado para testes
  _bot: { botTurn, botReact, botLose },
};
