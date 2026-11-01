'use strict';
// Salas da Vila Sossego: saguão, anfitrião, bots, reações, chat e relógio de cada fase, servidas por HTTP + SSE.
// Cada jogo entra como um módulo (cara-de-pau/jogo.js, ninguem-dorme/jogo.js) com esta interface:
//   id, min, max, options, defaults, start(room), move(room, pid, move), view(room, pid),
//   wait(room) → { key, ids, secs } | null, timeout(room), winners(room) → [pid] | null,
//   bot(room, pid) → move | null, botDelay(room, pid) → ms, botLine?(room, pid) → texto | null,
//   chat(room, pid) → canal | null, canSee(room, pid, canal) → bool, RuleError.

const crypto = require('crypto');

class GameError extends Error {}
const fail = (msg) => { throw new GameError(msg); };

const SEC = () => Number(process.env.SEC_MS) || 1000;   // 1 "segundo" do jogo em ms (testes usam menos)
const MAX_ROOMS = 300;
const LOBBY_GRACE_MS = 20000;
const OFFLINE_SECS = 4;
const CODE_LETTERS = 'ABCDEFGHJKLMNPQRSTUVXZ';
const EMOJIS = ['😂', '😱', '🤨', '🔥', '👀', '🤥'];
const AVATAR_BASE = 12;
const AVATAR_TOTAL = 20;   // deve bater com public/comum/avatars.js
const BOT_NAMES = ['Zé Bot', 'Dona Bitinha', 'Robertão', 'Lurdinha', 'Tião', 'Cida', 'Nestor', 'Jurema', 'Valdisney', 'Creusa', 'Genivaldo', 'Neusinha'];

const newId = () => crypto.randomBytes(8).toString('hex');
const clean = (s, max) => String(s == null ? '' : s).replace(/\s+/g, ' ').trim().slice(0, max);
const norm = (s) => clean(s, 60).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const rint = (n) => crypto.randomInt(n);

