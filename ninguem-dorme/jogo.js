'use strict';
// Ninguém Dorme dentro das salas da Vila Sossego: opções, relógio de cada fase, canais de chat e bots.

const crypto = require('crypto');
const L = require('./logica');
const { PAPEIS, MIN, MAX, VOZES, MISTERIOS } = require('../public/ninguem-dorme/papeis');

const rnd = (n) => crypto.randomInt(n);
const chance = (pct) => rnd(100) < pct;
const pickOne = (arr) => arr[rnd(arr.length)];

const OPTIONS = { diaSecs: [60, 120, 180, 300], noiteSecs: [30, 45, 60], revelar: [1, 0], extras: [1, 0], especiais: [1, 0], narrador: [0, 1],
  voz: Object.keys(VOZES), misterio: ['nenhum', ...Object.keys(MISTERIOS)] };
const DEFAULTS = { diaSecs: 120, noiteSecs: 45, revelar: 1, extras: 1, especiais: 1, narrador: 0, voz: 'padrao', misterio: 'nenhum' };
const ULTIMAS_BOT = ['Vocês vão se arrepender! 😤', 'Eu era inocente… cuidem da vila. 🥲', 'Fiquem de olho em quem votou primeiro! 👀',
  'Tudo bem… mas o verdadeiro capanga está rindo agora. 😏', 'Adeus, Vila Sossego! 👋'];
const limpa = (s, max) => String(s == null ? '' : s).replace(/\s+/g, ' ').trim().slice(0, max);
// expulso que é bot deixa as últimas palavras sozinho
function ultimasDoBot(room) {
  const g = room.g;
  if (g.fase !== 'veredito' || g.ultimas || !g.veredito || !g.veredito.expulso) return;
  const quem = room.players.find((p) => p.id === g.veredito.expulso);
  if (quem && quem.bot) g.ultimas = { pid: quem.id, text: pickOne(ULTIMAS_BOT) };
}
const FESTA_SECS = 7;
const AMANHECER_SECS = 9;
const VOTACAO_SECS = 40;
const VEREDITO_SECS = 9;

// Quem o bot acha suspeito: fofoca de "saiu de casa", votos contra, sorte. Fica guardado na partida.
function suspeitas(room, id) {
  const g = room.g;
  g.mente = g.mente || {};
  if (!g.mente[id]) {
    g.mente[id] = {};
    for (const p of g.players) g.mente[id][p.id] = rnd(10);
  }
  const m = g.mente[id];
  const a = g.anuncio;
  if (a && a.fofoca && a.fofoca.saiu && m._fofoca !== a.noite) { m[a.fofoca.alvo] += 12; m._fofoca = a.noite; }
  return m;
}

function botNoite(room, p) {
  const g = room.g;
  const alvos = L.alvosNoite(g, p);
  const acao = PAPEIS[p.papel].noite;
  if (!acao) return { t: 'noite' };
  if (!alvos.length) return null;
  if (acao === 'sumir') {
    const parceiro = g.players.find((x) => L.isCap(x) && x.vivo && x.id !== p.id && g.acoes[x.id]);
    // capanga prefere quem andou votando em capanga
    const m = suspeitas(room, p.id);
    const ordem = alvos.slice().sort((a, b) => (m[b] || 0) - (m[a] || 0));
    const primeiro = parceiro && chance(85) ? g.acoes[parceiro.id] : chance(50) ? ordem[0] : pickOne(alvos);
    if (g.especial === 'lua') {
      const resto = alvos.filter((a) => a !== primeiro);
      const segundo = parceiro && g.acoes2[parceiro.id] && g.acoes2[parceiro.id] !== primeiro ? g.acoes2[parceiro.id] : resto.length ? pickOne(resto) : null;
      return { t: 'noite', alvos: [primeiro, segundo].filter(Boolean) };
    }
    return { t: 'noite', alvo: primeiro };
  }
  if (acao === 'benzer') return { t: 'noite', alvo: alvos.includes(p.id) && chance(35) ? p.id : pickOne(alvos) };
  if (acao === 'investigar') {
    const ja = new Set((g.investigados[p.id] || []));
    const novos = alvos.filter((a) => !ja.has(a));
    return { t: 'noite', alvo: pickOne(novos.length ? novos : alvos) };
  }
  return { t: 'noite', alvo: pickOne(alvos) };
}

