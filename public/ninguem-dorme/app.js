'use strict';
// Tela do Ninguém Dorme. A base (início, saguão, passaporte, chat, reações, narrador) vem de ../comum/vila.js.

const { PAPEIS: R, distribuir, ESPECIAIS: ESP, CASAL, roteiro, sumiuTxt } = window.NOITE;
const fam = () => !!(Vila.state && Vila.state.settings.familia);   // Modo Família: textos leves
const narrando = (s) => !!(s && s.settings.narrador);               // narrador humano conduz (sem voz do celular)
const papelName = (r) => `${R[r].emoji} ${R[r].nome}`;
let roleShown = false;     // o papel fica escondido até tocar (proteção contra olhadas)
let sheep = 0;             // carneirinhos contados de noite
let seenLog = 0;

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

function roleCard(me) {
  const r = R[me.papel];
  if (!roleShown) {
    return h('button', { class: 'role hid', type: 'button', 'data-act': 'toggleRole', 'data-key': 'role' },
      h('span', { class: 'big' }, '🤫'), h('b', {}, 'Toque para ver seu papel'), h('small', {}, 'Esconda a tela dos curiosos!'));
  }
  return h('button', { class: `role show ${r.time}`, type: 'button', 'data-act': 'toggleRole', 'data-key': 'role', style: `--c:${r.cor}` },
    h('span', { class: 'big' }, r.emoji),
    h('b', {}, r.nome),
    h('small', { class: 'team' }, r.time === 'capangas' ? 'Time dos capangas 🦹' : 'Time da vila 🏘️'),
    h('small', {}, r.desc),
    h('small', { class: 'hint-hide' }, 'Toque para esconder'));
}
// botão "ouvir meu papel" (para quem não lê bem): fica fora do cartão
function ouvirPapel(me) {
  if (!roleShown || !Voz.ok) return null;
  return h('button', { class: 'btn ouvir', type: 'button', 'data-act': 'ouvirPapel', 'data-key': 'ouvir' }, '🔊 Ouvir meu papel (cubra o celular)');
}

function partners(s, g) {
  if (g.me.papel !== 'capanga') return null;
  const others = g.players.filter((p) => p.papel === 'capanga' && p.id !== s.you);
  if (!others.length) return h('p', { class: 'hint' }, 'Você é o único capanga. Boa sorte! 😈');
  return h('p', { class: 'partners' }, '🦹 Seus parceiros: ', others.map((p) => h('span', { class: 'pchip' }, av(Vila.P(p.id).avatar, 24), Vila.P(p.id).name, p.vivo ? '' : ' (sumiu)')));
}

function amor(g) {
  if (!g.me || !g.me.par) return null;
  const p = Vila.P(g.me.par);
  const vivo = (g.players.find((x) => x.id === g.me.par) || {}).vivo;
  return h('p', { class: 'partners love' }, '💘 Seu amor: ', h('span', { class: 'pchip' }, av(p.avatar, 24), p.name, vivo ? '' : ' (saiu)'),
    h('small', {}, ' Se um sai, o outro sai junto.'));
}

// Caderninho: resultados secretos da noite (Delegada/Zé Pinguço e Vigia).
function delegadaNotes(g) {
  const priv = g.me.priv || [];
  if (!priv.length) return null;
  const vigia = g.me.papel === 'vigia';
  return h('section', { class: 'panel notes', 'data-key': 'notes' }, h('h3', {}, vigia ? '🔦 Caderninho do Vigia' : '🚓 Caderninho da Delegada'),
    priv.map((r) => h('div', { class: 'note-row' }, av(Vila.P(r.alvo).avatar, 30), h('b', {}, Vila.P(r.alvo).name),
      'capanga' in r ? h('span', { class: `fact ${r.capanga ? 'no' : 'ok'}` }, r.capanga ? '🦹 É CAPANGA!' : '✅ Inocente')
        : h('span', { class: 'fact' }, r.visitas.length ? `🚪 ${r.visitas.map((id) => Vila.P(id).name).join(', ')}` : '🚪 Ninguém bateu'),
      h('small', {}, `noite ${r.noite}`))));
}

function especialBanner(key) {
  const e = key && ESP[key];
  if (!e) return null;
  return h('div', { class: 'event night-ev', 'data-key': 'esp-' + key }, h('span', { class: 'ee' }, e.emoji),
    h('div', {}, h('small', {}, 'Noite especial'), h('b', {}, e.nome), h('span', {}, e.desc)));
}

function pcard(id, opts = {}) {
  const p = Vila.P(id);
  return h('button', { class: `vcard${opts.dead ? ' dead' : ''}`, type: 'button', 'data-act': opts.act || null, 'data-id': id,
    'aria-pressed': String(!!opts.on), disabled: opts.disabled || null, 'data-key': 'v' + id },
  av(p.avatar, 60), h('span', { class: 'nm' }, p.name), opts.sub ? h('small', {}, opts.sub) : h('small', {}, ''),
  opts.extra || null,
  h('span', { class: 'tick' }, icon('check')));
}

