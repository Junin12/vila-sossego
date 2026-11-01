'use strict';
// Tela do Cara de Pau. A base (início, saguão, passaporte, chat, reações) vem de ../comum/vila.js.

const { MORADORES: M, ACOES: A, EVENTOS: E } = window.VILA;
const cardName = (c) => `${M[c].emoji} ${M[c].curto}`;
const GENERIC_EMOJI = { bico: '🔨', mudanca: '📦', escandalo: '📣', labia: '🤥' };
let picking = null;      // ação escolhida esperando alvo ou carta
let seenLog = 0;         // último lance já mostrado (sons e revelações)

function cardEl(c, o = {}) {
  const cls = `card${o.small ? ' small' : ''}${o.lost ? ' lost' : ''}${o.pick ? ' pick' : ''}`;
  if (!c) return h('div', { class: cls + ' back', 'aria-label': 'segredo escondido' }, h('span', { class: 'q' }, '?'));
  const m = M[c];
  return h(o.act ? 'button' : 'div', { class: cls, style: `--c:${m.cor}`, type: o.act ? 'button' : null, 'data-act': o.act || null,
    'data-i': o.i != null ? o.i : null, 'aria-label': `${m.curto}${o.lost ? ' (perdido)' : ''}` },
  h('span', { class: 'emo', 'aria-hidden': 'true' }, m.emoji),
  h('b', {}, m.curto),
  !o.small ? h('small', {}, A[m.acao].nome) : null,
  !o.small && m.bloqueia.length ? h('small', { class: 'blk' }, `bloqueia ${A[m.bloqueia[0]].nome}`) : null);
}

function seat(p, g) {
  const s = Vila.state;
  const pp = Vila.P(p.id);
  const cls = ['seat', g.turn === p.id && g.phase !== 'end' ? 'turn' : '', p.out ? 'out' : '', g.winner === p.id ? 'win' : ''].join(' ');
  const thinking = g.waiting.includes(p.id) && g.phase !== 'end';
  return h('div', { class: cls, 'data-key': 's' + p.id },
    h('div', { class: 'who' }, av(pp.avatar, 34), h('b', {}, pp.name), pp.bot ? h('span', { class: 'bot' }, 'bot') : null),
    h('div', { class: 'mini' }, p.cards.map((c, i) => h('span', { 'data-key': 'c' + i }, cardEl(c.c, { small: true, lost: c.lost })))),
    h('div', { class: 'seat-foot' },
      h('span', { class: 'coins' }, `🪙 ${p.coins}`),
      p.preso ? h('span', { class: 'badge' }, '🔒 preso') : null,
      p.out ? h('span', { class: 'badge' }, 'fora') : null,
      g.phase === 'end' && p.labia ? h('span', { class: 'badge' }, `🤥 ${p.labia}`) : null,
      thinking ? h('span', { class: 'badge dots' }, g.phase === 'turn' ? 'na vez' : 'pensando') : null,
      s.players.find((x) => x.id === p.id && !x.online) ? h('span', { class: 'badge' }, 'offline') : null));
}

function claimLine(g) {
  const c = g.claim;
  const who = Vila.P(c.by);
  if (c.kind === 'acao') {
    const a = A[g.pend.a];
    return h('div', { class: 'claim' }, av(who.avatar, 56),
      h('p', {}, h('b', {}, Vila.nameOf(c.by)), ' diz que é ', h('span', { class: 'hl', style: `--c:${M[c.card].cor}` }, cardName(c.card)),
        ' e faz ', h('b', {}, a.nome), g.pend.target ? [' em ', h('b', {}, g.pend.target === Vila.state.you ? 'você' : Vila.nameOf(g.pend.target))] : '', '!'));
  }
  return h('div', { class: 'claim' }, av(who.avatar, 56),
    h('p', {}, h('b', {}, Vila.nameOf(c.by)), ' bloqueia com ', h('span', { class: 'hl', style: `--c:${M[c.card].cor}` }, cardName(c.card)), '!'));
}

