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

// append que ignora null/false (o append do DOM escreveria "null" na tela)
function put(el, ...kids) {
  el.append(...kids.flat(Infinity).filter((k) => k != null && k !== false));
  return el;
}

// Foto no lugar do personagem: o avatar vira "f:<id>:<versão>" e a imagem vem de api/foto da sala (só na memória do servidor).
let FOTO_BASE = '';   // "api/foto?code=ABCD" (o telão usa o caminho do jogo)
const setFotoBase = (b) => { FOTO_BASE = b; };

// SVGs vêm de constantes de avatars.js; só o índice (validado) vem do servidor.
function av(i, size) {
  if (typeof i === 'string' && i.startsWith('f:')) {
    const [, id, v] = i.split(':');
    const d = h('div', { class: size ? 'av foto' : 'av fill foto', style: size ? `--s:${size}px` : null, role: 'img', 'aria-label': 'foto', 'data-static': 'av' + i });
    d.append(h('img', { src: `${FOTO_BASE}&id=${encodeURIComponent(id)}&v=${encodeURIComponent(v)}`, alt: '', loading: 'lazy' }));
    return d;
  }
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
    // "ouvir meu papel / minha palavra": fala na hora, mesmo com o narrador desligado
    falar(text, tom) {
      if (!ok) return false;
      try {
        speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(text);
        u.lang = 'pt-BR'; u.rate = (tom && tom.rate) || 0.95; if (tom && tom.pitch) u.pitch = tom.pitch;
        if (voice) u.voice = voice;
        speechSynthesis.speak(u);
        return true;
      } catch { return false; }
    },
    // tom: { rate, pitch } da voz do narrador escolhida (Vó, Locutor, Voz do Além…)
    say(text, isHost, tom) {
      if (!this.on(isHost)) return;
      try {
        speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(text);
        u.lang = 'pt-BR'; u.rate = (tom && tom.rate) || 1.02; u.pitch = (tom && tom.pitch) || 0.92;
        if (voice) u.voice = voice;
        speechSynthesis.speak(u);
      } catch { /* sem voz: tudo bem */ }
    },
  };
})();

const grande = () => ls.get('vila-letra') === '1';
// Modo Família: vale para os três jogos (palavras, prendas e textos para todas as idades). Cada jogo pode ajustar mais (onFamilia).
const FAMILIA = { key: 'familia', label: '👨‍👩‍👧 Modo Família', fmt: (v) => (v ? 'Ligado' : 'Desligado'),
  hint: (v) => (v ? 'Para todas as idades: textos leves, prendas de família e tempos mais folgados.' : 'Ligue quando tiver criança ou vó na roda.') };

