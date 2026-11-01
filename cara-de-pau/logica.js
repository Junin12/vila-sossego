'use strict';
// Regras do Cara de Pau, sem rede nem timers: o servidor chama act() e timeout(); os testes chamam direto.
//
// Fases: 'turn' (jogador da vez escolhe ação) → 'react' (os outros duvidam, bloqueiam ou passam)
//        → 'lose' (alguém escolhe qual segredo perde) → próxima vez … → 'end'.
// Lábia: cada blefe que passa sem ninguém duvidar dá +1 lábia (só o dono vê). Pego no blefe, zera.
// Com lábia suficiente, o jogador pode declarar vitória na sua vez.

const { MORADORES, ACOES, EVENTOS, moradoresDa, COPIAS, MOEDAS_INICIO, MOEDAS_RELAMPAGO, ESCANDALO_OBRIGATORIO } = require('../public/cara-de-pau/moradores');

class RuleError extends Error {}
const fail = (msg) => { throw new RuleError(msg); };

const defaultRnd = (n) => Math.floor(Math.random() * n);
const LOG_MAX = 40;

function shuffle(g, arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = g.rnd(i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// Quem bloqueia a ação (só entre os moradores da partida, quando g é passado).
const blockerOf = (a, g) => (g ? g.moradores : Object.keys(MORADORES)).find((k) => MORADORES[k].bloqueia.includes(a)) || null;
const P = (g, pid) => g.players.find((p) => p.id === pid);
const alive = (p) => p.cards.filter((c) => !c.lost);
const inGame = (g) => g.players.filter((p) => !p.out);
// Duplas: parceiros sentam em lados opostos da mesa (time = posição % metade).
const parceiros = (g, a, b) => !!g.duplas && a.team === b.team && a.id !== b.id;
const timeDe = (g, p) => g.players.filter((x) => x.team === p.team).map((x) => x.id);
const ev = (g) => (g.evento ? EVENTOS[g.evento] : {});
const custo = (g, a) => { const c = ev(g).custos; return c && c[a] != null ? c[a] : ACOES[a].custo; };

function log(g, entry) {
  g.log.push({ n: ++g.seq, ...entry });
  if (g.log.length > LOG_MAX) g.log.shift();
}

// opts: { labia: nº de blefes para vencer (0 = desligado), eventos: modo Eventos da Vila, feira: expansão Feira,
//         cartas: 2 (normal) ou 1 (Relâmpago), duplas: times de dois (4 ou 6 jogadores), rnd }
function newGame(ids, opts = {}) {
  if (ids.length < 2 || ids.length > 6) fail('O jogo é de 2 a 6 jogadores.');
  if (opts.duplas && ids.length !== 4 && ids.length !== 6) fail('O modo Duplas é com 4 ou 6 jogadores.');
  const cartas = opts.cartas === 1 ? 1 : 2;
  const g = {
    rnd: opts.rnd || defaultRnd, labiaWin: opts.labia == null ? 4 : opts.labia, eventos: !!opts.eventos, evento: null, volta: 0,
    moradores: moradoresDa(!!opts.feira), cartas, duplas: !!opts.duplas, priv: {},
    players: [], deck: [], turn: 0, phase: 'turn', pend: null, claim: null, waiting: [], loser: null, then: null,
    log: [], seq: 0, winner: null, winners: null, how: null,
  };
  for (const k of g.moradores) for (let i = 0; i < COPIAS; i++) g.deck.push(k);
  shuffle(g, g.deck);
  ids.forEach((id, i) => {
    g.players.push({ id, coins: cartas === 1 ? MOEDAS_RELAMPAGO : MOEDAS_INICIO, cards: Array.from({ length: cartas }, () => ({ c: g.deck.pop(), lost: false })),
      labia: 0, preso: false, out: false, team: g.duplas ? i % (ids.length / 2) : i, stats: { blefes: 0, pego: 0, acertos: 0, erros: 0 } });
  });
  g.turn = g.rnd(ids.length);
  g.first = g.turn;
  g.waiting = [g.players[g.turn].id];
  log(g, { t: 'inicio', by: g.players[g.turn].id });
  newRound(g);
  return g;
}

// Devolve a carta ao baralho e compra outra (depois de provar que tinha, ou na mudança).
function swapCard(g, p, idx) {
  g.deck.push(p.cards[idx].c);
  shuffle(g, g.deck);
  p.cards[idx] = { c: g.deck.pop(), lost: false };
}

function endGame(g, winner, how) {
  g.phase = 'end'; g.winner = winner; g.how = how; g.waiting = []; g.claim = null; g.pend = null; g.loser = null; g.then = null;
  g.winners = timeDe(g, P(g, winner));
  log(g, { t: 'fim', by: winner, how, dupla: g.duplas ? g.winners : null });
}

function killCard(g, p, idx) {
  p.cards[idx].lost = true;
  log(g, { t: 'perdeu', by: p.id, card: p.cards[idx].c });
  if (!alive(p).length) {
    p.out = true; p.preso = false;
    log(g, { t: 'fora', by: p.id });
    const rest = inGame(g);
    if (new Set(rest.map((x) => x.team)).size === 1) endGame(g, rest[0].id, 'ultimo');
  }
}

// Alguém perde um segredo; se tiver dois, escolhe qual (fase 'lose'). Depois segue com `then`.
function requireLoss(g, pid, then) {
  const p = P(g, pid);
  const live = alive(p);
  if (live.length === 1) killCard(g, p, p.cards.indexOf(live[0]));
  if (live.length < 2) { if (g.phase !== 'end') then(); return; }
  g.phase = 'lose'; g.loser = pid; g.waiting = [pid]; g.then = then;
}

// Nova volta da mesa: no modo eventos, sorteia o evento (sem repetir o anterior).
function newRound(g) {
  g.volta += 1;
  if (!g.eventos) return;
  const keys = Object.keys(EVENTOS).filter((k) => k !== g.evento);
  g.evento = keys[g.rnd(keys.length)];
  const e = EVENTOS[g.evento];
  if (e.inicio) for (const p of inGame(g)) p.coins += e.inicio;
  log(g, { t: 'evento', e: g.evento, volta: g.volta });
}

function nextTurn(g) {
  if (g.phase === 'end') return;
  const n = g.players.length;
  let i = g.turn;
  let wrapped = false;
  do {
    i = (i + 1) % n;
    if (i === g.first) wrapped = true;
  } while (g.players[i].out);
  if (g.players[g.first].out) g.first = i;   // quem abria a volta saiu: a volta passa a contar dali
  if (wrapped) newRound(g);
  g.turn = i; g.phase = 'turn'; g.pend = null; g.claim = null; g.loser = null; g.then = null;
  g.waiting = [g.players[i].id];
}

function openReact(g, claim) {
  g.phase = 'react';
  // presos e fora do jogo não reagem; quem anunciou também não. No apagão ninguém duvida (só o alvo bloqueia).
  if (ev(g).semDuvida) claim = { ...claim, noDoubt: true };
  g.claim = claim;
  g.waiting = inGame(g).filter((p) => p.id !== claim.by && !p.preso).map((p) => p.id);
  if (claim.blockOnly || claim.noDoubt) g.waiting = g.waiting.filter((id) => claim.kind === 'acao' && id === g.pend.target && blockerOf(g.pend.a, g));
  if (!g.waiting.length) allPassed(g);
}

function canBlock(g, pid) {
  const c = g.claim;
  return c && c.kind === 'acao' && pid === g.pend.target && !!blockerOf(g.pend.a, g);
}

function effect(g) {
  const { a, actor, target } = g.pend;
  const me = P(g, actor);
  const t = target ? P(g, target) : null;
  if (t && t.out) return nextTurn(g);
  log(g, { t: 'efeito', by: actor, a, target });
  switch (a) {
    case 'bico': me.coins += ev(g).bico || 1; break;
    case 'verba': me.coins += 3; break;
    case 'cobranca': { const v = Math.min(2, t.coins); t.coins -= v; me.coins += v; break; }
    case 'prisao': t.preso = true; break;
    case 'reza': {
      const idx = me.cards.findIndex((c) => c.lost);
      if (idx >= 0) { g.deck.push(me.cards[idx].c); shuffle(g, g.deck); me.cards[idx] = { c: g.deck.pop(), lost: false }; }
      break;
    }
    case 'mudanca': swapCard(g, me, g.pend.idx); break;
    case 'pechincha': {
      const ricos = inGame(g).filter((x) => x.id !== actor && x.coins > me.coins).sort((a, b) => b.coins - a.coins).slice(0, 3);
      for (const x of ricos) { x.coins -= 1; me.coins += 1; }
      break;
    }
    case 'confissao': {
      const vivas = alive(t);
      const c = vivas[g.rnd(vivas.length)];
      (g.priv[actor] = g.priv[actor] || []).push({ alvo: target, c: c.c, volta: g.volta });
      break;
    }
    case 'escandalo': case 'fofoca': return requireLoss(g, target, () => nextTurn(g));
    default: break;
  }
  nextTurn(g);
}

function allPassed(g) {
  const c = g.claim;
  const claimant = P(g, c.by);
  if (!c.verified && !alive(claimant).some((x) => x.c === c.card)) { claimant.labia += 1; claimant.stats.blefes += 1; }   // blefe que colou
  if (c.kind === 'acao') return effect(g);
  log(g, { t: 'bloqueado', by: g.pend.actor, a: g.pend.a });
  nextTurn(g);
}

function declare(g, p, move) {
  const a = move.a;
  const def = ACOES[a];
  if (!def || (def.carta && !g.moradores.includes(def.carta))) fail('Ação desconhecida.');
  const forced = p.coins >= ESCANDALO_OBRIGATORIO;
  if (forced && a !== 'escandalo') fail(`Com ${ESCANDALO_OBRIGATORIO} moedas ou mais, você tem que fazer um Escândalo.`);
  if (p.preso && !forced && a !== 'bico') fail('Você está preso: nesta vez só pode fazer bico.');
  const price = custo(g, a);
  if (p.coins < price) fail('Moedas insuficientes.');
  if (a === 'labia' && (!g.labiaWin || p.labia < g.labiaWin)) fail('Você ainda não tem lábia suficiente.');
  if (a === 'reza' && !p.cards.some((c) => c.lost)) fail('Você não perdeu nenhum segredo.');
  let target = null;
  if (def.alvo) {
    const t = P(g, move.target);
    if (!t || t.out || t.id === p.id) fail('Escolha um alvo válido.');
    if (parceiros(g, p, t)) fail('Não dá para atacar sua dupla!');
    target = t.id;
  }
  let idx = null;
  if (a === 'mudanca') {
    idx = Number(move.idx);
    if (!p.cards[idx] || p.cards[idx].lost) fail('Escolha um segredo seu.');
  }

  p.coins -= price;
  p.preso = false;   // cumpriu a pena nesta vez
  g.pend = { a, actor: p.id, target, idx, paid: price };
  log(g, { t: 'acao', by: p.id, a, target });
  if (a === 'labia') return endGame(g, p.id, 'labia');
  if (!def.carta) return effect(g);
  openReact(g, { by: p.id, card: def.carta, kind: 'acao' });
}

function doubt(g, p) {
  const c = g.claim;
  const claimant = P(g, c.by);
  const idx = claimant.cards.findIndex((x) => !x.lost && x.c === c.card);
  const had = idx >= 0;
  log(g, { t: 'duvida', by: p.id, of: c.by, card: c.card, had });
  if (had) {
    p.stats.erros += 1;
    swapCard(g, claimant, idx);
    requireLoss(g, p.id, () => {
      if (c.kind === 'bloqueio') { log(g, { t: 'bloqueado', by: g.pend.actor, a: g.pend.a }); return nextTurn(g); }
      const t = g.pend.target && P(g, g.pend.target);
      if (t && !t.out && !t.preso && blockerOf(g.pend.a, g)) return openReact(g, { ...c, verified: true, blockOnly: true });
      effect(g);
    });
  } else {
    p.stats.acertos += 1;
    claimant.stats.pego += 1;
    claimant.labia = 0;
    requireLoss(g, claimant.id, () => {
      if (c.kind === 'bloqueio') return effect(g);
      claimant.coins += g.pend.paid;   // ação desmascarada: devolve o que pagou
      nextTurn(g);
    });
  }
}

function act(g, pid, move) {
  const p = P(g, pid);
  if (!p) fail('Você não está nesta partida.');
  if (g.phase === 'end') fail('A partida acabou.');
  if (!g.waiting.includes(pid)) fail('Agora não é sua vez.');
  const t = move && move.t;
  if (g.phase === 'turn') {
    if (t !== 'acao') fail('Escolha uma ação.');
    return declare(g, p, move);
  }
  if (g.phase === 'lose') {
    if (t !== 'perder') fail('Escolha qual segredo vai perder.');
    const idx = Number(move.idx);
    if (!p.cards[idx] || p.cards[idx].lost) fail('Escolha um segredo seu.');
    const then = g.then;
    g.then = null; g.loser = null;
    killCard(g, p, idx);
    if (g.phase !== 'end') then();
    return;
  }
  // react
  if (t === 'passar') {
    g.waiting = g.waiting.filter((id) => id !== pid);
    if (!g.waiting.length) allPassed(g);
    return;
  }
  if (t === 'duvidar') {
    if (g.claim.verified) fail('Essa carta já foi mostrada.');
    if (g.claim.noDoubt) fail('No apagão ninguém pode duvidar.');
    return doubt(g, p);
  }
  if (t === 'bloquear') {
    if (!canBlock(g, pid)) fail('Você não pode bloquear isso.');
    const card = blockerOf(g.pend.a, g);
    log(g, { t: 'bloqueio', by: pid, card, a: g.pend.a });
    return openReact(g, { by: pid, card, kind: 'bloqueio' });
  }
  fail('Jogada inválida.');
}

// Tempo esgotado na fase atual: quem falta passa; na vez, faz bico (ou escândalo obrigatório); na perda, sorteia.
function timeout(g) {
  if (g.phase === 'react') { for (const id of g.waiting.slice()) act(g, id, { t: 'passar' }); return; }
  if (g.phase === 'lose') {
    const p = P(g, g.loser);
    const live = p.cards.map((c, i) => (c.lost ? -1 : i)).filter((i) => i >= 0);
    return act(g, p.id, { t: 'perder', idx: live[g.rnd(live.length)] });
  }
  if (g.phase === 'turn') {
    const p = g.players[g.turn];
    if (p.coins >= ESCANDALO_OBRIGATORIO) {
      const others = inGame(g).filter((x) => x.id !== p.id && !parceiros(g, p, x));
      return act(g, p.id, { t: 'acao', a: 'escandalo', target: others[g.rnd(others.length)].id });
    }
    act(g, p.id, { t: 'acao', a: 'bico' });
  }
}

// O que cada jogador enxerga: segredos dos outros só aparecem quando perdidos ou no fim.
function viewFor(g, pid) {
  const end = g.phase === 'end';
  const me = P(g, pid);
  const vejo = (p) => end || p.id === pid || (me && parceiros(g, me, p));   // na dupla, um vê os segredos do outro
  return {
    moradores: g.moradores, cartas: g.cartas, duplas: g.duplas, winners: g.winners,
    priv: (me && g.priv[pid]) || [],
    phase: g.phase, turn: g.players[g.turn].id, waiting: g.waiting, loser: g.loser,
    pend: g.pend && { a: g.pend.a, actor: g.pend.actor, target: g.pend.target },
    claim: g.claim && { by: g.claim.by, card: g.claim.card, kind: g.claim.kind, verified: !!g.claim.verified },
    canBlock: canBlock(g, pid), canDoubt: !!(g.claim && !g.claim.verified && !g.claim.noDoubt && g.waiting.includes(pid)),
    labiaWin: g.labiaWin, deck: g.deck.length, winner: g.winner, how: g.how, log: g.log, evento: g.evento, volta: g.volta,
    custos: Object.fromEntries(Object.keys(ACOES).map((a) => [a, custo(g, a)])), bico: ev(g).bico || 1,
    players: g.players.map((p) => ({
      id: p.id, coins: p.coins, preso: p.preso, out: p.out, team: p.team,
      cards: p.cards.map((c) => ({ lost: c.lost, c: (c.lost || vejo(p)) ? c.c : null })),
      labia: (p.id === pid || end) ? p.labia : null,
      stats: end ? p.stats : null,
    })),
    me: me ? { labia: me.labia } : null,
  };
}

module.exports = { newGame, act, timeout, viewFor, blockerOf, custo, alive, parceiros, RuleError };
