# 🏘️ Vila Sossego

Jogos de festa para jogar com a turma, **cada um no seu celular**. Sem turma? Chame **bots**.

| | 🤥 **Cara de Pau** | 🌙 **Ninguém Dorme** | 🕵️ **Intruso** |
|---|---|---|---|
| Estilo | Blefe | Cidade dorme (papéis secretos) | Ache o impostor (palavra secreta) |
| Jogadores | 2 a 6 | 4 a 12 | 3 a 10 |
| Destaques | "Duvido!", lábia secreta, Eventos, Feira, Relâmpago, Duplas | narrador por voz, votação ao vivo, fantasmas, papéis novos, casal, noites especiais | palavra parecida, cúmplice, lista da turma, 1 celular só |

Os três compartilham o **Passaporte da Vila**: nível, títulos, 20 conquistas, 8 personagens exclusivos, desafio do dia,
**temporada do mês** (3 metas com tema, selo e XP) e código para **trocar de celular**.
Nas salas: **Jogar agora com bots**, **placar da noite** (vitórias somadas a cada revanche), **frases prontas** e
botões de acusar no chat, e **Contar pra turma** (resultado para o WhatsApp).

## Cara de Pau
Cada um esconde 2 segredos (moradores) e começa com 2 moedas. Na sua vez, faça uma ação; as de morador podem ser **blefe**.
Qualquer um grita **"Duvido!"**: quem errar perde um segredo. Perdeu os dois, saiu da vila.

| Morador | Ação | Bloqueia |
|---|---|---|
| 🎩 Prefeito Tonhão | Verba pública: +3 moedas | — |
| 💰 Seu Agenor (Agiota) | Cobrança: tira até 2 moedas | — |
| 🚓 Delegada Rosa | Prisão (3): o alvo não reage e na vez só faz bico | Cobrança |
| 🌿 Vó Zefa (Benzedeira) | Reza forte (5): recupera um segredo | Fofoca |
| 👀 Cotinha (Fofoqueira) | Fofoca (3): o alvo perde um segredo | — |
| 🍉 Dona Neide (Feirante) · *Feira* | Pechincha: 1 moeda de cada mais rico (até 3) | — |
| ⛪ Padre Quinzinho · *Feira* | Confissão (1): espia um segredo do alvo | Prisão |

Qualquer um: **Bico** (+1), **Mudança** (1: troca um segredo), **Escândalo** (7: alvo perde um segredo; obrigatório com 10+).
**Lábia secreta:** blefes que passam enchem a lábia; cheia, você vence. Pego mentindo, zera.
**Eventos da Vila:** a cada volta, um evento muda as regras (Feira livre, Apagão, Blitz, Quermesse…).
**Modos:** ⚡ Relâmpago (1 segredo, 3 moedas) e 🤝 Duplas (4 ou 6: parceiros em frente, veem os segredos um do outro e vencem juntos).

## Ninguém Dorme
Capangas escondidos fazem alguém sumir toda noite. De dia a vila conversa e vota quem sai.
Papéis: 🦹 Capanga, 🚓 Delegada (investiga), 🌿 Vó Zefa (cuida/protege), 👀 Cotinha (espia quem saiu de casa),
🎩 Prefeito (voto vale 2, em segredo) e 🏠 Morador. Quem não tem poder conta carneirinhos à noite, para ninguém se entregar.
Quem sai vira fantasma 👻 (vê tudo e conversa com outros fantasmas). O celular de quem cria a sala narra por voz.
**Papéis novos** (opção): 🔦 Seu Lima, o Vigia (vê quem bateu na casa), 🍺 Zé Pinguço (acha que é a Delegada e chuta),
⚰️ Seu Bento, o Coveiro (vê o papel de quem sai, no modo segredo) e 💘 Casal apaixonado (se um sai, o outro sai junto).
**Noites especiais** (opção): 🌕 Lua cheia (capangas atacam duas), 🎉 Festa junina (ninguém sai), 🌫️ Neblina (voto secreto).

## Intruso
Veio do repositório `Junin12/Intruso` (que agora guarda só o app Android e a loja). Roda em `/intruso/` com servidor
próprio (`intruso/servidor.js`), perfil próprio e o Passaporte da Vila: cada partida (as rodadas até o placar final) soma XP,
conquistas, desafio do dia e temporada. O endereço antigo `intruso-eaza.onrender.com` redireciona para cá.

## Expansões
Novos moradores/eventos: `public/cara-de-pau/moradores.js`. Novos papéis: `public/ninguem-dorme/papeis.js`.

## Rodar e testar
```
node server.js 3010      # http://localhost:3010
npm test                 # regras, passaporte e partidas inteiras com bots
```
Deploy: Render (Blueprint do `render.yaml`, auto-deploy do `main`).

## Endereço wiapps.com.br/vila
O jogo roda no Render (https://vila-sossego.onrender.com). A pasta `cpanel-vila/` vai em `public_html/vila` no cPanel: a página "Acordando a vila…" chama o servidor até ele responder (o plano grátis dorme) e entra mantendo o caminho e o código da sala.
