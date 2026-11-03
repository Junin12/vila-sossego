'use strict';
// Intruso dentro da Vila Sossego: regras e salas do jogo (HTTP + SSE), montado pelo server.js em /intruso/api/...
// Veio do repositório Junin12/Intruso, que agora guarda só o app Android e a loja. Estado em memória.

const crypto = require('crypto');
const { GameError } = require('../salas');
const WORDS = require('../public/intruso/words');
const PAIRS = require('../public/intruso/pairs');
const PRENDAS = require('../public/comum/prendas');
const CLUE_LAPS = 2;       // quantas dicas cada jogador dá por rodada
const SEC = Number(process.env.SEC_MS) || 1000;           // 1 "segundo" do jogo em ms (testes usam valor menor)
const GUESS_SECS = 20;
const TWO_IMPOSTORS_FROM = 7;
const OPTIONS = { total: [5, 10, 20], clueSecs: [0, 10, 15, 20, 30, 45, 60], voteSecs: [0, 30, 45, 60, 90, 120],   // 0 = sem limite
  mode: [0, 1], accomplice: [0, 1],   // mode 1 = palavra parecida; accomplice 1 = cúmplice ligado
  familia: [0, 1], draw: [0, 1], teams: [0, 1] };   // Modo Família; dica desenhada; dois times
const LOBBY_ONLY = ['total', 'mode', 'accomplice', 'familia', 'draw', 'teams'];
// Modo Família: categorias que ficam de fora (bebidas e memes de internet)
const FORA_FAMILIA = new Set(['Bebidas', 'Internet e memes']);
const TEAMS_FROM = 4;
const DRAW_MAX = 2500;   // tamanho do rabisco (pontos 0..99, traços separados por |)
const BOT_NAMES = ['Zé Bot', 'Dona Bitinha', 'Robertão', 'Lurdinha', 'Tião', 'Cida', 'Nestor', 'Jurema', 'Valdisney', 'Creusa'];
const FOTO_MAX = 12000;
// pacotes que vêm com o Passe da Noite / Vila Completa (ver salas.js: premium da sala)
const PREMIUM_CATS = new Set(['Brinquedos e brincadeiras', 'Coisas de vó']);
const PREMIUM_MAX_MS = 48 * 60 * 60 * 1000;
const PRESENTE_MS = 3 * 60 * 60 * 1000;
let festa = null;   // Noite de Festa (festa.js), ligado pelo server.js
const ACCOMPLICE_FROM = 6;
const CUSTOM = 'Personalizada';
const CUSTOM_MIN = 6;
const CUSTOM_MAX = 60;
const EMOJIS = ['🤔', '😂', '😱', '🔥', '👀', '👍'];
const MIN_PLAYERS = 3;
const MAX_PLAYERS = 10;
const MAX_ROOMS = 500;
const LOBBY_GRACE_MS = 20000;
const INTRO_MS = Number(process.env.INTRO_MS) || 6000;   // tempo do placar no início de cada rodada
const AVATAR_BASE = 12;                                   // livres para todos
const AVATAR_TOTAL = 20;                                  // 8 exclusivos desbloqueados jogando (deve bater com public/avatars.js)
const CODE_LETTERS = 'ABCDEFGHJKLMNPQRSTUVXZ';

const rooms = new Map();

// ---------- utilidades ----------
const newId = () => crypto.randomBytes(8).toString('hex');
const pick = (arr) => arr[crypto.randomInt(arr.length)];
const clean = (s, max) => String(s == null ? '' : s).replace(/\s+/g, ' ').trim().slice(0, max);
const norm = (s) => clean(s, 60).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function newCode() {
  for (let tries = 0; tries < 50; tries++) {
    let c = '';
    for (let i = 0; i < 4; i++) c += CODE_LETTERS[crypto.randomInt(CODE_LETTERS.length)];
    if (!rooms.has(c)) return c;
  }
  return null;
}

const fail = (msg) => { throw new GameError(msg); };

// ---------- modelo ----------
// Personagem escolhido se estiver livre; senão um dos livres do conjunto básico (MAX_PLAYERS < AVATAR_BASE, sempre sobra um).
function pickAvatar(room, wanted) {
  const taken = new Set(room ? room.players.map((p) => p.avatar) : []);
  if (Number.isInteger(wanted) && wanted >= 0 && wanted < AVATAR_TOTAL && !taken.has(wanted)) return wanted;
  return pick([...Array(AVATAR_BASE).keys()].filter((i) => !taken.has(i)));
}

function blankStats() { return { impWins: 0, votesGot: 0, rightVotes: 0, wrongVotes: 0, clueMs: 0, clues: 0 }; }

