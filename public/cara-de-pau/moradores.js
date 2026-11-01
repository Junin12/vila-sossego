'use strict';
// Moradores da Vila Sossego e as ações do Cara de Pau. Serve o servidor (require) e a tela (window.VILA).
// Expansão nova = mais moradores e ações aqui; a lógica lê tudo deste arquivo.
(function (root) {
  const MORADORES = {
    prefeito: { nome: 'Prefeito Tonhão', curto: 'Prefeito', emoji: '🎩', cor: '#E8B33A', acao: 'verba', bloqueia: [],
      frase: 'Verba pública é pra isso mesmo.' },
    agiota: { nome: 'Seu Agenor', curto: 'Agiota', emoji: '💰', cor: '#3FA36B', acao: 'cobranca', bloqueia: [],
      frase: 'Juros? Só um pouquinho.' },
    delegada: { nome: 'Delegada Rosa', curto: 'Delegada', emoji: '🚓', cor: '#3A6FD8', acao: 'prisao', bloqueia: ['cobranca'],
      frase: 'Aqui ninguém cobra ninguém.' },
    benzedeira: { nome: 'Vó Zefa', curto: 'Benzedeira', emoji: '🌿', cor: '#8E5BC9', acao: 'reza', bloqueia: ['fofoca'],
      frase: 'Contra mau-olhado eu tenho reza.' },
    fofoqueira: { nome: 'Cotinha', curto: 'Fofoqueira', emoji: '👀', cor: '#E0565B', acao: 'fofoca', bloqueia: [],
      frase: 'Eu não falei nada, mas…' },
    // Expansão Feira (opção da sala)
    feirante: { nome: 'Dona Neide', curto: 'Feirante', emoji: '🍉', cor: '#E2793A', acao: 'pechincha', bloqueia: [], extra: 'feira',
      frase: 'Pra você eu faço um precinho.' },
    padre: { nome: 'Padre Quinzinho', curto: 'Padre', emoji: '⛪', cor: '#5B6BC9', acao: 'confissao', bloqueia: ['prisao'], extra: 'feira',
      frase: 'Na igreja ninguém é preso, meu filho.' },
  };

  // custo: moedas pagas ao anunciar; carta: morador que precisa ter (senão é blefe); alvo: escolhe um jogador.
  const ACOES = {
    bico: { nome: 'Fazer um bico', custo: 0, desc: 'Ganha 1 moeda. Ninguém pode impedir.' },
    mudanca: { nome: 'Mudança', custo: 1, desc: 'Paga 1 e troca um dos seus segredos por outro do baralho.' },
    escandalo: { nome: 'Escândalo', custo: 7, alvo: true, desc: 'Paga 7 e o alvo perde um segredo. Ninguém impede.' },
    verba: { nome: 'Verba pública', custo: 0, carta: 'prefeito', desc: 'Pega 3 moedas.' },
    cobranca: { nome: 'Cobrança', custo: 0, carta: 'agiota', alvo: true, desc: 'Tira até 2 moedas de alguém.' },
    prisao: { nome: 'Prisão', custo: 3, carta: 'delegada', alvo: true,
      desc: 'Paga 3. O alvo não pode duvidar nem bloquear, e na vez dele só faz bico.' },
    reza: { nome: 'Reza forte', custo: 5, carta: 'benzedeira', desc: 'Paga 5 e recupera um segredo perdido.' },
    fofoca: { nome: 'Fofoca', custo: 3, carta: 'fofoqueira', alvo: true, desc: 'Paga 3 e o alvo perde um segredo.' },
    pechincha: { nome: 'Pechincha', custo: 0, carta: 'feirante', desc: 'Pega 1 moeda de cada jogador mais rico que você (até 3).' },
    confissao: { nome: 'Confissão', custo: 1, carta: 'padre', alvo: true, desc: 'Paga 1 e espia um segredo do alvo (só você vê).' },
    labia: { nome: 'Vitória na lábia', custo: 0, desc: 'Você enganou a vila vezes suficientes. Ganha o jogo!' },
  };

  // Modo "Eventos da Vila": a cada volta da mesa sai um evento que muda as regras daquela volta.
  // bico: quanto rende; inicio: moedas para todos; custos: preço novo de ações; semDuvida: ninguém pode duvidar.
  const EVENTOS = {
    feira: { nome: 'Feira livre', emoji: '🍉', desc: 'Bico rende 2 moedas nesta volta.', bico: 2 },
    pagamento: { nome: 'Dia de pagamento', emoji: '💸', desc: 'Todo mundo ganhou 1 moeda.', inicio: 1 },
    apagao: { nome: 'Apagão', emoji: '🕯️', desc: 'No escuro ninguém pode duvidar. Blefe à vontade!', semDuvida: true },
    quermesse: { nome: 'Quermesse', emoji: '🎪', desc: 'Reza forte custa só 3.', custos: { reza: 3 } },
    eleicao: { nome: 'Ano de eleição', emoji: '🗳️', desc: 'Escândalo custa só 5.', custos: { escandalo: 5 } },
    missa: { nome: 'Missa de domingo', emoji: '⛪', desc: 'Fofoca custa 5: ficou feio falar dos outros.', custos: { fofoca: 5 } },
    blitz: { nome: 'Blitz da Delegada', emoji: '🚨', desc: 'Prisão custa só 1.', custos: { prisao: 1 } },
    calmaria: { nome: 'Calmaria', emoji: '☀️', desc: 'Nada de diferente. Por enquanto…' },
  };

  // Moradores de uma partida: os básicos e, com a Feira ligada, os da expansão.
  const moradoresDa = (feira) => Object.keys(MORADORES).filter((k) => !MORADORES[k].extra || (feira && MORADORES[k].extra === 'feira'));

  const VILA = { MORADORES, ACOES, EVENTOS, moradoresDa, COPIAS: 3, MOEDAS_INICIO: 2, MOEDAS_RELAMPAGO: 3, ESCANDALO_OBRIGATORIO: 10 };
  if (typeof module !== 'undefined' && module.exports) module.exports = VILA;
  else root.VILA = VILA;
})(this);
