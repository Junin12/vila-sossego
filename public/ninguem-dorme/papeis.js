'use strict';
// Papéis do Ninguém Dorme. Serve o servidor (require) e a tela (window.NOITE). Expansão = mais papéis aqui.
// time: 'vila' ou 'capangas'; noite: o que faz à noite (null = dorme); sai: aparece "saindo de casa" para a Fofoqueira.
(function (root) {
  const PAPEIS = {
    capanga: { nome: 'Capanga', emoji: '🦹', cor: '#E0565B', time: 'capangas', noite: 'sumir', sai: true,
      desc: 'De noite, combina com os outros capangas quem vai sumir. De dia, finge ser morador honesto.',
      pede: 'Quem vai sumir esta noite?', frase: 'Ninguém viu nada…' },
    delegada: { nome: 'Delegada Rosa', emoji: '🚓', cor: '#3A6FD8', time: 'vila', noite: 'investigar', sai: true,
      desc: 'Toda noite investiga uma pessoa e descobre se ela é capanga.',
      pede: 'Quem você vai investigar?', frase: 'Eu vou descobrir quem foi.' },
    benzedeira: { nome: 'Vó Zefa', emoji: '🌿', cor: '#8E5BC9', time: 'vila', noite: 'benzer', sai: true,
      desc: 'Toda noite cuida de uma pessoa (pode ser você). Se os capangas forem atrás dela, ela não some. Não pode cuidar da mesma pessoa duas noites seguidas.',
      pede: 'De quem você vai cuidar esta noite?', frase: 'Comigo por perto, ninguém some.' },
    fofoqueira: { nome: 'Cotinha', emoji: '👀', cor: '#E8A33A', time: 'vila', noite: 'espiar', sai: true,
      desc: 'Toda noite espia a casa de alguém. De manhã a vila inteira fica sabendo se a pessoa saiu de casa ou dormiu.',
      pede: 'Quem você vai espiar?', frase: 'Eu não falei nada, mas…' },
    prefeito: { nome: 'Prefeito Tonhão', emoji: '🎩', cor: '#E8B33A', time: 'vila', noite: null, sai: false,
      desc: 'Seu voto vale por dois na votação do dia. Ninguém sabe disso.',
      frase: 'Meu voto pesa mais.' },
    vigia: { nome: 'Seu Lima', emoji: '🔦', cor: '#2F9C9A', time: 'vila', noite: 'vigiar', sai: true, extra: true,
      desc: 'Vigia do bairro: toda noite fica de olho na casa de alguém e descobre quem bateu lá.',
      pede: 'Que casa você vai vigiar?', frase: 'Eu vi tudo da minha janela.' },
    bebado: { nome: 'Zé Pinguço', emoji: '🍺', cor: '#B07A3A', time: 'vila', noite: 'investigar', sai: true, extra: true, finge: 'delegada',
      desc: 'Acha que é a Delegada… mas bebeu demais e as investigações dele saem no chute. Ele só descobre no fim!',
      pede: 'Quem você vai investigar?', frase: 'Hic! Eu sou a autoridade aqui.' },
    coveiro: { nome: 'Seu Bento', emoji: '⚰️', cor: '#6B6B8A', time: 'vila', noite: null, sai: false, extra: true,
      desc: 'O coveiro conhece todo defunto: vê o papel verdadeiro de quem sai da vila, mesmo no modo segredo.',
      frase: 'Defunto não mente.' },
    morador: { nome: 'Morador', emoji: '🏠', cor: '#3FA36B', time: 'vila', noite: null, sai: false,
      desc: 'Sem poder especial: só a sua lábia e o seu faro. Descubra os capangas no papo.',
      frase: 'Eu só queria dormir em paz.' },
  };

  // Papéis por número de jogadores (4 a 12). opts.extras liga a expansão (Vigia, Zé Pinguço, Coveiro);
  // o Coveiro só entra quando os papéis de quem sai ficam em segredo (opts.revelar false).
  function distribuir(n, opts = {}) {
    const capangas = n <= 5 ? 1 : n <= 8 ? 2 : 3;
    const out = Array(capangas).fill('capanga');
    out.push('delegada', 'benzedeira');
    if (n >= 6) out.push('fofoqueira');
    if (n >= 8) out.push('prefeito');
    if (opts.extras) {
      if (n >= 7) out.push('vigia');
      if (n >= 9) out.push('bebado');
      if (n >= 10 && opts.revelar === false) out.push('coveiro');
    }
    while (out.length < n) out.push('morador');
    return out.slice(0, n);
  }

  // Noites especiais: a partir da 2ª noite, às vezes a noite vem diferente.
  const ESPECIAIS = {
    lua: { nome: 'Lua cheia', emoji: '🌕', desc: 'Os capangas estão agitados: esta noite podem atacar DUAS pessoas.' },
    festa: { nome: 'Festa junina', emoji: '🎉', desc: 'A vila inteira foi pro arraial. Ninguém sai de casa esta noite!' },
    neblina: { nome: 'Neblina', emoji: '🌫️', desc: 'Amanhã o voto é secreto: ninguém vê em quem os outros votaram até o veredito.' },
  };
  const CASAL = { nome: 'Casal apaixonado', emoji: '💘', desc: 'Dois moradores da vila são apaixonados e sabem disso. Se um sai, o outro sai junto, de saudade.' };

  const NOITE = { PAPEIS, distribuir, ESPECIAIS, CASAL, MIN: 4, MAX: 12 };
  if (typeof module !== 'undefined' && module.exports) module.exports = NOITE;
  else root.NOITE = NOITE;
})(this);