function makePlayer(name, avatar) {
  return { id: newId(), name, avatar, score: 0, res: null, timer: null, waiting: false, stats: blankStats(), lastReact: 0 };
}

function makeRoom(host) {
  return {
    code: newCode(), hostId: host.id, players: [host], phase: 'lobby', category: 'Todas',
    settings: { total: 5, clueSecs: 30, voteSecs: 60, mode: 0, accomplice: 0, familia: 0, draw: 0, teams: 0 }, matchRound: 0, customWords: [],
    tvs: new Set(), festa: null, prenda: null, next: null, botTimers: [], botKey: '', premium: 0, presenteDe: null,
    usedWords: new Set(), wordCategory: null, word: null, altWord: null, impostorIds: [], accompliceId: null, roster: [], order: [], turn: 0,
    clues: [], votes: {}, guesses: {}, chat: [], reactions: [], reactSeq: 0, result: null, awards: null,
    deadline: 0, timer: null, armKey: '', turnStart: 0, lastActive: Date.now(),
  };
}

const findPlayer = (room, pid) => room.players.find((p) => p.id === pid);
const connected = (room) => room.players.filter((p) => p.res);   // humanos conectados
const ativo = (p) => !!p && (p.bot || !!p.res);                   // joga agora (bot sempre)
const rosterOnline = (room) => room.roster.filter((id) => ativo(findPlayer(room, id)));
const categorias = (room) => Object.keys(WORDS).filter((c) => (!room.settings.familia || !FORA_FAMILIA.has(c)) && (room.premium > Date.now() || !PREMIUM_CATS.has(c)));

// O que cada jogador pode ver. Impostores nunca recebem a palavra antes do resultado (nem quem está só assistindo).
function view(room, pid) {
  const playing = room.phase !== 'lobby' && room.phase !== 'final';
  const reveal = room.phase === 'result';
  const me = findPlayer(room, pid);
  const isImp = playing && room.impostorIds.includes(pid);
  const isAcc = playing && room.accompliceId === pid;
  const spectator = playing && (!me || me.waiting);   // sem `me` = telão
  // palavra parecida: até ser descoberto, o intruso se vê como tripulante (só que com a outra palavra)
  const disguised = isImp && !!room.altWord && room.phase !== 'guess' && !reveal;
  const v = {
    code: room.code, you: pid, hostId: room.hostId, phase: room.phase,
    categories: ['Todas', ...categorias(room), CUSTOM], category: room.category, tv: room.tvs.size > 0, teamsFrom: TEAMS_FROM,
    festa: festa && room.festa ? festa.resumo(festa.get(room.festa)) : null, prenda: room.prenda, next: room.next,
    premium: room.premium > Date.now() ? room.premium : 0, presenteDe: room.premium > Date.now() ? room.presenteDe : null, premiumCats: [...PREMIUM_CATS],
    minPlayers: MIN_PLAYERS, laps: CLUE_LAPS, settings: room.settings, options: OPTIONS, emojis: EMOJIS,
    matchRound: room.matchRound, twoFrom: TWO_IMPOSTORS_FROM, accompliceFrom: ACCOMPLICE_FROM,
    customCount: room.customWords.length, customMin: CUSTOM_MIN,
    players: room.players.map((p) => ({
      id: p.id, name: p.name, avatar: p.avatar, score: p.score, online: ativo(p), waiting: p.waiting, impWins: p.stats.impWins,
      bot: !!p.bot, team: p.team == null ? null : p.team,
    })),
  };
  v.leftMs = room.deadline ? Math.max(0, room.deadline - Date.now()) : 0;
  if (room.phase === 'lobby' && pid === room.hostId) v.customWords = room.customWords;   // só o anfitrião vê a lista
  if (room.phase === 'final') { v.awards = room.awards; return v; }
  if (!playing) return v;
  v.role = spectator ? 'spectator' : disguised ? 'crew' : isImp ? 'impostor' : isAcc ? 'accomplice' : 'crew';
  v.impostorCount = room.impostorIds.length;
  v.similar = !!room.altWord;
  v.hasAccomplice = !!room.accompliceId;
  v.wordCategory = room.wordCategory;
  v.word = reveal ? room.word : disguised ? room.altWord : (isImp || spectator) ? null : room.word;
  if (isImp && !reveal && !disguised) v.partnerIds = room.altWord ? [] : room.impostorIds.filter((id) => id !== pid);
  if (isAcc && !reveal) v.knownImpostors = room.impostorIds;
  v.order = room.order;
  v.turn = room.turn;
  v.totalTurns = room.order.length * CLUE_LAPS;
  v.clues = room.clues;
  v.chat = room.chat;
  v.reactions = room.reactions;
  v.voted = Object.keys(room.votes);        // quem já votou (sem revelar em quem)
  v.myVote = room.votes[pid] || null;
  if (room.phase === 'guess') { v.accusedIds = room.impostorIds; v.guessed = Object.keys(room.guesses); }
  if (reveal) { v.impostorIds = room.impostorIds; v.accompliceId = room.accompliceId; v.altWord = room.altWord; v.result = room.result; }
  return v;
}