function nightScreen(s, g) {
  const me = g.me;
  const papel = R[me ? me.papel : 'morador'];
  const box = h('section', { class: 'panel nightbox', 'data-key': 'night' + g.noite });
  if (!me) put(box, h('p', {}, 'Você está assistindo esta partida. 🍿'));
  else if (!me.vivo) put(box, h('p', { class: 'big-msg' }, '👻 Você é um fantasma.'), h('p', { class: 'hint' }, 'Assista a noite e fofoque com os outros fantasmas.'));
  else if (g.especial === 'festa') {
    put(box, h('p', { class: 'big-msg center' }, '🎉 Arraiá na vila!'), h('p', { class: 'hint center' }, 'Ninguém sai de casa esta noite. Aproveite o quentão e fique de olho em quem dança demais. 🌽'),
      h('button', { class: 'sheep', type: 'button', 'data-act': 'sheep' }, h('span', { class: 'sh' }, '🎆'), h('b', {}, sheep ? `${sheep} fogos` : 'Soltar fogos')));
  } else if (papel.noite) {
    const capPicks = me.capangas || {};
    const sel = [me.acao, me.acao2].filter(Boolean);
    put(box, h('h3', {}, me.max === 2 ? '🌕 Lua cheia: escolha até DUAS pessoas' : papel.pede),
      me.papel === 'benzedeira' && me.benzidoAntes ? h('p', { class: 'hint' }, `Ontem você cuidou de ${Vila.P(me.benzidoAntes).name}: hoje não pode repetir.`) : null,
      h('div', { class: 'vgrid' }, me.alvos.map((id) => {
        const who = Object.entries(capPicks).filter(([cid, t]) => t.includes(id) && cid !== s.you).map(([cid]) => Vila.P(cid).name);
        return pcard(id, { act: 'night', on: sel.includes(id), sub: id === s.you ? 'você' : '', extra: who.length ? h('span', { class: 'cappick' }, `🦹 ${who.join(', ')}`) : null });
      })),
      h('button', { class: 'btn', type: 'button', 'data-act': 'stayHome', 'aria-pressed': String(me.acao === null) }, me.acao === null ? '🏠 Você ficou em casa' : '🏠 Ficar em casa esta noite'),
      me.acao !== undefined ? h('p', { class: 'hint center' }, me.papel === 'capanga' ? 'Pode trocar até a noite acabar.' : 'Feito! Pode trocar até a noite acabar.') : null);
  } else {
    put(box, h('p', { class: 'big-msg center' }, me.acao === undefined ? '😴 Você está dormindo…' : '💤 Zzz…'),
      h('p', { class: 'hint center' }, 'Toque nos carneirinhos para todo mundo mexer no celular igual e ninguém se entregar.'),
      h('button', { class: 'sheep', type: 'button', 'data-act': 'sheep' }, h('span', { class: 'sh' }, '🐑'), h('b', {}, sheep ? `${sheep} carneirinho${sheep > 1 ? 's' : ''}` : 'Contar carneirinhos')));
  }
  const left = g.waiting.length;
  return h('div', { class: 'screen', 'data-screen': 'nd-noite' },
    h('div', { class: 'phase-head' }, h('span', { class: 'moon' }, g.especial ? ESP[g.especial].emoji : '🌙'),
      h('div', {}, h('small', {}, `Noite ${g.noite}`), h('h2', {}, g.especial === 'festa' ? 'Festa no arraial!' : 'A Vila Sossego dorme…')),
      Vila.tmr()),
    especialBanner(g.especial),
    me && me.vivo ? roleCard(me) : null,
    me && me.vivo ? ouvirPapel(me) : null,
    me ? partners(s, g) : null,
    amor(g),
    box,
    g.especial === 'festa' ? null : h('p', { class: 'hint light center' }, left ? `Ainda acordados: ${left}` : 'Amanhecendo…'),
    me ? delegadaNotes(g) : null,
    Vila.chatPanel({ title: me && me.papel === 'capanga' && me.vivo ? 'Cochicho dos capangas' : me && !me.vivo ? 'Papo dos fantasmas' : null,
      cls: 'flat', silent: 'Shhh… de noite ninguém fala. 🤫' }));
}