function botVoto(room, p) {
  const g = room.g;
  const vivos = L.vivos(g).filter((x) => x.id !== p.id);
  if (!vivos.length) return { t: 'voto', alvo: 'pular' };
  // delegada que achou capanga vota nele
  const achado = (g.priv[p.id] || []).find((r) => r.capanga && L.P(g, r.alvo).vivo);
  if (achado) return { t: 'voto', alvo: achado.alvo };
  const conta = {};
  for (const a of Object.values(g.votos)) if (a !== 'pular') conta[a] = (conta[a] || 0) + 1;
  if (L.isCap(p)) {
    const inocentes = vivos.filter((x) => !L.isCap(x));
    const lider = inocentes.slice().sort((a, b) => (conta[b.id] || 0) - (conta[a.id] || 0))[0];
    return { t: 'voto', alvo: (lider && conta[lider.id] && chance(75)) ? lider.id : pickOne(inocentes).id };
  }
  if (chance(8)) return { t: 'voto', alvo: 'pular' };
  const m = suspeitas(room, p.id);
  // quem sumiu do celular (offline) e não fala nada fica suspeito: sem isso, um capanga que caiu da sala travava a partida
  const ausente = (x) => { const rp = room.players.find((y) => y.id === x.id); return rp && !rp.bot && !rp.res ? 25 : 0; };
  const peso = (x) => (m[x.id] || 0) + (conta[x.id] || 0) * 4 + ausente(x) + ((g.priv[p.id] || []).some((r) => r.alvo === x.id && !r.capanga) ? -50 : 0);
  return { t: 'voto', alvo: vivos.slice().sort((a, b) => peso(b) - peso(a))[0].id };
}

const nameOf = (room, id) => (room.players.find((p) => p.id === id) || { name: 'alguém' }).name;
const norm = (t) => String(t).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