function push(player, data) {
  if (player.res) player.res.write(`data: ${JSON.stringify(data)}\n\n`);
}

function broadcast(room) {
  room.lastActive = Date.now();
  for (const p of room.players) push(p, view(room, p.id));
  if (room.tvs.size) {   // telão: só o que é público
    const data = `data: ${JSON.stringify(view(room, null))}\n\n`;
    for (const res of room.tvs) res.write(data);
  }
}

// ---------- regras ----------
// Sorteia sem repetir na sala; quando a lista esgota, recomeça só ela.
function pickFresh(room, key, list) {
  let free = list.filter((x) => !room.usedWords.has(key + '|' + x));
  if (!free.length) {
    for (const x of list) room.usedWords.delete(key + '|' + x);
    free = list;
  }
  const x = pick(free);
  room.usedWords.add(key + '|' + x);
  return x;
}

// No modo palavra parecida volta também a palavra do intruso (alt).
function pickWord(room) {
  const similar = room.settings.mode === 1;
  if (room.category === CUSTOM) {
    const list = room.customWords;
    const word = pickFresh(room, CUSTOM, list);
    return { cat: CUSTOM, word, alt: similar ? pick(list.filter((w) => w !== word)) : null };
  }
  const cat = room.category === 'Todas' ? pick(categorias(room)) : room.category;
  if (!similar) return { cat, word: pickFresh(room, cat, WORDS[cat]), alt: null };
  const pair = pickFresh(room, 'par:' + cat, PAIRS[cat]).split('|');
  const flip = crypto.randomInt(2);
  return { cat, word: pair[flip], alt: pair[1 - flip] };
}

function startRound(room) {
  room.players = room.players.filter((p) => ativo(p) || !p.waiting);
  for (const p of room.players) p.waiting = false;
  room.roster = room.players.map((p) => p.id);
  const { cat, word, alt } = pickWord(room);
  room.wordCategory = cat;
  room.word = word;
  room.altWord = alt;
  const k = room.roster.length >= TWO_IMPOSTORS_FROM ? 2 : 1;
  const drawn = shuffle(room.roster);
  room.impostorIds = drawn.slice(0, k);
  room.accompliceId = room.settings.accomplice && room.roster.length >= ACCOMPLICE_FROM ? drawn[k] : null;
  room.order = shuffle(room.roster);
  room.turn = 0;
  room.clues = [];
  room.votes = {};
  room.guesses = {};
  room.chat = [];
  room.reactions = [];
  room.result = null;
  room.matchRound++;
  room.phase = 'intro';          // todos veem o placar antes das dicas
}

function finish(room, reason, guess) {
  const impostorWins = reason !== 'caught';
  const delta = {};
  for (const id of room.roster) {
    const isImp = room.impostorIds.includes(id), isAcc = id === room.accompliceId;
    delta[id] = impostorWins ? (isImp || isAcc ? 2 : 0) : (isImp || isAcc ? 0 : 1);   // o cúmplice vence junto com o intruso
    // intruso escapou da votação: quem votou num intruso de verdade ainda leva +1
    if (reason === 'escaped' && !isImp && !isAcc && room.impostorIds.includes(room.votes[id])) delta[id] = 1;
    const p = findPlayer(room, id);
    if (p) { p.score += delta[id]; if (impostorWins && isImp) p.stats.impWins++; }
  }
  for (const [voter, target] of Object.entries(room.votes)) {
    const t = findPlayer(room, target);
    if (t) t.stats.votesGot++;
    const vp = findPlayer(room, voter);
    if (vp && room.impostorIds.includes(target)) vp.stats.rightVotes++;
    else if (vp && !room.impostorIds.includes(voter)) vp.stats.wrongVotes++;
  }
  room.result = { impostorWins, reason, guesses: { ...room.guesses }, votes: { ...room.votes }, delta, accompliceId: room.accompliceId, last: room.matchRound >= room.settings.total };
  room.phase = 'result';
}

