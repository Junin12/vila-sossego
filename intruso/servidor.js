'use strict';
// Intruso dentro da Vila Sossego: regras e salas do jogo (HTTP + SSE), montado pelo server.js em /intruso/api/...
// Veio do repositório Junin12/Intruso, que agora guarda só o app Android e a loja. Estado em memória.

const crypto = require('crypto');
const { GameError } = require('../salas');
const WORDS = require('../public/intruso/words');
const PAIRS = require('../public/intruso/pairs');
const CLUE_LAPS = 2;       // quantas dicas cada jogador dá por rodada
const SEC = Number(process.env.SEC_MS) || 1000;           // 1 "segundo" do jogo em ms (testes usam valor menor)
const GUESS_SECS = 20;
const TWO_IMPOSTORS_FROM = 7;
const OPTIONS = { total: [5, 10, 20], clueSecs: [0, 10, 15, 20, 30, 45, 60], voteSecs: [0, 30, 45, 60, 90, 120],   // 0 = sem limite
  mode: [0, 1], accomplice: [0, 1] };   // mode 1 = palavra parecida; accomplice 1 = cúmplice ligado
const LOBBY_ONLY = ['total', 'mode', 'accomplice'];
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

function blankStats() { return { impWins: 0, votesGot: 0, rightVotes: 0, clueMs: 0, clues: 0 }; }

function makePlayer(name, avatar) {
  return { id: newId(), name, avatar, score: 0, res: null, timer: null, waiting: false, stats: blankStats(), lastReact: 0 };
}

function makeRoom(host) {
  return {
    code: newCode(), hostId: host.id, players: [host], phase: 'lobby', category: 'Todas',
    settings: { total: 5, clueSecs: 30, voteSecs: 60, mode: 0, accomplice: 0 }, matchRound: 0, customWords: [],
    usedWords: new Set(), wordCategory: null, word: null, altWord: null, impostorIds: [], accompliceId: null, roster: [], order: [], turn: 0,
    clues: [], votes: {}, guesses: {}, chat: [], reactions: [], reactSeq: 0, result: null, awards: null,
    deadline: 0, timer: null, armKey: '', turnStart: 0, lastActive: Date.now(),
  };
}

const findPlayer = (room, pid) => room.players.find((p) => p.id === pid);
const connected = (room) => room.players.filter((p) => p.res);
const rosterOnline = (room) => room.roster.filter((id) => findPlayer(room, id) && findPlayer(room, id).res);

// O que cada jogador pode ver. Impostores nunca recebem a palavra antes do resultado (nem quem está só assistindo).
function view(room, pid) {
  const playing = room.phase !== 'lobby' && room.phase !== 'final';
  const reveal = room.phase === 'result';
  const me = findPlayer(room, pid);
  const isImp = playing && room.impostorIds.includes(pid);
  const isAcc = playing && room.accompliceId === pid;
  const spectator = playing && me.waiting;
  // palavra parecida: até ser descoberto, o intruso se vê como tripulante (só que com a outra palavra)
  const disguised = isImp && !!room.altWord && room.phase !== 'guess' && !reveal;
  const v = {
    code: room.code, you: pid, hostId: room.hostId, phase: room.phase,
    categories: ['Todas', ...Object.keys(WORDS), CUSTOM], category: room.category,
    minPlayers: MIN_PLAYERS, laps: CLUE_LAPS, settings: room.settings, options: OPTIONS, emojis: EMOJIS,
    matchRound: room.matchRound, twoFrom: TWO_IMPOSTORS_FROM, accompliceFrom: ACCOMPLICE_FROM,
    customCount: room.customWords.length, customMin: CUSTOM_MIN,
    players: room.players.map((p) => ({
      id: p.id, name: p.name, avatar: p.avatar, score: p.score, online: !!p.res, waiting: p.waiting, impWins: p.stats.impWins,
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
  const cat = room.category === 'Todas' ? pick(Object.keys(WORDS)) : room.category;
  if (!similar) return { cat, word: pickFresh(room, cat, WORDS[cat]), alt: null };
  const pair = pickFresh(room, 'par:' + cat, PAIRS[cat]).split('|');
  const flip = crypto.randomInt(2);
  return { cat, word: pair[flip], alt: pair[1 - flip] };
}

function startRound(room) {
  room.players = room.players.filter((p) => p.res || !p.waiting);
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
  };
}

// Avança fases automaticamente (pula jogadores offline, fecha votação, etc.).
function advance(room) {
  const total = room.order.length * CLUE_LAPS;
  if (room.phase === 'clues') {
    while (room.turn < total && !(findPlayer(room, room.order[room.turn % room.order.length]) || {}).res) {
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
    case 'start':
      if (room.phase !== 'lobby' || !isHost) fail('Só o anfitrião inicia a partida.');
      if (room.players.length < MIN_PLAYERS) fail(`São necessários ${MIN_PLAYERS} jogadores.`);
      if (room.category === CUSTOM && room.customWords.length < CUSTOM_MIN) fail(`A lista personalizada precisa de pelo menos ${CUSTOM_MIN} palavras.`);
      room.matchRound = 0;
      for (const p of room.players) { p.score = 0; p.stats = blankStats(); }
      startRound(room);
      break;
    case 'skip':
      if (room.phase !== 'intro' || !isHost) fail('Só o anfitrião pula o placar.');
      room.phase = 'clues';
      break;
    case 'next':
      if (room.phase !== 'result' || !isHost) fail('Só o anfitrião avança.');
      if (room.matchRound >= room.settings.total) { room.awards = buildAwards(room); room.phase = 'final'; }
      else {
        if (connected(room).length < MIN_PLAYERS) fail(`São necessários ${MIN_PLAYERS} jogadores online.`);
        startRound(room);
      }
      break;
    case 'rematch':
      if (room.phase !== 'final' || !isHost) fail('Só o anfitrião reinicia.');
      room.players = room.players.filter((p) => p.res);   // quem saiu não volta para a próxima
      for (const p of room.players) { p.waiting = false; p.score = 0; p.stats = blankStats(); }
      room.matchRound = 0;
      room.awards = null;
      room.phase = 'lobby';
      break;
    case 'clue': {
      if (room.phase !== 'clues') fail('Não é hora de dar dicas.');
      if (room.order[room.turn % room.order.length] !== player.id) fail('Não é a sua vez.');
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
  if (!room.players.length) { clearTimeout(room.timer); rooms.delete(room.code); return; }
  if (room.hostId === player.id) room.hostId = (connected(room)[0] || room.players[0]).id;
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
    act(room, player, body);
    broadcast(room);
    return { ok: true };
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

module.exports = { handle, rooms };