function newsBlock(g) {
  const a = g.anuncio;
  if (!a) return null;
  const items = [];
  const gone = (id, papel, key, txt) => h('div', { class: 'news big', 'data-key': key }, h('div', { class: 'ghost' }, av(Vila.P(id).avatar, 84)),
    h('div', {}, h('b', {}, `${Vila.P(id).name} ${txt}`), papel ? h('small', {}, `Era ${papelName(papel)}`) : h('small', {}, 'Ninguém sabe quem era…')));
  if (a.especial === 'festa') {
    items.push(h('div', { class: 'news', 'data-key': 'n-festa' }, h('span', { class: 'ne' }, '🎉'),
      h('div', {}, h('b', {}, 'Teve festa junina!'), h('small', {}, 'Ninguém saiu de casa… oficialmente.'))));
  }
  if (a.sumiu) {
    items.push(gone(a.sumiu, a.papel, 'n-sumiu', `${sumiuTxt(fam())}!`));
    if (a.sumiu2) items.push(gone(a.sumiu2, a.papel2, 'n-sumiu2', `também ${sumiuTxt(fam())}! 🌕`));
    if (a.salvo) {
      items.push(h('div', { class: 'news good', 'data-key': 'n-salvo2' }, h('span', { class: 'ne' }, '🌿'),
        h('div', {}, h('b', {}, 'A Vó Zefa salvou alguém!'), h('small', {}, 'Os capangas atacaram duas vezes, mas uma vítima escapou.'))));
    }
  } else if (a.salvo) {
    items.push(h('div', { class: 'news big good', 'data-key': 'n-salvo' }, h('span', { class: 'ne' }, '🌿'),
      h('div', {}, h('b', {}, 'Ninguém sumiu!'), h('small', {}, 'Os capangas atacaram, mas a Vó Zefa cuidou da vítima.'))));
  } else {
    items.push(h('div', { class: 'news big good', 'data-key': 'n-calma' }, h('span', { class: 'ne' }, '😌'),
      h('div', {}, h('b', {}, 'Noite tranquila'), h('small', {}, 'Ninguém sumiu desta vez.'))));
  }
  if (a.saudade) items.push(gone(a.saudade, a.papelSaudade, 'n-saudade', 'saiu de saudade! 💔'));
  if (a.fofoca) {
    items.push(h('div', { class: 'news', 'data-key': 'n-fofo' }, h('span', { class: 'ne' }, '👀'),
      h('div', {}, h('b', {}, 'A Cotinha espalhou:'), h('small', {}, `${Vila.P(a.fofoca.alvo).name} ${a.fofoca.saiu ? 'SAIU de casa ontem à noite!' : 'ficou em casa a noite toda.'}`))));
  }
  return h('div', { class: 'newslist' }, items);
}

function playersStrip(s, g, mode) {
  return h('div', { class: 'strip' }, g.players.map((p) => {
    const pp = Vila.P(p.id);
    return h('div', { class: `sp${p.vivo ? '' : ' dead'}${mode === 'dia' && p.pronto ? ' ready' : ''}`, 'data-key': 'sp' + p.id },
      av(pp.avatar, 44), h('small', {}, p.id === s.you ? 'você' : pp.name),
      p.papel && (!p.vivo || p.id !== s.you) ? h('span', { class: 'rb' }, R[p.papel].emoji) : null,
      mode === 'dia' && p.vivo && p.pronto ? h('span', { class: 'okb' }, icon('check')) : null);
  }));
}

function dawnScreen(s, g) {
  return h('div', { class: 'screen', 'data-screen': 'nd-amanhecer' },
    h('div', { class: 'phase-head sun' }, h('span', { class: 'moon' }, '☀️'), h('div', {}, h('small', {}, `Dia ${g.dia + 1}`), h('h2', {}, 'Amanheceu na vila!')), Vila.tmr()),
    newsBlock(g),
    g.me ? delegadaNotes(g) : null,
    playersStrip(s, g),
    Vila.reactBar());
}

function dayScreen(s, g) {
  const me = g.me;
  const ready = me && me.vivo && g.players.find((p) => p.id === s.you).pronto;
  return h('div', { class: 'screen', 'data-screen': 'nd-dia' },
    h('div', { class: 'phase-head sun' }, h('span', { class: 'moon' }, '🗣️'), h('div', {}, h('small', {}, `Dia ${g.dia}`), h('h2', {}, 'Quem são os capangas?')), Vila.tmr()),
    newsBlock(g),
    playersStrip(s, g, 'dia'),
    Vila.chatPanel({ title: 'Conversa da vila', cls: 'tall', frases: FRASES, alvos: g.players.filter((p) => p.vivo && p.id !== s.you).map((p) => p.id) }),
    me && me.vivo ? h('button', { class: `btn big ${ready ? 'good' : 'primary'}`, type: 'button', 'data-act': 'ready' },
      ready ? '✅ Pronto! (toque para desfazer)' : 'Já sei! Pronto para votar') : null,
    me && me.vivo ? roleCard(me) : null,
    me ? partners(s, g) : null,
    amor(g),
    me ? delegadaNotes(g) : null,
    Vila.reactBar());
}

