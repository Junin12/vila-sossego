'use strict';
// Prendas da Vila: quem perde a rodada paga uma. Serve o servidor (require) e as telas (window.PRENDAS).
// "familia" é para todas as idades; "turma" é mais vergonhosa, mas sem bebida, palavrão ou nada pesado.
(function (root) {
  const familia = [
    'Imite um bicho até alguém adivinhar qual é 🐒',
    'Fale como um robô até a próxima rodada 🤖',
    'Cante o parabéns em ritmo de sertanejo 🎤',
    'Faça a dancinha da vitória… mesmo tendo perdido 💃',
    'Elogie cada pessoa da roda, uma por uma 🥰',
    'Conte uma piada (ruim também vale) 😂',
    'Imite alguém da roda, sem dizer quem é 🎭',
    'Fale só cantando até a próxima rodada 🎶',
    'Faça 10 polichinelos contando em voz alta 🤸',
    'Diga um trava-língua três vezes bem rápido 👅',
    'Narre a próxima jogada como locutor de futebol ⚽',
    'Faça a cara mais engraçada que conseguir e segure por 5 segundos 🤪',
    'Fale com sotaque de outra região até a próxima rodada 🗣️',
    'Conte a coisa mais engraçada que já aconteceu com você 🙈',
    'Imite um galo cantando no amanhecer 🐓',
    'Desfile como modelo de um lado ao outro da sala 🕺',
    'Diga três coisas boas sobre quem ganhou 🏆',
    'Fique de pé numa perna só até a próxima rodada 🦩',
    'Faça mímica de um filme até alguém adivinhar 🎬',
    'Invente uma música sobre a pessoa à sua direita 🎸',
    'Fale "Vila Sossego" de trás para frente 🔁',
    'Dê um abraço em quem estiver mais perto 🤗',
    'Responda tudo com "com certeza!" até a próxima rodada ✅',
    'Faça o barulho de três instrumentos musicais 🥁',
  ];
  const turma = [
    'Mostre a última foto da sua galeria (pode pular uma) 📱',
    'Conte uma vergonha da época da escola 🎒',
    'Mande um áudio cantando no grupo da turma 🎙️',
    'Imite como você chora assistindo novela 😭',
    'Revele qual é o seu crush famoso 😍',
    'Deixe a turma escolher seu nome no próximo jogo ✍️',
    'Leia em voz alta a última mensagem que você mandou (pode pular uma) 💬',
    'Fale com voz de narrador de documentário até a próxima rodada 🦁',
    'Conte o pior presente que você já ganhou 🎁',
    'Faça uma declaração dramática de amor para o objeto mais perto 💘',
    'Imite um influenciador fazendo publi de algo da mesa 📸',
    'Revele qual música vergonhosa você ouve escondido 🎧',
    'Conte o mico mais recente que você pagou 🙈',
    'Deixe alguém escolher um emoji para você usar de foto por um dia 🤳',
    'Faça um discurso de vencedor do Oscar por ter perdido 🏅',
    'Ligue (de brincadeira) para alguém da roda e cante parabéns 📞',
    ...familia.slice(0, 8),
  ];
  // rnd(n) → inteiro em [0, n)
  function sortear(modoFamilia, rnd) {
    const lista = modoFamilia ? familia : turma;
    return lista[rnd(lista.length)];
  }
  const PRENDAS = { familia, turma, sortear };
  if (typeof module !== 'undefined' && module.exports) module.exports = PRENDAS;
  else root.PRENDAS = PRENDAS;
})(this);