function botLine(room, id) {
  const g = room.g;
  const p = L.P(g, id);
  if (!p || !p.vivo) return null;
  if (g.fase === 'noite') {
    return L.isCap(p) && chance(50) ? pickOne(['Vamos nesse?', 'Bora, combinado.', 'Esse aí tá desconfiando de mim.']) : null;
  }
  if (g.fase !== 'dia' && g.fase !== 'votacao') return null;
  const outros = L.vivos(g).filter((x) => x.id !== id && (!L.isCap(p) || !L.isCap(x)));
  if (!outros.length) return null;
  // Delegada que achou capanga vivo bota a boca no trombone; capanga às vezes finge ser a Delegada
  if (!g.mente) g.mente = {};
  const falou = (g.mente.falou = g.mente.falou || {});
  const achado = (g.priv[id] || []).find((r) => r.capanga && L.P(g, r.alvo).vivo);
  if (achado && falou[id] !== achado.alvo && chance(85)) {
    falou[id] = achado.alvo;
    return `Gente, eu sou a Delegada! Investiguei ${nameOf(room, achado.alvo)} e É CAPANGA! 🚓`;
  }
  if (L.isCap(p) && g.fase === 'dia' && !falou[id] && g.dia >= 2 && chance(18)) {
    const vitima = pickOne(outros);
    falou[id] = vitima.id;
    return `Confia em mim: eu sou a Delegada. ${nameOf(room, vitima.id)} é capanga! 🚓`;
  }
  const inocente = (g.priv[id] || []).find((r) => !r.capanga && L.P(g, r.alvo).vivo);
  if (inocente && chance(30)) return `Eu sei que ${nameOf(room, inocente.alvo)} é inocente. Confiem. 😉`;
  const alvo = nameOf(room, pickOne(outros).id);
  const a = g.anuncio;
  const lines = [
    `Eu acho que foi ${alvo}. 🤨`, `${alvo} tá quieto demais…`, 'Juro que eu tava dormindo!', 'Gente, foco! Quem tem cara de capanga?',
    `${alvo}, onde você tava ontem à noite?`, 'Eu sou só um morador humilde. 🏠', 'Tô de olho em todo mundo. 👀',
    'Não fui eu, palavra de escoteiro!', 'Alguém tem uma pista boa?',
  ];
  if (a && a.fofoca && a.fofoca.saiu && a.fofoca.alvo !== id) lines.push(`A Cotinha viu ${nameOf(room, a.fofoca.alvo)} na rua, hein!`);
  if (a && a.sumiu) lines.push(`Coitado(a) de ${nameOf(room, a.sumiu)}… 😢`, 'Quem fez isso vai pagar!');
  if (a && a.sumiu2) lines.push('DUAS pessoas numa noite só?! Essa lua cheia… 🌕');
  if (a && a.saudade) lines.push(`${nameOf(room, a.saudade)} não aguentou a saudade… 💔`);
  if (a && a.especial === 'festa') lines.push('Que festa boa ontem! Mas alguém aqui comeu pamonha demais… 🌽');
  if (g.votoSecreto && g.fase === 'votacao') lines.push('Com essa neblina ninguém sabe em quem eu voto. 🌫️');
  if (a && a.salvo) lines.push('A Vó Zefa salvou alguém essa noite! 🌿');
  if (!chance(55)) return null;
  return pickOne(lines);
}

