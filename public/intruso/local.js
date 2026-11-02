'use strict';
// Modo 1 celular: a partida inteira roda neste aparelho, que passa de mão em mão. Não fala com o servidor.
// Depende de app.js (h, av, icon, render, toast, burst, ACT, FORM) e dos bancos words.js e pairs.js (carregados antes).

const LOCAL_KEY = 'intruso-local';
const LW = window.INTRUSO_WORDS || {};
const LP = window.INTRUSO_PAIRS || {};
const LOCAL_MAX = 10;
const rnd = (n) => Math.floor(Math.random() * n);

let loc = (() => { try { return JSON.parse(ls.get(LOCAL_KEY)); } catch { return null; } })();
if (!loc || !Array.isArray(loc.names)) loc = { step: 'setup', names: [], cat: 'Todas', similar: false, total: 5, used: [] };
if (loc.cat !== 'Todas' && !LW[loc.cat]) loc.cat = 'Todas';
const saveLoc = () => ls.set(LOCAL_KEY, JSON.stringify(loc));

// Sorteia sem repetir neste aparelho; quando a lista esgota, recomeça só ela.
function locFresh(key, list) {
  let free = list.filter((x) => !loc.used.includes(key + '|' + x));
  if (!free.length) { loc.used = loc.used.filter((k) => !k.startsWith(key + '|')); free = list; }
  const x = free[rnd(free.length)];
  loc.used.push(key + '|' + x);
  return x;
}

function locNewRound() {
  const cats = Object.keys(LW);
  const cat = loc.cat === 'Todas' ? cats[rnd(cats.length)] : loc.cat;
  if (loc.similar) {
    const pair = locFresh('par:' + cat, LP[cat]).split('|'), f = rnd(2);
    loc.word = pair[f]; loc.alt = pair[1 - f];
  } else {
    loc.word = locFresh(cat, LW[cat]); loc.alt = null;
  }
  loc.wordCat = cat;
  loc.round++;
  loc.imp = rnd(loc.names.length);
  loc.starter = rnd(loc.names.length);
  Object.assign(loc, { step: 'pass', passIdx: 0, peek: false, reason: null, showWord: false, delta: null });
}

function locFinish(reason) {
  const impWins = reason !== 'caught';
  loc.reason = reason;
  loc.delta = loc.names.map((_, i) => (impWins ? (i === loc.imp ? 2 : 0) : (i === loc.imp ? 0 : 1)));
  loc.scores = loc.scores.map((v, i) => v + loc.delta[i]);
  loc.step = 'result';
  Snd.win(); burst();
}

function locRanking() {
  const rows = loc.names.map((name, i) => ({ i, name, score: loc.scores[i] })).sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
  let rank = 0, prev = null;
  return rows.map((r) => { if (r.score !== prev) rank++; prev = r.score; return { ...r, rank }; });
}

function locRows(delta) {
  const rows = locRanking(), max = Math.max(1, ...rows.map((r) => r.score)), zero = rows.every((r) => r.score === 0);
  return h('ol', { class: 'rows' }, rows.map((r) => h('li', { class: 'row' + (r.rank === 1 && r.score > 0 ? ' first' : ''), 'data-key': 'l' + r.i },
    h('span', { class: 'rank' }, zero ? '' : r.rank), av(r.i % 12, 48),
    h('div', { class: 'rname' }, h('span', { class: 'nm' }, r.name), h('span', { class: 'bar' }, h('i', { style: `--w:${r.score ? Math.max(8, r.score / max * 100) : 0}%` }))),
    h('b', { class: 'pts' }, delta && delta[r.i] > 0 ? h('span', { class: 'delta' }, '+' + delta[r.i]) : null, r.score))));
}

const locScreen = (step, ...kids) => h('div', { class: 'screen local', 'data-screen': 'local-' + step }, ...kids);
const quitBtn = () => h('button', { class: 'btn ghost back', type: 'button', 'data-act': 'locQuit' }, icon('exit'), 'Encerrar partida');
const chip = (act, v, cur, label) => h('button', { type: 'button', class: 'chip', 'data-act': act, 'data-v': v, 'aria-pressed': String(String(v) === String(cur)), 'data-key': act + v }, label);

