'use strict';
// Telão da Vila Sossego: a TV (ou o notebook) mostra o tabuleiro público dos três jogos.
// Conecta em /<jogo>/api/tv?code=… (só o que é público: nada de papéis, cartas ou palavra secreta).
// Usa da base comum (vila.js): h, av, morph, Voz, Vila.flash e Vila.confetti.

const $tv = document.getElementById('tv');
const NOMES = { 'cara-de-pau': 'Cara de Pau', 'ninguem-dorme': 'Ninguém Dorme', intruso: 'Intruso' };
const EMOJI = { 'cara-de-pau': '🤥', 'ninguem-dorme': '🌙', intruso: '🕵️' };
const SITE_TXT = 'wiapps.com.br/vila';
let slug = null, code = null, st = null, es = null, erro = '';
let deadlineAt = 0, deadlineTotal = 0;
let vistos = { log: 0, prenda: 0, fase: '', result: '' };

const P = (id) => (st && st.players.find((p) => p.id === id)) || { name: 'alguém', avatar: 0 };
const nome = (id) => P(id).name;

// ---------- conexão ----------
async function conectar(c) {
  erro = '';
  code = String(c || '').replace(/[^a-z]/gi, '').toUpperCase().slice(0, 4);
  if (code.length !== 4) { erro = 'O código tem 4 letras.'; render(); return; }
  let r;
  try { r = await fetch(`../api/onde?code=${code}`).then((x) => x.json()); } catch { erro = 'Sem conexão com o servidor.'; render(); return; }
  if (!r.slug) { erro = r.error || 'Sala não encontrada.'; render(); return; }
  slug = r.slug;
  history.replaceState(null, '', `?sala=${code}`);
  setFotoBase(`../${slug}/api/foto?code=${code}`);
  document.body.className = `tvbody j-${slug === 'intruso' ? 'portal' : slug}`;
  if (es) es.close();
  es = new EventSource(`../${slug}/api/tv?code=${code}`);
  es.onmessage = (e) => {
    const prev = st;
    st = JSON.parse(e.data);
    deadlineTotal = st.totalMs || st.leftMs || 0;
    deadlineAt = st.leftMs ? Date.now() + st.leftMs : 0;
    efeitos(prev);
    render();
  };
  es.onerror = () => {
    if (es.readyState === 2) { st = null; slug = null; erro = 'A sala terminou. Digite o código da próxima.'; render(); }
  };
}

// ---------- efeitos: sons, revelações e o narrador falando pela caixa de som ----------
function efeitos(prev) {
  if (!prev) return;
  const pr = st.prenda;
  if (pr && pr.n !== vistos.prenda) { vistos.prenda = pr.n; Snd.drum(); Vila.flash({ emoji: '🎲', title: `Prenda para ${pr.para}!`, text: pr.texto, cls: 'sun', ms: 7000 }); }
  if (slug === 'cara-de-pau') return efeitosCdp(prev);
  if (slug === 'ninguem-dorme') return efeitosNd(prev);
  return efeitosInt(prev);
}

function efeitosCdp(prev) {
  const g = st.game;
  if (!g) return;
  const M = window.VILA.MORADORES;
  for (const e of g.log.filter((x) => x.n > vistos.log)) {
    if (e.t === 'duvida') {
      Snd.suspense();
      Vila.flash({ emoji: '🃏', title: 'DUVIDO!', text: `${nome(e.by)} duvidou de ${nome(e.of)}…`, cls: 'suspense', ms: 1800 });
      setTimeout(() => {
        Snd.drum();
        if (e.had) Vila.flash({ emoji: M[e.card].emoji, title: 'Tinha mesmo!', text: `${nome(e.of)} era ${M[e.card].curto} de verdade!`, cls: 'good revela', ms: 3200 });
        else Vila.flash({ emoji: '🤥', title: 'ERA BLEFE!', text: `${nome(e.by)} pegou ${nome(e.of)} na mentira!`, cls: 'bad revela', ms: 3200 });
      }, 1800);
    } else if (e.t === 'fim') { Snd.fanfare(); Vila.confetti(); cerimonia(); }
  }
  vistos.log = g.log.length ? g.log[g.log.length - 1].n : vistos.log;
}