module.exports = {
  id: 'ninguem-dorme', min: MIN, max: MAX, options: OPTIONS, defaults: DEFAULTS, RuleError: L.RuleError,
  start(room) {
    const s = room.settings;
    // narrador humano: quem criou a sala conduz a mesa e não joga
    room.narrador = s.narrador ? room.hostId : null;
    const ids = room.players.map((p) => p.id).filter((id) => id !== room.narrador);
    if (room.narrador && ids.length < MIN) throw new L.RuleError(`Com narrador, precisa de ${MIN + 1} pessoas (o narrador não joga). Chame bots!`);
    room.g = L.newGame(ids, { revelar: !!s.revelar, extras: !!s.extras, especiais: !!s.especiais, rnd });
  },
  move(room, pid, m) {
    const g = room.g;
    if (m && m.t === 'ultimas') {   // quem foi expulso tem uns segundos para um recado final
      if (g.fase !== 'veredito' || !g.veredito || g.veredito.expulso !== pid) throw new L.RuleError('Agora não é hora de últimas palavras.');
      if (g.ultimas) throw new L.RuleError('Você já deixou seu recado.');
      const text = limpa(m.text, 90);
      if (!text) throw new L.RuleError('Escreva seu recado.');
      g.ultimas = { pid, text };
      return;
    }
    L.act(g, pid, m);
    ultimasDoBot(room);
    // todos os humanos prontos para votar: os bots não seguram a conversa
    if (g.fase === 'dia') {
      const bot = (id) => (room.players.find((x) => x.id === id) || {}).bot;
      const vivos = L.vivos(g);
      if (vivos.some((p) => !bot(p.id)) && vivos.every((p) => bot(p.id) || p.pronto)) {
        for (const p of vivos) if (bot(p.id) && !p.pronto && g.fase === 'dia') L.act(g, p.id, { t: 'pronto' });
      }
    }
  },
  view(room, pid) { return L.viewFor(room.g, pid, { narrador: !!pid && pid === room.narrador }); },
  participants(room) { return room.g.players.map((p) => p.id); },
  inGame(room, pid) { const p = L.P(room.g, pid); return !!p && p.vivo; },
  wait(room) {
    const g = room.g;
    if (g.fase === 'fim') return null;
    const s = room.settings;
    const secs = { noite: g.especial === 'festa' ? FESTA_SECS : s.noiteSecs, amanhecer: AMANHECER_SECS, dia: s.diaSecs, votacao: VOTACAO_SECS,
      veredito: g.veredito && g.veredito.expulso ? VEREDITO_SECS + 4 : VEREDITO_SECS }[g.fase];   // +4s para as últimas palavras
    return { key: `${room.round}|${g.fase}|${g.noite}|${g.dia}`, ids: L.waiting(g), secs };
  },
  timeout(room) { L.timeout(room.g); ultimasDoBot(room); },
  winners(room) {
    const g = room.g;
    if (!g || g.fase !== 'fim') return null;
    return g.players.filter((p) => PAPEIS[p.papel].time === g.vencedor).map((p) => p.id);
  },
  // Canais: de noite só os capangas conversam (entre eles); quem sumiu fala com os fantasmas.
  chat(room, pid) {
    const g = room.g;
    const p = L.P(g, pid);
    if (pid && pid === room.narrador) return g.fase === 'noite' ? null : 'sala';   // narrador não cochicha à noite
    if (!p || g.fase === 'fim') return 'sala';
    if (!p.vivo) return 'fantasmas';
    if (g.fase === 'noite') return L.isCap(p) ? 'capangas' : null;
    return 'sala';
  },
  canSee(room, pid, ch) {
    const g = room.g;
    const p = L.P(g, pid);
    if (ch === 'sala') return true;
    if (g.fase === 'fim' || !p) return !p ? false : true;
    if (ch === 'capangas') return L.isCap(p) || !p.vivo;
    if (ch === 'fantasmas') return !p.vivo;
    return false;
  },
  bot(room, id) {
    const g = room.g;
    const p = L.P(g, id);
    if (!p || !p.vivo) return null;
    if (g.fase === 'noite') return botNoite(room, p);
    if (g.fase === 'dia') return p.pronto ? null : { t: 'pronto' };
    if (g.fase === 'votacao') return botVoto(room, p);
    return null;
  },
  botDelay(room) {
    const f = room.g.fase;
    if (f === 'noite') return 2500 + rnd(5000);
    if (f === 'dia') return Math.min(room.settings.diaSecs * 1000 * 0.6, 20000 + rnd(25000));
    return 3000 + rnd(9000);
  },
  botLine,
  // dia é a fase do papo: até 3 falas por bot; votação 1; noite só os capangas cochicham
  botChatTimes(room, id) {
    const f = room.g.fase;
    if (f === 'dia') return [2500 + rnd(6000), 12000 + rnd(12000), 28000 + rnd(20000)].filter((t) => t < room.settings.diaSecs * 900);
    if (f === 'votacao') return [1500 + rnd(5000)];
    if (f === 'noite' && L.isCap(L.P(room.g, id) || {})) return [2000 + rnd(3000)];
    return [];
  },
  // alguém citou um bot pelo nome: ele se defende (ou devolve a acusação)
  botReply(room, player, text, ch) {
    const g = room.g;
    if (!g || ch !== 'sala' || g.fase === 'fim' || g.fase === 'noite') return [];
    const t = norm(text);
    const out = [];
    for (const b of room.players.filter((x) => x.bot && x.id !== player.id)) {
      const bp = L.P(g, b.id);
      if (!bp || !bp.vivo || !t.includes(norm(b.name).split(' ')[0])) continue;
      const lines = ['Eu?? Tá doido! 😤', 'Prova! Cadê a prova?', `Olha quem fala, ${player.name}…`, 'Eu tava dormindo, juro! 😴',
        `${player.name}, isso é coisa de capanga querendo se esconder!`, 'Pode votar em mim que vocês vão se arrepender.'];
      out.push({ id: b.id, text: pickOne(lines) });
      if (out.length >= 2) break;
    }
    return out;
  },
  _bot: { botNoite, botVoto },
};