function locSetup() {
  const n = loc.names.length, full = n >= LOCAL_MAX;
  return locScreen('setup',
    h('button', { class: 'btn ghost back', type: 'button', 'data-act': 'home' }, icon('back'), 'Voltar'),
    h('div', { class: 'hero' }, h('h1', {}, 'Jogar em 1 celular'),
      h('p', { class: 'sub' }, 'O celular passa de mão em mão e cada um vê sua palavra em segredo. As dicas e a conversa são em voz alta.')),
    h('section', { class: 'panel' },
      h('h2', {}, `Jogadores (${n} de ${LOCAL_MAX})`),
      n ? h('div', { class: 'tags' }, loc.names.map((name, i) => h('div', { class: 'tag', 'data-key': 'n' + i + name },
        av(i % 12, 38), h('span', { class: 'nm' }, name),
        h('button', { type: 'button', class: 'ldel', 'data-act': 'locDel', 'data-i': i, 'aria-label': 'Tirar ' + name }, '×')))) : h('p', { class: 'hint' }, 'Adicione pelo menos 3 pessoas, na ordem da roda.'),
      full ? null : h('form', { class: 'form-row', 'data-form': 'locAdd' },
        h('input', { id: 'lnome', maxlength: 14, autocomplete: 'off', placeholder: 'Nome', 'aria-label': 'Nome do jogador' }),
        h('button', { class: 'btn', type: 'submit' }, 'Adicionar'))),
    h('section', { class: 'stack' }, h('h2', {}, 'Categoria'),
      h('div', { class: 'chips' }, ['Todas', ...Object.keys(LW)].map((c) => chip('locCat', c, loc.cat, c)))),
    h('section', { class: 'panel flat' }, h('h2', {}, 'Ajustes'),
      h('div', { class: 'setrow' }, h('p', { class: 'setlbl' }, 'Modo de jogo'),
        h('div', { class: 'chips' }, chip('locMode', 0, Number(loc.similar), 'Clássico'), chip('locMode', 1, Number(loc.similar), 'Palavra parecida'))),
      h('p', { class: 'hint' }, loc.similar ? 'O intruso recebe uma palavra parecida e pode nem perceber que é o intruso.' : 'O intruso não recebe palavra nenhuma, só a categoria.'),
      h('div', { class: 'setrow' }, h('p', { class: 'setlbl' }, 'Tamanho da partida'),
        h('div', { class: 'chips' }, [5, 10, 20].map((v) => chip('locTotal', v, loc.total, `${v} rodadas`))))),
    h('button', { class: 'btn primary', type: 'button', 'data-act': 'locStart', disabled: n < 3 },
      n < 3 ? `Faltam ${3 - n} ${3 - n === 1 ? 'jogador' : 'jogadores'}` : 'Começar'));
}

function locPass() {
  const i = loc.passIdx, name = loc.names[i], last = i === loc.names.length - 1, imp = i === loc.imp;
  const card = !loc.peek
    ? h('button', { type: 'button', class: 'role hid', 'data-act': 'locPeek' },
      av(i % 12, 64), h('span', { class: 'big' }, `Sou ${name}`), h('span', { class: 'hint' }, 'Toque para ver sua palavra. Ninguém mais olhando!'))
    : h('div', { class: 'role show ' + (imp && !loc.similar ? 'imp' : 'crew') },
      h('span', { class: 'hint' }, 'Categoria: ' + loc.wordCat),
      imp && !loc.similar ? [h('span', { class: 'big' }, 'Você é o intruso'), h('span', { class: 'hint' }, 'Descubra a palavra sem se entregar')]
        : [h('span', { class: 'hint' }, 'A palavra é'), h('span', { class: 'big' }, imp ? loc.alt : loc.word),
          loc.similar ? h('span', { class: 'hint' }, 'O intruso recebeu uma palavra parecida. Pode ser você!') : null]);
  return locScreen('pass-' + i + (loc.peek ? 'v' : ''),
    h('div', { class: 'hero' }, h('p', { class: 'sub' }, `Rodada ${loc.round} de ${loc.total}`), h('h1', {}, loc.peek ? name : `Passe para ${name}`)),
    h('div', { class: 'strip', role: 'group', 'aria-label': 'Quem já viu' }, loc.names.map((nm, k) =>
      h('div', { class: 'sp' + (k === i ? ' now' : k < i ? ' done' : ''), 'data-key': 's' + k }, av(k % 12, 42)))),
    card,
    loc.peek ? h('button', { class: 'btn primary', type: 'button', 'data-act': 'locNext' },
      last ? 'Esconder e começar as dicas' : `Esconder e passar para ${loc.names[i + 1]}`) : null,
    quitBtn());
}