function efeitosNd(prev) {
  const g = st.game;
  if (!g) return;
  const k = `${st.round}|${g.fase}|${g.noite}|${g.dia}`;
  if (k === vistos.fase) return;
  vistos.fase = k;
  if (st.settings.narrador) return;   // narrador humano: o telão não fala
  if (g.fase === 'noite') { Snd.low(); setTimeout(() => Snd.grilos(), 700); setTimeout(() => Snd.coruja(), 4000); }
  if (g.fase === 'amanhecer') Snd.galo();
  if (g.fase === 'veredito') Snd.drum();
  if (g.fase === 'fim') { Snd.fanfare(); Vila.confetti(); }
  if (g.fase === 'fim') { cerimonia(); return; }
  const r = window.NOITE.narrar(g, nome, !!st.settings.familia, st.settings.voz, st.settings.misterio);
  try { speechSynthesis.cancel(); } catch { /* sem voz */ }
  if (r.texto) setTimeout(() => Voz.falar(r.texto, r), g.fase === 'amanhecer' ? 1300 : 300);
}

// ---------- cerimônia de premiação: no fim de cada partida, os prêmios aparecem um a um, com fanfarra e locução ----------
function premios() {
  const out = [];
  const melhor = (lista, f) => lista.filter((p) => f(p) > 0).sort((a, b) => f(b) - f(a))[0];
  if (slug === 'cara-de-pau' && st.game) {
    const ps = st.game.players.filter((p) => p.stats);
    const b = melhor(ps, (p) => p.stats.blefes); if (b) out.push(['🤥', 'Maior cara de pau', b.id, `${b.stats.blefes} blefes colaram`]);
    const d = melhor(ps, (p) => p.stats.acertos); if (d) out.push(['🔎', 'Detetive da noite', d.id, `pegou ${d.stats.acertos} mentira(s)`]);
    const c = melhor(ps, (p) => p.stats.pego); if (c) out.push(['🚨', 'Pego no flagra', c.id, `${c.stats.pego} vez(es)`]);
  } else if (slug === 'ninguem-dorme' && st.game) {
    const ps = st.game.players.filter((p) => p.stats);
    const f = melhor(ps, (p) => p.stats.votosCertos); if (f) out.push(['🔎', 'Faro fino', f.id, `${f.stats.votosCertos} voto(s) certo(s)`]);
    const a = melhor(ps, (p) => p.stats.salvou); if (a) out.push(['🌿', 'Anjo da guarda', a.id, `salvou ${a.stats.salvou} vez(es)`]);
    const e = melhor(ps, (p) => p.stats.votosErrados); if (e) out.push(['🙈', 'Votou no inocente', e.id, `${e.stats.votosErrados} vez(es)`]);
  } else if (slug === 'intruso' && st.awards) {
    const nomes = { bluffer: ['🎭', 'Melhor blefador'], detective: ['🔍', 'Detetive da noite'], suspect: ['🕵️', 'Mais suspeito'], lost: ['🙈', 'Votou no inocente'] };
    for (const [k, [e, t]] of Object.entries(nomes)) if (st.awards[k]) out.push([e, t, st.awards[k].pid, '']);
  }
  return out;
}
let cerimoniaKey = '';
function cerimonia() {
  const k = `${slug}|${st.round || st.matchRound}`;
  if (k === cerimoniaKey) return;
  cerimoniaKey = k;
  const lista = premios();
  lista.forEach(([emoji, titulo, id, sub], i) => setTimeout(() => {
    Snd.fanfare();
    Vila.flash({ emoji, title: titulo, text: `${nome(id)}${sub ? ' · ' + sub : ''}`, cls: 'sun', ms: 3600 });
    Voz.falar(`E o prêmio de ${titulo} vai para… ${nome(id)}!`, { rate: 1.05, pitch: 1.05 });
  }, 3500 + i * 4200));
  setTimeout(() => Vila.confetti(), 3500 + lista.length * 4200);
}

function efeitosInt(prev) {
  const k = `${st.matchRound}|${st.phase}`;
  if (k === vistos.result) return;
  vistos.result = k;
  if (st.phase === 'result' && st.result) {
    Snd.drum();
    const r = st.result;
    Vila.flash({ emoji: r.impostorWins ? '🕵️' : '🎯', title: r.impostorWins ? 'O intruso venceu!' : 'Pegaram o intruso!', text: `A palavra era ${st.word}.`, cls: r.impostorWins ? 'bad' : 'good', ms: 3500 });
  } else if (st.phase === 'vote') Snd.alarm();
  else if (st.phase === 'final') { Snd.fanfare(); Vila.confetti(); cerimonia(); }
}