function tally(room) {
  const k = room.impostorIds.length;
  const counts = {};
  for (const target of Object.values(room.votes)) counts[target] = (counts[target] || 0) + 1;
  const ranked = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  // Só vale se os k mais votados forem inequívocos (sem empate na fronteira) e forem exatamente os impostores.
  const clear = ranked.length >= k && ranked[k - 1][1] > 0 && (ranked.length === k || ranked[k][1] < ranked[k - 1][1]);
  const top = ranked.slice(0, k).map((r) => r[0]);
  if (clear && top.every((id) => room.impostorIds.includes(id))) room.phase = 'guess';
  else finish(room, 'escaped');
}

function buildAwards(room) {
  const best = (fn, lowest) => {
    let top = null;
    for (const p of room.players) {
      const val = fn(p);
      if (val == null || val <= 0) continue;
      if (!top || (lowest ? val < top.value : val > top.value)) top = { pid: p.id, value: val };
    }
    return top;
  };
  return {
    bluffer: best((p) => p.stats.impWins),                                                      // vitórias como intruso
    suspect: best((p) => p.stats.votesGot),                                                     // votos recebidos
    detective: best((p) => p.stats.rightVotes),                                                 // votos certos no intruso
    fastest: best((p) => (p.stats.clues >= 2 ? Math.round(p.stats.clueMs / p.stats.clues) : null), true),   // ms por dica
    lost: best((p) => p.stats.wrongVotes),                                                      // votou no inocente
  };
}

// Avança fases automaticamente (pula jogadores offline, fecha votação, etc.).
function advance(room) {
  const total = room.order.length * CLUE_LAPS;
  if (room.phase === 'clues') {
    while (room.turn < total && !ativo(findPlayer(room, room.order[room.turn % room.order.length]))) {
      room.clues.push({ pid: room.order[room.turn % room.order.length], text: '—', round: Math.floor(room.turn / room.order.length) + 1 });
      room.turn++;
    }
    if (room.turn >= total) room.phase = 'vote';
  }
  if (room.phase === 'vote') {
    const online = rosterOnline(room);
    if (!online.length || online.every((id) => room.votes[id])) tally(room);
  }
  if (room.phase === 'guess') {
    const pending = room.impostorIds.filter((id) => rosterOnline(room).includes(id) && !(id in room.guesses));
    if (!pending.length) finish(room, 'caught');
  }
}

// Marca o prazo da fase atual. Só recalcula quando a fase/vez muda.
function arm(room) {
  const key = `${room.matchRound}|${room.phase}|${room.turn}`;
  if (key === room.armKey) return;
  room.armKey = key;
  clearTimeout(room.timer);
  room.deadline = 0;
  room.turnStart = Date.now();
  let ms = 0;
  if (room.phase === 'intro') ms = INTRO_MS;
  else if (room.phase === 'clues') ms = room.settings.clueSecs * SEC;
  else if (room.phase === 'vote') ms = room.settings.voteSecs * SEC;
  else if (room.phase === 'guess') ms = GUESS_SECS * SEC;
  if (!ms) return;
  const dl = Date.now() + ms;
  room.deadline = dl;
  room.timer = setTimeout(() => {
    if (rooms.get(room.code) !== room || room.deadline !== dl) return;
    timeout(room);
    settle(room);
    broadcast(room);
  }, ms);
}

function timeout(room) {
  if (room.phase === 'intro') room.phase = 'clues';
  else if (room.phase === 'clues') {
    room.clues.push({ pid: room.order[room.turn % room.order.length], text: '⏰', round: Math.floor(room.turn / room.order.length) + 1 });
    room.turn++;
  } else if (room.phase === 'vote') tally(room);
  else if (room.phase === 'guess') finish(room, 'caught');
}

function settle(room) {
  advance(room);
  arm(room);
  bots(room);
}