function voteScreen(s, g) {
  const me = g.me;
  const votos = g.votos || {};
  const secreto = g.votoSecreto;
  const count = {};
  for (const t of Object.values(votos)) count[t] = (count[t] || 0) + 1;
  const myVote = votos[s.you];
  const canVote = me && me.vivo;
  const alive = g.players.filter((p) => p.vivo && p.id !== s.you);
  return h('div', { class: 'screen', 'data-screen': 'nd-votacao' },
    h('div', { class: 'phase-head vote' }, h('span', { class: 'moon' }, '🗳️'), h('div', {}, h('small', {}, `Dia ${g.dia}`), h('h2', {}, canVote ? 'Quem sai da vila?' : 'A vila está votando…')), Vila.tmr()),
    h('div', { class: 'vgrid' }, alive.map((p) => {
      const voters = Object.entries(votos).filter(([, t]) => t === p.id).map(([v]) => v);
      return pcard(p.id, { act: canVote ? 'vote' : null, on: myVote === p.id, disabled: !canVote,
        extra: secreto ? null : h('span', { class: `cnt${count[p.id] ? ' has' : ''}` }, count[p.id] || 0),
        sub: secreto ? (myVote === p.id ? 'seu voto' : '') : voters.length ? voters.map((v) => Vila.P(v).name).join(', ') : '' });
    })),
    canVote ? h('button', { class: 'btn', type: 'button', 'data-act': 'skip', 'aria-pressed': String(myVote === 'pular') },
      (myVote === 'pular' ? '🤷 Você pulou' : '🤷 Pular votação') + (secreto ? '' : ` (${count.pular || 0})`)) : null,
    h('p', { class: 'hint light center' }, secreto
      ? `🌫️ Neblina: voto secreto. Votaram ${g.players.filter((p) => p.votou).length} de ${g.players.filter((p) => p.vivo).length}.`
      : `Votaram ${Object.keys(votos).length} de ${g.players.filter((p) => p.vivo).length}. Dá para trocar o voto até o fim.`),
    Vila.chatPanel({ title: 'Últimas palavras', cls: 'flat', max: 12, frases: FRASES, alvos: alive.map((p) => p.id) }),
    Vila.reactBar());
}

// Últimas palavras: quem foi expulso tem uns segundos para um recado final (aparece grande para todos e no telão)
function ultimasBox(s, g) {
  const v = g.veredito;
  if (!v || !v.expulso) return null;
  if (g.ultimas) return h('div', { class: 'ultimas', 'data-key': 'ult' }, h('small', {}, `🗣️ Últimas palavras de ${Vila.P(g.ultimas.pid).name}`), h('p', {}, `“${g.ultimas.text}”`));
  if (v.expulso !== s.you) return h('p', { class: 'hint center', 'data-key': 'ult' }, `${Vila.P(v.expulso).name} pode deixar as últimas palavras…`);
  return h('form', { class: 'form-row ultimas-form', 'data-form': 'ultimas', 'data-key': 'ult' },
    h('input', { name: 'txt', maxlength: 90, autocomplete: 'off', placeholder: 'Suas últimas palavras…', 'aria-label': 'Últimas palavras' }),
    h('button', { class: 'btn primary', type: 'submit' }, 'Dizer'));
}

// Narrador humano: quem criou a sala conduz a mesa (lê o roteiro em voz alta) e vê tudo, mas não joga
function narradorScreen(s, g) {
  const n = (id) => Vila.P(id).name;
  const fase = { noite: `🌙 Noite ${g.noite}`, amanhecer: '☀️ Amanhecer', dia: `🗣️ Dia ${g.dia}`, votacao: '🗳️ Votação', veredito: '⚖️ Veredito', fim: '🏁 Fim' }[g.fase];
  const acoes = g.narr && g.narr.acoes ? Object.entries(g.narr.acoes) : [];
  return h('div', { class: 'screen', 'data-screen': 'nd-narrador' },
    h('div', { class: 'phase-head' }, h('span', { class: 'moon' }, '🎙️'), h('div', {}, h('small', {}, 'Você é o narrador'), h('h2', {}, fase)), Vila.tmr()),
    h('section', { class: 'panel roteiro', 'data-key': 'rot-' + g.fase + g.noite + g.dia }, h('small', {}, '📜 Leia em voz alta'),
      h('p', {}, roteiroFixo(g))),
    g.fase === 'noite' ? h('section', { class: 'panel flat', 'data-key': 'narr-noite' }, h('h3', {}, 'O que estão fazendo agora'),
      acoes.length ? acoes.map(([id, alvo]) => h('div', { class: 'vrow' }, h('b', {}, `${R[g.players.find((p) => p.id === id).papel].emoji} ${n(id)}`), '→',
        alvo ? h('span', {}, n(alvo)) : h('span', {}, 'ficou em casa'))) : h('p', { class: 'hint' }, 'Ninguém agiu ainda.'),
      h('p', { class: 'hint' }, `Ainda acordados: ${g.waiting.length}`)) : null,
    g.fase === 'veredito' ? ultimasBox(s, g) : null,
    h('section', { class: 'panel', 'data-key': 'narr-papeis' }, h('h3', {}, 'Quem é quem (só você vê)'),
      h('div', { class: 'whois' }, g.players.map((p) => h('div', { class: `wi ${R[p.papel].time}${p.vivo ? '' : ' dead'}` },
        av(Vila.P(p.id).avatar, 44), h('b', {}, n(p.id), g.casal && g.casal.includes(p.id) ? ' 💘' : ''), h('small', {}, papelName(p.papel)))))),
    g.fase === 'fim' ? Vila.endButtons() : null,
    Vila.chatPanel({ title: 'Conversa da vila', cls: 'flat' }));
}
// o roteiro sorteia variações; fixa uma por fase para não mudar a cada atualização da tela
let rotKey = '', rotTxt = '';
function roteiroFixo(g) {
  const k = `${g.fase}|${g.noite}|${g.dia}`;
  if (k !== rotKey) { rotKey = k; rotTxt = roteiro(g, (id) => Vila.P(id).name, fam()); }
  return rotTxt;
}