// ---------- peças ----------
function relogio() {
  return h('div', { class: 'tvtmr', 'data-key': 'tvtmr' }, h('div', { class: 'tbar' }, h('i', {})), h('b', {}, ''));
}
setInterval(() => {
  const left = deadlineAt ? Math.max(0, deadlineAt - Date.now()) : 0;
  const pct = deadlineAt && deadlineTotal ? (left / deadlineTotal) * 100 : 0;
  for (const t of document.querySelectorAll('.tvtmr')) {
    t.querySelector('i').style.width = `${pct}%`;
    t.querySelector('b').textContent = deadlineAt ? Math.ceil(left / 1000) : '';
    t.classList.toggle('hot', !!deadlineAt && pct < 25);
  }
}, 250);

function convite() {
  const link = `${location.origin}/${slug}/?sala=${code}`;
  const qr = h('div', { class: 'qr', 'data-static': 'qr' + code + slug });
  try { qr.innerHTML = QR.svg(link); } catch { qr.textContent = link; }
  return h('aside', { class: 'convite', 'data-key': 'convite' },
    h('small', {}, 'Entre pelo celular'), qr, h('b', { class: 'cod' }, code), h('span', {}, `${SITE_TXT} · ${NOMES[slug]}`));
}

function festaLado() {
  const f = st && st.festa;
  if (!f || !f.jogos) return null;
  return h('section', { class: 'tvpanel festa', 'data-key': 'tvfesta' }, h('h3', {}, `🎉 Noite de Festa · ${f.jogos} jogo(s)`),
    h('ol', {}, f.placar.slice(0, 8).map((p, i) => h('li', { 'data-key': 'tf' + i }, av(p.avatar, 40), h('b', {}, p.name), h('span', {}, `${p.pontos} pts`)))));
}

function jogadores(lista, extra) {
  return h('div', { class: 'tvplayers' }, lista.map((p) => h('div', { class: `tvp${extra && extra(p) ? ' ' + extra(p) : ''}`, 'data-key': 'tp' + p.id },
    av(p.avatar, 84), h('b', {}, p.name), p.sub ? h('small', {}, p.sub) : null)));
}

function chatTv(max = 6) {
  const msgs = (st.chat || []).filter((m) => m.ch === 'sala').slice(-max);
  if (!msgs.length) return null;
  return h('section', { class: 'tvpanel chat', 'data-key': 'tvchat' }, msgs.map((m) => h('p', { 'data-key': 'm' + m.n }, av(P(m.pid).avatar, 40), h('b', {}, P(m.pid).name), ' ', m.text)));
}