// ---------- bots ----------
// Jogam pelo banco de palavras: a dica é outra palavra da mesma categoria (assim até o intruso disfarça),
// o voto desconfia de quem não deu dica e o palpite é um chute da categoria.
const botMs = (a, b) => (a + crypto.randomInt(b)) * SEC / 1000;
function listaDaRodada(room) { return room.wordCategory === CUSTOM ? room.customWords : WORDS[room.wordCategory] || []; }
function botClue(room, p) {
  const own = room.impostorIds.includes(p.id) ? room.altWord : room.word;
  const lista = listaDaRodada(room).filter((w) => norm(w) !== norm(own || '') && norm(w) !== norm(room.word) && !room.clues.some((c) => c.text === w));
  return clean(lista.length ? pick(lista) : 'hmm', 24);
}
function botVote(room, p) {
  const others = room.roster.filter((id) => id !== p.id);
  if (room.impostorIds.includes(p.id) || room.accompliceId === p.id) return pick(others.filter((id) => !room.impostorIds.includes(id)) || others) || pick(others);
  const sumido = others.filter((id) => room.clues.some((c) => c.pid === id && (c.text === '—' || c.text === '⏰')));
  return sumido.length && crypto.randomInt(2) ? pick(sumido) : pick(others);
}
function bots(room) {
  const key = `${room.matchRound}|${room.phase}|${room.turn}`;
  if (key === room.botKey) return;
  room.botKey = key;
  for (const t of room.botTimers) clearTimeout(t);
  room.botTimers = [];
  const later = (ms, fn) => room.botTimers.push(setTimeout(() => {
    if (rooms.get(room.code) !== room || room.botKey !== key) return;
    try { fn(); } catch (e) { if (!(e instanceof GameError)) console.error(e); }
    broadcast(room);
  }, ms));
  const roster = room.roster.map((id) => findPlayer(room, id)).filter((p) => p && p.bot);
  if (room.phase === 'clues') {
    const cur = findPlayer(room, room.order[room.turn % room.order.length]);
    if (cur && cur.bot) later(botMs(1500, 2500), () => act(room, cur, { type: 'clue', text: botClue(room, cur) }));
  } else if (room.phase === 'vote') {
    for (const b of roster) later(botMs(2000, 5000), () => { if (!room.votes[b.id]) act(room, b, { type: 'vote', target: botVote(room, b) }); });
  } else if (room.phase === 'guess') {
    for (const b of roster.filter((x) => room.impostorIds.includes(x.id))) later(botMs(2500, 3000), () => act(room, b, { type: 'guess', text: pick(listaDaRodada(room)) || 'sei lá' }));
  }
}

function setSetting(room, key, value) {
  if (!OPTIONS[key] || !OPTIONS[key].includes(value)) fail('Valor inválido.');
  room.settings[key] = value;
}

