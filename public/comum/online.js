'use strict';
// Vila online (lado da tela): salva o Passaporte da Vila na nuvem, recupera em outro celular pelo código secreto,
// guarda os amigos com quem você jogou (para o ranking), A Turma e o link de convite (indique e ganhe).
const Online = (() => {
  const ls = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch { /* ok */ } },
  };
  const LETRAS = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  const aleatorio = (n, abc) => Array.from(crypto.getRandomValues(new Uint8Array(n)), (b) => abc[b % abc.length]).join('');

  function pp() {
    let id = ls.get('vila-pp');
    if (!/^[a-z0-9]{8}$/.test(id || '')) { id = aleatorio(8, 'abcdefghijkmnpqrstuvwxyz23456789'); ls.set('vila-pp', id); }
    return id;
  }
  function codigo() {
    let c = ls.get('vila-codigo');
    if (!/^[A-Za-z0-9]{16,40}$/.test(c || '')) { c = aleatorio(20, LETRAS); ls.set('vila-codigo', c); }
    return c;
  }
  const codigoBonito = () => codigo().match(/.{1,5}/g).join('-');

  // convite: quem chega por ?ref=<pp> fica marcado (conta para quem convidou quando salvar pela 1ª vez)
  (() => {
    const ref = new URLSearchParams(location.search).get('ref');
    if (/^[a-z0-9]{8}$/.test(ref || '') && !ls.get('vila-codigo') && ref !== ls.get('vila-pp')) ls.set('vila-ref', ref);
  })();

  async function post(rota, body) {
    let r;
    try { r = await fetch('/api/' + rota, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); }
    catch { throw new Error('Sem conexão com a nuvem da vila.'); }
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || 'A nuvem da vila não respondeu.');
    return j;
  }

  // salvar o passaporte (com intervalo: no máximo 1 a cada 20s, o último ganha)
  let timer = null, pendente = null;
  function salvar(perfil, nome, avatar) {
    pendente = { perfil, nome, avatar };
    if (timer) return;
    timer = setTimeout(async () => {
      timer = null;
      const p = pendente; pendente = null;
      try {
        const r = await post('passaporte/salvar', { codigo: codigo(), pp: pp(), nome: p.nome || 'Morador', avatar: typeof p.avatar === 'number' ? p.avatar : 0, perfil: p.perfil, ref: ls.get('vila-ref') || undefined });
        ls.set('vila-online', String(Date.now()));
        if (typeof r.convites === 'number') ls.set('vila-convites', String(r.convites));
      } catch { /* sem nuvem agora: tenta na próxima */ }
    }, 1500);
  }

  // recuperar em outro celular: troca o código e devolve o passaporte salvo
  async function recuperar(cod) {
    const limpo = String(cod || '').replace(/[^A-Za-z0-9]/g, '');
    const r = await post('passaporte/carregar', { codigo: limpo });
    ls.set('vila-codigo', limpo);
    ls.set('vila-pp', r.pp);
    if (typeof r.convites === 'number') ls.set('vila-convites', String(r.convites));
    return r;
  }

  // amigos: gente com passaporte que jogou na mesma sala que você
  function amigos() { try { return JSON.parse(ls.get('vila-amigos')) || []; } catch { return []; } }
  function anotarAmigos(lista) {
    const meu = pp();
    const a = amigos();
    let mudou = false;
    for (const x of lista) if (/^[a-z0-9]{8}$/.test(x || '') && x !== meu && !a.includes(x)) { a.unshift(x); mudou = true; }
    if (mudou) ls.set('vila-amigos', JSON.stringify(a.slice(0, 60)));
  }
  const ranking = () => post('ranking', { pps: [pp(), ...amigos()] });

  const turmas = () => post('turma/minhas', { pp: pp() });
  const criarTurma = (nome) => post('turma/criar', { pp: pp(), nome });
  const entrarTurma = (id) => post('turma/entrar', { pp: pp(), id });
  const verTurma = (id) => post('turma/ver', { id });

  const convites = () => Number(ls.get('vila-convites')) || 0;
  const linkConvite = (site) => `${site}?ref=${pp()}`;

  return { pp, codigo, codigoBonito, salvar, recuperar, amigos, anotarAmigos, ranking, turmas, criarTurma, entrarTurma, verTurma, convites, linkConvite };
})();
window.Online = Online;
