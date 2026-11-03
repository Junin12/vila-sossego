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

  // Roteiro do narrador (voz do celular, telão ou o narrador humano lê em voz alta).
  // g = visão da partida; n(id) = nome; fam = Modo Família (ninguém "some": os capangas "levam para a casa deles").
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  function sumiuTxt(fam) { return fam ? 'foi levado pelos capangas' : 'sumiu'; }
  function roteiro(g, n, fam) {
    const a = g.anuncio;
    const sumiu = sumiuTxt(fam);
    switch (g.fase) {
      case 'noite':
        if (g.especial === 'festa') return 'Noite de festa na Vila Sossego! Todo mundo no arraial. Hoje ninguém sai de casa.';
        if (g.especial === 'lua') return `Noite ${g.noite}. Lua cheia na Vila Sossego… os capangas estão agitados. Hoje eles podem agir duas vezes. Todo mundo de olhos fechados.`;
        if (g.especial === 'neblina') return `Noite ${g.noite}. Uma neblina cobre a vila. Amanhã, o voto será secreto. Façam sua parte, em silêncio.`;
        return pick([
          `Noite ${g.noite}. A Vila Sossego vai dormir. Todo mundo de olhos fechados. Capangas, Delegada, Vó Zefa e Cotinha: façam sua parte, em silêncio.`,
          'Cai a noite na Vila Sossego. Silêncio total. Quem tem trabalho noturno, mãos à obra. O resto, conte carneirinhos.',
          'Escureceu. Os grilos cantam, as janelas se fecham… e alguém está tramando alguma coisa.']);
      case 'amanhecer': {
        let t = 'Amanheceu na Vila Sossego! ';
        if (a && a.sumiu) t += `Mas… ${n(a.sumiu)} ${sumiu} durante a noite! ${a.papel ? 'Era ' + PAPEIS[a.papel].nome + '.' : ''} `;
        if (a && a.sumiu2) t += `E não foi só isso: ${n(a.sumiu2)} também ${sumiu}! `;
        if (a && a.saudade) t += `E ${n(a.saudade)}, de tanta saudade, foi embora junto. `;
        else if (a && a.salvo) t += `Os capangas agiram, mas a Vó Zefa cuidou da vítima. Ninguém ${sumiu}! `;
        else if (!a || !a.sumiu) t += `Foi uma noite tranquila. Ninguém ${sumiu}. `;
        if (a && a.fofoca) t += `E a Cotinha já espalhou: ${n(a.fofoca.alvo)} ${a.fofoca.saiu ? 'saiu de casa ontem à noite!' : 'ficou em casa a noite inteira.'}`;
        return t;
      }
      case 'dia': return pick(['Hora da conversa. Quem são os capangas?', 'Vamos lá, vila. Alguém aqui está mentindo. Conversem!', 'Debate aberto. Acusações, defesas e muita cara de pau.']);
      case 'votacao': return 'Hora de votar! Apontem quem vai sair da vila.';
      case 'veredito': {
        const v = g.veredito;
        if (v && v.expulso) return `A vila decidiu: ${n(v.expulso)} está fora! ${v.papel ? (v.papel === 'capanga' ? 'Era um capanga! Muito bem.' : 'Era ' + PAPEIS[v.papel].nome + '. Xi…') : ''}${v.saudade ? ` E ${n(v.saudade)} foi junto, de saudade.` : ''}`;
        return v && v.empate ? 'Empate! Ninguém sai hoje.' : 'A vila não se decidiu. Ninguém sai hoje.';
      }
      case 'fim': return g.vencedor === 'vila' ? 'Fim de jogo! Os capangas foram descobertos. A vila venceu!' : 'Fim de jogo! Os capangas tomaram conta da Vila Sossego!';
      default: return '';
    }
  }

  // Vozes do narrador: o mesmo roteiro com outra personalidade (jeito de falar + entonação da voz do aparelho).
  const VOZES = {
    padrao: { nome: 'Narrador da Vila', emoji: '🎙️', rate: 1.02, pitch: 0.92, antes: [''], depois: [''] },
    vo: { nome: 'Vó Contadora', emoji: '👵', rate: 0.9, pitch: 1.2, premium: true,
      antes: ['Ai, meus netinhos… ', 'Senta aqui que a vó conta: ', 'Pois é, no meu tempo era assim: '], depois: [' …e não esqueçam o casaco!', ' Ai, ai, essa vila…', ''] },
    locutor: { nome: 'Locutor de Futebol', emoji: '📣', rate: 1.25, pitch: 1.05, premium: true,
      antes: ['ATENÇÃO, VILA SOSSEGO! ', 'É AGORA, MINHA GENTE! ', 'OLHA ELE, OLHA ELE! '], depois: [' QUE JOGOOOO!', ' Tá lá o lance!', ' Segue o jogo!'] },
    terror: { nome: 'Voz do Além', emoji: '👻', rate: 0.78, pitch: 0.55, premium: true,
      antes: ['Shhh… escutem… ', 'Na escuridão da vila… ', 'Alguém está ouvindo os passos? '], depois: [' …muahahaha.', ' …e o silêncio voltou.', ''] },
    reporter: { nome: 'Plantão da Vila', emoji: '📺', rate: 1.12, pitch: 1.05, premium: true,
      antes: ['Plantão da Vila Sossego! ', 'Interrompemos a programação: ', 'Notícia urgente: '], depois: [' Voltamos a qualquer momento.', ' Fiquem ligados.', ''] },
  };

  // Mistérios da Vila: partidas com história (capítulo a cada noite, final próprio). Mesmas regras, mais clima.
  const MISTERIOS = {
    taca: { nome: 'O Sumiço da Taça', emoji: '🏆', premium: true,
      sinopse: 'A taça do campeonato de bocha sumiu da prefeitura na véspera da final. Os capangas querem vender a taça na cidade vizinha.',
      noites: ['Na prefeitura, a vitrine da taça amanheceu vazia. Pegadas de lama levam até a praça…',
        'Alguém viu uma sombra carregando um saco pesado perto da estação…',
        'Um bilhete apareceu debaixo da porta da padaria: "A taça vale mais que a vila".',
        'O cachorro do Seu Lima latiu a noite inteira para o celeiro abandonado…',
        'A final é amanhã. Se a taça não aparecer, a vila perde o campeonato!'],
      vila: 'A taça foi encontrada no celeiro, embrulhada num pano de prato bordado! A final vai acontecer e a vila comemora!',
      capangas: 'Os capangas fugiram de madrugada com a taça. A vila vai jogar a final… com um troféu de papelão.' },
    radio: { nome: 'A Rádio Pirata', emoji: '📻', premium: true,
      sinopse: 'Toda madrugada uma rádio pirata conta os segredos da vila. Os capangas estão por trás disso para espalhar a confusão.',
      noites: ['À meia-noite, o rádio de pilha da Vó Zefa chiou: "Boa noite, Vila Sossego… eu sei o que vocês fizeram"…',
        'A rádio pirata contou que alguém da vila tem medo de galinha. Ninguém dormiu de vergonha…',
        'Um fio de antena foi visto saindo da torre da igreja até a casa de alguém…',
        'A transmissão de hoje falou o nome de cada morador, um por um. Arrepio geral.',
        'O sinal está mais forte do que nunca. A rádio diz que amanhã revela o maior segredo da vila…'],
      vila: 'A antena foi arrancada e a rádio pirata saiu do ar! Os segredos da vila estão a salvo… por enquanto.',
      capangas: 'A rádio pirata virou a mais ouvida da região. Agora todo mundo sabe de tudo da Vila Sossego!' },
    bolo: { nome: 'O Concurso de Bolos', emoji: '🎂', premium: true,
      sinopse: 'O famoso concurso de bolos da vila está sendo sabotado: alguém troca o açúcar por sal. Os capangas querem o prêmio de qualquer jeito.',
      noites: ['A cozinha comunitária amanheceu com farinha no chão e uma colher de pau perdida…',
        'O bolo de fubá da Dona Bitinha apareceu com gosto de mar. Sabotagem!',
        'Alguém viu luz acesa na cozinha às três da manhã e cheiro de cobertura queimada…',
        'O livro de receitas da vila sumiu. Sem receita, ninguém acerta o ponto!',
        'Amanhã é o julgamento dos bolos. Quem não for pego até lá vai levar a faixa de campeão…'],
      vila: 'O sabotador foi desmascarado com farinha até nas orelhas! O concurso volta e o bolo de fubá leva o prêmio!',
      capangas: 'Os capangas ganharam o concurso com um bolo comprado na padaria da cidade. Que vergonha para a vila!' },
  };

  // aplica a voz (escolhe o começo e o fim do jeito daquela personalidade) e o capítulo do mistério
  function narrar(g, n, fam, voz, misterio) {
    const v = VOZES[voz] || VOZES.padrao;
    const m = MISTERIOS[misterio];
    let t = roteiro(g, n, fam);
    if (m && g.fase === 'noite') t = (g.noite === 1 ? `${m.nome}. ${m.sinopse} ` : '') + m.noites[(g.noite - 1) % m.noites.length] + ' ' + t;
    if (m && g.fase === 'fim') t += ' ' + (g.vencedor === 'vila' ? m.vila : m.capangas);
    return { texto: `${pick(v.antes)}${t}${pick(v.depois)}`.trim(), rate: v.rate, pitch: v.pitch };
  }

  const NOITE = { PAPEIS, distribuir, ESPECIAIS, CASAL, VOZES, MISTERIOS, roteiro, narrar, sumiuTxt, MIN: 4, MAX: 12 };
  if (typeof module !== 'undefined' && module.exports) module.exports = NOITE;
  else root.NOITE = NOITE;
})(this);
