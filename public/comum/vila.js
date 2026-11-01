'use strict';
// Base das telas da Vila Sossego, igual nos dois jogos: conexão, início, saguão (QR, bots, regras), passaporte,
// chat, reações, cronômetro, narrador por voz e efeitos. Depende de avatars.js, qr.js, sound.js e perfil.js.
// Cada jogo chama Vila.start(Jogo) — ver cara-de-pau/app.js e ninguem-dorme/app.js.

// ---------- utilidades ----------
const ls = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* sem armazenamento */ } },
  del(k) { try { localStorage.removeItem(k); } catch { /* idem */ } },
};

// Monta elementos só com textContent/atributos: nada de innerHTML com dado de jogador.
function h(tag, props, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v === false || v == null) continue;
    el.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat(Infinity)) {
    if (kid == null || kid === false) continue;
    el.append(kid instanceof Node ? kid : String(kid));
  }
  return el;
}

// SVGs vêm de constantes de avatars.js; só o índice (validado) vem do servidor.
function av(i, size) {
  const a = AVATARS[i] || AVATARS[0];
  const d = h('div', { class: size ? 'av' : 'av fill', style: size ? `--s:${size}px;background:${a.bg}` : `background:${a.bg}`,
    role: 'img', 'aria-label': a.name, 'data-static': 'av' + i });
  d.innerHTML = `<svg viewBox="0 0 64 64" aria-hidden="true">${a.art}</svg>`;
  return d;
}

function icon(name) {
  const s = h('span', { class: 'ic', 'data-static': name });
  s.innerHTML = ICONS[name] || '';
  return s;
}

// Atualiza o DOM existente em vez de recriá-lo: campos de texto, foco e animações em curso são preservados.
function syncAttrs(o, n) {
  for (const { name, value } of Array.from(n.attributes)) if (o.getAttribute(name) !== value) o.setAttribute(name, value);
  for (const { name } of Array.from(o.attributes)) if (!n.hasAttribute(name)) o.removeAttribute(name);
}

function morph(oldParent, newParent) {
  const olds = Array.from(oldParent.childNodes);
  const news = Array.from(newParent.childNodes);
  for (let i = 0; i < Math.max(olds.length, news.length); i++) {
    const o = olds[i], n = news[i];
    if (!n) { oldParent.removeChild(o); continue; }
    if (!o) { oldParent.appendChild(n); continue; }
    const keyO = o.nodeType === 1 ? o.getAttribute('data-key') : null;
    const keyN = n.nodeType === 1 ? n.getAttribute('data-key') : null;
    if (o.nodeType !== n.nodeType || o.nodeName !== n.nodeName || keyO !== keyN) { oldParent.replaceChild(n, o); continue; }
    if (o.nodeType === 3) { if (o.nodeValue !== n.nodeValue) o.nodeValue = n.nodeValue; continue; }
    const st = o.getAttribute('data-static');
    const same = st !== null && st === n.getAttribute('data-static');
    syncAttrs(o, n);
    if (same) continue;
    morph(o, n);
  }
}

// ---------- narrador (voz do aparelho) ----------
// Por padrão só o celular de quem criou a sala narra (senão a mesa vira um coral). Cada um pode ligar/desligar.
const Voz = (() => {
  const ok = typeof window !== 'undefined' && 'speechSynthesis' in window;
  let voice = null;
  const pickVoice = () => {
    if (!ok) return;
    const vs = speechSynthesis.getVoices();
    voice = vs.find((v) => /pt[-_]BR/i.test(v.lang)) || vs.find((v) => /^pt/i.test(v.lang)) || null;
  };
  if (ok) { pickVoice(); speechSynthesis.onvoiceschanged = pickVoice; }
  return {
    ok,
    on(isHost) { const v = ls.get('vila-voz'); return ok && (v == null ? !!isHost : v === '1'); },
    set(v) { ls.set('vila-voz', v ? '1' : '0'); if (!v && ok) speechSynthesis.cancel(); },
    say(text, isHost) {
      if (!this.on(isHost)) return;
      try {
        speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(text);
        u.lang = 'pt-BR'; u.rate = 1.02; u.pitch = 0.92;
        if (voice) u.voice = voice;
        speechSynthesis.speak(u);
      } catch { /* sem voz: tudo bem */ }
    },
  };
})();