function locTalk() {
  const n = loc.names.length, order = loc.names.map((_, k) => (loc.starter + k) % n);
  return locScreen('talk',
    h('div', { class: 'hero' }, h('p', { class: 'sub' }, `Rodada ${loc.round} de ${loc.total} · ${loc.wordCat}`), h('h1', {}, 'Hora das dicas'),
      h('p', { class: 'sub' }, `Cada um fala em voz alta uma palavra que lembre a sua, nesta ordem, por 2 voltas. Depois conversem e decidam em quem votar.`
        + (loc.similar ? ' Lembrem: o intruso pode nem saber que é ele.' : ''))),
    h('section', { class: 'panel' }, h('h2', {}, 'Ordem da roda'),
      h('ol', { class: 'rows' }, order.map((k, pos) => h('li', { class: 'row' + (pos === 0 ? ' first' : ''), 'data-key': 'o' + k },
        h('span', { class: 'rank' }, pos + 1), av(k % 12, 40), h('div', { class: 'rname' }, h('span', { class: 'nm' }, loc.names[k] + (pos === 0 ? ' começa' : ''))))))),
    h('button', { class: 'btn primary', type: 'button', 'data-act': 'locToVote' }, 'Ir para a votação'),
    quitBtn());
}

function locVote() {
  return locScreen('vote',
    h('div', { class: 'hero' }, h('h1', {}, 'Em quem a roda votou?'),
      h('p', { class: 'sub' }, 'No três, todo mundo aponta para quem acha que é o intruso. Toque em quem recebeu mais votos.')),
    h('div', { class: 'vgrid' }, loc.names.map((name, i) => h('button', { type: 'button', class: 'vcard', 'data-act': 'locVote', 'data-i': i, 'data-key': 'v' + i },
      av(i % 12, 64), h('span', { class: 'nm' }, name)))),
    h('button', { class: 'btn', type: 'button', 'data-act': 'locTie' }, 'Deu empate'),
    quitBtn());
}

function locGuess() {
  const name = loc.names[loc.imp];
  return locScreen('guess' + (loc.showWord ? 'w' : ''),
    h('section', { class: 'panel accused' }, h('div', { class: 'faces' }, av(loc.imp % 12, 120)),
      h('h2', {}, `${name} é o intruso!`),
      h('p', {}, loc.similar ? `${name}, agora você sabe: diga em voz alta qual você acha que é a palavra da turma.`
        : `Ainda dá para virar: ${name}, diga em voz alta qual você acha que é a palavra.`),
      loc.showWord ? h('p', { class: 'fact' }, 'A palavra era: ' + loc.word) : null),
    loc.showWord
      ? h('div', { class: 'two' },
        h('button', { class: 'btn primary', type: 'button', 'data-act': 'locGuessed', 'data-v': 1 }, 'Acertou'),
        h('button', { class: 'btn', type: 'button', 'data-act': 'locGuessed', 'data-v': 0 }, 'Errou'))
      : h('button', { class: 'btn primary', type: 'button', 'data-act': 'locShowWord' }, 'Já chutou? Mostrar a palavra'),
    quitBtn());
}

function locResult() {
  const impWins = loc.reason !== 'caught', name = loc.names[loc.imp], last = loc.round >= loc.total;
  const why = { escaped: 'A roda votou na pessoa errada e o intruso escapou.', tie: 'Deu empate e o intruso escapou.',
    guessed: 'Descoberto, mas acertou a palavra.', caught: 'Pego e errou a palavra.' }[loc.reason];
  return locScreen('result',
    h('div', { class: 'banner ' + (impWins ? 'lose' : 'win') }, impWins ? 'O intruso venceu!' : 'A turma venceu!'),
    h('section', { class: 'reveal' }, h('p', { class: 'sub' }, 'O intruso era'),
      h('div', { class: 'faces' }, h('div', { class: 'face' }, av(loc.imp % 12, 116), h('p', { class: 'who' }, name))),
      h('div', { class: 'facts' }, h('span', { class: 'fact' }, (loc.alt ? 'Palavra da turma: ' : 'Palavra: ') + loc.word),
        loc.alt ? h('span', { class: 'fact' }, 'Palavra do intruso: ' + loc.alt) : null),
      h('p', { class: 'sub' }, why)),
    h('section', { class: 'panel' }, h('h2', {}, 'Placar'), locRows(loc.delta)),
    h('button', { class: 'btn primary', type: 'button', 'data-act': 'locNextRound' }, last ? 'Ver resultado final' : `Próxima rodada (${loc.round + 1} de ${loc.total})`),
    quitBtn());
}