function actionMenu(g, me) {
  const others = g.players.filter((p) => !p.out && p.id !== me.id);
  if (picking) {
    const a = A[picking];
    if (picking === 'mudanca') {
      return h('div', { class: 'pickbox', 'data-key': 'pick' }, h('h3', {}, 'Qual segredo vai trocar?'),
        h('div', { class: 'hand' }, me.cards.map((c, i) => (c.lost ? null : cardEl(c.c, { act: 'doMudanca', i })))),
        h('button', { class: 'btn', type: 'button', 'data-act': 'cancelPick' }, 'Cancelar'));
    }
    return h('div', { class: 'pickbox', 'data-key': 'pick' }, h('h3', {}, `${a.nome}: em quem?`),
      h('div', { class: 'targets' }, others.map((p) => h('button', { class: 'target', type: 'button', 'data-act': 'doTarget', 'data-id': p.id },
        av(Vila.P(p.id).avatar, 48), h('b', {}, Vila.P(p.id).name), h('small', {}, `🪙 ${p.coins} · ${p.cards.filter((c) => !c.lost).length} segredo(s)`)))),
      h('button', { class: 'btn', type: 'button', 'data-act': 'cancelPick' }, 'Cancelar'));
  }
  const forced = me.coins >= 10;
  const mine = new Set(me.cards.filter((c) => !c.lost).map((c) => c.c));
  const item = (key) => {
    const a = A[key];
    const cost = g.custos[key];
    let why = '';
    if (forced && key !== 'escandalo') why = 'Com 10 moedas, Escândalo é obrigatório';
    else if (me.preso && !forced && key !== 'bico') why = 'Você está preso';
    else if (me.coins < cost) why = `Precisa de ${cost} moedas`;
    else if (key === 'reza' && !me.cards.some((c) => c.lost)) why = 'Nada para recuperar';
    const desc = key === 'bico' && g.bico > 1 ? `Ganha ${g.bico} moedas (evento!). Ninguém impede.` : a.desc;
    return h('button', { type: 'button', class: `act${a.carta ? ' char' : ''}`, style: a.carta ? `--c:${M[a.carta].cor}` : null,
      disabled: !!why, 'data-act': 'choose', 'data-a': key, 'data-key': 'a' + key },
    h('span', { class: 'emo', 'aria-hidden': 'true' }, a.carta ? M[a.carta].emoji : GENERIC_EMOJI[key]),
    h('span', { class: 'grow' }, h('b', {}, a.nome, cost ? h('span', { class: `cost${cost !== a.custo ? ' changed' : ''}` }, `🪙${cost}`) : null), h('small', {}, why || desc)),
    a.carta ? h('span', { class: mine.has(a.carta) ? 'flag ok' : 'flag lie' }, mine.has(a.carta) ? 'tenho' : 'blefe') : null);
  };
  const canLabia = g.labiaWin && me.labia >= g.labiaWin;
  return h('div', { class: 'menu', 'data-key': 'menu' },
    canLabia ? h('button', { type: 'button', class: 'act labia', 'data-act': 'choose', 'data-a': 'labia' },
      h('span', { class: 'emo' }, '🤥'), h('span', { class: 'grow' }, h('b', {}, 'Vitória na lábia!'), h('small', {}, 'Você enganou a vila. Ganhe agora!'))) : null,
    h('p', { class: 'mh' }, 'Qualquer um faz'),
    ['bico', 'mudanca', 'escandalo'].map(item),
    h('p', { class: 'mh' }, 'Diga que você é… (pode ser blefe)'),
    ['verba', 'cobranca', 'prisao', 'reza', 'fofoca'].map(item));
}