function verdictScreen(s, g) {
  const v = g.veredito;
  const ex = v && v.expulso ? Vila.P(v.expulso) : null;
  const tally = {};
  for (const [voter, t] of Object.entries(v ? v.votos : {})) (tally[t] = tally[t] || []).push(voter);
  return h('div', { class: 'screen', 'data-screen': 'nd-veredito' },
    h('div', { class: 'phase-head vote' }, h('span', { class: 'moon' }, '⚖️'), h('div', {}, h('small', {}, `Dia ${g.dia}`), h('h2', {}, 'O veredito')), Vila.tmr()),
    ex ? h('section', { class: 'panel verdict' }, av(ex.avatar, 120), h('b', { class: 'vt' }, `A vila expulsou ${ex.name}!`),
      v.papel ? h('span', { class: `fact ${v.papel === 'capanga' ? 'ok' : 'no'}` }, v.papel === 'capanga' ? `Era ${papelName(v.papel)}! 🎯` : `Era ${papelName(v.papel)}… ops! 😬`)
        : h('span', { class: 'fact' }, 'O papel fica em segredo… 🤐'),
      v.saudade ? h('span', { class: 'fact no' }, `💔 ${Vila.P(v.saudade).name} saiu junto, de saudade${v.papelSaudade ? ` (era ${papelName(v.papelSaudade)})` : ''}`) : null,
      ultimasBox(s, g))
      : h('section', { class: 'panel verdict' }, h('span', { class: 'big-emoji' }, v && v.empate ? '🤝' : '🤷'),
        h('b', { class: 'vt' }, v && v.empate ? 'Empate! Ninguém saiu.' : 'A vila não se decidiu. Ninguém saiu.')),
    h('section', { class: 'panel flat' }, h('h3', {}, 'Como cada um votou'),
      Object.entries(tally).map(([t, voters]) => h('div', { class: 'vrow' }, h('b', {}, t === 'pular' ? '🤷 Pular' : Vila.P(t).name), '←',
        voters.map((x) => av(Vila.P(x).avatar, 28)))),
      !Object.keys(tally).length ? h('p', { class: 'hint' }, 'Ninguém votou.') : null),
    Vila.reactBar());
}

function endScreen(s, g) {
  const me = g.players.find((p) => p.id === s.you);
  const myTeam = me && me.papel ? R[me.papel].time : null;
  const won = myTeam && myTeam === g.vencedor;
  const best = (f) => g.players.filter((p) => p.stats).sort((a, b) => f(b) - f(a))[0];
  const aw = [];
  const fa = best((p) => p.stats.votosCertos);
  if (fa && fa.stats.votosCertos) aw.push(['🔎', 'Faro fino', fa.id, `${fa.stats.votosCertos} voto(s) certo(s)`]);
  const sv = best((p) => p.stats.salvou);
  if (sv && sv.stats.salvou) aw.push(['🌿', 'Anjo da guarda', sv.id, `salvou ${sv.stats.salvou} vez(es)`]);
  const dl = best((p) => p.stats.investigouCapanga);
  if (dl && dl.stats.investigouCapanga) aw.push(['🚓', 'Investigação certeira', dl.id, `achou ${dl.stats.investigouCapanga} capanga(s)`]);
  const er = best((p) => p.stats.votosErrados);
  if (er && er.stats.votosErrados) aw.push(['🙈', 'Votou no inocente', er.id, `${er.stats.votosErrados} vez(es)`]);
  return h('div', { class: 'screen', 'data-screen': 'nd-fim' },
    h('div', { class: `banner ${won ? 'win' : myTeam ? 'lose' : ''}` }, g.vencedor === 'vila' ? '🏘️ A vila venceu!' : '🦹 Os capangas venceram!',
      h('small', {}, myTeam ? (won ? 'Você está no time vencedor!' : 'Não foi dessa vez…') : 'Fim de jogo')),
    h('section', { class: 'panel' }, h('h2', {}, 'Quem era quem'),
      h('div', { class: 'whois' }, g.players.map((p) => h('div', { class: `wi ${R[p.papel].time}${p.vivo ? '' : ' dead'}` },
        av(Vila.P(p.id).avatar, 52), h('b', {}, Vila.P(p.id).name, g.casal && g.casal.includes(p.id) ? ' 💘' : ''),
        h('small', {}, papelName(p.papel)), h('small', {}, p.vivo ? 'sobreviveu' : 'sumiu')))),
      g.casal ? h('p', { class: 'hint center' }, `💘 O casal apaixonado era ${g.casal.map((id) => Vila.P(id).name).join(' e ')}.`) : null),
    Vila.placar(),
    aw.length ? h('div', { class: 'awards' }, aw.map(([e, t, id, sub]) => h('div', { class: 'award' }, h('span', { class: 'aemoji' }, e),
      h('small', {}, t), av(Vila.P(id).avatar, 44), h('b', {}, Vila.P(id).name), h('small', {}, sub)))) : null,
    Vila.resultPanel(),
    Vila.shareButton(),
    Vila.endButtons(),
    Vila.reactBar(),
    Vila.chatPanel({ title: 'Resenha', cls: 'flat' }));
}

