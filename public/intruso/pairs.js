'use strict';

// Pares para o modo "palavra parecida": a turma recebe uma palavra do par e o intruso recebe a outra.
// Cada categoria de words.js precisa ter sua lista aqui (test/check-words.js confere).
(function (root) {
  const PAIRS = {
    Comidas: [
      'Pizza|Lasanha', 'Coxinha|Kibe', 'Pastel|Esfiha', 'Hambúrguer|Cachorro-quente', 'Sorvete|Picolé', 'Brigadeiro|Beijinho', 'Pudim|Mousse', 'Panqueca|Crepe',
      'Macarrão|Nhoque', 'Sushi|Temaki', 'Bolo de cenoura|Bolo de chocolate', 'Churros|Sonho', 'Waffle|Panqueca americana', 'Torrada|Pão de alho', 'Bife|Picanha',
      'Salsicha|Linguiça', 'Presunto|Mortadela', 'Brownie|Cookie', 'Ketchup|Mostarda', 'Batata frita|Mandioca frita', 'Taco|Burrito', 'Donut|Rosquinha',
    ],
    Animais: [
      'Cachorro|Lobo', 'Gato|Tigre', 'Leão|Onça', 'Jacaré|Crocodilo', 'Golfinho|Baleia', 'Tubarão|Orca', 'Sapo|Perereca', 'Coelho|Hamster',
      'Pato|Ganso', 'Galinha|Peru', 'Abelha|Vespa', 'Borboleta|Mariposa', 'Cavalo|Zebra', 'Camelo|Lhama', 'Coruja|Águia', 'Papagaio|Arara',
      'Macaco|Gorila', 'Cobra|Minhoca', 'Tartaruga|Jabuti', 'Formiga|Cupim', 'Mosquito|Mosca', 'Foca|Pinguim',
    ],
    Lugares: [
      'Praia|Piscina', 'Hospital|Farmácia', 'Escola|Faculdade', 'Shopping|Mercado', 'Cinema|Teatro', 'Padaria|Lanchonete', 'Estádio|Ginásio', 'Biblioteca|Livraria',
      'Zoológico|Aquário', 'Hotel|Pousada', 'Aeroporto|Rodoviária', 'Igreja|Catedral', 'Fazenda|Sítio', 'Museu|Galeria de arte', 'Montanha|Vulcão', 'Rio|Lago',
      'Floresta|Selva', 'Circo|Parque de diversões', 'Delegacia|Prisão', 'Academia|Clube', 'Restaurante|Pizzaria', 'Caverna|Túnel',
    ],
    Profissões: [
      'Médico|Enfermeiro', 'Professor|Diretor', 'Bombeiro|Salva-vidas', 'Pedreiro|Mestre de obras', 'Cozinheiro|Confeiteiro', 'Motorista|Taxista', 'Advogado|Juiz', 'Dentista|Ortodontista',
      'Piloto|Comissário de bordo', 'Padeiro|Pizzaiolo', 'Policial|Detetive', 'Cantor|DJ', 'Fotógrafo|Cineasta', 'Eletricista|Encanador', 'Garçom|Bartender', 'Veterinário|Biólogo',
      'Arquiteto|Engenheiro', 'Mecânico|Borracheiro', 'Cabeleireiro|Barbeiro', 'Jornalista|Apresentador', 'Ator|Dublador', 'Carteiro|Entregador',
    ],
    Objetos: [
      'Guarda-chuva|Guarda-sol', 'Geladeira|Freezer', 'Óculos|Lupa', 'Violão|Guitarra', 'Chave|Cadeado', 'Relógio|Despertador', 'Mochila|Bolsa', 'Travesseiro|Almofada',
      'Tesoura|Faca', 'Ventilador|Ar-condicionado', 'Escada|Banquinho', 'Lanterna|Vela', 'Panela|Frigideira', 'Cadeira|Banco', 'Martelo|Marreta', 'Caneta|Lápis',
      'Celular|Telefone fixo', 'Notebook|Tablet', 'Tênis|Chinelo', 'Boné|Chapéu', 'Garfo|Colher', 'Copo|Caneca',
    ],
    Esportes: [
      'Futebol|Futsal', 'Vôlei|Vôlei de praia', 'Natação|Polo aquático', 'Basquete|Handebol', 'Surfe|Bodyboard', 'Judô|Jiu-jitsu', 'Tênis|Badminton', 'Ciclismo|Mountain bike',
      'Boxe|MMA', 'Skate|Patins', 'Corrida|Caminhada', 'Golfe|Minigolfe', 'Esqui|Snowboard', 'Karatê|Taekwondo', 'Sinuca|Boliche', 'Remo|Canoagem',
      'Escalada|Rapel', 'Yoga|Pilates', 'Musculação|Crossfit', 'Fórmula 1|Kart', 'Rúgbi|Futebol americano', 'Tênis de mesa|Padel',
    ],
    Futebol: [
      'Pênalti|Falta', 'Cartão amarelo|Cartão vermelho', 'Goleiro|Zagueiro', 'Escanteio|Lateral', 'Copa do Mundo|Copa América', 'Libertadores|Champions League', 'Pelé|Maradona', 'Neymar|Vinícius Júnior',
      'Messi|Cristiano Ronaldo', 'Ronaldo Fenômeno|Romário', 'Maracanã|Mineirão', 'Flamengo|Vasco', 'Corinthians|Palmeiras', 'Grêmio|Internacional', 'Real Madrid|Barcelona', 'Trave|Travessão',
      'Árbitro|Bandeirinha', 'Técnico|Capitão', 'Drible|Chapéu', 'Gol contra|Gol olímpico', 'Chuteira|Caneleira', 'Narrador|Comentarista',
    ],
    'Novelas e TV': [
      'Chaves|Chapolin', 'Vilã|Mocinha', 'Big Brother|A Fazenda', 'Jornal Nacional|Fantástico', 'Faustão|Luciano Huck', 'Xuxa|Angélica', 'Silvio Santos|Gugu', 'Bob Esponja|Patrick Estrela',
      'Tom e Jerry|Pica-Pau', 'Pokémon|Digimon', 'Dragon Ball|Naruto', 'Os Simpsons|Family Guy', 'Mickey Mouse|Pato Donald', 'Cebolinha|Cascão', 'Mônica|Magali', 'Peppa Pig|Galinha Pintadinha',
      'Malhação|Rebelde', 'Casamento interrompido|Troca de bebês', 'Herança|Testamento', 'Comercial|Intervalo comercial', 'Reality show|Programa de auditório', 'Sessão da Tarde|Tela Quente',
    ],
    'Comidas regionais': [
      'Acarajé|Abará', 'Vatapá|Caruru', 'Tacacá|Pato no tucupi', 'Baião de dois|Arroz carreteiro', 'Carne de sol|Charque', 'Pamonha|Curau', 'Feijão tropeiro|Tutu de feijão', 'Chimarrão|Tereré',
      'Pão de queijo|Biscoito de polvilho', 'Queijo coalho|Queijo minas', 'Canjica|Mungunzá', 'Cuscuz nordestino|Cuscuz paulista', 'Bolo de rolo|Bolo Souza Leão', 'Goiabada cascão|Doce de abóbora', 'Bobó de camarão|Moqueca capixaba', 'Galinhada|Arroz com pequi',
      'Caipirinha|Caipiroska', 'Bauru|Sanduíche de mortadela', 'Pinhão cozido|Castanha assada', 'Torresmo|Pururuca', 'Rabada|Dobradinha', 'Quentão|Vinho quente',
    ],
    Marcas: [
      'Coca-Cola|Pepsi', 'Nike|Adidas', 'McDonald\'s|Burger King', 'Apple|Samsung', 'Netflix|YouTube', 'Instagram|TikTok', 'WhatsApp|Telegram', 'Uber|99',
      'iFood|Rappi', 'Mercado Livre|Amazon', 'Shopee|Shein', 'Nubank|Itaú', 'PlayStation|Xbox', 'Nescau|Toddy', 'Fanta|Sprite', 'Skol|Brahma',
      'Natura|O Boticário', 'Ferrari|Lamborghini', 'Lego|Playmobil', 'Havaianas|Ipanema', 'Bis|Kit Kat', 'Ruffles|Doritos',
    ],
    'Internet e memes': [
      'Story|Reels', 'Meme|Figurinha', 'Selfie|Foto de perfil', 'Live|Podcast', 'Curtida|Comentário', 'Seguidor|Fã', 'Wi-Fi|Bluetooth', 'Download|Upload',
      'Vírus|Bug', 'Hacker|Golpista', 'Fake news|Corrente de oração', 'Emoji|GIF', 'Influencer|Youtuber', 'Pix|QR code', 'Spoiler|Trailer', 'Minecraft|Roblox',
      'Free Fire|Fortnite', 'Orkut|MSN', 'Discord|Twitch', 'ChatGPT|Robô', 'Senha|Captcha', 'Print|Tela compartilhada',
    ],
    'Filmes e séries': [
      'Titanic|Náufrago', 'Star Wars|Star Trek', 'Harry Potter|O Senhor dos Anéis', 'Jurassic Park|King Kong', 'Matrix|A Origem', 'O Rei Leão|Mogli', 'Toy Story|Monstros S.A.', 'Frozen|Enrolados',
      'Vingadores|Liga da Justiça', 'Velozes e Furiosos|Carros', 'Missão Impossível|007', 'Rocky|Karatê Kid', 'Esqueceram de Mim|Os Caça-Fantasmas', 'Tropa de Elite|Cidade de Deus', 'Stranger Things|Dark', 'La Casa de Papel|Round 6',
      'Friends|The Office', 'Game of Thrones|Vikings', 'Breaking Bad|Narcos', 'Filme de terror|Filme de suspense', 'Legenda|Dublagem', 'Oscar|Tapete vermelho',
    ],
    'Música brasileira': [
      'Samba|Pagode', 'Forró|Piseiro', 'Sertanejo|Moda de viola', 'Axé|Frevo', 'Funk|Rap nacional', 'Bossa nova|MPB', 'Anitta|Ludmilla', 'Ivete Sangalo|Claudia Leitte',
      'Caetano Veloso|Gilberto Gil', 'Tom Jobim|Vinicius de Moraes', 'Legião Urbana|Titãs', 'Skank|Jota Quest', 'Marília Mendonça|Maiara e Maraisa', 'Jorge e Mateus|Henrique e Juliano', 'Zeca Pagodinho|Martinho da Vila', 'Tim Maia|Jorge Ben Jor',
      'Luiz Gonzaga|Dominguinhos', 'Raul Seixas|Rita Lee', 'Sandy e Junior|KLB', 'Racionais MC\'s|Emicida', 'Trio elétrico|Roda de samba', 'Gusttavo Lima|Luan Santana',
    ],
    Personagens: [
      'Batman|Superman', 'Homem-Aranha|Homem de Ferro', 'Hulk|Thor', 'Mario|Luigi', 'Sonic|Pac-Man', 'Pikachu|Ash Ketchum', 'Goku|Vegeta', 'Darth Vader|Voldemort',
      'Yoda|Gandalf', 'Shrek|Fiona', 'Simba|Mufasa', 'Woody|Buzz Lightyear', 'Elsa|Olaf', 'Cinderela|Branca de Neve', 'Ariel|Moana', 'Pernalonga|Patolino',
      'Papai Noel|Coelhinho da Páscoa', 'Saci|Curupira', 'Drácula|Lobisomem', 'Bruxa|Fada do Dente', 'Sherlock Holmes|James Bond', 'Coringa|Arlequina',
    ],
    Bebidas: [
      'Café|Chá', 'Cerveja|Chope', 'Vinho tinto|Vinho branco', 'Espumante|Champanhe', 'Vodca|Gim', 'Tequila|Rum', 'Mojito|Caipirinha', 'Suco de uva|Suco de maracujá',
      'Leite|Achocolatado', 'Água mineral|Água com gás', 'Energético|Isotônico', 'Cappuccino|Latte', 'Chá gelado|Chá mate', 'Quentão|Vinho quente', 'Refrigerante|Guaraná natural', 'Uísque|Conhaque',
      'Smoothie|Milkshake', 'Chocolate quente|Café com leite', 'Piña colada|Batida de coco', 'Suco de laranja|Suco de tangerina', 'Saquê|Licor', 'Margarita|Daiquiri',
    ],
    'Países e cidades': [
      'Brasil|Portugal', 'Argentina|Uruguai', 'Estados Unidos|Canadá', 'França|Itália', 'Espanha|México', 'Alemanha|Áustria', 'Inglaterra|Irlanda', 'Japão|China',
      'Coreia do Sul|Tailândia', 'Egito|Marrocos', 'Austrália|Nova Zelândia', 'Paris|Londres', 'Roma|Veneza', 'Nova York|Las Vegas', 'Tóquio|Seul', 'Rio de Janeiro|Salvador',
      'Recife|Fortaleza', 'Gramado|Campos do Jordão', 'Florianópolis|Balneário Camboriú', 'Lisboa|Madri', 'Dubai|Catar', 'Brasília|Goiânia',
    ],
    Escola: [
      'Prova|Simulado', 'Lousa|Quadro de avisos', 'Giz|Apagador', 'Recreio|Intervalo', 'Merenda|Cantina', 'Diretor|Coordenador', 'Boletim|Caderneta', 'Recuperação|Reprovação',
      'Vestibular|Enem', 'Matemática|Física', 'História|Geografia', 'Português|Inglês', 'Biologia|Química', 'Caderno|Fichário', 'Lápis de cor|Giz de cera', 'Régua|Esquadro',
      'Compasso|Transferidor', 'Formatura|Diploma', 'Excursão|Gincana', 'Dever de casa|Trabalho em grupo', 'Nerd|Bagunceiro', 'Fundão|Primeira fila',
    ],
    'Corpo humano': [
      'Olho|Pálpebra', 'Nariz|Boca', 'Orelha|Tímpano', 'Mão|Pé', 'Dedo|Unha', 'Joelho|Cotovelo', 'Ombro|Quadril', 'Coração|Pulmão',
      'Fígado|Rim', 'Estômago|Intestino', 'Cérebro|Coluna', 'Veia|Artéria', 'Osso|Músculo', 'Cabelo|Barba', 'Bigode|Sobrancelha', 'Dente|Gengiva',
      'Espirro|Tosse', 'Soluço|Arroto', 'Bocejo|Ronco', 'Suor|Lágrima', 'Sarda|Pinta', 'Calcanhar|Tornozelo',
    ],
    'Coisas de casa': [
      'Campainha|Interfone', 'Porta|Janela', 'Maçaneta|Fechadura', 'Telhado|Teto', 'Pia|Tanque', 'Banheira|Box do banheiro', 'Sala de estar|Sala de jantar', 'Portão|Muro',
      'Jardim|Horta', 'Poltrona|Pufe', 'Guarda-roupa|Cômoda', 'Beliche|Berço', 'Edredom|Cobertor', 'Tapete|Capacho', 'Cortina|Persiana', 'Abajur|Lustre',
      'Forno|Air fryer', 'Bule|Jarra', 'Taça|Caneca', 'Detergente|Desinfetante', 'Sabão em pó|Amaciante', 'Lareira|Aquecedor',
    ],
    'Anos 90 e 2000': [
      'Fita VHS|DVD', 'Disquete|CD', 'Walkman|Discman', 'Orelhão|Telefone fixo', 'Nokia tijolão|Celular de flip', 'Lan house|Fliperama', 'Mega Drive|Super Nintendo', 'PlayStation 2|Nintendo 64',
      'Game Boy|Polystation', 'Tazos|Cards de Yu-Gi-Oh', 'Ioiô|Pião', 'Furby|Bichinho virtual', 'Orkut|MSN', 'Kazaa|Winamp', 'Paciência|Campo minado', 'Counter-Strike|GTA San Andreas',
      'Street Fighter|Mortal Kombat', 'Spice Girls|Backstreet Boys', 'Pochete|Mochila de um ombro só', 'Fax|Secretária eletrônica', 'Polaroid|Câmera descartável', 'Locadora|Videocassete',
    ],
  };
  if (typeof module !== 'undefined') module.exports = PAIRS; else root.INTRUSO_PAIRS = PAIRS;
})(this);