function statusPanel(g, me) {
  const s = Vila.state;
  const mine = g.waiting.includes(s.you);
  const box = h('section', { class: `panel status${mine ? ' mine' : ''}`, 'data-key': 'status-' + g.phase });
  box.append(Vila.tmr());
  if (g.phase === 'turn') {
    if (g.turn === s.you) box.append(h('p', { class: 'big-msg' }, 'Sua vez! O que você vai fazer?'), actionMenu(g, me));
    else box.append(h('div', { class: 'claim' }, av(Vila.P(g.turn).avatar, 56), h('p', {}, 'Vez de ', h('b', {}, Vila.nameOf(g.turn)), '… o que será que vem aí?')));
    return box;
  }
  if (g.phase === 'react') {
    box.append(claimLine(g));
    if (mine) {
      const blockCard = g.canBlock && Object.keys(M).find((k) => M[k].bloqueia.includes(g.pend.a));
      box.append(h('div', { class: 'reactbtns' },
        g.canDoubt ? h('button', { class: 'btn danger big', type: 'button', 'data-act': 'mv', 'data-t': 'duvidar' }, '🤨 Duvido!') : null,
        blockCard ? h('button', { class: 'btn dark', type: 'button', 'data-act': 'mv', 'data-t': 'bloquear' }, `Bloquear com ${cardName(blockCard)}`) : null,
        h('button', { class: 'btn', type: 'button', 'data-act': 'mv', 'data-t': 'passar' }, 'Deixa passar')),
      g.claim.noDoubt ? h('p', { class: 'hint' }, '🕯️ Apagão: ninguém pode duvidar nesta volta.') : null);
    } else {
      box.append(h('p', { class: 'hint' }, 'Esperando: ', g.waiting.map((id) => Vila.P(id).name).join(', ')));
    }
    return box;
  }
  if (g.phase === 'lose') {
    box.append(g.loser === s.you ? h('p', { class: 'big-msg' }, '😬 Escolha qual segredo vai perder 👇')
      : h('div', { class: 'claim' }, av(Vila.P(g.loser).avatar, 56), h('p', {}, h('b', {}, Vila.nameOf(g.loser)), ' está escolhendo qual segredo perder…')));
  }
  return box;
}

function myArea(g, me) {
  const losing = g.phase === 'lose' && g.loser === Vila.state.you;
  return h('section', { class: `myarea${me.out ? ' out' : ''}`, 'data-key': 'me' },
    h('div', { class: 'who' }, h('b', {}, 'Seus segredos'), h('span', { class: 'coins big' }, `🪙 ${me.coins}`),
      me.preso ? h('span', { class: 'badge' }, '🔒 preso') : null),
    h('div', { class: 'hand' }, me.cards.map((c, i) => h('span', { 'data-key': 'h' + i },
      cardEl(c.c, { lost: c.lost, pick: losing && !c.lost, act: losing && !c.lost ? 'lose' : null, i })))),
    g.labiaWin ? h('div', { class: 'labia', title: 'Só você vê' },
      h('span', {}, '🤥 Lábia secreta'),
      h('span', { class: 'dots-l' }, Array.from({ length: g.labiaWin }, (_, i) => h('i', { class: i < me.labia ? 'on' : '' }))),
      h('small', {}, `${Math.min(me.labia, g.labiaWin)}/${g.labiaWin}`)) : null,
    me.out ? h('p', { class: 'hint light center' }, 'Você saiu da vila. Assista e reaja! 👀') : null);
}