// ---------- narrador ----------
// Voz do celular de quem criou a sala; com telão, quem narra é o telão; com narrador humano, ninguém fala.
function narrate(s, g) {
  if (narrando(s)) return null;
  return Voz.say(roteiroFixo(g), Vila.isHost() && !s.tv);
}

const FRASES = ['Confia em mim 😇', 'Juro que tava dormindo 😴', 'Eu sou da vila! 🏘️', 'Prova! Cadê a prova? 🤨', 'Votem comigo! 🗳️', 'Tá quieto demais… 👀'];

const Jogo = {
  id: 'nd', slug: 'ninguem-dorme', nome: 'Ninguém Dorme', emoji: '🌙', voz: true, bots: 6,
  sub: 'Toda noite alguém some na Vila Sossego. De dia, a vila conversa e vota. Descubra os capangas antes que seja tarde!',
  jogadores: 'De 4 a 12 jogadores, cada um no seu celular. O celular de quem cria a sala vira o narrador. Faltou gente? Chame bots.',
  outros: [{ href: '../cara-de-pau/', nome: 'Cara de Pau', emoji: '🤥' }, { href: '../intruso/', nome: 'Intruso', emoji: '🕵️' }],
  settings: [
    { key: 'diaSecs', label: 'Tempo de conversa', fmt: (v) => `${v / 60} min` },
    { key: 'noiteSecs', label: 'Duração da noite', fmt: (v) => `${v}s` },
    { key: 'revelar', label: 'Quem sai revela o papel?', fmt: (v) => (v ? 'Revela' : 'Segredo'),
      hint: (v) => (v ? 'Mais fácil: todo mundo vê o papel de quem sai.' : 'Mais difícil: os papéis só aparecem no fim (e o Coveiro entra no jogo).') },
    { key: 'extras', label: 'Papéis novos', fmt: (v) => (v ? 'Ligados' : 'Clássico'),
      hint: (v) => (v ? 'Vigia, Zé Pinguço, Coveiro e o Casal apaixonado entram conforme o tamanho da vila.' : 'Só os papéis básicos.') },
    { key: 'narrador', label: '🎙️ Narrador', fmt: (v) => (v ? 'Uma pessoa' : 'Voz do celular'),
      hint: (v) => (v ? 'Quem criou a sala narra lendo o roteiro na tela e não joga (precisa de 5 pessoas).' : 'O celular de quem criou a sala (ou o telão) narra sozinho.') },
    { key: 'especiais', label: 'Noites especiais', fmt: (v) => (v ? 'Ligadas' : 'Desligadas'),
      hint: (v) => (v ? 'De vez em quando: lua cheia, festa junina ou neblina.' : 'Toda noite é igual.') },
  ],
  over: (s) => !!(s.game && s.game.fase === 'fim'),
  rules() {
    return h('div', { class: 'rules' },
      h('p', {}, 'Na Vila Sossego tem capangas escondidos entre os moradores. Cada um recebe um papel secreto no celular.'),
      h('h3', {}, '🌙 De noite'),
      h('p', {}, 'Os capangas escolhem quem vai sumir. A Delegada investiga, a Vó Zefa cuida de alguém (protege) e a Cotinha espia. Quem não tem poder conta carneirinhos, assim todo mundo mexe no celular e ninguém se entrega.'),
      h('h3', {}, '☀️ De dia'),
      h('p', {}, 'O narrador conta quem sumiu e o que a Cotinha espalhou. Todo mundo conversa e depois vota em quem sai da vila. Empate não tira ninguém.'),
      h('h3', {}, '🏆 Quem vence'),
      h('ul', {}, h('li', {}, h('b', {}, 'A vila'), ': quando não sobrar nenhum capanga.'), h('li', {}, h('b', {}, 'Os capangas'), ': quando forem tantos quanto o resto da vila.')),
      h('h3', {}, 'Os papéis'),
      h('ul', {}, Object.keys(R).map((k) => h('li', {}, `${R[k].emoji} `, h('b', {}, R[k].nome), R[k].extra ? ' (papel novo)' : '', `: ${R[k].desc}`))),
      h('h3', {}, 'Quantos de cada'),
      h('p', {}, [4, 6, 8, 10].map((n) => `${n} jogadores: ${distribuir(n).filter((x) => x === 'capanga').length} capanga(s)`).join(' · ')),
      h('p', {}, 'Quem sai vira fantasma: vê todos os papéis e conversa só com os outros fantasmas. 👻'),
      h('h3', {}, `${CASAL.emoji} ${CASAL.nome}`),
      h('p', {}, `${CASAL.desc} (com os papéis novos, a partir de 6 jogadores)`),
      h('h3', {}, '🌕 Noites especiais'),
      h('ul', {}, Object.values(ESP).map((e) => h('li', {}, `${e.emoji} `, h('b', {}, e.nome), `: ${e.desc}`))));
  },
  game(s) {
    const g = s.game;
    if (narrando(s) && s.hostId === s.you) return narradorScreen(s, g);
    if (g.fase === 'noite') return nightScreen(s, g);
    if (g.fase === 'amanhecer') return dawnScreen(s, g);
    if (g.fase === 'dia') return dayScreen(s, g);
    if (g.fase === 'votacao') return voteScreen(s, g);
    if (g.fase === 'veredito') return verdictScreen(s, g);
    return endScreen(s, g);
  },
  // Modo Família: papéis simples, sem noites especiais e com mais tempo para conversar
  onFamilia() { return [['extras', 0], ['especiais', 0], ['diaSecs', 180], ['noiteSecs', 60]]; },
  album(s) {
    const g = s.game;
    if (!g || g.fase !== 'fim') return null;
    const time = g.players.filter((p) => R[p.papel].time === g.vencedor);
    const linhas = [`${g.vencedor === 'vila' ? '🏘️' : '🦹'} Time vencedor: ${time.map((p) => Vila.P(p.id).name).join(', ')}`];
    const caps = g.players.filter((p) => p.papel === 'capanga').map((p) => Vila.P(p.id).name);
    linhas.push(`🦹 Capanga(s): ${caps.join(', ')}`);
    if (g.casal) linhas.push(`💘 Casal: ${g.casal.map((id) => Vila.P(id).name).join(' e ')}`);
    linhas.push(`🌙 ${g.noite} noite(s) na Vila Sossego`);
    return { titulo: '🌙 Ninguém Dorme', avatares: time.slice(0, 3).map((p) => Vila.P(p.id).avatar), cor1: '#4A57B8', cor2: '#121741',
      destaque: g.vencedor === 'vila' ? 'A vila venceu!' : 'Os capangas venceram!', linhas };
  },
  onState(prev, s) {
    const g = s.game;
    document.body.classList.toggle('escuro', !!(g && g.fase === 'noite'));   // a tela escurece de noite
    if (!g) { roleShown = false; sheep = 0; seenLog = 0; return; }
    const pg = prev && prev.game && prev.round === s.round ? prev.game : null;
    if (!pg) { roleShown = false; sheep = 0; }
    const changed = !pg || pg.fase !== g.fase || pg.noite !== g.noite;
    if (!changed || !prev) return;   // recarregou a página: não repete narração
    const clima = Vila.isHost() && !s.tv;   // o telão faz o clima quando está ligado
    if (g.fase === 'noite') {
      sheep = 0;
      Snd.low();
      if (clima) { setTimeout(() => Snd.grilos(), 600); setTimeout(() => Snd.coruja(), 3500); }
      if (g.especial) {
        const e = ESP[g.especial];
        Vila.flash({ emoji: e.emoji, title: e.nome, text: e.desc, cls: g.especial === 'festa' ? 'sun' : 'night', ms: 3400 });
      } else if (g.noite === 1 && g.me) {
        const r = R[g.me.papel];
        const txt = r.time === 'capangas' ? 'Time dos capangas. Não se entregue! 😈' : 'Time da vila. Descubra os capangas!';
        Vila.flash({ emoji: r.emoji, title: `Você é ${r.nome}!`, text: txt + (g.me.par ? ` E está apaixonado(a) por ${Vila.P(g.me.par).name}! 💘` : ''),
          cls: r.time === 'capangas' ? 'bad' : 'night', ms: 3600 });
        roleShown = true;
      }
    } else if (g.fase === 'amanhecer') {
      if (clima) Snd.galo(); else Snd.turn();
      const a = g.anuncio;
      if (a && a.sumiu === s.you) Vila.flash({ emoji: '👻', title: 'Você sumiu!', text: 'Agora você é um fantasma. Assista e fofoque com os outros fantasmas.', cls: 'night', ms: 3400 });
      else if (a && (a.sumiu2 === s.you || a.saudade === s.you)) {
        Vila.flash({ emoji: a.saudade === s.you ? '💔' : '👻', title: a.saudade === s.you ? 'Você saiu de saudade!' : 'Você sumiu!',
          text: a.saudade === s.you ? 'Seu amor sumiu e a vila perdeu a graça. Agora você é um fantasma.' : 'Lua cheia… os capangas atacaram duas vezes.', cls: 'night', ms: 3400 });
      } else if (a && a.sumiu && a.sumiu2) Vila.flash({ emoji: '🌕', title: 'Duas pessoas sumiram!', text: `${Vila.P(a.sumiu).name} e ${Vila.P(a.sumiu2).name}.`, cls: 'bad' });
      else if (a && a.sumiu) Vila.flash({ emoji: fam() ? '🏚️' : '😱', title: `${Vila.P(a.sumiu).name} ${sumiuTxt(fam())}!`, text: a.papel ? `Era ${papelName(a.papel)}.` : '', cls: 'bad' });
      else Vila.flash({ emoji: a && a.salvo ? '🌿' : '😌', title: 'Ninguém sumiu!', text: a && a.salvo ? 'A Vó Zefa salvou alguém!' : 'Noite tranquila.', cls: 'good' });
    } else if (g.fase === 'votacao') {
      Snd.alarm();
    } else if (g.fase === 'veredito') {
      Snd.drum();
      const v = g.veredito;
      if (v && v.expulso) Vila.flash({ emoji: v.papel === 'capanga' ? '🎯' : v.papel ? '😬' : '⚖️', title: `${Vila.P(v.expulso).name} saiu!`,
        text: v.papel ? `Era ${papelName(v.papel)}.` : 'O papel fica em segredo.', cls: v.papel === 'capanga' ? 'good' : 'bad' });
    } else if (g.fase === 'fim') {
      const me = g.players.find((p) => p.id === s.you);
      const won = me && me.papel && R[me.papel].time === g.vencedor;
      if (won) { Snd.fanfare(); Vila.confetti(); } else Snd.lose();
      Vila.flash({ emoji: g.vencedor === 'vila' ? '🏘️' : '🦹', title: g.vencedor === 'vila' ? 'A vila venceu!' : 'Os capangas venceram!', cls: won ? 'good' : 'bad', ms: 3200 });
    }
    narrate(s, g);
  },
  shareText(s) {
    const g = s.game;
    const me = g.players.find((p) => p.id === s.you);
    if (!me || !me.papel) return 'Joguei Ninguém Dorme na Vila Sossego! 🌙';
    const r = R[me.papel];
    const won = r.time === g.vencedor;
    if (me.papel === 'capanga') return won ? 'Fui Capanga no Ninguém Dorme e enganei a vila inteira 😈🦹' : 'Fui Capanga no Ninguém Dorme… e me pegaram 😅🦹';
    if (me.papel === 'bebado') return 'Passei a partida inteira achando que era a Delegada… era o Zé Pinguço 🍺😂';
    return won ? `Fui ${r.nome} ${r.emoji} e a vila venceu os capangas no Ninguém Dorme! 🏘️` : `Fui ${r.nome} ${r.emoji}… e os capangas tomaram a vila 😱`;
  },
  result(s) {
    const g = s.game;
    if (!g || g.fase !== 'fim' || !g.me) return null;
    const me = g.players.find((p) => p.id === s.you);
    const team = R[g.me.papel].time;
    return { jogo: 'nd', won: team === g.vencedor, team, survived: me.vivo,
      votosCertos: me.stats ? me.stats.votosCertos : 0, delegadaAcertos: me.stats ? me.stats.investigouCapanga : 0 };
  },
};

