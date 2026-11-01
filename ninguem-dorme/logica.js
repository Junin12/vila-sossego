'use strict';
// Regras do Ninguém Dorme, sem rede nem timers: o servidor chama act() e timeout(); os testes chamam direto.
//
// Fases: 'noite' (cada um faz sua ação no próprio celular; quem não tem poder "dorme")
//        → 'amanhecer' (quem sumiu, o que a Cotinha espalhou) → 'dia' (conversa) → 'votacao'
//        → 'veredito' (quem foi expulso) → 'noite' … até 'fim'.
// Vila vence quando não sobra capanga; capangas vencem quando são tantos quanto o resto.
// Expansão: Vigia, Zé Pinguço (acha que é a Delegada), Coveiro, Casal apaixonado e noites especiais.

const { PAPEIS, ESPECIAIS, distribuir, MIN, MAX } = require('../public/ninguem-dorme/papeis');

class RuleError extends Error {}
const fail = (msg) => { throw new RuleError(msg); };
const defaultRnd = (n) => Math.floor(Math.random() * n);
const LOG_MAX = 50;
const CHANCE_ESPECIAL = 3;   // 1 em 3 noites (a partir da 2ª)

const P = (g, id) => g.players.find((p) => p.id === id);
const vivos = (g) => g.players.filter((p) => p.vivo);
const isCap = (p) => p.papel === 'capanga';
const investiga = (p) => p.papel === 'delegada' || p.papel === 'bebado';

function log(g, entry) {
  g.log.push({ n: ++g.seq, ...entry });
  if (g.log.length > LOG_MAX) g.log.shift();
}