// ---------- Cara de Pau ----------
function tvCdp() {
  const g = st.game;
  if (!g) return saguao();
  const M = window.VILA.MORADORES, A = window.VILA.ACOES, E = window.VILA.EVENTOS;
  const ap = (st.extra && st.extra.apelidos) || {};
  const carta = (c) => (c ? `${M[c].emoji} ${ap[c] || M[c].curto}` : '');
  if (g.phase === 'end') {
    const ws = g.winners || [g.winner];
    return h('div', { class: 'tvscreen', 'data-screen': 'cdp-fim' },
      h('h1', { class: 'tvtitle' }, `🏆 ${ws.map(nome).join(' e ')} ${ws.length > 1 ? 'venceram' : 'venceu'}!`),
      h('div', { class: 'tvwin' }, ws.map((id) => av(P(id).avatar, 220))),
      g.serie && g.serie.fim ? h('p', { class: 'tvbig' }, `🏆 Maior Cara de Pau da Família: ${nome(g.serie.campeao)}`) : null,
      h('div', { class: 'tvrow' }, g.players.map((p) => h('div', { class: 'tvseat', 'data-key': 's' + p.id }, av(P(p.id).avatar, 64), h('b', {}, nome(p.id)),
        h('div', { class: 'tvcards' }, p.cards.map((c) => h('span', { class: `tvcard${c.lost ? ' lost' : ''}` }, carta(c.c)))),
        h('small', {}, `🤥 ${p.stats.blefes} blefes`)))));
  }
  const ev = g.evento ? E[g.evento] : null;
  let foco;
  if (g.phase === 'react' && g.claim) {
    const c = g.claim;
    foco = c.kind === 'acao'
      ? `${nome(c.by)} diz que é ${carta(c.card)} e faz ${A[g.pend.a].nome}${g.pend.target ? ' em ' + nome(g.pend.target) : ''}!`
      : `${nome(c.by)} bloqueia com ${carta(c.card)}!`;
  } else if (g.phase === 'lose') foco = `${nome(g.loser)} está escolhendo qual segredo perder…`;
  else foco = `Vez de ${nome(g.turn)}…`;
  return h('div', { class: 'tvscreen', 'data-screen': 'cdp' },
    ev ? h('div', { class: 'event tvev', 'data-key': 'ev' + g.volta }, h('span', { class: 'ee' }, ev.emoji), h('div', {}, h('small', {}, `Volta ${g.volta}`), h('b', {}, ev.nome), h('span', {}, ev.desc))) : null,
    h('div', { class: 'tvfoco', 'data-key': 'foco' }, av(P(g.phase === 'react' && g.claim ? g.claim.by : g.phase === 'lose' ? g.loser : g.turn).avatar, 120), h('p', {}, foco)),
    relogio(),
    h('div', { class: 'tvrow' }, g.players.map((p) => h('div', { class: `tvseat${g.turn === p.id ? ' turn' : ''}${p.out ? ' out' : ''}`, 'data-key': 's' + p.id },
      av(P(p.id).avatar, 64), h('b', {}, nome(p.id)),
      h('div', { class: 'tvcards' }, p.cards.map((c) => h('span', { class: `tvcard${c.lost ? ' lost' : ' back'}` }, c.lost ? carta(c.c) : '?'))),
      h('small', {}, `🪙 ${p.coins}${p.preso ? ' · 🔒' : ''}`)))),
    chatTv(4));
}

// ---------- Ninguém Dorme ----------
function tvNd() {
  const g = st.game;
  if (!g) return saguao();
  const R = window.NOITE.PAPEIS, ESP = window.NOITE.ESPECIAIS;
  const fam = !!st.settings.familia;
  const titulo = { noite: `🌙 Noite ${g.noite}`, amanhecer: '☀️ Amanheceu!', dia: `🗣️ Dia ${g.dia}: quem são os capangas?`, votacao: '🗳️ Votação!', veredito: '⚖️ O veredito', fim: g.vencedor === 'vila' ? '🏘️ A vila venceu!' : '🦹 Os capangas venceram!' }[g.fase];
  const vivos = g.players.filter((p) => p.vivo);
  const corpo = [];
  if (g.fase === 'noite') {
    corpo.push(h('p', { class: 'tvbig' }, g.especial ? `${ESP[g.especial].emoji} ${ESP[g.especial].nome}: ${ESP[g.especial].desc}` : 'A Vila Sossego dorme… ninguém olha a tela do outro! 🤫'));
    corpo.push(h('p', { class: 'tvsub' }, g.waiting.length ? `Ainda acordados: ${g.waiting.length}` : 'Amanhecendo…'));
  } else if (g.fase === 'amanhecer' || g.fase === 'dia') {
    const a = g.anuncio || {};
    const sai = window.NOITE.sumiuTxt(fam);
    const news = [];
    if (a.sumiu) news.push(`${nome(a.sumiu)} ${sai}!${a.papel ? ` Era ${R[a.papel].emoji} ${R[a.papel].nome}.` : ''}`);
    if (a.sumiu2) news.push(`${nome(a.sumiu2)} também ${sai}!`);
    if (a.saudade) news.push(`💔 ${nome(a.saudade)} saiu de saudade.`);
    if (!a.sumiu) news.push(a.salvo ? '🌿 Ninguém saiu: a Vó Zefa cuidou da vítima!' : '😌 Noite tranquila.');
    if (a.fofoca) news.push(`👀 A Cotinha espalhou: ${nome(a.fofoca.alvo)} ${a.fofoca.saiu ? 'SAIU de casa!' : 'ficou em casa.'}`);
    corpo.push(h('div', { class: 'tvnews' }, news.map((t, i) => h('p', { 'data-key': 'nw' + i }, t))));
    if (g.fase === 'dia') corpo.push(chatTv(7));
  } else if (g.fase === 'votacao') {
    const votos = g.votos || {};
    const conta = {};
    for (const t of Object.values(votos)) conta[t] = (conta[t] || 0) + 1;
    corpo.push(g.votoSecreto ? h('p', { class: 'tvbig' }, `🌫️ Voto secreto! Já votaram ${g.players.filter((p) => p.votou).length} de ${vivos.length}.`)
      : jogadores(vivos.map((p) => ({ id: p.id, name: nome(p.id), avatar: P(p.id).avatar, sub: `${conta[p.id] || 0} voto(s)` })), (p) => (conta[p.id] ? 'votado' : '')));
  } else if (g.fase === 'veredito') {
    const v = g.veredito;
    corpo.push(v && v.expulso
      ? h('div', { class: 'tvfoco' }, av(P(v.expulso).avatar, 180), h('p', {}, `A vila expulsou ${nome(v.expulso)}!${v.papel ? ` Era ${R[v.papel].emoji} ${R[v.papel].nome}.` : ''}`))
      : h('p', { class: 'tvbig' }, v && v.empate ? '🤝 Empate! Ninguém saiu.' : '🤷 Ninguém saiu.'));
    if (g.ultimas) corpo.push(h('div', { class: 'ultimas tvult' }, h('small', {}, `🗣️ Últimas palavras de ${nome(g.ultimas.pid)}`), h('p', {}, `“${g.ultimas.text}”`)));
  } else if (g.fase === 'fim') {
    corpo.push(jogadores(g.players.map((p) => ({ id: p.id, name: nome(p.id), avatar: P(p.id).avatar, sub: `${R[p.papel].emoji} ${R[p.papel].nome}` })),
      (p) => (R[g.players.find((x) => x.id === p.id).papel].time === g.vencedor ? 'votado' : 'dead')));
  }
  return h('div', { class: `tvscreen${g.fase === 'noite' ? ' noite' : ''}`, 'data-screen': 'nd-' + g.fase },
    h('h1', { class: 'tvtitle' }, titulo), g.fase !== 'fim' ? relogio() : null, corpo,
    g.fase !== 'votacao' && g.fase !== 'fim' ? jogadores(g.players.map((p) => ({ id: p.id, name: nome(p.id), avatar: P(p.id).avatar,
      sub: p.vivo ? '' : (p.papel ? `${R[p.papel].emoji} fora` : 'fora') })), (p) => (g.players.find((x) => x.id === p.id).vivo ? '' : 'dead')) : null);
}

