'use strict';
// Intruso Diário: um desafio por dia, igual para todo mundo. Cada desafio tem a palavra secreta, 4 opções para o palpite,
// as dicas de quem sabe a palavra (2 rodadas) e as do intruso, que blefa com dicas vagas.
// Formato: [categoria, palavra, [3 outras opções], [[dica1, dica2] x 4 de quem sabe], [dica1, dica2 do intruso]]
(function (root) {
  const D = [
    ['Lugares', 'Praia', ['Piscina', 'Lago', 'Cachoeira'], [['Areia', 'Guarda-sol'], ['Onda', 'Coqueiro'], ['Protetor', 'Canga'], ['Sal', 'Conchinha']], ['Água', 'Verão']],
    ['Comidas', 'Pizza', ['Lasanha', 'Pastel', 'Esfiha'], [['Borda', 'Fatia'], ['Forno a lenha', 'Calabresa'], ['Delivery', 'Muçarela'], ['Redonda', 'Orégano']], ['Queijo', 'Massa']],
    ['Esportes', 'Futebol', ['Vôlei', 'Basquete', 'Handebol'], [['Gol', 'Chuteira'], ['Escanteio', 'Juiz'], ['Pelada', 'Trave'], ['Torcida', 'Impedimento']], ['Bola', 'Time']],
    ['Profissões', 'Dentista', ['Médico', 'Enfermeiro', 'Veterinário'], [['Cárie', 'Broca'], ['Aparelho', 'Sorriso'], ['Obturação', 'Escova'], ['Canal', 'Siso']], ['Consultório', 'Jaleco']],
    ['Coisas de casa', 'Geladeira', ['Fogão', 'Micro-ondas', 'Freezer'], [['Gelo', 'Porta'], ['Ímã', 'Gaveta de verdura'], ['Frio', 'Pote'], ['Luzinha', 'Congelador']], ['Cozinha', 'Tomada']],
    ['Animais', 'Elefante', ['Rinoceronte', 'Hipopótamo', 'Girafa'], [['Tromba', 'Marfim'], ['Orelhão', 'Memória'], ['Manada', 'Amendoim'], ['Cinzento', 'Presa']], ['Grande', 'Savana']],
    ['Lugares', 'Escola', ['Biblioteca', 'Faculdade', 'Creche'], [['Recreio', 'Uniforme'], ['Chamada', 'Lousa'], ['Merenda', 'Sinal'], ['Prova', 'Diretor']], ['Livro', 'Estudar']],
    ['Comidas', 'Brigadeiro', ['Beijinho', 'Pudim', 'Bolo de chocolate'], [['Granulado', 'Forminha'], ['Panela', 'Colher'], ['Leite condensado', 'Bolinha'], ['Enrolar', 'Chocolate']], ['Doce', 'Aniversário']],
    ['Lugares', 'Cinema', ['Teatro', 'Shopping', 'Estádio'], [['Pipoca', 'Telona'], ['Ingresso', 'Trailer'], ['Poltrona', '3D'], ['Escurinho', 'Sessão']], ['Fila', 'Fim de semana']],
    ['Objetos', 'Guarda-chuva', ['Capa de chuva', 'Galocha', 'Toldo'], [['Abrir', 'Vareta'], ['Esquecido', 'Cabo'], ['Pingando', 'Dobrável'], ['Virou com o vento', 'Sombrinha']], ['Chuva', 'Proteger']],
    ['Transporte', 'Avião', ['Helicóptero', 'Foguete', 'Balão'], [['Asa', 'Turbina'], ['Aeroporto', 'Piloto'], ['Decolar', 'Comissária'], ['Janelinha', 'Cinto']], ['Céu', 'Viagem']],
    ['Música', 'Violão', ['Guitarra', 'Cavaquinho', 'Ukulele'], [['Cordas de náilon', 'Dedilhar'], ['Fogueira', 'Roda de amigos'], ['Acústico', 'Afinar'], ['Serenata', 'Palheta']], ['Música', 'Tocar']],
    ['Profissões', 'Bombeiro', ['Policial', 'Salva-vidas', 'Socorrista'], [['Mangueira', 'Escada'], ['Caminhão vermelho', 'Incêndio'], ['Capacete', 'Resgate'], ['Gato na árvore', 'Hidrante']], ['Herói', 'Uniforme']],
    ['Comidas', 'Banana', ['Maçã', 'Mamão', 'Manga'], [['Casca', 'Cacho'], ['Macaco', 'Escorregar'], ['Prata', 'Nanica'], ['Vitamina', 'Amarela']], ['Fruta', 'Feira']],
    ['Lugares', 'Hospital', ['Farmácia', 'Clínica', 'Posto de saúde'], [['Maca', 'Plantão'], ['UTI', 'Ambulância'], ['Cirurgia', 'Internação'], ['Corredor branco', 'Soro']], ['Médico', 'Saúde']],
    ['Objetos', 'Relógio', ['Despertador', 'Cronômetro', 'Ampulheta'], [['Ponteiro', 'Pulso'], ['Pilha', 'Hora'], ['Tic-tac', 'Corda'], ['Atrasado', 'Pulseira']], ['Tempo', 'Parede']],
    ['Animais', 'Girafa', ['Zebra', 'Camelo', 'Avestruz'], [['Pescoço', 'Manchas'], ['Alta', 'Copa das árvores'], ['Língua roxa', 'Chifrinhos'], ['Pernas compridas', 'Malhada']], ['África', 'Zoológico']],
    ['Comidas', 'Pipoca', ['Algodão-doce', 'Amendoim', 'Batata frita'], [['Milho', 'Estourar'], ['Cinema', 'Panela'], ['Manteiga', 'Saquinho'], ['Micro-ondas', 'Piruá']], ['Salgadinho', 'Petisco']],
    ['Transporte', 'Bicicleta', ['Patinete', 'Skate', 'Moto'], [['Pedal', 'Corrente'], ['Rodinha', 'Selim'], ['Ciclovia', 'Guidão'], ['Pneu furado', 'Campainha']], ['Rodas', 'Passeio']],
    ['Esportes', 'Natação', ['Mergulho', 'Polo aquático', 'Surfe'], [['Piscina', 'Touca'], ['Raia', 'Óculos'], ['Braçada', 'Crawl'], ['Borboleta', 'Nado de costas']], ['Água', 'Olimpíada']],
    ['Profissões', 'Padeiro', ['Confeiteiro', 'Cozinheiro', 'Açougueiro'], [['Pão francês', 'Madrugada'], ['Forno', 'Fermento'], ['Farinha', 'Sovar'], ['Padaria', 'Sonho']], ['Avental', 'Balcão']],
    ['Lugares', 'Biblioteca', ['Livraria', 'Escola', 'Museu'], [['Silêncio', 'Empréstimo'], ['Estante', 'Ficha'], ['Carimbo de data', 'Devolver'], ['Leitura', 'Prateleira']], ['Livros', 'Estudo']],
    ['Animais', 'Coruja', ['Morcego', 'Gavião', 'Papagaio'], [['Noite', 'Olhos grandes'], ['Pio', 'Gira a cabeça'], ['Sábia', 'Penas'], ['Uh-uh', 'Celeiro']], ['Ave', 'Bico']],
    ['Comidas', 'Chocolate', ['Sorvete', 'Bala', 'Pirulito'], [['Cacau', 'Barra'], ['Derrete', 'Quadradinho'], ['Amargo', 'Ao leite'], ['Bombom', 'Trufa']], ['Doce', 'Embalagem']],
    ['Transporte', 'Ônibus', ['Metrô', 'Trem', 'Van'], [['Ponto', 'Cobrador'], ['Catraca', 'Motorista'], ['Lotado', 'Passagem'], ['Linha', 'Dar sinal']], ['Cidade', 'Viagem']],
    ['Coisas de casa', 'Fogão', ['Forno elétrico', 'Micro-ondas', 'Churrasqueira'], [['Boca', 'Chama'], ['Gás', 'Botijão'], ['Panela', 'Acendedor'], ['Cozinhar', 'Grelha']], ['Cozinha', 'Calor']],
    ['Animais', 'Tartaruga', ['Jabuti', 'Caramujo', 'Lagarto'], [['Casco', 'Lenta'], ['Mar', 'Ovos na areia'], ['Esconde a cabeça', 'Centenária'], ['Corrida com a lebre', 'Nadadeira']], ['Verde', 'Réptil']],
    ['Lugares', 'Mercado', ['Feira', 'Padaria', 'Shopping'], [['Carrinho', 'Caixa'], ['Corredor', 'Promoção'], ['Sacola', 'Prateleira'], ['Fila', 'Gôndola']], ['Compras', 'Dinheiro']],
    ['Profissões', 'Professor', ['Diretor', 'Aluno', 'Tutor'], [['Giz', 'Prova'], ['Lição', 'Chamada'], ['Sala de aula', 'Corrigir'], ['Quadro', 'Aula']], ['Escola', 'Livro']],
    ['Comidas', 'Sorvete', ['Picolé', 'Milk-shake', 'Açaí'], [['Casquinha', 'Bola'], ['Derreter', 'Gelado'], ['Sabor', 'Cobertura'], ['Massa de flocos', 'Pote']], ['Doce', 'Calor']],
    ['Animais', 'Cachorro', ['Gato', 'Lobo', 'Raposa'], [['Latir', 'Coleira'], ['Osso', 'Abanar o rabo'], ['Passeio', 'Ração'], ['Fiel', 'Focinho']], ['Pelo', 'Estimação']],
    ['Objetos', 'Celular', ['Telefone fixo', 'Tablet', 'Rádio'], [['Bateria', 'Tela'], ['Carregador', 'Aplicativo'], ['Selfie', 'Notificação'], ['Capinha', 'Wi-fi']], ['Ligar', 'Bolso']],
    ['Lugares', 'Circo', ['Parque de diversões', 'Zoológico', 'Teatro'], [['Palhaço', 'Lona'], ['Trapézio', 'Malabarista'], ['Picadeiro', 'Mágico'], ['Respeitável público', 'Equilibrista']], ['Espetáculo', 'Crianças']],
    ['Coisas de casa', 'Travesseiro', ['Cobertor', 'Colchão', 'Almofada'], [['Fronha', 'Cabeça'], ['Pena', 'Dormir'], ['Fofo', 'Cama'], ['Babar', 'Afundar']], ['Quarto', 'Macio']],
    ['Esportes', 'Basquete', ['Vôlei', 'Handebol', 'Futsal'], [['Cesta', 'Enterrada'], ['Aro', 'Três pontos'], ['Quicar', 'Garrafão'], ['Rebote', 'Tabela']], ['Quadra', 'Time']],
    ['Animais', 'Abelha', ['Vespa', 'Borboleta', 'Formiga'], [['Mel', 'Colmeia'], ['Ferrão', 'Rainha'], ['Zumbido', 'Pólen'], ['Favo', 'Apicultor']], ['Inseto', 'Flor']],
    ['Comidas', 'Bolo', ['Torta', 'Pudim', 'Pão'], [['Vela', 'Fatia'], ['Cobertura', 'Forma'], ['Recheio', 'Parabéns'], ['Fermento', 'Assar']], ['Doce', 'Festa']],
    ['Profissões', 'Cabeleireiro', ['Barbeiro', 'Manicure', 'Maquiador'], [['Tesoura', 'Secador'], ['Escova', 'Franja'], ['Tintura', 'Salão'], ['Corte', 'Chapinha']], ['Beleza', 'Cadeira']],
    ['Lugares', 'Montanha', ['Vulcão', 'Colina', 'Serra'], [['Pico', 'Escalar'], ['Neve no topo', 'Trilha'], ['Altitude', 'Cume'], ['Alpinista', 'Ar rarefeito']], ['Natureza', 'Paisagem']],
    ['Objetos', 'Espelho', ['Janela', 'Vidro', 'Quadro'], [['Reflexo', 'Banheiro'], ['Quebrar', 'Azar'], ['Penteadeira', 'Retrovisor'], ['Selfie', 'Embaçado']], ['Parede', 'Moldura']],
    ['Animais', 'Leão', ['Tigre', 'Onça', 'Leopardo'], [['Juba', 'Rugido'], ['Rei da selva', 'Leoa'], ['Simba', 'Savana'], ['Caça zebra', 'Bando']], ['Felino', 'Garras']],
    ['Lugares', 'Piscina', ['Praia', 'Lago', 'Banheira'], [['Cloro', 'Trampolim'], ['Boia', 'Borda'], ['Azulejo', 'Raia'], ['Parte funda', 'Prancha de isopor']], ['Água', 'Nadar']],
    ['Coisas de casa', 'Vassoura', ['Rodo', 'Pá de lixo', 'Aspirador'], [['Varrer', 'Cerdas'], ['Bruxa', 'Cabo'], ['Poeira', 'Cisco'], ['Atrás da porta', 'Canto']], ['Limpeza', 'Chão']],
    ['Personagens', 'Pirata', ['Marinheiro', 'Capitão', 'Viking'], [['Tapa-olho', 'Papagaio'], ['Tesouro', 'Mapa'], ['Perna de pau', 'Navio'], ['Gancho', 'Bandeira de caveira']], ['Mar', 'Aventura']],
    ['Coisas de casa', 'Sofá', ['Poltrona', 'Cama', 'Rede'], [['Almofada', 'Controle remoto'], ['Cochilo', 'Assento'], ['Moedas perdidas', 'Visita'], ['Novela', 'Braço']], ['Sala', 'Confortável']],
  ];
  // começa em 01/11/2026 (desafio #1)
  const INICIO = Date.UTC(2026, 10, 1);
  const SUSPEITOS = [['Dona Bitinha', 1], ['Robertão', 2], ['Tião', 5], ['Cida', 7], ['Nestor', 9], ['Jurema', 4], ['Zé Bot', 10], ['Lurdinha', 6]];

  // número do desafio de uma data local (1 = 01/11/2026)
  function numero(d = new Date()) {
    return Math.floor((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - INICIO) / 86400000) + 1;
  }
  // sorteio com semente (igual para todo mundo no mesmo dia)
  function semente(n) {
    let x = (n * 2654435761) >>> 0;
    return (m) => { x = (x * 1103515245 + 12345) >>> 0; return (x >>> 8) % m; };
  }
  function embaralha(arr, r) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = r(i + 1); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }
  // desafio do dia n: 5 suspeitos (um é o intruso) e 4 opções de palavra
  function doDia(n) {
    const k = ((n - 1) * 7) % D.length;   // 7 e o total não têm divisor comum: passa por todos antes de repetir
    const [cat, palavra, outras, sabem, blefe] = D[(k + D.length) % D.length];
    const r = semente(n);
    const gente = embaralha(SUSPEITOS, r).slice(0, 5);
    const dicas = embaralha([...sabem.map((d) => ({ d, intruso: false })), { d: blefe, intruso: true }], r);
    return {
      n, cat, palavra,
      opcoes: embaralha([palavra, ...outras], r),
      suspeitos: dicas.map((x, i) => ({ nome: gente[i][0], avatar: gente[i][1], dicas: x.d, intruso: x.intruso })),
    };
  }
  // texto para compartilhar (estilo "quadradinhos")
  function resultadoTexto(n, res) {
    const intr = res.tentativas === 1 ? '🟩' : res.tentativas === 2 ? '🟨' : '🟥';
    return [`🕵️ Intruso Diário #${n}`, `Intruso: ${intr}  Palavra: ${res.palavra ? '🟩' : '🟥'}${res.estrela ? '  ⭐' : ''}`,
      res.sequencia > 1 ? `🔥 ${res.sequencia} dias seguidos` : null, 'wiapps.com.br/vila/diario'].filter(Boolean).join('\n');
  }

  const DIARIO = { D, INICIO, numero, doDia, resultadoTexto };
  if (typeof module !== 'undefined' && module.exports) module.exports = DIARIO;
  else root.DIARIO = DIARIO;
})(this);