function createRooms(G) {
  const rooms = new Map();
  const findPlayer = (room, pid) => room.players.find((p) => p.id === pid);
  const online = (p) => p.bot || !!p.res;
  const connected = (room) => room.players.filter((p) => !p.bot && p.res);

  function newCode() {
    for (let tries = 0; tries < 50; tries++) {
      let c = '';
      for (let i = 0; i < 4; i++) c += CODE_LETTERS[rint(CODE_LETTERS.length)];
      if (!rooms.has(c)) return c;
    }
    return null;
  }

  function pickAvatar(room, wanted) {
    const taken = new Set(room ? room.players.map((p) => p.avatar) : []);
    if (Number.isInteger(wanted) && wanted >= 0 && wanted < AVATAR_TOTAL && !taken.has(wanted)) return wanted;
    const free = [...Array(AVATAR_BASE).keys()].filter((i) => !taken.has(i));
    return free.length ? free[rint(free.length)] : rint(AVATAR_BASE);
  }

  const makePlayer = (name, avatar, bot = false) => ({ id: newId(), name, avatar, bot, wins: 0, res: null, timer: null, lastReact: 0, lastChat: 0 });

  function makeRoom(host) {
    return { code: newCode(), hostId: host.id, players: [host], phase: 'lobby', settings: { ...G.defaults }, g: null, round: 0,
      deadline: 0, total: 0, timer: null, armKey: '', botKeys: new Set(), botTimers: [], chat: [], reactions: [], seq: 0,
      counted: false, lastActive: Date.now() };
  }

  function view(room, pid) {
    const me = findPlayer(room, pid);
    const v = {
      code: room.code, you: pid, hostId: room.hostId, phase: room.phase, settings: room.settings, options: G.options,
      min: G.min, max: G.max, emojis: EMOJIS, round: room.round,
      players: room.players.map((p) => ({ id: p.id, name: p.name, avatar: p.avatar, bot: p.bot, wins: p.wins, online: online(p) })),
      leftMs: room.deadline ? Math.max(0, room.deadline - Date.now()) : 0, totalMs: room.total,
      reactions: room.reactions,
      chat: room.chat.filter((m) => m.ch === 'sala' || (room.phase === 'game' && room.g && G.canSee(room, pid, m.ch))),
    };
    if (room.phase === 'game' && room.g) {
      v.game = G.view(room, pid);
      v.chatCh = me ? G.chat(room, pid) : null;
    } else v.chatCh = me ? 'sala' : null;
    return v;
  }

  function push(player, data) {
    if (player.res) player.res.write(`data: ${JSON.stringify(data)}\n\n`);
  }

  function broadcast(room) {
    room.lastActive = Date.now();
    for (const p of room.players) if (!p.bot) push(p, view(room, p.id));
  }

  function clearBots(room) {
    for (const t of room.botTimers) clearTimeout(t);
    room.botTimers = [];
    room.botKeys.clear();
  }

  // Relógio da fase + jogadas dos bots. A chave muda quando a fase muda; quem passa não reinicia o relógio.
  function arm(room) {
    const w = room.phase === 'game' && room.g ? G.wait(room) : null;
    if (!w) { clearTimeout(room.timer); clearBots(room); room.deadline = 0; room.armKey = ''; return; }
    if (w.key !== room.armKey) {
      room.armKey = w.key;
      clearTimeout(room.timer);
      clearBots(room);
      const waitingHumans = w.ids.map((id) => findPlayer(room, id)).filter((p) => !p || !p.bot);
      const allOffline = w.ids.length > 0 && waitingHumans.length === w.ids.length && waitingHumans.every((p) => !p || !p.res);
      const secs = allOffline ? Math.min(OFFLINE_SECS, w.secs) : w.secs;
      room.total = secs * 1000;
      room.deadline = Date.now() + secs * SEC();
      const key = w.key;
      room.timer = setTimeout(() => {
        if (room.armKey !== key) return;
        try { G.timeout(room); } catch (e) { if (!(e instanceof G.RuleError)) console.error(e); }
        settle(room);
      }, secs * SEC());
    }
    for (const id of w.ids) {
      const p = findPlayer(room, id);
      const bk = `${w.key}|${id}`;
      if (!p || !p.bot || room.botKeys.has(bk)) continue;
      room.botKeys.add(bk);
      const key = w.key;
      // falas do bot nesta fase (o jogo decide quando e o quê; botLine pode devolver null)
      const times = G.botChatTimes ? G.botChatTimes(room, id) : [G.botDelay(room, id) * (0.3 + Math.random() * 0.4)];
      for (const t of G.botLine ? times : []) {
        room.botTimers.push(setTimeout(() => {
          if (room.armKey !== key) return;
          const text = G.botLine(room, id);
          if (text) { addChat(room, p, text, G.chat(room, id) || 'sala'); broadcast(room); }
        }, t * SEC() / 1000));
      }
      room.botTimers.push(setTimeout(() => {
        if (room.armKey !== key) return;
        const cur = G.wait(room);
        if (!cur || !cur.ids.includes(id)) return;
        try { const m = G.bot(room, id); if (m) G.move(room, id, m); } catch (e) { if (!(e instanceof G.RuleError)) console.error(e); }
        settle(room);
      }, G.botDelay(room, id) * SEC() / 1000));
    }
  }

  function settle(room) {
    if (room.phase === 'game' && room.g && !room.counted) {
      const ws = G.winners(room);
      if (ws) {
        room.counted = true;
        for (const id of ws) { const p = findPlayer(room, id); if (p) p.wins += 1; }
      }
    }
    arm(room);
    broadcast(room);
  }

  function addChat(room, player, text, ch) {
    room.chat.push({ n: ++room.seq, pid: player.id, text, ch });
    if (room.chat.length > 60) room.chat.shift();
  }

  function removePlayer(room, player) {
    room.players = room.players.filter((p) => p !== player);
    clearTimeout(player.timer);
    if (player.res) { player.res.end(); player.res = null; }
    if (!room.players.some((p) => !p.bot)) { clearTimeout(room.timer); clearBots(room); rooms.delete(room.code); return; }
    if (room.hostId === player.id) room.hostId = (connected(room)[0] || room.players.find((p) => !p.bot)).id;
  }

  const inMatch = (room, pid) => room.phase === 'game' && room.g && !G.winners(room) && G.inGame(room, pid);

  function act(room, player, body) {
    const type = body.type;
    const isHost = player.id === room.hostId;
    const lobby = room.phase === 'lobby' || (room.g && G.winners(room));
    switch (type) {
      case 'ping': return;
      case 'setting': {
        if (!isHost) fail('Só quem criou a sala muda as regras.');
        if (!lobby) fail('Mude as regras antes de começar.');
        const opts = G.options[body.key];
        if (!opts || !opts.includes(body.value)) fail('Opção inválida.');
        room.settings[body.key] = body.value;
        return;
      }
      case 'avatar': {
        if (!lobby) fail('Troque de personagem no saguão.');
        const want = Number(body.value);
        if (!Number.isInteger(want) || want < 0 || want >= AVATAR_TOTAL) fail('Personagem inválido.');
        if (room.players.some((p) => p !== player && p.avatar === want)) fail('Esse personagem já foi escolhido.');
        player.avatar = want;
        return;
      }
      case 'addBot': {
        if (!isHost) fail('Só quem criou a sala chama bots.');
        if (!lobby) fail('Chame bots no saguão.');
        if (room.players.length >= G.max) fail('Sala cheia.');
        const used = new Set(room.players.map((p) => norm(p.name)));
        const name = BOT_NAMES.find((n) => !used.has(norm(n))) || `Bot ${room.players.length + 1}`;
        room.players.push(makePlayer(name, pickAvatar(room), true));
        if (room.phase !== 'lobby') { room.phase = 'lobby'; room.g = null; }
        return;
      }
      case 'kick': {
        if (!isHost) fail('Só quem criou a sala tira alguém.');
        if (!lobby) fail('Espere a partida acabar.');
        const p = findPlayer(room, body.id);
        if (!p || p === player) fail('Jogador inválido.');
        removePlayer(room, p);
        if (room.phase !== 'lobby') { room.phase = 'lobby'; room.g = null; }
        return;
      }
      case 'start': {
        if (!isHost) fail('Só quem criou a sala pode começar.');
        if (!lobby) fail('A partida já começou.');
        if (room.players.length < G.min) fail(`Precisa de pelo menos ${G.min} jogadores (dá pra chamar bots).`);
        if (room.players.length > G.max) fail(`No máximo ${G.max} jogadores.`);
        room.round += 1;
        room.counted = false;
        room.reactions = [];
        room.chat = room.chat.filter((m) => m.ch === 'sala').slice(-10);
        G.start(room);
        room.phase = 'game';
        room.armKey = '';
        return;
      }
      case 'lobby': {
        if (!isHost) fail('Só quem criou a sala volta ao saguão.');
        if (!lobby) fail('Termine a partida primeiro.');
        room.phase = 'lobby'; room.g = null; room.armKey = '';
        return;
      }
      case 'leave': {
        if (inMatch(room, player.id)) fail('Espere a partida acabar para sair.');
        removePlayer(room, player);
        return;
      }
      case 'react': {
        const i = Number(body.i);
        if (!EMOJIS[i]) fail('Reação inválida.');
        if (Date.now() - player.lastReact < 700) return;
        player.lastReact = Date.now();
        room.reactions.push({ n: ++room.seq, pid: player.id, e: EMOJIS[i] });
        if (room.reactions.length > 12) room.reactions.shift();
        return;
      }
      case 'chat': {
        const text = clean(body.text, 120);
        if (!text) return;
        const ch = room.phase === 'game' && room.g ? G.chat(room, player.id) : 'sala';
        if (!ch) fail('Agora você não pode falar.');
        if (Date.now() - player.lastChat < 800) fail('Calma, uma mensagem por vez.');
        player.lastChat = Date.now();
        addChat(room, player, text, ch);
        // bot citado responde
        for (const r of (G.botReply ? G.botReply(room, player, text, ch) : []) || []) {
          const bot = findPlayer(room, r.id);
          if (!bot || !bot.bot) continue;
          room.botTimers.push(setTimeout(() => {
            if (!rooms.has(room.code) || !room.players.includes(bot)) return;
            addChat(room, bot, r.text, ch);
            broadcast(room);
          }, (1500 + rint(2500)) * SEC() / 1000));
        }
        return;
      }
      case 'move': {
        if (room.phase !== 'game' || !room.g) fail('A partida não começou.');
        try { G.move(room, player.id, body.move || {}); }
        catch (e) { if (e instanceof G.RuleError) fail(e.message); throw e; }
        return;
      }
      default: fail('Ação desconhecida.');
    }
  }

  function onDisconnect(room, player) {
    if (room.phase === 'lobby') {
      player.timer = setTimeout(() => {
        if (!player.res && room.phase === 'lobby' && rooms.has(room.code)) { removePlayer(room, player); if (rooms.has(room.code)) broadcast(room); }
      }, LOBBY_GRACE_MS);
    }
    if (room.hostId === player.id && connected(room).length) room.hostId = connected(room)[0].id;
    room.armKey = '';
    arm(room);
    broadcast(room);
  }

  function validName(room, raw) {
    const name = clean(raw, 14);
    if (!name) fail('Digite seu nome.');
    if (room && room.players.some((p) => norm(p.name) === norm(name))) fail('Esse nome já está na sala.');
    return name;
  }

  function lookup(code, pid) {
    const room = rooms.get(String(code || '').trim().toUpperCase());
    const player = room && findPlayer(room, pid);
    if (!player || player.bot) fail('Sala não encontrada.');
    return { room, player };
  }

  // sub = caminho depois de /<jogo>/api
  async function handle(req, res, url, sub, readJson) {
    if (req.method === 'GET' && sub === '/events') {
      const { room, player } = lookup(url.searchParams.get('code'), url.searchParams.get('pid'));
      res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
      res.write('retry: 2000\n\n');
      clearTimeout(player.timer);
      if (player.res) player.res.end();
      player.res = res;
      const beat = setInterval(() => res.write(': ping\n\n'), 20000);
      req.on('close', () => {
        clearInterval(beat);
        if (player.res === res) { player.res = null; if (rooms.has(room.code)) onDisconnect(room, player); }
      });
      room.armKey = '';
      arm(room);
      broadcast(room);
      return null;
    }
    if (req.method !== 'POST') fail('Método não permitido.');
    const body = await readJson(req);
    if (sub === '/create') {
      if (rooms.size >= MAX_ROOMS) fail('Servidor cheio, tente em instantes.');
      const player = makePlayer(validName(null, body.name), pickAvatar(null, Number(body.avatar)));
      const room = makeRoom(player);
      if (!room.code) fail('Não foi possível criar a sala.');
      rooms.set(room.code, room);
      return { code: room.code, pid: player.id };
    }
    if (sub === '/join') {
      const room = rooms.get(clean(body.code, 4).toUpperCase());
      if (!room) fail('Sala não encontrada. Confira o código.');
      if (room.players.length >= G.max) fail('Sala cheia.');
      const player = makePlayer(validName(room, body.name), pickAvatar(room, Number(body.avatar)));
      room.players.push(player);   // entrou no meio: assiste e joga a próxima
      broadcast(room);
      return { code: room.code, pid: player.id };
    }
    if (sub === '/act') {
      const { room, player } = lookup(body.code, body.pid);
      act(room, player, body);
      if (rooms.has(room.code)) settle(room);
      return { ok: true };
    }
    fail('Rota inexistente.');
    return null;
  }

  setInterval(() => {
    for (const [code, room] of rooms) {
      if (!connected(room).length && Date.now() - room.lastActive > 30 * 60 * 1000) { clearTimeout(room.timer); clearBots(room); rooms.delete(code); }
    }
  }, 5 * 60 * 1000).unref();

  return { handle, rooms };
}

module.exports = { createRooms, GameError };
