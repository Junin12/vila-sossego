'use strict';
// Intruso Diário: lê as dicas de 5 moradores, acha o intruso (2 chances) e chuta a palavra (1 chance).
// A 2ª rodada de dicas ajuda, mas tira a estrela ⭐. O resultado vira quadradinhos para o WhatsApp.
// Guarda sequência e histórico no aparelho (vila-diario) e dá XP no Passaporte da Vila.

const $v = document.getElementById('view');
const ls = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* sem armazenamento */ } },
};
function h(tag, props, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) if (v != null && v !== false) el.setAttribute(k, v === true ? '' : v);
  for (const kid of kids.flat(Infinity)) if (kid != null && kid !== false) el.append(kid instanceof Node ? kid : String(kid));
  return el;
}
function av(i, size) {
  const a = AVATARS[i] || AVATARS[0];
  const d = h('div', { class: 'av', style: `--s:${size}px;background:${a.bg}`, role: 'img', 'aria-label': a.name });
  d.innerHTML = `<svg viewBox="0 0 64 64" aria-hidden="true">${a.art}</svg>`;
  return d;
}
function toast(msg, ok) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.className = ok ? 'ok' : ''; t.hidden = false;
  clearTimeout(toast.t); toast.t = setTimeout(() => { t.hidden = true; }, 3000);
}

const N = DIARIO.numero();
const hoje = DIARIO.doDia(N);
const stats = (() => { try { return JSON.parse(ls.get('vila-diario')) || {}; } catch { return {}; } })();
stats.hist = stats.hist || {};
const salvar = () => ls.set('vila-diario', JSON.stringify(stats));
// partida de hoje (retoma se fechou no meio)
let jogo = stats.hist[N] || { rodada2: false, erros: [], intruso: null, palavra: null, fim: false };

function sequencia() {
  let s = 0;
  for (let d = N; stats.hist[d] && stats.hist[d].fim && stats.hist[d].intruso; d--) s++;
  return s;
}

function terminar() {
  jogo.fim = true;
  stats.hist[N] = jogo;
  const ok = !!jogo.intruso;
  stats.jogados = (stats.jogados || 0) + 1;
  if (ok) stats.acertos = (stats.acertos || 0) + 1;
  stats.melhor = Math.max(stats.melhor || 0, sequencia());
  salvar();
  // Passaporte da Vila: XP do desafio
  try {
    const p = Perfil.touch(Object.assign(Perfil.blank(), JSON.parse(ls.get('vila-perfil')) || {}));
    const g = Perfil.onDiario(p, { intruso: ok, palavra: jogo.palavra === hoje.palavra, estrela: !jogo.rodada2 && ok, sequencia: sequencia() });
    ls.set('vila-perfil', JSON.stringify(p));
    jogo.xp = g.xp;
    stats.hist[N] = jogo; salvar();
    if (g.ach.length) setTimeout(() => toast(`${g.ach[0].emoji} Conquista: ${g.ach[0].name}!`, true), 1800);
  } catch { /* sem passaporte: tudo bem */ }
  if (ok) { Snd.fanfare(); confete(); } else Snd.lose();
  if (window.Premium) Premium.depoisDaPartida();
}

function confete() {
  const fx = document.getElementById('fx');
  const cores = ['#FFD23F', '#FF5A5F', '#1FC98D', '#8E7CF0', '#fff'];
  for (let i = 0; i < 36; i++) {
    const c = h('i', { style: `left:${Math.random() * 100}%;background:${cores[i % 5]};--t:${1.6 + Math.random() * 1.6}s;--r:${Math.random() * 720 - 360}deg;animation-delay:${Math.random() * 0.4}s` });
    fx.append(c); setTimeout(() => c.remove(), 3800);
  }
}

function suspeito(s, i) {
  const errado = jogo.erros.includes(i);
  const achou = jogo.intruso && s.intruso;
  const revela = jogo.fim || achou;
  return h('button', { class: `susp${errado ? ' errado' : ''}${revela && s.intruso ? ' intruso' : ''}`, type: 'button', 'data-a': 'votar', 'data-i': i,
    disabled: jogo.intruso || errado || jogo.fim || null },
  av(s.avatar, 56), h('b', {}, s.nome),
  h('span', { class: 'dicas' }, h('span', { class: 'dica' }, s.dicas[0]), jogo.rodada2 || jogo.fim ? h('span', { class: 'dica' }, s.dicas[1]) : null),
  errado ? h('small', {}, '❌ inocente') : revela && s.intruso ? h('small', {}, '🕵️ o intruso!') : null);
}