function act(room, player, body) {
  const isHost = player.id === room.hostId;
  switch (body.type) {
    case 'category': {
      if (room.phase !== 'lobby' || !isHost) fail('Só o anfitrião muda a categoria.');
      const c = clean(body.value, 30);
      if (c !== 'Todas' && c !== CUSTOM && !WORDS[c]) fail('Categoria inválida.');
      if (PREMIUM_CATS.has(c) && !(room.premium > Date.now())) fail('🔒 Esse pacote vem com o Passe da Noite ou a Vila Completa.');
      room.category = c;
      break;
    }
    case 'customWords': {
      if (room.phase !== 'lobby' || !isHost) fail('Só o anfitrião monta a lista.');
      const raw = Array.isArray(body.words) ? body.words : String(body.words || '').split(/[,;\n]/);
      const seen = new Set(), list = [];
      for (const w of raw.slice(0, 200)) {
        const t = clean(w, 24);
        if (t && !seen.has(norm(t))) { seen.add(norm(t)); list.push(t); }
      }
      if (list.length > CUSTOM_MAX) fail(`No máximo ${CUSTOM_MAX} palavras.`);
      room.customWords = list;
      for (const k of [...room.usedWords]) if (k.startsWith(CUSTOM + '|')) room.usedWords.delete(k);
      break;
    }
    case 'settings': {
      if (!isHost) fail('Só o anfitrião muda os tempos.');
      const key = String(body.key);
      if (LOBBY_ONLY.includes(key)) { if (room.phase !== 'lobby') fail('Esse ajuste só muda no lobby.'); }
      else if (room.phase !== 'lobby' && room.phase !== 'result') fail('Os tempos mudam no lobby ou entre as rodadas.');
      setSetting(room, key, body.value);
      break;
    }
    case 'avatar': {
      if (room.phase !== 'lobby') fail('Só dá para trocar de personagem no lobby.');
      const a = body.value;
      if (!Number.isInteger(a) || a < 0 || a >= AVATAR_TOTAL) fail('Personagem inválido.');
      if (room.players.some((p) => p !== player && p.avatar === a)) fail('Esse personagem já foi escolhido.');
      player.avatar = a;
      break;
    }
    case 'premium': {
      if (!isHost) fail('Só o anfitrião.');
      const ate = Math.min(Number(body.ate) || 0, Date.now() + PREMIUM_MAX_MS);
      if (ate > room.premium) { room.premium = ate; room.presenteDe = null; }
      break;
    }
    case 'presente': {
      room.premium = Math.max(room.premium, Date.now() + PRESENTE_MS);
      room.presenteDe = player.name;
      break;
    }
    case 'addBot': {
      if (room.phase !== 'lobby' || !isHost) fail('Só o anfitrião chama bots, no lobby.');
      if (room.players.length >= MAX_PLAYERS) fail('Sala cheia.');
      const used = new Set(room.players.map((p) => norm(p.name)));
      const b = makePlayer(BOT_NAMES.find((n) => !used.has(norm(n))) || `Bot ${room.players.length + 1}`, pickAvatar(room));
      b.bot = true;
      room.players.push(b);
      break;
    }
    case 'kick': {
      if (room.phase !== 'lobby' || !isHost) fail('Só o anfitrião tira alguém, no lobby.');
      const k = findPlayer(room, body.id);
      if (!k || k === player) fail('Jogador inválido.');
      room.players = room.players.filter((p) => p !== k);
      if (k.res) { k.res.end(); k.res = null; }
      break;
    }
    case 'festa': {
      if (!festa) fail('Noite de Festa indisponível.');
      if (!isHost || room.phase !== 'lobby') fail('Só o anfitrião liga a Noite de Festa, no lobby.');
      room.festa = room.festa ? null : festa.criar(room.settings.familia).id;
      break;
    }
    case 'proximo': {
      if (!festa || !room.festa) fail('Ligue a Noite de Festa primeiro.');
      if (!isHost || (room.phase !== 'lobby' && room.phase !== 'final')) fail('Só o anfitrião escolhe o próximo jogo, no fim da partida.');
      let out;
      try { out = festa.proximo(room.festa, String(body.jogo || ''), { name: player.name, avatar: typeof player.avatar === 'number' ? player.avatar : 0 }); }
      catch (e) { if (e instanceof GameError) throw e; fail(e.message); }
      room.next = { slug: String(body.jogo), code: out.code };
      settle(room);
      return { ...out, slug: room.next.slug };
    }
    case 'prenda': {
      if (room.phase !== 'final') fail('A prenda sai no fim da partida.');
      const humanos = room.players.filter((p) => !p.bot);
      const menor = Math.min(...humanos.map((p) => p.score));
      const ultimos = humanos.filter((p) => p.score === menor);
      if (!ultimos.length) fail('Sem ninguém para a prenda.');
      const fam = festa && room.festa ? festa.get(room.festa).familia : !!room.settings.familia;
      room.prenda = { para: pick(ultimos).name, texto: PRENDAS.sortear(fam, (n) => crypto.randomInt(n)), n: (room.prenda ? room.prenda.n : 0) + 1 };
      break;
    }
    case 'foto': {
      if (room.phase !== 'lobby') fail('Troque a foto no lobby.');
      if (body.data == null) { player.foto = null; if (typeof player.avatar !== 'number') player.avatar = pickAvatar(room); break; }
      const m = /^data:image\/jpeg;base64,([A-Za-z0-9+/=]+)$/.exec(String(body.data));
      const buf = m ? Buffer.from(m[1], 'base64') : null;
      if (!buf || buf.length > FOTO_MAX || buf[0] !== 0xff || buf[1] !== 0xd8) fail('Foto inválida.');
      player.foto = buf;
      player.fotoV = (player.fotoV || 0) + 1;
      player.avatar = `f:${player.id}:${player.fotoV}`;
      break;
    }
    case 'start':
      if (room.phase !== 'lobby' || !isHost) fail('Só o anfitrião inicia a partida.');
      if (room.players.length < MIN_PLAYERS) fail(`São necessários ${MIN_PLAYERS} jogadores (dá para chamar bots).`);
      if (room.category === CUSTOM && room.customWords.length < CUSTOM_MIN) fail(`A lista personalizada precisa de pelo menos ${CUSTOM_MIN} palavras.`);
      if (room.settings.teams && room.players.length < TEAMS_FROM) fail(`Times precisam de pelo menos ${TEAMS_FROM} jogadores.`);
      room.matchRound = 0;
      room.prenda = null;
      room.next = null;
      for (const p of room.players) { p.score = 0; p.stats = blankStats(); p.team = null; }
      if (room.settings.teams) shuffle(room.players).forEach((p, i) => { p.team = i % 2; });
      if (room.category !== CUSTOM && room.category !== 'Todas' && !categorias(room).includes(room.category)) room.category = 'Todas';
      startRound(room);
      break;
    case 'skip':
      if (room.phase !== 'intro' || !isHost) fail('Só o anfitrião pula o placar.');
      room.phase = 'clues';
      break;
    case 'next':
      if (room.phase !== 'result' || !isHost) fail('Só o anfitrião avança.');
      if (room.matchRound >= room.settings.total) { room.awards = buildAwards(room); room.phase = 'final'; registrarFesta(room); }
      else {
        if (room.players.filter(ativo).length < MIN_PLAYERS) fail(`São necessários ${MIN_PLAYERS} jogadores online.`);
        startRound(room);
      }
      break;
    case 'rematch':
      if (room.phase !== 'final' || !isHost) fail('Só o anfitrião reinicia.');
      room.players = room.players.filter(ativo);   // quem saiu não volta para a próxima (bots ficam)
      for (const p of room.players) { p.waiting = false; p.score = 0; p.stats = blankStats(); }
      room.matchRound = 0;
      room.awards = null;
      room.phase = 'lobby';
      break;
    case 'clue': {
      if (room.phase !== 'clues') fail('Não é hora de dar dicas.');
      if (room.order[room.turn % room.order.length] !== player.id) fail('Não é a sua vez.');
      // dica desenhada: pontos 0..99 ("x,y x,y|x,y ...")
      if (room.settings.draw && body.draw != null) {
        const draw = String(body.draw);
        if (draw.length > DRAW_MAX || !/^[0-9, |]+$/.test(draw) || !/\d/.test(draw)) fail('Desenho inválido.');
        player.stats.clueMs += Date.now() - room.turnStart;
        player.stats.clues++;
        room.clues.push({ pid: player.id, text: '✏️', draw, round: Math.floor(room.turn / room.order.length) + 1 });
        room.turn++;
        break;
      }
      const text = clean(body.text, 24);
      if (!text) fail('Escreva uma dica.');
      const own = room.impostorIds.includes(player.id) ? room.altWord : room.word;   // compara só com a palavra que a pessoa recebeu
      if (own && norm(text) === norm(own)) fail('Essa dica entrega a palavra!');
      player.stats.clueMs += Date.now() - room.turnStart;
      player.stats.clues++;
      room.clues.push({ pid: player.id, text, round: Math.floor(room.turn / room.order.length) + 1 });
      room.turn++;
      break;
    }
    case 'chat': {
      if (room.phase !== 'vote') fail('O chat abre na votação.');
      if (player.waiting) fail('Você entra na próxima rodada.');
      const text = clean(body.text, 120);
      if (!text) fail('Mensagem vazia.');
      room.chat.push({ pid: player.id, text });
      if (room.chat.length > 60) room.chat.shift();
      break;
    }
    case 'react': {
      if (room.phase !== 'vote' && room.phase !== 'guess') fail('Reações só na votação.');
      if (!EMOJIS.includes(body.emoji)) fail('Reação inválida.');
      if (Date.now() - player.lastReact < 350) break;
      player.lastReact = Date.now();
      room.reactions.push({ id: ++room.reactSeq, pid: player.id, emoji: body.emoji });
      if (room.reactions.length > 12) room.reactions.shift();
      break;
    }
    case 'vote': {
      if (room.phase !== 'vote') fail('Não é hora de votar.');
      if (!room.roster.includes(player.id)) fail('Você entra na próxima rodada.');
      if (body.target === player.id || !room.roster.includes(body.target)) fail('Voto inválido.');
      room.votes[player.id] = body.target;
      break;
    }
    case 'guess': {
      if (room.phase !== 'guess' || !room.impostorIds.includes(player.id)) fail('Você não pode palpitar agora.');
      if (player.id in room.guesses) fail('Você já palpitou.');
      const guess = clean(body.text, 40);
      if (!guess) fail('Escreva um palpite.');
      room.guesses[player.id] = guess;
      if (norm(guess) === norm(room.word)) finish(room, 'guessed');
      break;
    }
    default:
      fail('Ação desconhecida.');
  }
  settle(room);
}