function logLine(e) {
  const n = Vila.nameOf;
  switch (e.t) {
    case 'inicio': return `🎬 ${n(e.by)} começa.`;
    case 'evento': return `${E[e.e].emoji} Volta ${e.volta}: ${E[e.e].nome}. ${E[e.e].desc}`;
    case 'acao': {
      const a = A[e.a];
      return `${n(e.by)}: ${a.nome}${e.target ? ' em ' + n(e.target) : ''}${a.carta ? ` (diz ser ${cardName(a.carta)})` : ''}`;
    }
    case 'duvida': return `🤨 ${n(e.by)} duvidou de ${n(e.of)}… ${e.had ? `tinha ${cardName(e.card)} mesmo!` : 'ERA BLEFE! 🤥'}`;
    case 'bloqueio': return `🛡️ ${n(e.by)} bloqueia com ${cardName(e.card)}`;
    case 'bloqueado': return `${A[e.a].nome} de ${n(e.by)} foi bloqueada.`;
    case 'perdeu': return `💔 ${n(e.by)} perdeu ${cardName(e.card)}`;
    case 'fora': return `🏚️ ${n(e.by)} saiu da vila!`;
    case 'fim': return `🏆 ${n(e.by)} venceu${e.how === 'labia' ? ' na lábia' : ''}!`;
    default: return null;
  }
}

function awards(g) {
  const best = (f) => g.players.slice().sort((a, b) => f(b) - f(a))[0];
  const out = [];
  const b = best((p) => p.stats.blefes);
  if (b && b.stats.blefes) out.push(['🤥', 'Mais cara de pau', b.id, `${b.stats.blefes} blefes colaram`]);
  const d = best((p) => p.stats.acertos);
  if (d && d.stats.acertos) out.push(['🔎', 'Detetive', d.id, `pegou ${d.stats.acertos} blefe(s)`]);
  const c = best((p) => p.stats.pego);
  if (c && c.stats.pego) out.push(['🚨', 'Pego no flagra', c.id, `${c.stats.pego} vez(es)`]);
  const w = best((p) => p.stats.erros);
  if (w && w.stats.erros) out.push(['🙈', 'Desconfiado demais', w.id, `errou ${w.stats.erros} dúvida(s)`]);
  return out;
}

function endScreen(g) {
  const s = Vila.state;
  const won = g.winner === s.you;
  const wp = Vila.P(g.winner);
  return h('div', { class: 'screen', 'data-screen': 'cdp-end' },
    h('div', { class: `banner ${won ? 'win' : 'lose'}` }, won ? '🏆 Você venceu!' : `${wp.name} venceu!`,
      h('small', {}, g.how === 'labia' ? 'Na lábia: enganou a vila vezes suficientes 🤥' : 'Último morador que sobrou na vila')),
    h('div', { class: 'winner' }, av(wp.avatar, 120)),
    h('section', { class: 'panel' }, h('h2', {}, 'Todos os segredos'),
      g.players.map((p) => h('div', { class: 'reveal-row', 'data-key': 'r' + p.id }, av(Vila.P(p.id).avatar, 40),
        h('div', { class: 'grow' }, h('b', {}, Vila.P(p.id).name), h('small', {}, `🤥 ${p.stats.blefes} blefes · 🔎 ${p.stats.acertos} dúvidas certas`)),
        h('div', { class: 'mini' }, p.cards.map((c) => cardEl(c.c, { small: true, lost: c.lost })))))),
    awards(g).length ? h('div', { class: 'awards' }, awards(g).map(([e, t, id, sub]) => h('div', { class: 'award' },
      h('span', { class: 'aemoji' }, e), h('small', {}, t), av(Vila.P(id).avatar, 44), h('b', {}, Vila.P(id).name), h('small', {}, sub)))) : null,
    Vila.resultPanel(),
    Vila.endButtons(),
    Vila.reactBar(),
    Vila.chatPanel({ title: 'Resenha', cls: 'flat' }));
}