function telaJogo() {
  const etapa = !jogo.intruso ? 'intruso' : !jogo.palavra ? 'palavra' : 'fim';
  return h('div', { class: 'screen' },
    h('div', { class: 'logo' }, h('span', { class: 'mark' }, '🕵️'), h('div', {}, h('p', { class: 'kicker' }, `Desafio #${N}`), h('h1', {}, 'Intruso Diário'))),
    h('section', { class: 'panel cat' }, h('small', {}, 'Categoria'), h('b', {}, hoje.cat),
      h('p', { class: 'hint' }, etapa === 'intruso' ? `Quatro moradores sabem a palavra. Um é o intruso e está blefando. Quem é? (${2 - jogo.erros.length} chance${jogo.erros.length ? '' : 's'})`
        : 'Achou o intruso! Agora: qual era a palavra secreta? (1 chance)')),
    h('div', { class: 'susps' }, hoje.suspeitos.map(suspeito)),
    etapa === 'intruso' && !jogo.rodada2 ? h('button', { class: 'btn', type: 'button', 'data-a': 'rodada2' }, '👀 Ver a 2ª rodada de dicas (perde a ⭐)') : null,
    etapa === 'palavra' ? h('div', { class: 'opcoes' }, hoje.opcoes.map((o) => h('button', { class: 'btn', type: 'button', 'data-a': 'palavra', 'data-p': o }, o))) : null);
}

function telaFim() {
  const ok = !!jogo.intruso;
  const res = { tentativas: ok ? jogo.erros.length + 1 : 3, palavra: jogo.palavra === hoje.palavra, estrela: ok && !jogo.rodada2, sequencia: sequencia() };
  const txt = DIARIO.resultadoTexto(N, res);
  const amanha = new Date(); amanha.setHours(24, 0, 0, 0);
  return h('div', { class: 'screen' },
    h('div', { class: `banner ${ok ? 'win' : 'lose'}` }, ok ? (res.palavra ? '🏆 Gabaritou!' : '🕵️ Pegou o intruso!') : '😅 O intruso escapou!',
      h('small', {}, `A palavra era ${hoje.palavra}.`)),
    h('div', { class: 'susps' }, hoje.suspeitos.map(suspeito)),
    h('section', { class: 'panel grade' }, h('pre', {}, txt),
      h('button', { class: 'btn wa', type: 'button', 'data-a': 'compartilhar', 'data-t': txt }, '📣 Mandar para a turma')),
    h('div', { class: 'stats' },
      h('div', { class: 'stat' }, h('b', {}, stats.jogados || 0), h('small', {}, 'jogados')),
      h('div', { class: 'stat' }, h('b', {}, `${Math.round(((stats.acertos || 0) / Math.max(1, stats.jogados || 0)) * 100)}%`), h('small', {}, 'acertos')),
      h('div', { class: 'stat' }, h('b', {}, `🔥 ${res.sequencia}`), h('small', {}, `seguidos (recorde ${stats.melhor || 0})`))),
    jogo.xp ? h('p', { class: 'lead center' }, `+${jogo.xp} XP no Passaporte da Vila`) : null,
    h('p', { class: 'hint light center', id: 'conta', 'data-ate': amanha.getTime() }, ''),
    h('section', { class: 'panel' }, h('h2', {}, 'Agora com a turma, ao vivo'),
      h('p', { class: 'hint' }, 'No Intruso de verdade, cada um recebe a palavra no celular e o intruso é alguém da roda.'),
      h('a', { class: 'btn primary', href: '../intruso/' }, '🕵️ Jogar Intruso com a turma'),
      h('a', { class: 'btn', href: '../intruso/?bots=1' }, '🤖 Treinar contra bots')));
}

function render() {
  $v.replaceChildren(jogo.fim ? telaFim() : telaJogo());
}

// contagem para o próximo desafio
setInterval(() => {
  const el = document.getElementById('conta');
  if (!el) return;
  const ms = Math.max(0, Number(el.dataset.ate) - Date.now());
  if (!ms) { location.reload(); return; }
  const hh = Math.floor(ms / 3600000), mm = Math.floor(ms / 60000) % 60, ss = Math.floor(ms / 1000) % 60;
  el.textContent = `Próximo desafio em ${hh}h ${String(mm).padStart(2, '0')}min ${String(ss).padStart(2, '0')}s`;
}, 1000);

const A = {
  rodada2: () => { jogo.rodada2 = true; stats.hist[N] = jogo; salvar(); Snd.pop(); render(); },
  votar: (el) => {
    Snd.unlock();
    const i = Number(el.dataset.i);
    const s = hoje.suspeitos[i];
    if (s.intruso) { jogo.intruso = s.nome; Snd.drum(); }
    else {
      jogo.erros.push(i); Snd.low();
      if (jogo.erros.length >= 2) { jogo.palavra = '—'; terminar(); }
    }
    stats.hist[N] = jogo; salvar(); render();
  },
  palavra: (el) => {
    jogo.palavra = el.dataset.p;
    if (jogo.palavra !== hoje.palavra) toast(`Era ${hoje.palavra}!`);
    terminar(); render();
  },
  compartilhar: async (el) => {
    const t = el.dataset.t;
    try {
      if (navigator.share) await navigator.share({ text: t });
      else { await navigator.clipboard.writeText(t); toast('Copiado! Cole no grupo. 📋', true); }
    } catch { /* cancelou */ }
  },
  letra: () => { const on = ls.get('vila-letra') !== '1'; ls.set('vila-letra', on ? '1' : '0'); document.documentElement.classList.toggle('grande', on); },
};
document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-a]');
  if (el && !el.disabled && A[el.dataset.a]) A[el.dataset.a](el);
});
document.documentElement.classList.toggle('grande', ls.get('vila-letra') === '1');
render();