// ---------- Intruso ----------
function rabisco(draw) {
  const d = String(draw).split('|').map((tr) => tr.trim().split(/\s+/).join(' ')).filter(Boolean);
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 100 100');
  svg.setAttribute('class', 'rabisco');
  for (const pts of d) {
    const pl = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
    pl.setAttribute('points', pts);
    svg.append(pl);
  }
  return svg;
}

function tvInt() {
  const s = st;
  if (s.phase === 'lobby') return saguao();
  if (s.phase === 'final') {
    const rows = s.players.slice().sort((a, b) => b.score - a.score);
    return h('div', { class: 'tvscreen', 'data-screen': 'int-final' }, h('h1', { class: 'tvtitle' }, '🏆 Fim da partida!'),
      jogadores(rows.map((p, i) => ({ id: p.id, name: `${i + 1}º ${p.name}`, avatar: p.avatar, sub: `${p.score} pts` })), (p) => (p.id === rows[0].id ? 'votado' : '')));
  }
  if (s.phase === 'intro') {
    return h('div', { class: 'tvscreen', 'data-screen': 'int-intro' }, h('h1', { class: 'tvtitle' }, `🕵️ Rodada ${s.matchRound} de ${s.settings.total}`),
      h('p', { class: 'tvbig' }, `${s.impostorCount === 2 ? 'Há 2 intrusos' : 'Há 1 intruso'} na roda. Olhem a palavra no celular!`),
      jogadores(s.players.slice().sort((a, b) => b.score - a.score).map((p) => ({ ...p, sub: `${p.score} pts` }))));
  }
  const vez = s.order && s.order.length ? s.order[s.turn % s.order.length] : null;
  const titulo = { clues: `✍️ Dicas · vez de ${nome(vez)}`, vote: '🗳️ Quem é o intruso?', guess: '🎯 O intruso tenta adivinhar a palavra…', result: s.result && s.result.impostorWins ? '🕵️ O intruso venceu!' : '🎯 Pegaram o intruso!' }[s.phase] || '';
  return h('div', { class: 'tvscreen', 'data-screen': 'int-' + s.phase },
    h('h1', { class: 'tvtitle' }, titulo),
    s.phase === 'result' ? h('p', { class: 'tvbig' }, `A palavra era ${s.word}${s.altWord ? ` (o intruso tinha ${s.altWord})` : ''}. Intruso: ${(s.impostorIds || []).map(nome).join(' e ')}.`) : null,
    s.phase !== 'result' ? relogio() : null,
    h('div', { class: 'tvclues' }, (s.order || []).map((id) => h('div', { class: `tvclue${id === vez && s.phase === 'clues' ? ' turn' : ''}${(s.voted || []).includes(id) ? ' votou' : ''}`, 'data-key': 'c' + id },
      av(P(id).avatar, 64), h('b', {}, nome(id)),
      h('div', { class: 'ds' }, (s.clues || []).filter((c) => c.pid === id).map((c, i) => (c.draw ? h('span', { class: 'dica d', 'data-key': 'd' + i }, rabisco(c.draw)) : h('span', { class: 'dica', 'data-key': 'd' + i }, c.text)))),
      s.phase === 'vote' && (s.voted || []).includes(id) ? h('small', {}, '✓ votou') : null))));
}