function removePlayer(room, player) {
  room.players = room.players.filter((p) => p !== player);
  if (!room.players.some((p) => !p.bot)) { clearTimeout(room.timer); for (const t of room.botTimers) clearTimeout(t); for (const r of room.tvs) r.end(); rooms.delete(room.code); return; }
  if (room.hostId === player.id) room.hostId = (connected(room)[0] || room.players.find((p) => !p.bot)).id;
  broadcast(room);
}

function onDisconnect(room, player) {
  if (room.phase === 'lobby') {
    player.timer = setTimeout(() => {
      if (!player.res && room.phase === 'lobby') removePlayer(room, player);   // se a partida já começou, o jogador fica
    }, LOBBY_GRACE_MS);
  } else {
    settle(room);
  }
  if (room.hostId === player.id && connected(room).length) room.hostId = connected(room)[0].id;
  broadcast(room);
}

// ---------- HTTP ----------
function lookup(code, pid) {
  const room = rooms.get(String(code || '').toUpperCase());
  const player = room && findPlayer(room, pid);
  if (!player) fail('Sala não encontrada.');
  return { room, player };
}

function validName(room, raw) {
  const name = clean(raw, 14);
  if (!name) fail('Digite seu nome.');
  if (room && room.players.some((p) => norm(p.name) === norm(name))) fail('Esse nome já está na sala.');
  return name;
}

