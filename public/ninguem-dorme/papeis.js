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
      desc: 'Toda noite benze uma pessoa (pode ser você). Se os capangas forem atrás dela, ela não some. Não pode benzer a mesma pessoa duas noites seguidas.',
      pede: 'Quem você vai benzer?', frase: 'Contra mau-olhado eu tenho reza.' },
    fofoqueira: { nome: 'Cotinha', emoji: '👀', cor: '#E8A33A', time: 'vila', noite: 'espiar', sai: true,
      desc: 'Toda noite espia a casa de alguém. De manhã a vila inteira fica sabendo se a pessoa saiu de casa ou dormiu.',
      pede: 'Quem você vai espiar?', frase: 'Eu não falei nada, mas…' },
    prefeito: { nome: 'Prefeito Tonhão', emoji: '🎩', cor: '#E8B33A', time: 'vila', noite: null, sai: false,
      desc: 'Seu voto vale por dois na votação do dia. Ninguém sabe disso.',
      frase: 'Meu voto pesa mais.' },
    morador: { nome: 'Morador', emoji: '🏠', cor: '#3FA36B', time: 'vila', noite: null, sai: false,
      desc: 'Sem poder especial: só a sua lábia e o seu faro. Descubra os capangas no papo.',
      frase: 'Eu só queria dormir em paz.' },
  };

  // Papéis por número de jogadores (4 a 12).
  function distribuir(n) {
    const capangas = n <= 5 ? 1 : n <= 8 ? 2 : 3;
    const out = Array(capangas).fill('capanga');
    out.push('delegada', 'benzedeira');
    if (n >= 6) out.push('fofoqueira');
    if (n >= 8) out.push('prefeito');
    while (out.length < n) out.push('morador');
    return out.slice(0, n);
  }

  const NOITE = { PAPEIS, distribuir, MIN: 4, MAX: 12 };
  if (typeof module !== 'undefined' && module.exports) module.exports = NOITE;
  else root.NOITE = NOITE;
})(this);