// ---------- base ----------
const Vila = (() => {
  const $view = document.getElementById('view');
  const $top = document.getElementById('top');
  const $modal = document.getElementById('modal');
  const $toast = document.getElementById('toast');
  const $conn = document.getElementById('conn');
  const $fx = document.getElementById('fx');
  let J = null;
  let session = null, state = null, es = null, errors = 0;
  let tab = 'home', showQR = false, showRules = false, picker = false;
  let deadlineAt = 0, deadlineTotal = 0, toastTimer = null, flashTimer = null;
  let reactSeen = Infinity, chatSeen = 0;
  let lastResult = null;
  let prof = null;
  let myAvatar = 0;

  // ---------- passaporte ----------
  function loadProf() {
    try { prof = Object.assign(Perfil.blank(), JSON.parse(ls.get('vila-perfil')) || {}); } catch { prof = Perfil.blank(); }
    Perfil.touch(prof);
    myAvatar = Number(ls.get('vila-avatar'));
    if (!Number.isInteger(myAvatar) || !Perfil.unlocked(prof, myAvatar)) myAvatar = 0;
  }
  const saveProf = () => ls.set('vila-perfil', JSON.stringify(prof));

  // ---------- rede ----------
  async function api(path, body) {
    let r;
    try { r = await fetch('api/' + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); }
    catch { throw new Error('Sem conexão. Confira a internet e tente de novo.'); }
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { const e = new Error(j.error || 'O servidor está acordando… tente de novo em alguns segundos.'); e.status = r.status; throw e; }
    return j;
  }
  const act = (type, extra) => api('act', { code: session.code, pid: session.pid, type, ...extra }).catch((e) => toast(e.message));
  const move = (m) => act('move', { move: m });

  function toast(msg, ok) {
    $toast.textContent = msg;
    $toast.className = ok ? 'ok' : '';
    $toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { $toast.hidden = true; }, 3200);
  }

  function enterRoom(s) {
    session = s;
    ls.set(`vila-sessao-${J.slug}`, JSON.stringify(s));
    history.replaceState(null, '', location.pathname);
    reactSeen = Infinity; chatSeen = 0; lastResult = null;
    connect();
  }

  function leaveRoom(msg) {
    if (es) es.close();
    es = null; session = null; state = null; showQR = false; picker = false;
    ls.del(`vila-sessao-${J.slug}`);
    $conn.hidden = true;
    if (msg) toast(msg);
    tab = 'home';
    render();
  }

  function connect() {
    if (es) es.close();
    es = new EventSource(`api/events?code=${encodeURIComponent(session.code)}&pid=${encodeURIComponent(session.pid)}`);
    es.onmessage = (e) => {
      errors = 0;
      $conn.hidden = true;
      const prev = state;
      state = JSON.parse(e.data);
      if (!state.players.some((p) => p.id === session.pid)) { leaveRoom('Você saiu da sala.'); return; }
      deadlineTotal = state.totalMs || state.leftMs;
      deadlineAt = state.leftMs ? Date.now() + state.leftMs : 0;
      newReactions();
      if (prev && state.chat.length && state.chat[state.chat.length - 1].n > chatSeen && chatSeen) {
        const last = state.chat[state.chat.length - 1];
        if (last.pid !== state.you) Snd.pop();
      }
      chatSeen = state.chat.length ? state.chat[state.chat.length - 1].n : chatSeen || 1;
      record();
      try { J.onState(prev, state); } catch (err) { console.error(err); }
      render();
    };
    es.onerror = () => {
      $conn.hidden = false;
      if (++errors === 2) {
        api('act', { code: session.code, pid: session.pid, type: 'ping' }).catch((e) => { if (e.status === 404) leaveRoom('Essa sala não existe mais.'); });
      }
    };
  }

  // Fim de partida: conta no passaporte uma vez só por rodada.
  function record() {
    if (!state.game) return;
    const e = J.result(state);
    if (!e) return;
    const key = `${J.slug}|${state.code}|${state.round}|${session.pid}`;
    if (ls.get('vila-ultimo') === key) return;
    ls.set('vila-ultimo', key);
    lastResult = Perfil.onGame(prof, e);
    saveProf();
    setTimeout(() => {
      toast(`+${lastResult.xp} XP` + (lastResult.levelUp ? ` · Nível ${lastResult.levelUp}!` : '') + (lastResult.avatars.length ? ' · Personagem novo!' : ''), true);
    }, 2600);
  }

  function newReactions() {
    const rs = state.reactions || [];
    const top = rs.length ? rs[rs.length - 1].n : 0;
    if (reactSeen === Infinity) { reactSeen = top; return; }
    for (const r of rs) {
      if (r.n <= reactSeen) continue;
      const p = state.players.find((x) => x.id === r.pid);
      const f = h('div', { class: 'floaty', style: `left:${8 + Math.random() * 76}%` }, p ? av(p.avatar, 28) : null, r.e);
      $fx.append(f);
      setTimeout(() => f.remove(), 2500);
    }
    reactSeen = Math.max(reactSeen, top);
  }

  // ---------- peças que os jogos usam ----------
  const P = (id) => (state && state.players.find((p) => p.id === id)) || { name: 'alguém', avatar: 0 };
  const nameOf = (id) => (state && id === state.you ? 'Você' : P(id).name);
  const isHost = () => !!state && state.hostId === state.you;

  function tmr() {
    return h('div', { class: 'tmr', 'data-key': 'tmr' }, h('div', { class: 'tbar' }, h('i', {})), h('b', {}, ''));
  }
  setInterval(() => {
    const left = deadlineAt ? Math.max(0, deadlineAt - Date.now()) : 0;
    const pct = deadlineAt && deadlineTotal ? (left / deadlineTotal) * 100 : 0;
    for (const t of document.querySelectorAll('.tmr')) {
      t.querySelector('i').style.width = `${pct}%`;
      t.querySelector('b').textContent = deadlineAt ? Math.ceil(left / 1000) : '';
      t.classList.toggle('hot', !!deadlineAt && pct < 25);
    }
  }, 250);

  function reactBar() {
    if (!state) return null;
    return h('div', { class: 'reacts', 'data-key': 'reacts' },
      state.emojis.map((e, i) => h('button', { class: 'react', type: 'button', 'data-act': 'react', 'data-i': i, 'aria-label': 'Reagir ' + e }, e)));
  }

  const CH = { capangas: '🦹 só capangas', fantasmas: '👻 fantasmas' };
  function chatPanel(opts = {}) {
    const ch = state.chatCh;
    const msgs = state.chat.slice(-(opts.max || 40));
    const placeholder = ch === 'capangas' ? 'Cochiche com os capangas…' : ch === 'fantasmas' ? 'Fale com os outros fantasmas…' : 'Mande uma mensagem…';
    return h('section', { class: `panel chatbox${opts.cls ? ' ' + opts.cls : ''}`, 'data-key': 'chat' },
      opts.title ? h('h2', {}, opts.title) : null,
      h('div', { class: 'chat', 'data-n': msgs.length ? msgs[msgs.length - 1].n : 0 },
        msgs.map((m) => h('div', { class: `msg${m.ch !== 'sala' ? ' ch-' + m.ch : ''}`, 'data-key': 'm' + m.n },
          av(P(m.pid).avatar, 26),
          h('p', {}, h('b', {}, P(m.pid).name), CH[m.ch] ? h('small', { class: 'chtag' }, CH[m.ch]) : null, ' ', m.text)))),
      ch ? h('form', { class: 'form-row', 'data-form': 'chat' },
        h('input', { name: 'msg', maxlength: 120, autocomplete: 'off', placeholder, 'aria-label': 'Mensagem' }),
        h('button', { class: 'btn', type: 'submit', 'aria-label': 'Enviar' }, icon('send')))
        : h('p', { class: 'hint' }, opts.silent || 'Agora não dá para falar.'));
  }

  function flash({ emoji, title, text, cls, ms }) {
    const el = document.getElementById('flash');
    el.replaceChildren(h('div', { class: `flash-card ${cls || ''}` }, emoji ? h('div', { class: 'flash-emoji' }, emoji) : null,
      h('b', {}, title), text ? h('p', {}, text) : null));
    el.hidden = false;
    clearTimeout(flashTimer);
    flashTimer = setTimeout(() => { el.hidden = true; }, ms || 2400);
  }
  document.getElementById('flash').addEventListener('click', (e) => { e.currentTarget.hidden = true; });

  function confetti() {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const colors = ['#FFD23F', '#FF5A5F', '#1FC98D', '#8E7CF0', '#fff'];
    for (let i = 0; i < 40; i++) {
      const c = h('i', { style: `left:${Math.random() * 100}%;background:${colors[i % colors.length]};--t:${1.6 + Math.random() * 1.6}s;--r:${Math.random() * 720 - 360}deg;animation-delay:${Math.random() * 0.4}s` });
      $fx.append(c);
      setTimeout(() => c.remove(), 3800);
    }
  }

  function xpBar() {
    const li = Perfil.levelInfo(prof.xp);
    return h('div', { class: 'xp' },
      h('div', { class: 'xpline' }, h('b', {}, `Nível ${li.level}`), h('span', { class: 'title-tag sm' }, li.title), h('small', {}, `${li.into}/${li.need} XP`)),
      h('span', { class: 'bar' }, h('i', { style: `--w:${Math.round((li.into / li.need) * 100)}%` })));
  }

  // Quadro do fim: XP ganho, nível, conquistas e personagens novos.
  function resultPanel() {
    const r = lastResult;
    if (!r) return null;
    return h('section', { class: 'panel gain', 'data-key': 'gain' },
      h('p', { class: 'xpgain' }, `+${r.xp} XP`),
      r.levelUp ? h('span', { class: 'lvup' }, `Subiu para o nível ${r.levelUp}! ${Perfil.levelInfo(prof.xp).title}`) : null,
      r.dailyDone ? h('span', { class: 'lvup' }, '📅 Desafio do dia completo!') : null,
      r.ach.map((a) => h('span', { class: 'fact ok' }, `${a.emoji} ${a.name}`)),
      r.avatars.length ? h('div', { class: 'unl' }, h('small', {}, 'Personagem liberado!'), r.avatars.map((i) => av(i, 64))) : null,
      xpBar());
  }

  function endButtons() {
    if (isHost()) {
      return h('div', { class: 'two', 'data-key': 'endbtns' },
        h('button', { class: 'btn primary', type: 'button', 'data-act': 'start' }, 'Jogar de novo'),
        h('button', { class: 'btn', type: 'button', 'data-act': 'lobby' }, 'Saguão'));
    }
    return h('p', { class: 'hint light center', 'data-key': 'endbtns' }, `Esperando ${P(state.hostId).name} começar outra…`);
  }

  // ---------- telas ----------
  function header() {
    const t = h('div', {});
    if (session && state) {
      t.append(h('div', { class: 'l' },
        h('button', { class: 'iconbtn', type: 'button', 'data-act': 'leave', 'aria-label': 'Sair da sala' }, icon('exit')),
        h('button', { class: 'pill', type: 'button', 'data-act': 'share', 'aria-label': 'Compartilhar sala' }, 'Sala ', h('b', {}, state.code))));
    } else {
      t.append(h('a', { class: 'pill', href: '../' }, '🏘️ Vila Sossego'));
    }
    t.append(h('div', { class: 'r' },
      J.voz && Voz.ok ? h('button', { class: `iconbtn${Voz.on(isHost()) ? '' : ' off'}`, type: 'button', 'data-act': 'voz',
        'aria-label': Voz.on(isHost()) ? 'Desligar narrador' : 'Ligar narrador', title: 'Narrador por voz' }, '🎙️') : null,
      h('button', { class: 'iconbtn', type: 'button', 'data-act': 'sound', 'aria-label': Snd.muted ? 'Ligar som' : 'Desligar som' }, icon(Snd.muted ? 'mute' : 'sound')),
      h('button', { class: 'iconbtn', type: 'button', 'data-act': 'rules', 'aria-label': 'Como jogar' }, '?')));
    return t;
  }

  function avatarGrid(act, current, taken) {
    return h('div', { class: 'avgrid' }, AVATARS.map((a, i) => {
      const locked = !Perfil.unlocked(prof, i);
      return h('button', { class: `avbtn${locked ? ' locked' : ''}`, type: 'button', 'data-act': act, 'data-i': i,
        'aria-pressed': String(i === current), 'aria-label': a.name + (locked ? ' (bloqueado)' : ''), disabled: taken.has(i) && i !== current },
      av(i), locked ? h('span', { class: 'lockbadge' }, icon('lock')) : null);
    }));
  }

  function dailyCard() {
    const d = prof.daily;
    const def = Perfil.DAILY.find((x) => x.id === d.id);
    if (!def) return null;
    return h('div', { class: `daily${d.done ? ' done' : ''}` },
      h('div', {}, h('small', {}, `Desafio do dia · +${Perfil.XP.diario} XP`), h('b', {}, def.text)),
      d.done ? h('span', { class: 'okmark' }, icon('check')) : h('span', { class: 'prog' }, `${Math.min(d.prog, def.goal)}/${def.goal}`));
  }

  function homeScreen() {
    const nameIn = h('input', { id: 'nome', maxlength: 14, autocomplete: 'nickname', placeholder: 'Como te chamam na vila?' });
    nameIn.value = ls.get('vila-nome') || '';
    const codeIn = h('input', { id: 'codigo', class: 'code-in', maxlength: 4, autocapitalize: 'characters', autocomplete: 'off',
      autocorrect: 'off', spellcheck: 'false', placeholder: 'ABCD', 'aria-label': 'Código da sala' });
    codeIn.value = (new URLSearchParams(location.search).get('sala') || '').toUpperCase().slice(0, 4);
    return h('div', { class: 'screen home', 'data-screen': 'home' },
      h('div', { class: 'logo' }, h('span', { class: 'mark' }, J.emoji), h('div', {}, h('p', { class: 'kicker' }, 'Vila Sossego apresenta'), h('h1', {}, J.nome))),
      h('p', { class: 'lead' }, J.sub),
      h('button', { type: 'button', class: 'panel mini', 'data-act': 'perfil', 'aria-label': 'Abrir meu passaporte' },
        av(myAvatar, 52), h('div', { class: 'grow' }, xpBar()), h('span', { class: 'chev' }, icon('user'))),
      h('section', { class: 'panel' },
        h('h2', {}, 'Seu personagem'),
        avatarGrid('homeAvatar', myAvatar, new Set()),
        h('div', {}, h('label', { for: 'nome' }, 'Seu nome'), nameIn)),
      dailyCard(),
      h('button', { class: 'btn primary big', type: 'button', 'data-act': 'create' }, 'Criar sala'),
      h('form', { class: 'form-row', 'data-form': 'join' }, codeIn, h('button', { class: 'btn', type: 'submit' }, 'Entrar')),
      h('button', { class: 'btn ghost', type: 'button', 'data-act': 'rules' }, 'Como jogar'),
      h('p', { class: 'hint light center' }, J.jogadores),
      J.outro ? h('a', { class: 'other', href: J.outro.href }, h('span', { class: 'oe' }, J.outro.emoji),
        h('span', {}, h('small', {}, 'Também na Vila Sossego'), h('b', {}, J.outro.nome)), icon('send')) : null);
  }

  function perfilScreen() {
    const li = Perfil.levelInfo(prof.xp);
    const stat = (n, t) => h('div', { class: 'stat' }, h('b', {}, n), h('small', {}, t));
    return h('div', { class: 'screen', 'data-screen': 'perfil' },
      h('button', { class: 'btn back', type: 'button', 'data-act': 'home' }, icon('back'), 'Voltar'),
      h('section', { class: 'panel prof-head' }, av(myAvatar, 96), h('h2', {}, ls.get('vila-nome') || 'Morador sem nome'),
        h('span', { class: 'title-tag' }, li.title), xpBar()),
      h('h2', {}, 'Passaporte da Vila'),
      h('div', { class: 'stats' }, stat(prof.partidas, 'partidas'), stat(prof.vitorias, 'vitórias'), stat(prof.bestStreak, 'melhor sequência')),
      h('h2', {}, '🤥 Cara de Pau'),
      h('div', { class: 'stats' }, stat(prof.cdp.blefes, 'blefes que colaram'), stat(prof.cdp.duvidasCertas, 'blefes pegos'), stat(prof.cdp.labia, 'vitórias na lábia')),
      h('h2', {}, '🌙 Ninguém Dorme'),
      h('div', { class: 'stats' }, stat(prof.nd.vitVila, 'vitórias da vila'), stat(prof.nd.vitCapanga, 'vitórias de capanga'), stat(prof.nd.votosCertos, 'votos certos')),
      h('section', { class: 'panel' }, h('h2', {}, 'Conquistas'),
        h('ul', { class: 'achs' }, Perfil.ACH.map((a) => h('li', { class: `ach${prof.ach[a.id] ? ' on' : ''}` },
          h('span', { class: 'achic' }, a.emoji), h('div', {}, h('b', {}, a.name), h('small', {}, a.desc)))))),
      h('section', { class: 'panel' }, h('h2', {}, 'Personagens exclusivos'),
        h('ul', { class: 'achs' }, Perfil.UNLOCKS.map((u) => h('li', { class: `ach${Perfil.unlocked(prof, u.i) ? ' on' : ''}` },
          av(u.i, 44), h('div', {}, h('b', {}, AVATARS[u.i].name), h('small', {}, u.req)))))));
  }

  function lobbyScreen() {
    const host = isHost();
    const link = `${location.origin}${location.pathname}?sala=${state.code}`;
    const meP = P(state.you);
    const enough = state.players.length >= state.min;
    const taken = new Set(state.players.filter((p) => p.id !== state.you).map((p) => p.avatar));
    let qr = null;
    if (showQR) {
      qr = h('div', { class: 'qr', 'data-static': 'qr' + state.code });
      try { qr.innerHTML = QR.svg(link); } catch { qr.textContent = link; }
    }
    return h('div', { class: 'screen', 'data-screen': 'lobby' },
      h('section', { class: 'panel invite' },
        h('p', { class: 'sub dark' }, 'Chame a turma com o código'),
        h('div', { class: 'code', role: 'img', 'aria-label': 'Código ' + state.code.split('').join(' ') }, state.code.split('').map((c, i) => h('span', { 'data-key': 'c' + i }, c))),
        h('div', { class: 'two' },
          h('button', { class: 'btn wa', type: 'button', 'data-act': 'whats' }, 'WhatsApp'),
          h('button', { class: 'btn', type: 'button', 'data-act': 'toggleQR', 'aria-expanded': String(showQR) }, showQR ? 'Fechar QR' : 'QR code')),
        qr),
      h('section', { class: 'panel' },
        h('h2', {}, `Na sala (${state.players.length}/${state.max})`),
        h('div', { class: 'tags' }, state.players.map((p) => h(p.id === state.you ? 'button' : 'span', {
          class: `tag${p.id === state.you ? ' me' : ''}${p.online ? '' : ' off'}`, 'data-key': 'p' + p.id,
          type: p.id === state.you ? 'button' : null, 'data-act': p.id === state.you ? 'picker' : null, 'aria-label': p.id === state.you ? 'Trocar personagem' : null },
        av(p.avatar, 38), h('span', { class: 'nm' }, p.name), p.bot ? h('span', { class: 'bot' }, 'bot') : null,
        p.id === state.hostId ? icon('crown') : null, p.id === state.you ? icon('edit') : null,
        host && p.id !== state.you ? h('button', { class: 'ldel', type: 'button', 'data-act': 'kick', 'data-id': p.id, 'aria-label': `Tirar ${p.name}` }, '×') : null))),
        picker ? avatarGrid('pickAvatar', meP.avatar, taken) : null,
        host ? h('button', { class: 'btn', type: 'button', 'data-act': 'addBot', disabled: state.players.length >= state.max }, '🤖 Chamar um bot') : null,
        host && !enough ? h('p', { class: 'hint' }, `Precisa de pelo menos ${state.min}. Sem gente? Chame bots e jogue agora.`) : null),
      h('section', { class: 'panel' }, h('h2', {}, 'Regras da sala'),
        J.settings.map((s) => h('div', { class: 'setrow' }, h('span', { class: 'setlbl' }, s.label),
          h('div', { class: 'chips' }, state.options[s.key].map((v) => h('button', { class: 'chip', type: 'button', 'data-act': 'setting',
            'data-k': s.key, 'data-v': JSON.stringify(v), 'aria-pressed': String(state.settings[s.key] === v), disabled: !host }, s.fmt(v)))),
          s.hint ? h('small', { class: 'hint' }, s.hint(state.settings[s.key])) : null))),
      host ? h('button', { class: 'btn primary big', type: 'button', 'data-act': 'start', disabled: !enough },
        enough ? `Começar ${J.nome}` : `Faltam ${state.min - state.players.length} jogador(es)`)
        : h('p', { class: 'lead center' }, `Esperando ${P(state.hostId).name} começar…`),
      chatPanel({ title: 'Papo do saguão', cls: 'flat' }),
      reactBar());
  }

  function rulesSheet() {
    return h('div', { class: 'sheet', 'data-act': 'closeRules' },
      h('div', { class: 'sheet-body', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Como jogar' },
        h('div', { class: 'sheet-head' }, h('h2', {}, `Como jogar ${J.nome}`),
          h('button', { class: 'iconbtn', type: 'button', 'data-act': 'closeRules', 'aria-label': 'Fechar' }, '×')),
        J.rules(),
        h('button', { class: 'btn primary', type: 'button', 'data-act': 'closeRules' }, 'Entendi!')));
  }

  function render() {
    morph($top, header());
    let next;
    if (session && !state) {
      next = h('div', { class: 'screen', 'data-screen': 'loading' }, h('div', { class: 'loading' }, h('span', {}, J.emoji), h('p', { class: 'lead' }, 'Entrando na sala…'),
        h('p', { class: 'hint light' }, 'Se o servidor estava dormindo, pode levar uns segundos.')));
    } else if (!session) next = tab === 'perfil' ? perfilScreen() : homeScreen();
    else if (state.phase === 'lobby' || !state.game) next = lobbyScreen();
    else next = J.game(state);
    const cur = $view.firstElementChild;
    if (!cur || cur.getAttribute('data-screen') !== next.getAttribute('data-screen')) { $view.replaceChildren(next); window.scrollTo(0, 0); }
    else { syncAttrs(cur, next); morph(cur, next); }
    const modal = h('div', {}, showRules ? rulesSheet() : null);
    morph($modal, modal);
    for (const c of document.querySelectorAll('.chat')) {
      if (c._seen !== c.dataset.n) { c.scrollTop = c.scrollHeight; c._seen = c.dataset.n; }
    }
  }

  // ---------- ações ----------
  async function enter(path, body) {
    const nameEl = document.getElementById('nome');
    const name = nameEl.value.trim();
    if (!name) { toast('Digite seu nome.'); nameEl.focus(); return; }
    ls.set('vila-nome', name);
    Snd.unlock();
    try { enterRoom(await api(path, { name, avatar: myAvatar, ...body })); }
    catch (e) { toast(e.message); }
  }

  function shareText() { return `Bora jogar ${J.nome} na Vila Sossego! Sala ${state.code}: ${location.origin}${location.pathname}?sala=${state.code}`; }

  const ACT = {
    create: () => enter('create', {}),
    homeAvatar: (el) => {
      const i = Number(el.dataset.i);
      const u = Perfil.UNLOCKS.find((x) => x.i === i);
      if (!Perfil.unlocked(prof, i)) { toast(`🔒 ${u ? u.req : 'Bloqueado'} para liberar.`); return; }
      myAvatar = i; ls.set('vila-avatar', i); Snd.pop(); render();
    },
    pickAvatar: (el) => {
      const i = Number(el.dataset.i);
      if (!Perfil.unlocked(prof, i)) { const u = Perfil.UNLOCKS.find((x) => x.i === i); toast(`🔒 ${u ? u.req : 'Bloqueado'} para liberar.`); return; }
      myAvatar = i; ls.set('vila-avatar', i); picker = false; act('avatar', { value: i });
    },
    picker: () => { picker = !picker; render(); },
    perfil: () => { tab = 'perfil'; render(); window.scrollTo(0, 0); },
    home: () => { tab = 'home'; render(); },
    rules: () => { showRules = true; render(); },
    closeRules: (el, e) => { if (el.classList.contains('sheet') && e.target !== el) return; showRules = false; render(); },
    toggleQR: () => { showQR = !showQR; render(); },
    share: async () => {
      const link = `${location.origin}${location.pathname}?sala=${state.code}`;
      try {
        if (navigator.share) await navigator.share({ title: J.nome, text: shareText(), url: link });
        else { await navigator.clipboard.writeText(link); toast('Link da sala copiado!', true); }
      } catch { /* cancelou */ }
    },
    whats: () => { window.open('https://wa.me/?text=' + encodeURIComponent(shareText()), '_blank', 'noopener'); },
    addBot: () => act('addBot'),
    kick: (el) => act('kick', { id: el.dataset.id }),
    setting: (el) => act('setting', { key: el.dataset.k, value: JSON.parse(el.dataset.v) }),
    start: () => { Snd.unlock(); act('start'); },
    lobby: () => act('lobby'),
    leave: () => {
      const g = state && state.game;
      if (g && !J.over(state) && !confirm('Sair da sala no meio da partida?')) return;
      act('leave').finally(() => leaveRoom());
    },
    react: (el) => { act('react', { i: Number(el.dataset.i) }); },
    sound: () => { Snd.toggle(); render(); },
    voz: () => { Voz.set(!Voz.on(isHost())); toast(Voz.on(isHost()) ? '🎙️ Narrador ligado neste celular' : 'Narrador desligado', true); render(); },
  };
  const FORM = {
    join: (f) => {
      const code = f.elements.codigo.value.replace(/[^a-z]/gi, '').toUpperCase();
      if (code.length !== 4) { toast('O código tem 4 letras.'); f.elements.codigo.focus(); return; }
      enter('join', { code });
    },
    chat: (f) => { const i = f.elements.msg; const text = i.value.trim(); if (text) { i.value = ''; act('chat', { text }); } },
  };

  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-act]');
    if (el && !el.disabled && ACT[el.dataset.act]) ACT[el.dataset.act](el, e);
  });
  document.addEventListener('submit', (e) => {
    const f = e.target.closest('form[data-form]');
    if (!f) return;
    e.preventDefault();
    if (FORM[f.dataset.form]) FORM[f.dataset.form](f);
  });

  function start(jogo) {
    J = jogo;
    document.body.classList.add('j-' + J.slug);
    loadProf();
    try { session = JSON.parse(ls.get(`vila-sessao-${J.slug}`)); } catch { session = null; }
    const sala = new URLSearchParams(location.search).get('sala');
    if (session && sala && sala.toUpperCase() !== session.code) session = null;   // link de outra sala: entra nela
    if (session) connect();
    render();
  }

  return {
    start, render, ACT, FORM, act, move, toast, flash, confetti, tmr, reactBar, chatPanel, resultPanel, endButtons,
    P, nameOf, isHost, get state() { return state; }, get prof() { return prof; },
  };
})();