function locFinal() {
  const rows = locRanking(), tops = rows.filter((r) => r.rank === 1);
  return locScreen('final',
    h('div', { class: 'hero' }, h('p', { class: 'sub' }, `Fim da partida · ${loc.total} rodadas`),
      h('h1', {}, tops.length > 1 ? 'Empate no topo!' : `${tops[0].name} venceu!`)),
    h('section', { class: 'faces' }, tops.map((r) => h('div', { class: 'face', 'data-key': 't' + r.i }, av(r.i % 12, 96), h('p', { class: 'who' }, r.name)))),
    h('section', { class: 'panel' }, h('h2', {}, 'Classificação final'), locRows(null)),
    h('button', { class: 'btn primary', type: 'button', 'data-act': 'locAgain' }, 'Jogar de novo'),
    h('button', { class: 'btn', type: 'button', 'data-act': 'locEdit' }, 'Trocar jogadores ou categoria'));
}

const LOCAL_STEPS = { setup: locSetup, pass: locPass, talk: locTalk, vote: locVote, guess: locGuess, result: locResult, final: locFinal };
function localScreen() { return (LOCAL_STEPS[loc.step] || locSetup)(); }

const locDo = (fn) => (el) => { fn(el); saveLoc(); window.scrollTo(0, 0); render(); };
Object.assign(ACT, {
  locDel: (el) => { loc.names.splice(Number(el.dataset.i), 1); saveLoc(); render(); },
  locCat: (el) => { loc.cat = el.dataset.v; saveLoc(); render(); },
  locMode: (el) => { loc.similar = el.dataset.v === '1'; saveLoc(); render(); },
  locTotal: (el) => { loc.total = Number(el.dataset.v); saveLoc(); render(); },
  locStart: locDo(() => { Snd.unlock(); loc.scores = loc.names.map(() => 0); loc.round = 0; locNewRound(); Snd.pop(); }),
  locPeek: (el) => { loc.peek = true; saveLoc(); Snd.pop(); render(); },
  locNext: locDo(() => { if (loc.passIdx < loc.names.length - 1) { loc.passIdx++; loc.peek = false; } else { loc.step = 'talk'; Snd.turn(); } }),
  locToVote: locDo(() => { loc.step = 'vote'; }),
  locVote: locDo((el) => { if (Number(el.dataset.i) === loc.imp) { loc.step = 'guess'; Snd.drum(); } else { locFinish('escaped'); } }),
  locTie: locDo(() => locFinish('tie')),
  locShowWord: locDo(() => { loc.showWord = true; }),
  locGuessed: locDo((el) => locFinish(el.dataset.v === '1' ? 'guessed' : 'caught')),
  locNextRound: locDo(() => { if (loc.round >= loc.total) { loc.step = 'final'; Snd.fanfare(); burst(); } else locNewRound(); }),
  locAgain: locDo(() => { loc.scores = loc.names.map(() => 0); loc.round = 0; locNewRound(); }),
  locEdit: locDo(() => { loc.step = 'setup'; }),
  locQuit: (el) => {
    if (!confirm('Encerrar esta partida no celular?')) return;
    loc.step = 'setup'; saveLoc(); tab = 'home'; window.scrollTo(0, 0); render();
  },
});

FORM.locAdd = (f) => {
  const inp = f.elements.lnome, name = inp.value.replace(/\s+/g, ' ').trim().slice(0, 14);
  if (!name) { inp.focus(); return; }
  if (loc.names.some((x) => nz(x) === nz(name))) { toast('Esse nome já está na lista.'); return; }
  if (loc.names.length >= LOCAL_MAX) return;
  loc.names.push(name); inp.value = ''; saveLoc(); render();
  const again = document.getElementById('lnome'); if (again) again.focus();
};