// sub = caminho depois de /intruso/api (mesma interface das salas da Vila: devolve o JSON ou null quando é SSE)
async function handle(req, res, url, sub, readJson) {
  if (req.method === 'GET' && sub === '/tv') {   // telão
    const room = rooms.get(String(url.searchParams.get('code') || '').trim().toUpperCase());
    if (!room) fail('Sala não encontrada.');
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
    res.write('retry: 3000\n\n');
    room.tvs.add(res);
    const beat = setInterval(() => res.write(': ping\n\n'), 20000);
    req.on('close', () => { clearInterval(beat); room.tvs.delete(res); if (rooms.has(room.code)) broadcast(room); });
    broadcast(room);
    return null;
  }
  if (req.method === 'GET' && sub === '/foto') {
    const room = rooms.get(String(url.searchParams.get('code') || '').toUpperCase());
    const p = room && findPlayer(room, url.searchParams.get('id'));
    if (!p || !p.foto) fail('Sala não encontrada.');
    res.writeHead(200, { 'Content-Type': 'image/jpeg', 'Cache-Control': 'private, max-age=86400', 'X-Content-Type-Options': 'nosniff' });
    res.end(p.foto);
    return null;
  }
  if (req.method === 'GET' && sub === '/events') {
    const { room, player } = lookup(url.searchParams.get('code'), url.searchParams.get('pid'));
    res.writeHead(200, {
      'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive', 'X-Accel-Buffering': 'no',
    });
    res.write('retry: 2000\n\n');
    clearTimeout(player.timer);
    if (player.res) player.res.end();           // substitui conexão antiga (ex.: aba duplicada)
    player.res = res;
    const beat = setInterval(() => res.write(': ping\n\n'), 20000);
    req.on('close', () => {
      clearInterval(beat);
      if (player.res === res) { player.res = null; if (rooms.has(room.code)) onDisconnect(room, player); }
    });
    broadcast(room);
    return null;
  }
  if (req.method !== 'POST') fail('Método não permitido.');
  const body = await readJson(req);

  if (sub === '/create') {
    if (rooms.size >= MAX_ROOMS) fail('Servidor cheio, tente em instantes.');
    const player = makePlayer(validName(null, body.name), pickAvatar(null, body.avatar));
    const room = makeRoom(player);
    if (!room.code) fail('Não foi possível criar a sala.');
    rooms.set(room.code, room);
    return { code: room.code, pid: player.id };
  }
  if (sub === '/join') {
    const room = rooms.get(clean(body.code, 4).toUpperCase());
    if (!room) fail('Sala não encontrada.');
    if (room.players.length >= MAX_PLAYERS) fail('Sala cheia.');
    const player = makePlayer(validName(room, body.name), pickAvatar(room, body.avatar));
    player.waiting = room.phase !== 'lobby';        // entrou no meio: assiste e joga a partir da próxima rodada
    room.players.push(player);
    broadcast(room);
    return { code: room.code, pid: player.id };
  }
  if (sub === '/act') {
    const { room, player } = lookup(body.code, body.pid);
    const out = act(room, player, body);
    broadcast(room);
    return out && typeof out === 'object' ? out : { ok: true };
  }
  fail('Rota inexistente.');
  return null;
}

// Remove salas abandonadas.
setInterval(() => {
  for (const [code, room] of rooms) {
    if (!connected(room).length && Date.now() - room.lastActive > 30 * 60 * 1000) rooms.delete(code);
  }
}, 5 * 60 * 1000).unref();

// Noite de Festa: no placar final, quem fez mais pontos (empate vale) vence a partida da noite
function registrarFesta(room) {
  if (!festa || !room.festa) return;
  const top = Math.max(0, ...room.players.map((p) => p.score));
  const f = festa.registrar(room.festa, 'intruso', room.players.map((p) => ({ name: p.name, avatar: p.avatar, bot: !!p.bot, venceu: top > 0 && p.score === top })));
  if (f && f.prenda) room.prenda = { ...f.prenda };
}

// abre uma sala do Intruso já com o anfitrião, ligada à Noite de Festa
function abrir(host, festaId) {
  if (rooms.size >= MAX_ROOMS) fail('Servidor cheio, tente em instantes.');
  const player = makePlayer(clean(host.name, 14) || 'Anfitrião', pickAvatar(null, Number(host.avatar)));
  const room = makeRoom(player);
  if (!room.code) fail('Não foi possível criar a sala.');
  room.festa = festaId;
  const f = festa && festa.get(festaId);
  if (f) room.settings.familia = f.familia ? 1 : 0;
  rooms.set(room.code, room);
  return { code: room.code, pid: player.id };
}

module.exports = { handle, rooms, abrir, ligarFesta: (f) => { festa = f; } };