Object.assign(Vila.FORM, {
  ultimas: (f) => { const t = f.elements.txt.value.trim(); if (t) Vila.move({ t: 'ultimas', text: t }); },
});

Object.assign(Vila.ACT, {
  ouvirPapel: () => {
    const g = Vila.state.game;
    if (!g || !g.me) return;
    const r = R[g.me.papel];
    Voz.falar(`Você é ${r.nome}. ${r.time === 'capangas' ? 'Time dos capangas.' : 'Time da vila.'} ${r.desc}`);
  },
  toggleRole: () => { roleShown = !roleShown; Vila.render(); },
  night: (el) => {
    Snd.pop();
    const me = Vila.state.game.me;
    if (me.max !== 2) { Vila.move({ t: 'noite', alvo: el.dataset.id }); return; }
    // lua cheia: tocar marca/desmarca (até duas pessoas)
    let sel = [me.acao, me.acao2].filter(Boolean);
    sel = sel.includes(el.dataset.id) ? sel.filter((x) => x !== el.dataset.id) : [...sel, el.dataset.id].slice(-2);
    Vila.move({ t: 'noite', alvos: sel });
  },
  stayHome: () => Vila.move({ t: 'noite', alvo: null }),
  sheep: () => {
    sheep += 1;
    Snd.pop();
    const g = Vila.state.game;
    if (g && g.me && g.me.acao === undefined && g.especial !== 'festa') Vila.move({ t: 'noite' });
    Vila.render();
  },
  ready: () => Vila.move({ t: 'pronto' }),
  vote: (el) => { Snd.pop(); Vila.move({ t: 'voto', alvo: el.dataset.id }); },
  skip: () => Vila.move({ t: 'voto', alvo: 'pular' }),
});

Vila.start(Jogo);
