'use strict';
// Passaporte da Vila: nível, XP, conquistas, personagens exclusivos e desafio do dia, somando os três jogos
// (Cara de Pau, Ninguém Dorme e Intruso).
// Lógica pura (sem DOM) para ser testável no Node. Fica no aparelho (localStorage): é diversão, não segurança.
const Perfil = (() => {
  const XP = { partida: 20, vitoria: 30, blefe: 3, duvidaCerta: 5, labia: 25, votoCerto: 6, rodadaIntruso: 4, intrusoVenceu: 12, sobreviveu: 10, capanga: 15, diario: 60, temporada: 250 };
  const TITLES = [[1, 'Forasteiro'], [3, 'Vizinho novo'], [5, 'Morador antigo'], [8, 'Fofoqueiro de plantão'],
    [12, 'Figura da Vila'], [16, 'Lenda de Sossego'], [20, 'Dono da Vila']];
  const needFor = (lvl) => 100 + (lvl - 1) * 50;

  function levelInfo(xp) {
    let lvl = 1, rest = xp;
    while (rest >= needFor(lvl)) { rest -= needFor(lvl); lvl++; }
    return { level: lvl, into: rest, need: needFor(lvl), title: TITLES.filter((t) => t[0] <= lvl).pop()[1] };
  }

  const blank = () => ({
    v: 1, xp: 0, partidas: 0, vitorias: 0, streak: 0, bestStreak: 0, days: 0, lastDay: '', dailyDone: 0, ach: {}, daily: null,
    temp: null, temporadas: {},
    cdp: { partidas: 0, vitorias: 0, blefes: 0, duvidasCertas: 0, labia: 0 },
    nd: { partidas: 0, vitorias: 0, vitCapanga: 0, vitVila: 0, sobreviveu: 0, votosCertos: 0, delegadaAcertos: 0 },
    int: { partidas: 0, vitorias: 0, rodadas: 0, vitIntruso: 0, votosCertos: 0 },
    diario: { jogados: 0, acertos: 0, melhorSeq: 0 },
    convites: 0,
  });

  const ACH = [
    ['estreia', '🎟️', 'Chegou na vila', 'Jogue sua primeira partida', (p) => p.partidas >= 1],
    ['vence1', '🏆', 'Primeira vitória', 'Vença uma partida', (p) => p.vitorias >= 1],
    ['blefe10', '🤥', 'Cara de pau', 'Passe 10 blefes sem ser pego', (p) => p.cdp.blefes >= 10],
    ['blefe50', '🎭', 'Mentiroso profissional', 'Passe 50 blefes sem ser pego', (p) => p.cdp.blefes >= 50],
    ['labia', '🗣️', 'Lábia de ouro', 'Vença um Cara de Pau na lábia', (p) => p.cdp.labia >= 1],
    ['duvido10', '🤨', 'Duvido!', 'Pegue 10 blefes dos outros', (p) => p.cdp.duvidasCertas >= 10],
    ['capanga', '🦹', 'Crime perfeito', 'Vença o Ninguém Dorme como capanga', (p) => p.nd.vitCapanga >= 1],
    ['vila3', '🏘️', 'Herói da vila', 'Vença 3 vezes com a vila no Ninguém Dorme', (p) => p.nd.vitVila >= 3],
    ['faro', '🔎', 'Faro fino', 'Vote certo num capanga 10 vezes', (p) => p.nd.votosCertos >= 10],
    ['sobrevive', '🛌', 'Sono leve', 'Chegue vivo ao fim de 5 partidas do Ninguém Dorme', (p) => p.nd.sobreviveu >= 5],
    ['st3', '🔥', 'Em chamas', '3 vitórias seguidas', (p) => p.bestStreak >= 3],
    ['p25', '🗓️', 'Freguês', 'Jogue 25 partidas', (p) => p.partidas >= 25],
    ['lv5', '⭐', 'Nível 5', 'Chegue ao nível 5', (p) => levelInfo(p.xp).level >= 5],
    ['lv10', '🌟', 'Nível 10', 'Chegue ao nível 10', (p) => levelInfo(p.xp).level >= 10],
    ['daily5', '📅', 'Batendo ponto', 'Complete 5 desafios do dia', (p) => p.dailyDone >= 5],
    ['os2', '🎪', 'Turista completo', 'Jogue os dois jogos da vila', (p) => p.cdp.partidas >= 1 && p.nd.partidas >= 1],
    ['int1', '🕵️', 'Disfarce perfeito', 'Vença uma rodada do Intruso como intruso', (p) => p.int.vitIntruso >= 1],
    ['int10', '🔍', 'Olho de lince', 'Ache o intruso 10 vezes', (p) => p.int.votosCertos >= 10],
    ['tres', '🏡', 'Morador completo', 'Jogue os três jogos da vila', (p) => p.cdp.partidas >= 1 && p.nd.partidas >= 1 && p.int.partidas >= 1],
    ['diario1', '🧩', 'Detetive do dia', 'Ache o intruso no Intruso Diário', (p) => p.diario.acertos >= 1],
    ['diario7', '📆', 'Investigador fiel', 'Acerte o Intruso Diário 7 dias seguidos', (p) => p.diario.melhorSeq >= 7],
    ['convida3', '💌', 'Embaixador da Vila', 'Convide 3 pessoas que entraram na vila', (p) => (p.convites || 0) >= 3],
    ['temp1', '🏅', 'Campeão da temporada', 'Complete todas as metas de uma temporada', (p) => Object.keys(p.temporadas || {}).length >= 1],
  ].map((a) => ({ id: a[0], emoji: a[1], name: a[2], desc: a[3], test: a[4] }));

  // Personagens 12..19 (ver AVATARS em avatars.js)
  const UNLOCKS = [
    { i: 12, req: 'Chegue ao nível 3', test: (p) => levelInfo(p.xp).level >= 3 },
    { i: 13, req: 'Passe 10 blefes no Cara de Pau', test: (p) => p.cdp.blefes >= 10 },
    { i: 14, req: 'Vença como capanga no Ninguém Dorme', test: (p) => p.nd.vitCapanga >= 1 },
    { i: 15, req: 'Vote certo num capanga 5 vezes', test: (p) => p.nd.votosCertos >= 5 },
    { i: 16, req: '3 vitórias seguidas', test: (p) => p.bestStreak >= 3 },
    { i: 17, req: 'Chegue ao nível 7', test: (p) => levelInfo(p.xp).level >= 7 },
    { i: 18, req: 'Complete 3 desafios do dia', test: (p) => p.dailyDone >= 3 },
    { i: 19, req: 'Vença um Cara de Pau na lábia', test: (p) => p.cdp.labia >= 1 },
  ];

  // Desafio do dia: igual para todo mundo, sorteado pela data. on(e) diz quanto avança com o evento de fim de partida.
  const DAILY = [
    { id: 'play2', text: 'Jogue 2 partidas', goal: 2, on: () => 1 },
    { id: 'win1', text: 'Vença uma partida', goal: 1, on: (e) => (e.won ? 1 : 0) },
    { id: 'blefe3', text: 'Passe 3 blefes no Cara de Pau', goal: 3, on: (e) => e.blefes || 0 },
    { id: 'duvido2', text: 'Pegue 2 blefes no Cara de Pau', goal: 2, on: (e) => e.duvidasCertas || 0 },
    { id: 'nd1', text: 'Jogue uma partida de Ninguém Dorme', goal: 1, on: (e) => (e.jogo === 'nd' ? 1 : 0) },
    { id: 'cdp1', text: 'Jogue uma partida de Cara de Pau', goal: 1, on: (e) => (e.jogo === 'cdp' ? 1 : 0) },
    { id: 'voto2', text: 'Vote certo num capanga 2 vezes', goal: 2, on: (e) => (e.jogo === 'nd' ? e.votosCertos || 0 : 0) },
    { id: 'vivo1', text: 'Chegue vivo ao fim do Ninguém Dorme', goal: 1, on: (e) => (e.jogo === 'nd' && e.survived ? 1 : 0) },
    { id: 'int1', text: 'Jogue uma partida de Intruso', goal: 1, on: (e) => (e.jogo === 'int' ? 1 : 0) },
    { id: 'achei2', text: 'Ache o intruso 2 vezes', goal: 2, on: (e) => (e.jogo === 'int' ? e.votosCertos || 0 : 0) },
  ];

  // Temporada do mês: tema + 3 metas sorteadas pelo mês (iguais para todo mundo). Completar dá XP e um selo.
  const TEMAS = {
    '01': ['Verão na Vila', '🏖️'], '02': ['Carnaval na Vila', '🎭'], '03': ['Outono na Vila', '🍂'], '04': ['Páscoa na Vila', '🐣'],
    '05': ['Mês das Flores', '💐'], '06': ['Arraiá da Vila', '🔥'], '07': ['Férias de Julho', '🪁'], '08': ['Mês do Folclore', '🌽'],
    '09': ['Primavera na Vila', '🌼'], '10': ['Mês das Crianças', '🧸'], '11': ['Novembro dos Mistérios', '🕵️'], '12': ['Natal na Vila', '🎄'],
  };
  const METAS = [
    { id: 'jogar', text: 'Jogue 15 partidas', goal: 15, on: () => 1 },
    { id: 'vencer', text: 'Vença 6 partidas', goal: 6, on: (e) => (e.won ? 1 : 0) },
    { id: 'blefes', text: 'Passe 15 blefes no Cara de Pau', goal: 15, on: (e) => e.blefes || 0 },
    { id: 'duvidas', text: 'Pegue 8 blefes no Cara de Pau', goal: 8, on: (e) => e.duvidasCertas || 0 },
    { id: 'vila', text: 'Vença 4 vezes com a vila no Ninguém Dorme', goal: 4, on: (e) => (e.jogo === 'nd' && e.won && e.team !== 'capangas' ? 1 : 0) },
    { id: 'capanga', text: 'Vença 2 vezes como capanga', goal: 2, on: (e) => (e.jogo === 'nd' && e.won && e.team === 'capangas' ? 1 : 0) },
    { id: 'votos', text: 'Vote certo num capanga 8 vezes', goal: 8, on: (e) => (e.jogo === 'nd' ? e.votosCertos || 0 : 0) },
    { id: 'nd', text: 'Jogue 6 partidas de Ninguém Dorme', goal: 6, on: (e) => (e.jogo === 'nd' ? 1 : 0) },
    { id: 'cdp', text: 'Jogue 6 partidas de Cara de Pau', goal: 6, on: (e) => (e.jogo === 'cdp' ? 1 : 0) },
    // metas com `desde` só entram a partir daquele mês (não embaralham uma temporada que já começou)
    { id: 'int', text: 'Jogue 5 partidas de Intruso', goal: 5, on: (e) => (e.jogo === 'int' ? 1 : 0), desde: '2026-12' },
    { id: 'disfarce', text: 'Vença 5 rodadas como intruso', goal: 5, on: (e) => e.intrusoVitorias || 0, desde: '2026-12' },
  ];
  const hash = (key) => { let n = 7; for (const ch of key) n = (n * 31 + ch.charCodeAt(0)) >>> 0; return n; };
  function temporada(mes) {
    const [nome, emoji] = TEMAS[mes.slice(5, 7)] || ['Temporada', '⭐'];
    const pool = METAS.filter((m) => !m.desde || mes >= m.desde);
    const metas = [];
    let n = hash(mes);
    for (let i = 0; i < 3; i++) { metas.push(pool.splice(n % pool.length, 1)[0]); n = Math.floor(n / 7) + 13; }
    return { id: mes, nome, emoji, metas };
  }

  const dayKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const dailyFor = (key) => {
    let n = 0;
    for (const ch of key) n = (n * 31 + ch.charCodeAt(0)) >>> 0;
    return DAILY[n % DAILY.length];
  };

  // Completa campos de versões antigas e atualiza dia/desafio.
  function touch(p, today = dayKey()) {
    const b = blank();
    for (const k of Object.keys(b)) if (p[k] == null) p[k] = b[k];
    p.cdp = Object.assign(b.cdp, p.cdp);
    p.nd = Object.assign(b.nd, p.nd);
    p.int = Object.assign(b.int, p.int);
    p.diario = Object.assign(b.diario, p.diario);
    if (p.lastDay !== today) { p.days++; p.lastDay = today; }
    if (!p.daily || p.daily.day !== today) p.daily = { day: today, id: dailyFor(today).id, prog: 0, done: false };
    const mes = today.slice(0, 7);
    if (!p.temp || p.temp.id !== mes) p.temp = { id: mes, prog: [0, 0, 0], done: false };
    return p;
  }

  const snapshot = (p) => JSON.parse(JSON.stringify(p));

  // e = { jogo: 'cdp'|'nd'|'int', won, blefes, duvidasCertas, labiaWin, team, survived, votosCertos, delegadaAcertos,
  //       rodadas, intrusoVitorias }  (no Intruso, uma partida = as rodadas até o placar final)
  function onGame(p, e, today = dayKey()) {
    touch(p, today);
    const before = snapshot(p);
    let gain = XP.partida;
    p.partidas++;
    if (e.won) { p.vitorias++; gain += XP.vitoria; p.streak++; p.bestStreak = Math.max(p.bestStreak, p.streak); } else p.streak = 0;
    if (e.jogo === 'cdp') {
      const c = p.cdp;
      c.partidas++;
      if (e.won) c.vitorias++;
      c.blefes += e.blefes || 0;
      c.duvidasCertas += e.duvidasCertas || 0;
      gain += (e.blefes || 0) * XP.blefe + (e.duvidasCertas || 0) * XP.duvidaCerta;
      if (e.labiaWin) { c.labia++; gain += XP.labia; }
    } else if (e.jogo === 'int') {
      const n = p.int;
      n.partidas++;
      if (e.won) n.vitorias++;
      n.rodadas += e.rodadas || 0;
      n.vitIntruso += e.intrusoVitorias || 0;
      n.votosCertos += e.votosCertos || 0;
      gain += (e.rodadas || 0) * XP.rodadaIntruso + (e.intrusoVitorias || 0) * XP.intrusoVenceu + (e.votosCertos || 0) * XP.votoCerto;
    } else {
      const n = p.nd;
      n.partidas++;
      if (e.won) { n.vitorias++; if (e.team === 'capangas') { n.vitCapanga++; gain += XP.capanga; } else n.vitVila++; }
      if (e.survived) { n.sobreviveu++; gain += XP.sobreviveu; }
      n.votosCertos += e.votosCertos || 0;
      n.delegadaAcertos += e.delegadaAcertos || 0;
      gain += (e.votosCertos || 0) * XP.votoCerto;
    }
    p.xp += gain;
    // desafio do dia
    const def = DAILY.find((x) => x.id === p.daily.id);
    let dailyDone = false;
    if (def && !p.daily.done) {
      p.daily.prog += def.on(e);
      if (p.daily.prog >= def.goal) { p.daily.done = true; p.dailyDone++; p.xp += XP.diario; gain += XP.diario; dailyDone = true; }
    }
    // temporada do mês
    let seasonDone = null;
    if (!p.temp.done) {
      const t = temporada(p.temp.id);
      t.metas.forEach((m, i) => { p.temp.prog[i] = Math.min(m.goal, p.temp.prog[i] + m.on(e)); });
      if (t.metas.every((m, i) => p.temp.prog[i] >= m.goal)) {
        p.temp.done = true; p.temporadas[t.id] = t.nome; p.xp += XP.temporada; gain += XP.temporada; seasonDone = t;
      }
    }
    const out = { xp: gain, levelUp: null, ach: [], avatars: [], dailyDone, seasonDone };
    for (const a of ACH) if (!p.ach[a.id] && a.test(p)) { p.ach[a.id] = today; out.ach.push(a); }
    const lvBefore = levelInfo(before.xp).level, lvAfter = levelInfo(p.xp).level;
    if (lvAfter > lvBefore) out.levelUp = lvAfter;
    for (const u of UNLOCKS) if (u.test(p) && !u.test(before)) out.avatars.push(u.i);
    return out;
  }

  // Intruso Diário (sozinho, 1 por dia): XP pelo acerto, pela palavra, pela estrela e pela sequência
  function onDiario(p, e, today = dayKey()) {
    touch(p, today);
    const before = snapshot(p);
    let gain = 10 + (e.intruso ? 20 : 0) + (e.palavra ? 10 : 0) + (e.estrela ? 10 : 0) + Math.min(e.sequencia || 0, 7) * 2;
    p.diario.jogados++;
    if (e.intruso) p.diario.acertos++;
    p.diario.melhorSeq = Math.max(p.diario.melhorSeq, e.sequencia || 0);
    p.xp += gain;
    const out = { xp: gain, levelUp: null, ach: [], avatars: [] };
    for (const a of ACH) if (!p.ach[a.id] && a.test(p)) { p.ach[a.id] = today; out.ach.push(a); }
    if (levelInfo(p.xp).level > levelInfo(before.xp).level) out.levelUp = levelInfo(p.xp).level;
    for (const u of UNLOCKS) if (u.test(p) && !u.test(before)) out.avatars.push(u.i);
    return out;
  }

  const unlocked = (p, i) => i < 12 || UNLOCKS.some((u) => u.i === i && u.test(p));

  return { blank, touch, onGame, onDiario, levelInfo, dailyFor, dayKey, unlocked, temporada, ACH, UNLOCKS, DAILY, METAS, XP, TITLES };
})();
if (typeof module !== 'undefined') module.exports = Perfil;