// endereço que vai nos convites de resultado (wiapps.com.br/vila mostra "acordando a vila" e cai no servidor)
const SITE = 'https://wiapps.com.br/vila/';

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
  let quickStart = false;   // "Jogar agora com bots": começa sozinho assim que a sala abrir
  let showTv = false;       // instruções do telão
  let prendaSeen = 0;       // última prenda já anunciada
  let indo = false;         // Noite de Festa: indo para o próximo jogo
  let showTransfer = false;

  // ---------- passaporte ----------
  function loadProf() {
    try { prof = Object.assign(Perfil.blank(), JSON.parse(ls.get('vila-perfil')) || {}); } catch { prof = Perfil.blank(); }
    Perfil.touch(prof);
    myAvatar = Number(ls.get('vila-avatar'));
    if (!Number.isInteger(myAvatar) || !Perfil.unlocked(prof, myAvatar)) myAvatar = 0;
  }
  const saveProf = () => ls.set('vila-perfil', JSON.stringify(prof));
  // id público do passaporte (vai junto para a sala; base para o ranking entre amigos)
  function passId() {
    let id = ls.get('vila-pp');
    if (!/^[a-z0-9]{8}$/.test(id || '')) { id = Array.from(crypto.getRandomValues(new Uint8Array(8)), (b) => 'abcdefghijkmnpqrstuvwxyz23456789'[b % 32]).join(''); ls.set('vila-pp', id); }
    return id;
  }

  // Levar o passaporte para outro celular: um código de texto com tudo (sem servidor).
  const PREFIXO = 'VILA1-';
  function exportCode() {
    const data = { p: prof, n: ls.get('vila-nome') || '', a: myAvatar, pp: passId() };
    return PREFIXO + btoa(unescape(encodeURIComponent(JSON.stringify(data))));
  }
  function importCode(code) {
    const raw = String(code || '').replace(/\s+/g, '');
    if (!raw.startsWith(PREFIXO)) throw new Error('Esse código não é de um passaporte da Vila.');
    let data;
    try { data = JSON.parse(decodeURIComponent(escape(atob(raw.slice(PREFIXO.length))))); } catch { throw new Error('Código incompleto. Copie ele inteiro.'); }
    if (!data || typeof data.p !== 'object' || typeof data.p.xp !== 'number') throw new Error('Código inválido.');
    prof = Perfil.touch(Object.assign(Perfil.blank(), data.p));
    saveProf();
    if (data.n) ls.set('vila-nome', String(data.n).slice(0, 14));
    if (Number.isInteger(data.a) && Perfil.unlocked(prof, data.a)) { myAvatar = data.a; ls.set('vila-avatar', data.a); }
    if (/^[a-z0-9]{8}$/.test(data.pp || '')) ls.set('vila-pp', data.pp);
  }

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
    setFotoBase(`api/foto?code=${encodeURIComponent(s.code)}`);
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

  // Prenda nova: todo mundo vê quem paga (e o telão também).
  function anunciarPrenda(prev) {
    const pr = state.prenda;
    if (!pr || pr.n === prendaSeen) return;
    const first = !prev;
    prendaSeen = pr.n;
    if (first) return;   // abriu a página agora: não repete
    Snd.drum();
    flash({ emoji: '🎲', title: `Prenda para ${pr.para}!`, text: pr.texto, cls: 'sun', ms: 5200 });
  }

  // Noite de Festa: o anfitrião abriu o próximo jogo; a turma vai junto (entra sozinha com o mesmo nome).
  function seguirFesta() {
    const nx = state.next;
    if (!nx || indo || isHost()) return;
    indo = true;
    toast(`🎉 Próximo jogo da noite: ${(state.festa && state.festa.nomes[nx.slug]) || nx.slug}!`, true);
    setTimeout(() => { location.href = `../${nx.slug}/?sala=${encodeURIComponent(nx.code)}&entrar=1`; }, 1600);
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
      if (quickStart && state.phase === 'lobby' && state.hostId === state.you) { quickStart = false; act('start'); }
      anunciarPrenda(prev);
      seguirFesta();
      try { J.onState(prev, state); } catch (err) { console.error(err); }
      render();
    };
    // Sala que sumiu (servidor reiniciou/dormiu): o EventSource leva 404 e desiste sem tentar de novo.
    // Pergunta ao servidor se a sala existe; se não, volta ao início; se sim e a conexão fechou, reconecta.
    es.onerror = () => {
      $conn.hidden = false;
      errors += 1;
      const closed = es.readyState === 2;
      if (errors !== 1 && !closed && errors % 5) return;
      const cur = es;
      api('act', { code: session.code, pid: session.pid, type: 'ping' })
        .then(() => { if (closed && es === cur) setTimeout(() => { if (es === cur && session) connect(); }, 2000); })
        .catch((e) => {
          if (e.status === 404) leaveRoom(state ? 'Essa sala não existe mais.' : null);
          else if (closed && es === cur) setTimeout(() => { if (es === cur && session) connect(); }, 3000);
        });
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
      if (lastResult.seasonDone) {
        const t = lastResult.seasonDone;
        Snd.fanfare(); confetti();
        flash({ emoji: t.emoji, title: 'Temporada completa!', text: `Você é campeão(ã) de ${t.nome}! +${Perfil.XP.temporada} XP`, cls: 'sun', ms: 3600 });
      }
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
  // Frases prontas: um toque e a frase vai pro chat (digitar no meio da discussão é lento).
  // opts.alvos: ids para os botões de acusação ("🫵 Foi o Tião!").
  function quickChips(opts) {
    if (!opts.frases || state.chatCh !== 'sala') return null;
    return h('div', { class: 'quick', 'data-key': 'quick' },
      (opts.alvos || []).slice(0, 8).map((id) => h('button', { class: 'qchip acc', type: 'button', 'data-act': 'frase',
        'data-t': `${opts.acusa || 'Foi'} ${P(id).name}! 🫵`, 'data-key': 'q' + id }, `🫵 ${P(id).name}`)),
      opts.frases.map((f, i) => h('button', { class: 'qchip', type: 'button', 'data-act': 'frase', 'data-t': f, 'data-key': 'f' + i }, f)));
  }

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
      quickChips(opts),
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
      r.seasonDone ? h('span', { class: 'lvup' }, `${r.seasonDone.emoji} Temporada ${r.seasonDone.nome} completa!`) : null,
      r.ach.map((a) => h('span', { class: 'fact ok' }, `${a.emoji} ${a.name}`)),
      r.avatars.length ? h('div', { class: 'unl' }, h('small', {}, 'Personagem liberado!'), r.avatars.map((i) => av(i, 64))) : null,
      xpBar());
  }

  // Placar da noite: vitórias de cada um desde que a sala abriu (soma a cada revanche).
  function placar() {
    if (state && state.festa && state.festa.jogos) return festaPlacar();
    if (!state || !state.round) return null;
    const rows = state.players.slice().sort((a, b) => b.wins - a.wins);
    const top = rows[0] && rows[0].wins;
    return h('section', { class: 'panel placar', 'data-key': 'placar' },
      h('h2', {}, `🏆 Placar da noite`, h('small', {}, ` · ${state.round} partida${state.round > 1 ? 's' : ''}`)),
      h('ol', {}, rows.map((p, i) => h('li', { class: `${p.wins && p.wins === top ? 'topo' : ''}${p.id === state.you ? ' me' : ''}`, 'data-key': 'pl' + p.id },
        h('span', { class: 'pos' }, p.wins && p.wins === top ? '👑' : `${i + 1}º`), av(p.avatar, 32), h('b', {}, p.id === state.you ? 'Você' : p.name),
        h('span', { class: 'wins' }, `${p.wins} 🏆`)))),
      top && rows.filter((p) => p.wins === top).length === 1
        ? h('p', { class: 'hint center' }, `${rows[0].id === state.you ? 'Você lidera' : rows[0].name + ' lidera'} a noite! Revanche?`) : null);
  }

  // Placar da Noite de Festa: pontos de todos os jogos da noite (vitória 3, presença 1).
  function festaPlacar() {
    const f = state.festa;
    const top = f.placar[0] && f.placar[0].pontos;
    return h('section', { class: 'panel placar festa', 'data-key': 'festa-placar' },
      h('h2', {}, '🎉 Noite de Festa', h('small', {}, ` · ${f.jogos} jogo${f.jogos > 1 ? 's' : ''}`)),
      h('ol', {}, f.placar.map((p, i) => h('li', { class: p.pontos === top ? 'topo' : '', 'data-key': 'fp' + i },
        h('span', { class: 'pos' }, p.pontos === top ? '👑' : `${i + 1}º`), av(p.avatar, 32), h('b', {}, p.name),
        h('span', { class: 'wins' }, `${p.pontos} pts`)))),
      h('p', { class: 'hint center' }, 'Vitória vale 3, jogar vale 1. Bots não contam.'));
  }

  // Prenda: botão no fim da partida e o cartão da última prenda
  function prendaPanel() {
    if (!state) return null;
    const pr = state.prenda;
    return h('section', { class: 'panel prenda', 'data-key': 'prenda' },
      pr ? [h('small', {}, '🎲 Prenda'), h('b', {}, `${pr.para}:`), h('p', {}, pr.texto)] : h('p', { class: 'hint' }, 'Quem perdeu paga prenda? 😏'),
      h('button', { class: 'btn', type: 'button', 'data-act': 'prenda' }, pr ? '🎲 Sortear outra' : '🎲 Sortear prenda'));
  }

  // Noite de Festa: o anfitrião escolhe o próximo jogo (a turma vai junto)
  function festaNext() {
    if (!state || !state.festa || !isHost()) return null;
    const jogos = Object.entries(state.festa.nomes);
    const emoji = { 'cara-de-pau': '🤥', 'ninguem-dorme': '🌙', intruso: '🕵️' };
    return h('section', { class: 'panel', 'data-key': 'festa-next' }, h('h2', {}, '🎉 Próximo jogo da noite'),
      h('div', { class: 'chips' }, jogos.map(([slug, nome]) => h('button', { class: 'chip', type: 'button', 'data-act': 'proximo', 'data-j': slug },
        `${emoji[slug] || '🎲'} ${nome}`))),
      h('p', { class: 'hint' }, 'A turma toda vai junto, com o mesmo nome. O placar da noite continua.'));
  }

  // Álbum da noite: um cartão (imagem) com o campeão, os destaques e a frase da noite
  function fraseDaNoite() {
    const chat = (state.chat || []).filter((m) => m.ch === 'sala' && !P(m.pid).bot);
    const rs = state.reactions || [];
    let best = null, bestN = 0;
    chat.forEach((m, i) => {
      const fim = chat[i + 1] ? chat[i + 1].n : Infinity;
      const n = rs.filter((r) => r.n > m.n && r.n < fim && r.e === '😂').length;
      if (n > bestN) { best = m; bestN = n; }
    });
    return best ? `"${best.text}" — ${P(best.pid).name}` : null;
  }

  async function album() {
    const a = J.album ? J.album(state) : null;
    if (!a) return;
    const W = 1080, H = 1350, c = document.createElement('canvas');
    c.width = W; c.height = H;
    const x = c.getContext('2d');
    const grad = x.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, a.cor1 || '#3B49F0'); grad.addColorStop(1, a.cor2 || '#17143F');
    x.fillStyle = grad; x.fillRect(0, 0, W, H);
    x.fillStyle = '#FFD23F'; x.font = '800 44px "Bricolage Grotesque", system-ui, sans-serif'; x.textAlign = 'center';
    x.fillText('🏘️ VILA SOSSEGO · ÁLBUM DA NOITE', W / 2, 90);
    x.fillStyle = '#fff'; x.font = '800 96px "Bricolage Grotesque", system-ui, sans-serif';
    x.fillText(a.titulo, W / 2, 230);
    // avatares do(s) destaque(s)
    const imgs = await Promise.all(a.avatares.slice(0, 3).map((i) => avatarImg(i)));
    const size = imgs.length > 1 ? 230 : 300;
    imgs.forEach((img, k) => {
      const cx = W / 2 + (k - (imgs.length - 1) / 2) * (size + 30), cy = 470;
      x.save(); x.beginPath(); x.arc(cx, cy, size / 2, 0, Math.PI * 2); x.closePath(); x.fillStyle = '#fff'; x.fill(); x.clip();
      if (img) x.drawImage(img, cx - size / 2, cy - size / 2, size, size);
      x.restore();
      x.lineWidth = 12; x.strokeStyle = '#17143F'; x.beginPath(); x.arc(cx, cy, size / 2, 0, Math.PI * 2); x.stroke();
    });
    x.fillStyle = '#FFD23F'; x.font = '800 64px "Bricolage Grotesque", system-ui, sans-serif';
    x.fillText(a.destaque, W / 2, 720);
    x.fillStyle = '#fff'; x.font = '700 40px Figtree, system-ui, sans-serif';
    let y = 820;
    const frase = fraseDaNoite();
    for (const l of [...a.linhas, ...(frase ? ['😂 Frase da noite:', frase] : [])].slice(0, 9)) {
      for (const parte of quebra(x, l, W - 140)) { x.fillText(parte, W / 2, y); y += 52; }
      y += 10;
    }
    x.fillStyle = 'rgba(255,255,255,.75)'; x.font = '700 34px Figtree, system-ui, sans-serif';
    x.fillText('wiapps.com.br/vila', W / 2, H - 50);
    const blob = await new Promise((r) => c.toBlob(r, 'image/png'));
    const file = new File([blob], 'album-da-noite.png', { type: 'image/png' });
    try {
      if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: 'Álbum da noite' }); return; }
    } catch { return; }
    const link = h('a', { href: URL.createObjectURL(blob), download: 'album-da-noite.png' });
    document.body.append(link); link.click(); link.remove();
    toast('Álbum salvo! 📸', true);
  }
  function quebra(x, t, max) {
    const out = []; let linha = '';
    for (const w of String(t).split(' ')) {
      const teste = linha ? linha + ' ' + w : w;
      if (x.measureText(teste).width > max && linha) { out.push(linha); linha = w; } else linha = teste;
    }
    if (linha) out.push(linha);
    return out;
  }
  function avatarImg(i) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(img); img.onerror = () => resolve(null);
      if (typeof i === 'string' && i.startsWith('f:')) { const [, id, v] = i.split(':'); img.src = `${FOTO_BASE}&id=${id}&v=${v}`; return; }
      const a = AVATARS[i] || AVATARS[0];
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="${a.bg}"/>${a.art}</svg>`);
    });
  }
  function albumButton() {
    if (!J.album) return null;
    return h('button', { class: 'btn', type: 'button', 'data-act': 'album', 'data-key': 'albumbtn' }, '📸 Álbum da noite');
  }

  // Contar o resultado pra turma (WhatsApp / compartilhar do celular).
  function shareButton() {
    if (!J.shareText) return null;
    return h('button', { class: 'btn wa', type: 'button', 'data-act': 'shareResult', 'data-key': 'shareres' }, '📣 Contar pra turma');
  }

  function endButtons() {
    const extra = [prendaPanel(), albumButton(), festaNext()];
    if (isHost()) {
      return h('div', { class: 'endstack', 'data-key': 'endbtns' }, extra,
        h('div', { class: 'two' },
          h('button', { class: 'btn primary', type: 'button', 'data-act': 'start' }, 'Jogar de novo'),
          h('button', { class: 'btn', type: 'button', 'data-act': 'lobby' }, 'Saguão')));
    }
    return h('div', { class: 'endstack', 'data-key': 'endbtns' }, extra,
      h('p', { class: 'hint light center' }, `Esperando ${P(state.hostId).name} começar outra…`));
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
      h('button', { class: 'iconbtn', type: 'button', 'data-act': 'letra', 'aria-label': grande() ? 'Letra normal' : 'Letra grande', 'aria-pressed': String(grande()) }, 'Aa'),
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

  function seasonCard(full) {
    const t = Perfil.temporada(prof.temp.id);
    const done = prof.temp.done;
    return h('section', { class: `panel season${done ? ' done' : ''}`, 'data-key': 'season' },
      h('div', { class: 'season-head' }, h('span', { class: 'se' }, t.emoji),
        h('div', {}, h('small', {}, `Temporada do mês · +${Perfil.XP.temporada} XP`), h('b', {}, t.nome))),
      done ? h('p', { class: 'fact ok center' }, '🏅 Temporada completa! Volte no mês que vem.')
        : t.metas.map((m, i) => h('div', { class: 'meta' }, h('div', { class: 'xpline' }, h('span', {}, m.text), h('small', {}, `${prof.temp.prog[i]}/${m.goal}`)),
          full !== false ? h('span', { class: 'bar' }, h('i', { style: `--w:${Math.round((prof.temp.prog[i] / m.goal) * 100)}%` })) : null)));
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
      h('button', { class: 'btn primary big', type: 'button', 'data-act': 'create' }, 'Criar sala'),
      h('form', { class: 'form-row', 'data-form': 'join' }, codeIn, h('button', { class: 'btn', type: 'submit' }, 'Entrar')),
      h('button', { class: 'btn good', type: 'button', 'data-act': 'quick' }, '🤖 Jogar agora com bots'),
      dailyCard(),
      seasonCard(false),
      h('button', { class: 'btn ghost', type: 'button', 'data-act': 'rules' }, 'Como jogar'),
      h('p', { class: 'hint light center' }, J.jogadores),
      (J.outros || []).map((o) => h('a', { class: 'other', href: o.href }, h('span', { class: 'oe' }, o.emoji),
        h('span', {}, h('small', {}, 'Também na Vila Sossego'), h('b', {}, o.nome)), icon('send'))));
  }

  function perfilScreen() {
    const li = Perfil.levelInfo(prof.xp);
    const stat = (n, t) => h('div', { class: 'stat' }, h('b', {}, n), h('small', {}, t));
    return h('div', { class: 'screen', 'data-screen': 'perfil' },
      h('button', { class: 'btn back', type: 'button', 'data-act': 'home' }, icon('back'), 'Voltar'),
      h('section', { class: 'panel prof-head' }, av(myAvatar, 96), h('h2', {}, ls.get('vila-nome') || 'Morador sem nome'),
        h('span', { class: 'title-tag' }, li.title), xpBar()),
      seasonCard(),
      Object.keys(prof.temporadas || {}).length ? h('section', { class: 'panel' }, h('h2', {}, 'Selos de temporada'),
        h('div', { class: 'facts' }, Object.entries(prof.temporadas).map(([id, nome]) => h('span', { class: 'fact ok' }, `${Perfil.temporada(id).emoji} ${nome}`)))) : null,
      h('h2', {}, 'Passaporte da Vila'),
      h('div', { class: 'stats' }, stat(prof.partidas, 'partidas'), stat(prof.vitorias, 'vitórias'), stat(prof.bestStreak, 'melhor sequência')),
      h('h2', {}, '🤥 Cara de Pau'),
      h('div', { class: 'stats' }, stat(prof.cdp.blefes, 'blefes que colaram'), stat(prof.cdp.duvidasCertas, 'blefes pegos'), stat(prof.cdp.labia, 'vitórias na lábia')),
      h('h2', {}, '🌙 Ninguém Dorme'),
      h('div', { class: 'stats' }, stat(prof.nd.vitVila, 'vitórias da vila'), stat(prof.nd.vitCapanga, 'vitórias de capanga'), stat(prof.nd.votosCertos, 'votos certos')),
      h('h2', {}, '🕵️ Intruso'),
      h('div', { class: 'stats' }, stat(prof.int.partidas, 'partidas'), stat(prof.int.vitIntruso, 'rodadas vencidas de intruso'), stat(prof.int.votosCertos, 'vezes que achou o intruso')),
      h('section', { class: 'panel' }, h('h2', {}, 'Conquistas'),
        h('ul', { class: 'achs' }, Perfil.ACH.map((a) => h('li', { class: `ach${prof.ach[a.id] ? ' on' : ''}` },
          h('span', { class: 'achic' }, a.emoji), h('div', {}, h('b', {}, a.name), h('small', {}, a.desc)))))),
      h('section', { class: 'panel' }, h('h2', {}, 'Personagens exclusivos'),
        h('ul', { class: 'achs' }, Perfil.UNLOCKS.map((u) => h('li', { class: `ach${Perfil.unlocked(prof, u.i) ? ' on' : ''}` },
          av(u.i, 44), h('div', {}, h('b', {}, AVATARS[u.i].name), h('small', {}, u.req)))))),
      transferPanel());
  }

  function transferPanel() {
    return h('section', { class: 'panel', 'data-key': 'transfer' }, h('h2', {}, '📲 Trocar de celular'),
      h('p', { class: 'hint' }, 'O passaporte fica guardado neste aparelho. Para levar para outro, copie o código aqui e cole lá.'),
      showTransfer ? [
        h('textarea', { class: 'code-out', readonly: true, rows: 3, 'aria-label': 'Código do passaporte', 'data-static': 'code-' + prof.xp }, exportCode()),
        h('button', { class: 'btn', type: 'button', 'data-act': 'copyPass' }, '📋 Copiar código'),
        h('form', { class: 'form-row', 'data-form': 'importPass' },
          h('input', { name: 'code', autocomplete: 'off', placeholder: 'Colar código de outro celular', 'aria-label': 'Código de outro celular' }),
          h('button', { class: 'btn', type: 'submit' }, 'Usar')),
      ] : h('button', { class: 'btn', type: 'button', 'data-act': 'transfer' }, 'Levar ou trazer meu passaporte'));
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
        picker ? [avatarGrid('pickAvatar', meP.avatar, taken),
          h('label', { class: 'btn fotobtn' }, '📸 Usar minha foto',
            h('input', { type: 'file', accept: 'image/*', capture: 'user', 'data-change': 'foto', hidden: true })),
          h('p', { class: 'hint' }, 'A foto fica só nesta sala, enquanto ela existir. Ninguém guarda.')] : null,
        host ? h('button', { class: 'btn', type: 'button', 'data-act': 'addBot', disabled: state.players.length >= state.max }, '🤖 Chamar um bot') : null,
        host && !enough ? h('p', { class: 'hint' }, `Precisa de pelo menos ${state.min}. Sem gente? Chame bots e jogue agora.`) : null),
      h('div', { class: 'two' },
        h('button', { class: 'btn', type: 'button', 'data-act': 'tv' }, '📺 Telão'),
        h('button', { class: `btn${state.festa ? ' good' : ''}`, type: 'button', 'data-act': 'festa', disabled: !host, 'aria-pressed': String(!!state.festa) },
          state.festa ? '🎉 Festa ligada' : '🎉 Noite de Festa')),
      state.festa ? h('p', { class: 'hint light center' }, 'Noite de Festa: várias partidas, de qualquer jogo, com um placar só e prenda para quem perde.') : null,
      placar(),
      h('section', { class: 'panel' }, h('h2', {}, 'Regras da sala'),
        [FAMILIA, ...J.settings].map((s) => h('div', { class: 'setrow' }, h('span', { class: 'setlbl' }, s.label),
          h('div', { class: 'chips' }, state.options[s.key].map((v) => h('button', { class: 'chip', type: 'button', 'data-act': 'setting',
            'data-k': s.key, 'data-v': JSON.stringify(v), 'aria-pressed': String(state.settings[s.key] === v), disabled: !host }, s.fmt(v)))),
          s.hint ? h('small', { class: 'hint' }, s.hint(state.settings[s.key])) : null))),
      J.lobby ? J.lobby(state) : null,
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

  function tvSheet() {
    const tvUrl = `${SITE}tv`;
    const local = `../tv/?sala=${state.code}`;
    return h('div', { class: 'sheet', 'data-act': 'closeTv' },
      h('div', { class: 'sheet-body', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Telão' },
        h('div', { class: 'sheet-head' }, h('h2', {}, '📺 Jogar no telão'),
          h('button', { class: 'iconbtn', type: 'button', 'data-act': 'closeTv', 'aria-label': 'Fechar' }, '×')),
        h('p', {}, 'A TV (ou o notebook) mostra o tabuleiro para todo mundo: código, placar, votação, revelações e o narrador falando pela caixa de som. Os segredos continuam só no celular de cada um.'),
        h('ol', { class: 'passos' },
          h('li', {}, 'No navegador da TV ou do notebook, abra ', h('b', {}, tvUrl.replace('https://', ''))),
          h('li', {}, 'Digite o código da sala: ', h('b', { class: 'tvcode' }, state.code))),
        h('a', { class: 'btn', href: local, target: '_blank', rel: 'noopener' }, 'Abrir o telão neste aparelho'),
        state.tv ? h('p', { class: 'fact ok center' }, '📺 Telão conectado!') : null,
        h('button', { class: 'btn primary', type: 'button', 'data-act': 'closeTv' }, 'Entendi!')));
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
    const modal = h('div', {}, showRules ? rulesSheet() : null, showTv && state ? tvSheet() : null);
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
    try { enterRoom(await api(path, { name, avatar: myAvatar, pp: passId(), ...body })); }
    catch (e) { quickStart = false; toast(e.message); }
  }

  function shareText() { return `Bora jogar ${J.nome} na Vila Sossego! Sala ${state.code}: ${location.origin}${location.pathname}?sala=${state.code}`; }

  const ACT = {
    create: () => enter('create', {}),
    quick: () => { quickStart = true; enter('create', { bots: J.bots || 3 }); },
    frase: (el) => { Snd.pop(); act('chat', { text: el.dataset.t }); },
    shareResult: async () => {
      const text = `${J.shareText(state)}\nVem jogar na Vila Sossego: ${SITE}`;
      try {
        if (navigator.share) await navigator.share({ title: 'Vila Sossego', text });
        else window.open('https://wa.me/?text=' + encodeURIComponent(text), '_blank', 'noopener');
      } catch { /* cancelou */ }
    },
    transfer: () => { showTransfer = true; render(); },
    copyPass: async () => {
      try { await navigator.clipboard.writeText(exportCode()); toast('Código copiado! Cole no outro celular.', true); }
      catch { const t = document.querySelector('.code-out'); if (t) { t.select(); toast('Selecione e copie o código.'); } }
    },
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
    setting: async (el) => {
      const key = el.dataset.k, value = JSON.parse(el.dataset.v);
      await act('setting', { key, value });
      // Modo Família ligado: o jogo ajusta o resto (ex.: tempos maiores, papéis simples)
      if (key === 'familia' && value && J.onFamilia) for (const [k, v] of J.onFamilia()) await act('setting', { key: k, value: v });
    },
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
    tv: () => { showTv = true; render(); },
    closeTv: (el, e) => { if (el.classList.contains('sheet') && e.target !== el) return; showTv = false; render(); },
    festa: () => act('festa'),
    prenda: () => act('prenda'),
    album: () => { album().catch(() => toast('Não consegui montar o álbum.')); },
    letra: () => { const on = !grande(); document.documentElement.classList.toggle('grande', on); ls.set('vila-letra', on ? '1' : '0'); render(); },
    proximo: async (el) => {
      const jogo = el.dataset.j;
      let r;
      try { r = await api('act', { code: session.code, pid: session.pid, type: 'proximo', jogo }); } catch (e) { toast(e.message); return; }
      // o anfitrião já entra na sala nova; a turma recebe o link pelo state.next
      if (r.slug === 'intruso') ls.set('intruso-sessao', JSON.stringify({ code: r.code, pid: r.pid }));
      else ls.set(`vila-sessao-${r.slug}`, JSON.stringify({ code: r.code, pid: r.pid }));
      indo = true;
      setTimeout(() => { location.href = `../${r.slug}/`; }, 1200);
    },
  };

  // Foto do celular → 96x96 JPEG (pequena) → sala
  async function enviarFoto(file) {
    if (!file) return;
    try {
      const bmp = await createImageBitmap(file);
      const c = document.createElement('canvas'); c.width = 96; c.height = 96;
      const lado = Math.min(bmp.width, bmp.height);
      c.getContext('2d').drawImage(bmp, (bmp.width - lado) / 2, (bmp.height - lado) / 2, lado, lado, 0, 0, 96, 96);
      let q = 0.8, data = c.toDataURL('image/jpeg', q);
      while (data.length > 15000 && q > 0.3) { q -= 0.15; data = c.toDataURL('image/jpeg', q); }
      picker = false;
      await act('foto', { data });
    } catch { toast('Não consegui usar essa foto.'); }
  }
  document.addEventListener('change', (e) => {
    const el = e.target.closest('[data-change="foto"]');
    if (el) enviarFoto(el.files && el.files[0]);
  });
  const FORM = {
    join: (f) => {
      const code = f.elements.codigo.value.replace(/[^a-z]/gi, '').toUpperCase();
      if (code.length !== 4) { toast('O código tem 4 letras.'); f.elements.codigo.focus(); return; }
      enter('join', { code });
    },
    chat: (f) => { const i = f.elements.msg; const text = i.value.trim(); if (text) { i.value = ''; act('chat', { text }); } },
    importPass: (f) => {
      const code = f.elements.code.value;
      if (!code.trim()) return;
      if (!confirm('Trocar o passaporte deste celular pelo do código? O daqui será substituído.')) return;
      try { importCode(code); showTransfer = false; toast('Passaporte carregado! 🎉', true); render(); }
      catch (e) { toast(e.message); }
    },
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
    document.documentElement.classList.toggle('grande', grande());
    loadProf();
    try { session = JSON.parse(ls.get(`vila-sessao-${J.slug}`)); } catch { session = null; }
    if (session) setFotoBase(`api/foto?code=${encodeURIComponent(session.code)}`);
    const sala = new URLSearchParams(location.search).get('sala');
    if (session && sala && sala.toUpperCase() !== session.code) session = null;   // link de outra sala: entra nela
    const comBots = new URLSearchParams(location.search).get('bots') === '1';
    if (comBots) session = null;   // pediu partida nova com bots
    if (session) connect();
    render();
    // Noite de Festa: veio pelo link do próximo jogo → entra sozinho com o nome de sempre
    const q = new URLSearchParams(location.search);
    if (!session && q.get('entrar') === '1' && sala && (ls.get('vila-nome') || ls.get('intruso-nome'))) {
      const n = document.getElementById('nome');
      if (n && !n.value) n.value = ls.get('vila-nome') || ls.get('intruso-nome');
      enter('join', { code: sala.toUpperCase() });
    }
    // link "jogar com bots" do portal: começa direto se o nome já é conhecido
    if (comBots) {
      history.replaceState(null, '', location.pathname);
      if (ls.get('vila-nome')) ACT.quick();
      else { toast('Digite seu nome e toque em "Jogar agora com bots".', true); const n = document.getElementById('nome'); if (n) n.focus(); }
    }
  }

  return {
    start, render, ACT, FORM, act, move, toast, flash, confetti, tmr, reactBar, chatPanel, resultPanel, endButtons, placar, shareButton,
    fraseDaNoite,
    P, nameOf, isHost, get state() { return state; }, get prof() { return prof; },
  };
})();
