'use strict';
// Perfil do jogador: nível, XP, conquistas, personagens exclusivos e desafio diário.
// Lógica pura (sem DOM) para ser testável no Node. O perfil fica no aparelho (localStorage);
// por isso é só diversão: não vale como segurança.
const Profile = (() => {
  const XP = { round: 10, win: 15, impWin: 15, rightVote: 5, match: 20, matchWin: 30, daily: 50 };
  const TITLES = [[1, 'Curioso'], [3, 'Suspeito'], [5, 'Detetive'], [8, 'Mestre do blefe'], [12, 'Lenda da mesa'], [20, 'Intruso supremo']];
  const needFor = (lvl) => 100 + (lvl - 1) * 50;                     // XP para sair do nível `lvl`

  function levelInfo(xp) {
    let lvl = 1, rest = xp;
    while (rest >= needFor(lvl)) { rest -= needFor(lvl); lvl++; }
    return { level: lvl, into: rest, need: needFor(lvl), title: TITLES.filter((t) => t[0] <= lvl).pop()[1] };
  }

  const blank = () => ({
    v: 1, pack: false, xp: 0, rounds: 0, wins: 0, impRounds: 0, impWins: 0, rightVotes: 0, wordGuesses: 0, duoWins: 0,
    matches: 0, matchWins: 0, streak: 0, bestStreak: 0, dailyDone: 0, days: 0, lastDay: '', ach: {}, daily: null,
  });

  // [id, nome, descrição, teste]
  const ACH = [
    ['first', 'Estreante', 'Jogue sua primeira rodada', (p) => p.rounds >= 1],
    ['win', 'Primeira vitória', 'Vença uma rodada', (p) => p.wins >= 1],
    ['imp1', 'Mestre do disfarce', 'Vença como intruso', (p) => p.impWins >= 1],
    ['imp5', 'Camaleão', 'Vença 5 vezes como intruso', (p) => p.impWins >= 5],
    ['guess', 'Mente brilhante', 'Seja pego, mas acerte a palavra', (p) => p.wordGuesses >= 1],
    ['duo', 'Dupla perigosa', 'Vença como um de 2 intrusos', (p) => p.duoWins >= 1],
    ['det5', 'Faro fino', 'Acerte o voto no intruso 5 vezes', (p) => p.rightVotes >= 5],
    ['det25', 'Sherlock', 'Acerte o voto no intruso 25 vezes', (p) => p.rightVotes >= 25],
    ['st3', 'Em chamas', '3 vitórias seguidas', (p) => p.bestStreak >= 3],
    ['st5', 'Imparável', '5 vitórias seguidas', (p) => p.bestStreak >= 5],
    ['champ', 'Campeão', 'Vença uma partida completa', (p) => p.matchWins >= 1],
    ['match5', 'Veterano', 'Termine 5 partidas', (p) => p.matches >= 5],
    ['r50', 'Maratonista', 'Jogue 50 rodadas', (p) => p.rounds >= 50],
    ['lv5', 'Nível 5', 'Chegue ao nível 5', (p) => levelInfo(p.xp).level >= 5],
    ['lv10', 'Nível 10', 'Chegue ao nível 10', (p) => levelInfo(p.xp).level >= 10],
    ['daily3', 'Disciplinado', 'Complete 3 desafios diários', (p) => p.dailyDone >= 3],
  ];
  ACH.forEach((a, i) => { ACH[i] = { id: a[0], name: a[1], desc: a[2], test: a[3] }; });

  // Personagens 12..19 (ver AVATARS em avatars.js)
  const UNLOCKS = [
    { i: 12, req: 'Chegue ao nível 3', test: (p) => levelInfo(p.xp).level >= 3 },
    { i: 13, req: 'Vença como intruso', test: (p) => p.impWins >= 1 },
    { i: 14, req: 'Vença 5 vezes como intruso', test: (p) => p.impWins >= 5 },
    { i: 15, req: 'Acerte o voto no intruso 5 vezes', test: (p) => p.rightVotes >= 5 },
    { i: 16, req: '3 vitórias seguidas', test: (p) => p.bestStreak >= 3 },
    { i: 17, req: 'Chegue ao nível 7', test: (p) => levelInfo(p.xp).level >= 7 },
    { i: 18, req: 'Complete 3 desafios diários', test: (p) => p.dailyDone >= 3 },
    { i: 19, req: 'Vença uma partida completa', test: (p) => p.matchWins >= 1 },
  ];

  // Desafios do dia: um por dia, sorteado pela data (igual para todo mundo).
  const DAILY = [
    { id: 'play3', text: 'Jogue 3 rodadas', goal: 3, on: () => 1, ev: 'round' },
    { id: 'win2', text: 'Vença 2 rodadas', goal: 2, on: (e) => (e.won ? 1 : 0), ev: 'round' },
    { id: 'imp1', text: 'Vença uma rodada como intruso', goal: 1, on: (e) => (e.won && e.wasImp ? 1 : 0), ev: 'round' },
    { id: 'vote2', text: 'Acerte 2 votos no intruso', goal: 2, on: (e) => (e.votedRight ? 1 : 0), ev: 'round' },
    { id: 'match1', text: 'Termine uma partida', goal: 1, on: () => 1, ev: 'match' },
    { id: 'crew3', text: 'Vença 3 rodadas na tripulação', goal: 3, on: (e) => (e.won && !e.wasImp ? 1 : 0), ev: 'round' },
  ];

  const dayKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const dailyFor = (key) => {
    let n = 0;
    for (const ch of key) n = (n * 31 + ch.charCodeAt(0)) >>> 0;
    return DAILY[n % DAILY.length];
  };

  // Garante que o desafio e a contagem de dias estão atualizados para `today`.
  function touch(p, today = dayKey()) {
    if (p.lastDay !== today) { p.days++; p.lastDay = today; }
    if (!p.daily || p.daily.day !== today) p.daily = { day: today, id: dailyFor(today).id, prog: 0, done: false };
    return p;
  }

  function finalize(p, before, gained, today) {
    const out = { xp: gained, levelUp: null, ach: [], avatars: [], dailyDone: false };
    // desafio diário
    const d = p.daily;
    const def = DAILY.find((x) => x.id === d.id);
    if (d.done && d._fresh) out.dailyDone = true;
    delete d._fresh;
    // conquistas e personagens podem depender do XP; repete até estabilizar (bônus do desafio)
    for (let k = 0; k < 2; k++) {
      for (const a of ACH) if (!p.ach[a.id] && a.test(p)) { p.ach[a.id] = today; out.ach.push(a); }
    }
    const lvBefore = levelInfo(before.xp).level, lvAfter = levelInfo(p.xp).level;
    if (lvAfter > lvBefore) out.levelUp = lvAfter;
    for (const u of UNLOCKS) if (u.test(p) && !u.test(before)) out.avatars.push(u.i);
    out.def = def;
    return out;
  }

  const snapshot = (p) => JSON.parse(JSON.stringify(p));

  function addDaily(p, def, amount, today) {
    const d = p.daily;
    if (d.done || d.id !== def.id || !amount) return 0;
    d.prog += amount;
    if (d.prog >= def.goal) { d.done = true; d._fresh = true; p.dailyDone++; p.xp += XP.daily; return XP.daily; }
    return 0;
  }

  // e = { won, wasImp, votedRight, duo, guessed }
  function onRound(p, e, today = dayKey()) {
    touch(p, today);
    const before = snapshot(p);
    let gain = XP.round;
    p.rounds++;
    if (e.won) { p.wins++; gain += XP.win; p.streak++; p.bestStreak = Math.max(p.bestStreak, p.streak); } else p.streak = 0;
    if (e.wasImp) {
      p.impRounds++;
      if (e.won) { p.impWins++; gain += XP.impWin; if (e.duo) p.duoWins++; }
      if (e.guessed) p.wordGuesses++;
    }
    if (e.votedRight) { p.rightVotes++; gain += XP.rightVote; }
    p.xp += gain;
    for (const def of DAILY.filter((x) => x.ev === 'round')) gain += addDaily(p, def, def.on(e), today);
    return finalize(p, before, gain, today);
  }

  // e = { champion }
  function onMatch(p, e, today = dayKey()) {
    touch(p, today);
    const before = snapshot(p);
    let gain = XP.match;
    p.matches++;
    if (e.champion) { p.matchWins++; gain += XP.matchWin; }
    p.xp += gain;
    for (const def of DAILY.filter((x) => x.ev === 'match')) gain += addDaily(p, def, def.on(e), today);
    return finalize(p, before, gain, today);
  }

  // Junta dois perfis (ex.: o do aparelho e o da nuvem): contadores pelo maior valor, conquistas somadas.
  function merge(a, b) {
    const out = Object.assign(blank(), a);
    for (const k of ['xp', 'rounds', 'wins', 'impRounds', 'impWins', 'rightVotes', 'wordGuesses', 'duoWins', 'matches', 'matchWins', 'bestStreak', 'dailyDone', 'days']) {
      out[k] = Math.max(Number(a[k]) || 0, Number(b[k]) || 0);
    }
    out.pack = !!(a.pack || b.pack);
    out.ach = Object.assign({}, b.ach, a.ach);
    for (const id of Object.keys(b.ach || {})) if (a.ach && a.ach[id] && b.ach[id] < a.ach[id]) out.ach[id] = b.ach[id];
    out.lastDay = [a.lastDay, b.lastDay].filter(Boolean).sort().pop() || '';
    const newer = (a.lastDay || '') >= (b.lastDay || '') ? a : b;
    out.streak = Number(newer.streak) || 0;
    const da = a.daily, db = b.daily;
    out.daily = !da ? db : !db ? da : da.day !== db.day ? (da.day > db.day ? da : db)
      : ((da.done ? 1e9 : da.prog) >= (db.done ? 1e9 : db.prog) ? da : db);
    return out;
  }

  // XP extra (ex.: anúncio com recompensa). Pode subir de nível e liberar conquistas.
  function bonus(p, xp, today = dayKey()) {
    touch(p, today);
    const before = snapshot(p);
    p.xp += xp;
    return finalize(p, before, xp, today);
  }

  const unlocked = (p, i) => i < 12 || !!p.pack || UNLOCKS.some((u) => u.i === i && u.test(p));

  return { bonus, merge, blank, levelInfo, onRound, onMatch, touch, dailyFor, dayKey, unlocked, ACH, UNLOCKS, DAILY, XP, TITLES };
})();
if (typeof module !== 'undefined') module.exports = Profile;