const Jogo = {
  id: 'cdp', slug: 'cara-de-pau', nome: 'Cara de Pau', emoji: '🤥',
  sub: 'Todo mundo na vila esconde dois segredos. Minta com cara de pau, ou grite "Duvido!" e desmascare os outros.',
  jogadores: 'De 2 a 6 jogadores, cada um no seu celular. Sem turma? Jogue contra bots.',
  outro: { href: '../ninguem-dorme/', nome: 'Ninguém Dorme', emoji: '🌙' },
  settings: [
    { key: 'labia', label: 'Vitória na lábia', fmt: (v) => (v ? `${v} blefes` : 'Desligada'),
      hint: (v) => (v ? `Quem passar ${v} blefes sem ser pego pode declarar vitória.` : 'Só vence o último que sobrar.') },
    { key: 'eventos', label: 'Eventos da Vila', fmt: (v) => (v ? 'Ligados' : 'Desligados'),
      hint: (v) => (v ? 'A cada volta, um evento muda as regras (feira, apagão, blitz…).' : 'Regras fixas a partida toda.') },
    { key: 'reactSecs', label: 'Tempo para duvidar', fmt: (v) => `${v}s` },
  ],
  over: (s) => !!(s.game && s.game.phase === 'end'),
  rules() {
    return h('div', { class: 'rules' },
      h('p', {}, 'Cada um começa com 2 segredos (moradores escondidos) e 2 moedas. Perdeu os dois segredos, saiu da vila. O último que sobrar vence.'),
      h('h3', {}, 'Na sua vez, faça uma ação'),
      h('ul', {}, Object.keys(A).filter((k) => k !== 'labia').map((k) => h('li', {}, h('b', {}, A[k].nome), A[k].carta ? ` (${cardName(A[k].carta)})` : '', `: ${A[k].desc}`))),
      h('p', {}, 'As ações de morador podem ser feitas mesmo sem ter a carta. Isso é blefe, a famosa cara de pau.'),
      h('h3', {}, '🤨 Duvido!'),
      h('p', {}, 'Qualquer um pode duvidar. Se era blefe, quem mentiu perde um segredo e a ação não vale. Se era verdade, quem duvidou perde um segredo, e a carta mostrada volta para o baralho em troca de outra.'),
      h('h3', {}, '🛡️ Bloquear'),
      h('p', {}, 'A Delegada bloqueia a Cobrança e a Vó Zefa bloqueia a Fofoca. Bloqueio também pode ser blefe e também leva "Duvido!".'),
      h('h3', {}, '🤥 Lábia secreta'),
      h('p', {}, 'Cada blefe que passa sem ninguém duvidar enche sua lábia (só você vê). Encheu, você pode declarar vitória na sua vez. Se te pegarem mentindo, zera. Então duvide de vez em quando!'),
      h('h3', {}, '🎪 Eventos da Vila'),
      h('p', {}, 'Com os eventos ligados, a cada volta da mesa acontece algo na vila que muda as regras daquela volta.'),
      h('ul', {}, Object.values(E).map((e) => h('li', {}, `${e.emoji} `, h('b', {}, e.nome), `: ${e.desc}`))),
      h('p', {}, 'Com 10 moedas ou mais, o Escândalo é obrigatório.'),
      h('h3', {}, 'Os moradores'),
      h('div', { class: 'hand wrap' }, Object.keys(M).map((k) => cardEl(k))));
  },
  game(s) {
    const g = s.game;
    if (g.phase === 'end') return endScreen(g);
    const me = g.players.find((p) => p.id === s.you);
    const lines = g.log.slice().reverse().map((e) => [e.n, logLine(e)]).filter((x) => x[1]).slice(0, 7);
    const ev = g.evento ? E[g.evento] : null;
    return h('div', { class: 'screen', 'data-screen': 'cdp-game' },
      ev ? h('div', { class: 'event', 'data-key': 'ev' + g.volta }, h('span', { class: 'ee' }, ev.emoji),
        h('div', {}, h('small', {}, `Volta ${g.volta}`), h('b', {}, ev.nome), h('span', {}, ev.desc))) : null,
      h('div', { class: 'table' }, g.players.filter((p) => p.id !== s.you).map((p) => seat(p, g))),
      statusPanel(g, me),
      me ? myArea(g, me) : h('p', { class: 'lead center' }, 'Você está assistindo. Entra na próxima partida! 🍿'),
      Vila.reactBar(),
      h('section', { class: 'panel flat log' }, h('h2', {}, 'O que rolou'), h('ol', {}, lines.map(([n, t]) => h('li', { 'data-key': 'l' + n }, t)))),
      Vila.chatPanel({ title: 'Papo', cls: 'flat' }));
  },
  onState(prev, s) {
    const g = s.game;
    if (!g) { seenLog = 0; picking = null; return; }
    if (g.phase !== 'turn' || g.turn !== s.you) picking = null;
    const fresh = !prev || !prev.game || prev.round !== s.round;
    if (fresh && prev && prev.game) seenLog = 0;
    const news = g.log.filter((e) => e.n > seenLog);
    seenLog = g.log.length ? g.log[g.log.length - 1].n : seenLog;
    if (!prev) return;   // abriu agora: não repete efeitos antigos
    const n = Vila.nameOf;
    for (const e of news) {
      if (e.t === 'duvida') {
        Snd.drum();
        if (e.had) Vila.flash({ emoji: '😳', title: 'Tinha mesmo!', text: `${n(e.of)} era ${cardName(e.card)} de verdade. ${n(e.by)} se deu mal!`, cls: 'good' });
        else Vila.flash({ emoji: '🤥', title: 'ERA BLEFE!', text: `${n(e.by)} pegou ${n(e.of)} na mentira!`, cls: 'bad' });
      } else if (e.t === 'evento' && e.volta > 1) {
        Snd.fanfare();
        Vila.flash({ emoji: E[e.e].emoji, title: E[e.e].nome, text: E[e.e].desc, cls: 'sun', ms: 2800 });
      } else if (e.t === 'fora') {
        Snd.lose();
      } else if (e.t === 'fim') {
        if (e.by === s.you) { Snd.fanfare(); Vila.confetti(); } else Snd.lose();
        Vila.flash({ emoji: e.how === 'labia' ? '🤥' : '🏆', title: e.by === s.you ? 'Você venceu!' : `${n(e.by)} venceu!`,
          text: e.how === 'labia' ? 'Ganhou na lábia, com a maior cara de pau!' : 'Último morador de pé.', cls: e.by === s.you ? 'good' : 'sun', ms: 3000 });
      }
    }
    const pg = prev.game;
    const myTurnNow = g.phase === 'turn' && g.turn === s.you;
    if (myTurnNow && !(pg && pg.phase === 'turn' && pg.turn === s.you)) Snd.turn();
    if (g.phase === 'react' && g.pend && g.pend.target === s.you && !(pg && pg.phase === 'react')) Snd.alarm();
    if (g.phase === 'lose' && g.loser === s.you && !(pg && pg.phase === 'lose' && pg.loser === s.you)) Snd.low();
  },
  result(s) {
    const g = s.game;
    if (!g || g.phase !== 'end') return null;
    const me = g.players.find((p) => p.id === s.you);
    if (!me) return null;
    const won = g.winner === s.you;
    return { jogo: 'cdp', won, blefes: me.stats.blefes, duvidasCertas: me.stats.acertos, labiaWin: won && g.how === 'labia' };
  },
};

Object.assign(Vila.ACT, {
  choose: (el) => {
    const a = el.dataset.a;
    if (A[a].alvo || a === 'mudanca') { picking = a; Vila.render(); }
    else Vila.move({ t: 'acao', a });
  },
  doTarget: (el) => { const a = picking; picking = null; Vila.move({ t: 'acao', a, target: el.dataset.id }); },
  doMudanca: (el) => { picking = null; Vila.move({ t: 'acao', a: 'mudanca', idx: Number(el.dataset.i) }); },
  cancelPick: () => { picking = null; Vila.render(); },
  mv: (el) => Vila.move({ t: el.dataset.t }),
  lose: (el) => Vila.move({ t: 'perder', idx: Number(el.dataset.i) }),
});

Vila.start(Jogo);