// ---------- saguão e conexão ----------
function saguao() {
  const lista = st.players.map((p) => ({ ...p }));
  return h('div', { class: 'tvscreen', 'data-screen': 'lobby' },
    h('h1', { class: 'tvtitle' }, `${EMOJI[slug]} ${NOMES[slug]}`),
    h('p', { class: 'tvbig' }, `Entre pelo celular com o código ${code}`),
    jogadores(lista),
    slug !== 'intruso' ? chatTv(4) : null);
}

function telaCodigo() {
  const inp = h('input', { id: 'tvcode', class: 'code-in tvin', maxlength: 4, autocomplete: 'off', placeholder: 'ABCD', 'aria-label': 'Código da sala' });
  return h('div', { class: 'tvscreen inicio', 'data-screen': 'codigo' },
    h('div', { class: 'houses' }, '🏠🏡⛪🏪🏠'),
    h('h1', { class: 'tvtitle' }, '📺 Telão da Vila Sossego'),
    h('p', { class: 'tvbig' }, 'Digite o código da sala que aparece no celular de quem criou'),
    h('form', { class: 'form-row tvform', 'data-form': 'tv' }, inp, h('button', { class: 'btn primary', type: 'submit' }, 'Conectar')),
    erro ? h('p', { class: 'tverro' }, erro) : null,
    h('p', { class: 'tvsub' }, 'Cara de Pau, Ninguém Dorme e Intruso. Os segredos continuam só no celular de cada um.'));
}

function render() {
  let next;
  if (!st || !slug) next = telaCodigo();
  else {
    const corpo = slug === 'cara-de-pau' ? tvCdp() : slug === 'ninguem-dorme' ? tvNd() : tvInt();
    next = h('div', { class: 'tvlayout', 'data-screen': 'tv-' + slug },
      h('div', { class: 'tvmain' }, corpo),
      h('div', { class: 'tvside' }, convite(), festaLado(), st.prenda ? h('section', { class: 'tvpanel prenda', 'data-key': 'tvprenda' }, h('small', {}, '🎲 Prenda'), h('b', {}, st.prenda.para), h('p', {}, st.prenda.texto)) : null));
  }
  const cur = $tv.firstElementChild;
  if (!cur || cur.getAttribute('data-screen') !== next.getAttribute('data-screen')) $tv.replaceChildren(next);
  else { syncAttrs(cur, next); morph(cur, next); }
  const i = document.getElementById('tvcode');
  if (i && document.activeElement !== i) i.focus();
}

document.addEventListener('submit', (e) => {
  const f = e.target.closest('form[data-form="tv"]');
  if (!f) return;
  e.preventDefault();
  Snd.unlock();
  conectar(f.elements.tvcode ? f.elements.tvcode.value : document.getElementById('tvcode').value);
});
// a TV precisa de um toque/tecla para liberar som e voz
document.addEventListener('keydown', () => Snd.unlock(), { once: true });

const inicial = new URLSearchParams(location.search).get('sala');
render();
if (inicial) conectar(inicial);