function shuffle(g, arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = g.rnd(i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// opts: { revelar: mostra o papel de quem sai (padrão sim), extras: expansão de papéis + casal, especiais: noites especiais, rnd }
function newGame(ids, opts = {}) {
  if (ids.length < MIN || ids.length > MAX) fail(`O jogo é de ${MIN} a ${MAX} jogadores.`);
  const g = {
    rnd: opts.rnd || defaultRnd, revelar: opts.revelar !== false, especiais: !!opts.especiais,
    fase: 'noite', noite: 1, dia: 0, players: [], acoes: {}, acoes2: {}, benzidoAntes: {}, investigados: {}, priv: {},
    anuncio: null, votos: {}, veredito: null, vencedor: null, log: [], seq: 0, casal: null, especial: null, votoSecreto: false,
  };
  const papeis = shuffle(g, distribuir(ids.length, { extras: !!opts.extras, revelar: g.revelar }));
  ids.forEach((id, i) => g.players.push({ id, papel: papeis[i], vivo: true, revelado: false, pronto: false,
    stats: { votosCertos: 0, votosErrados: 0, investigouCapanga: 0, salvou: 0 } }));
  if (opts.extras && ids.length >= 6) {
    const vila = shuffle(g, g.players.filter((p) => !isCap(p)).map((p) => p.id));
    g.casal = vila.slice(0, 2);
  }
  log(g, { t: 'noite', noite: 1 });
  return g;
}

function waiting(g) {
  if (g.fase === 'noite') return g.especial === 'festa' ? [] : vivos(g).filter((p) => !(p.id in g.acoes)).map((p) => p.id);
  if (g.fase === 'dia') return vivos(g).filter((p) => !p.pronto).map((p) => p.id);
  if (g.fase === 'votacao') return vivos(g).filter((p) => !(p.id in g.votos)).map((p) => p.id);
  return [];
}

// Quem cada papel pode escolher à noite.
function alvosNoite(g, p) {
  const acao = PAPEIS[p.papel].noite;
  if (!acao || !p.vivo || g.especial === 'festa') return [];
  return vivos(g).filter((x) => {
    if (acao === 'sumir') return !isCap(x);
    if (acao === 'benzer') return g.benzidoAntes[p.id] !== x.id;
    return x.id !== p.id;   // investigar, espiar, vigiar
  }).map((x) => x.id);
}

function checkWin(g) {
  const caps = vivos(g).filter(isCap).length;
  const resto = vivos(g).length - caps;
  if (caps === 0) g.vencedor = 'vila';
  else if (caps >= resto) g.vencedor = 'capangas';
  if (g.vencedor) { g.fase = 'fim'; log(g, { t: 'fim', vencedor: g.vencedor }); return true; }
  return false;
}

// Tira alguém da vila. Se for metade do casal, o par sai junto (devolve quem saiu de saudade).
function tirar(g, p) {
  p.vivo = false;
  p.pronto = false;
  if (g.revelar) p.revelado = true;
  if (!g.casal || !g.casal.includes(p.id)) return null;
  const par = P(g, g.casal.find((id) => id !== p.id));
  if (!par || !par.vivo) return null;
  par.vivo = false;
  par.pronto = false;
  if (g.revelar) par.revelado = true;
  return par;
}

function maisVotado(g, contagem) {
  let max = 0, top = [];
  for (const [id, n] of Object.entries(contagem)) {
    if (n > max) { max = n; top = [id]; } else if (n === max) top.push(id);
  }
  return { max, top };
}

function resolverNoite(g) {
  const vivosAntes = vivos(g);
  // capangas: alvo mais escolhido (empate sorteia); na lua cheia, também o segundo mais escolhido
  const conta = {};
  for (const p of vivosAntes.filter(isCap)) {
    for (const a of [g.acoes[p.id], g.acoes2[p.id]]) if (a) conta[a] = (conta[a] || 0) + 1;
  }
  const alvos = [];
  const { top } = maisVotado(g, conta);
  if (top.length) alvos.push(top[g.rnd(top.length)]);
  if (g.especial === 'lua' && alvos.length) {
    delete conta[alvos[0]];
    const seg = maisVotado(g, conta).top;
    if (seg.length) alvos.push(seg[g.rnd(seg.length)]);
  }
  const benz = vivosAntes.find((p) => p.papel === 'benzedeira');
  const benzido = benz ? g.acoes[benz.id] || null : null;
  for (const p of vivosAntes) if (p.papel === 'benzedeira') g.benzidoAntes[p.id] = g.acoes[p.id] || null;
  const salvo = alvos.includes(benzido);
  if (salvo) benz.stats.salvou += 1;

  // Delegada descobre a verdade; o Zé Pinguço acha que é Delegada e chuta.
  for (const d of vivosAntes.filter(investiga)) {
    const a = g.acoes[d.id];
    if (!a) continue;
    const t = P(g, a);
    const capanga = d.papel === 'bebado' ? g.rnd(2) === 0 : isCap(t);
    (g.priv[d.id] = g.priv[d.id] || []).push({ noite: g.noite, alvo: a, capanga });
    (g.investigados[d.id] = g.investigados[d.id] || []).push(a);
    if (d.papel === 'delegada' && isCap(t)) d.stats.investigouCapanga += 1;
  }

  // Vigia: quem bateu na casa vigiada (todo mundo que sai e escolheu aquela pessoa)
  for (const v of vivosAntes.filter((p) => p.papel === 'vigia')) {
    const casa = g.acoes[v.id];
    if (!casa) continue;
    const visitas = vivosAntes.filter((x) => x.id !== v.id && PAPEIS[x.papel].sai && (g.acoes[x.id] === casa || g.acoes2[x.id] === casa)).map((x) => x.id);
    (g.priv[v.id] = g.priv[v.id] || []).push({ noite: g.noite, alvo: casa, visitas });
  }

  let fofoca = null;
  const fofo = vivosAntes.find((p) => p.papel === 'fofoqueira' && g.acoes[p.id]);
  if (fofo) {
    const t = P(g, g.acoes[fofo.id]);
    fofoca = { alvo: t.id, saiu: !!(PAPEIS[t.papel].sai && g.acoes[t.id]) };
  }

  const sumidos = alvos.filter((a) => a !== benzido).map((a) => P(g, a));
  let saudade = null;
  for (const p of sumidos) { if (p.vivo) saudade = tirar(g, p) || saudade; }
  const [s1, s2] = sumidos;
  const papel = (p) => (p && g.revelar ? p.papel : null);
  g.anuncio = { noite: g.noite, sumiu: s1 ? s1.id : null, papel: papel(s1), sumiu2: s2 ? s2.id : null, papel2: papel(s2),
    salvo, fofoca, saudade: saudade ? saudade.id : null, papelSaudade: papel(saudade), especial: g.especial };
  log(g, { t: 'amanhecer', ...g.anuncio });
  g.votoSecreto = g.especial === 'neblina';
  g.especial = null;
  g.acoes = {};
  g.acoes2 = {};
  if (!checkWin(g)) g.fase = 'amanhecer';
}

function abrirDia(g) {
  g.fase = 'dia';
  g.dia += 1;
  for (const p of g.players) p.pronto = false;
  log(g, { t: 'dia', dia: g.dia });
}

function abrirVotacao(g) {
  g.fase = 'votacao';
  g.votos = {};
  log(g, { t: 'votacao', dia: g.dia });
}

function resolverVotos(g) {
  const conta = {};
  let pular = 0;
  for (const [voter, alvo] of Object.entries(g.votos)) {
    const v = P(g, voter);
    const peso = v.papel === 'prefeito' ? 2 : 1;
    if (alvo === 'pular') { pular += peso; continue; }
    conta[alvo] = (conta[alvo] || 0) + peso;
    if (isCap(P(g, alvo))) v.stats.votosCertos += 1; else v.stats.votosErrados += 1;
  }
  const { max, top } = maisVotado(g, conta);
  const expulso = top.length === 1 && max > pular ? P(g, top[0]) : null;
  const saudade = expulso ? tirar(g, expulso) : null;
  g.veredito = { dia: g.dia, expulso: expulso ? expulso.id : null, papel: expulso && g.revelar ? expulso.papel : null,
    empate: top.length > 1 && max > pular, votos: { ...g.votos },
    saudade: saudade ? saudade.id : null, papelSaudade: saudade && g.revelar ? saudade.papel : null };
  log(g, { t: 'veredito', expulso: g.veredito.expulso, papel: g.veredito.papel, empate: g.veredito.empate, saudade: g.veredito.saudade });
  g.votoSecreto = false;
  g.fase = 'veredito';
}

function abrirNoite(g) {
  g.noite += 1;
  g.fase = 'noite';
  g.acoes = {};
  g.acoes2 = {};
  g.especial = null;
  if (g.especiais && g.rnd(CHANCE_ESPECIAL) === 0) {
    const ks = Object.keys(ESPECIAIS).filter((k) => k !== g.ultimaEspecial);
    g.especial = ks[g.rnd(ks.length)];
    g.ultimaEspecial = g.especial;
  }
  log(g, { t: 'noite', noite: g.noite, especial: g.especial });
}

function depoisVeredito(g) {
  if (checkWin(g)) return;
  abrirNoite(g);
}

function act(g, pid, move) {
  const p = P(g, pid);
  if (!p) fail('Você não está nesta partida.');
  if (g.fase === 'fim') fail('A partida acabou.');
  if (!p.vivo) fail('Você sumiu da vila… agora só assiste. 👻');
  const t = move && move.t;
  if (g.fase === 'noite') {
    if (t !== 'noite') fail('É noite: faça sua ação ou durma.');
    if (g.especial === 'festa') fail('Hoje é festa: ninguém sai de casa! 🎉');
    const lista = Array.isArray(move.alvos) ? move.alvos.filter((a) => a != null) : move.alvo != null ? [move.alvo] : [];
    const max = isCap(p) && g.especial === 'lua' ? 2 : 1;
    if (PAPEIS[p.papel].noite && lista.length) {   // sem alvo = ficou em casa
      const ok = alvosNoite(g, p);
      if (lista.length > max || new Set(lista).size !== lista.length || !lista.every((a) => ok.includes(a))) fail('Escolha alguém válido.');
      g.acoes[pid] = lista[0];
      if (lista[1]) g.acoes2[pid] = lista[1]; else delete g.acoes2[pid];
    } else {
      g.acoes[pid] = null;   // dormiu
      delete g.acoes2[pid];
    }
    if (!waiting(g).length) resolverNoite(g);
    return;
  }
  if (g.fase === 'dia') {
    if (t !== 'pronto') fail('Agora é hora de conversar.');
    p.pronto = !p.pronto;
    if (!waiting(g).length) abrirVotacao(g);
    return;
  }
  if (g.fase === 'votacao') {
    if (t !== 'voto') fail('Vote em alguém ou pule.');
    const alvo = move.alvo;
    if (alvo !== 'pular') {
      const a = P(g, alvo);
      if (!a || !a.vivo || a.id === pid) fail('Vote em alguém que ainda está na vila.');
    }
    g.votos[pid] = alvo;
    if (!waiting(g).length) resolverVotos(g);
    return;
  }
  fail('Espere um pouco…');
}

// Tempo esgotado: a fase acaba com quem já agiu (quem não agiu, não fez nada).
function timeout(g) {
  if (g.fase === 'noite') return resolverNoite(g);
  if (g.fase === 'amanhecer') return abrirDia(g);
  if (g.fase === 'dia') return abrirVotacao(g);
  if (g.fase === 'votacao') return resolverVotos(g);
  if (g.fase === 'veredito') return depoisVeredito(g);
}

// O Zé Pinguço se vê como Delegada até o fim (ou até sair da vila).
const papelPara = (g, p, pid) => (p.papel === 'bebado' && p.id === pid && p.vivo && g.fase !== 'fim' ? PAPEIS.bebado.finge : p.papel);

function viewFor(g, pid) {
  const me = P(g, pid);
  const fim = g.fase === 'fim';
  const fantasma = !!(me && !me.vivo);
  const souCap = !!(me && isCap(me));
  const coveiro = !!(me && me.papel === 'coveiro');
  const noCasal = !!(me && g.casal && g.casal.includes(pid));
  const verPapel = (p) => fim || p.id === pid || fantasma || p.revelado || (souCap && isCap(p)) || (coveiro && !p.vivo);
  const secreto = g.fase === 'votacao' && g.votoSecreto;
  const v = {
    fase: g.fase, noite: g.noite, dia: g.dia, waiting: waiting(g), vencedor: g.vencedor, revelar: g.revelar,
    anuncio: g.anuncio, log: g.log, especial: g.especial, votoSecreto: secreto,
    casal: fim || fantasma ? g.casal : noCasal ? g.casal : null,
    players: g.players.map((p) => ({
      id: p.id, vivo: p.vivo, papel: verPapel(p) ? papelPara(g, p, pid) : null, pronto: p.pronto,
      votou: g.fase === 'votacao' ? p.id in g.votos : false,
      stats: fim ? p.stats : null,
    })),
    votos: g.fase === 'votacao' ? (secreto ? (g.votos[pid] ? { [pid]: g.votos[pid] } : {}) : g.votos) : null,
    veredito: g.veredito && (g.fase === 'veredito' || fim) ? g.veredito : null,
  };
  // modo segredo: só fantasmas e o Coveiro sabem quem era quem saiu
  if (!g.revelar && !fantasma && !fim && !coveiro) {
    if (v.veredito) v.veredito = { ...v.veredito, papel: null, papelSaudade: null };
  } else if (!g.revelar && g.anuncio && !fim) {
    const real = (id) => (id ? P(g, id).papel : null);
    v.anuncio = { ...g.anuncio, papel: real(g.anuncio.sumiu), papel2: real(g.anuncio.sumiu2), papelSaudade: real(g.anuncio.saudade) };
    if (v.veredito) v.veredito = { ...v.veredito, papel: real(v.veredito.expulso), papelSaudade: real(v.veredito.saudade) };
  }
  if (me) {
    const papel = papelPara(g, me, pid);
    v.me = { papel, vivo: me.vivo, time: PAPEIS[me.papel].time, priv: g.priv[pid] || [],
      alvos: g.fase === 'noite' ? alvosNoite(g, me) : [], acao: g.fase === 'noite' && pid in g.acoes ? g.acoes[pid] : undefined,
      acao2: g.fase === 'noite' ? g.acoes2[pid] || null : null,
      max: souCap && g.especial === 'lua' ? 2 : 1,
      benzidoAntes: g.benzidoAntes[pid] || null, par: noCasal ? g.casal.find((id) => id !== pid) : null };
    if (souCap && g.fase === 'noite') {
      v.me.capangas = Object.fromEntries(g.players.filter(isCap).filter((p) => p.vivo)
        .map((p) => [p.id, [g.acoes[p.id], g.acoes2[p.id]].filter(Boolean)]));
    }
  }
  return v;
}

module.exports = { newGame, act, timeout, viewFor, waiting, alvosNoite, isCap, RuleError, P, vivos };
