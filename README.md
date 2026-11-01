# 🏘️ Vila Sossego

Jogos de festa para jogar com a turma, **cada um no seu celular**. Sem turma? Chame **bots**.

| | 🤥 **Cara de Pau** | 🌙 **Ninguém Dorme** |
|---|---|---|
| Estilo | Blefe | Cidade dorme (papéis secretos) |
| Jogadores | 2 a 6 | 4 a 12 |
| Destaques | "Duvido!", lábia secreta, Eventos da Vila | narrador por voz, votação ao vivo, fantasmas |

Os dois compartilham o **Passaporte da Vila**: nível, títulos, 16 conquistas, 8 personagens exclusivos e desafio do dia.

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

Qualquer um: **Bico** (+1), **Mudança** (1: troca um segredo), **Escândalo** (7: alvo perde um segredo; obrigatório com 10+).
**Lábia secreta:** blefes que passam enchem a lábia; cheia, você vence. Pego mentindo, zera.
**Eventos da Vila:** a cada volta, um evento muda as regras (Feira livre, Apagão, Blitz, Quermesse…).

## Ninguém Dorme
Capangas escondidos fazem alguém sumir toda noite. De dia a vila conversa e vota quem sai.
Papéis: 🦹 Capanga, 🚓 Delegada (investiga), 🌿 Vó Zefa (benze/protege), 👀 Cotinha (espia quem saiu de casa),
🎩 Prefeito (voto vale 2, em segredo) e 🏠 Morador. Quem não tem poder conta carneirinhos à noite, para ninguém se entregar.
Quem sai vira fantasma 👻 (vê tudo e conversa com outros fantasmas). O celular de quem cria a sala narra por voz.

## Expansões
Novos moradores/eventos: `public/cara-de-pau/moradores.js`. Novos papéis: `public/ninguem-dorme/papeis.js`.

## Rodar e testar
```
node server.js 3010      # http://localhost:3010
npm test                 # regras, passaporte e partidas inteiras com bots
```
Deploy: Render (Blueprint do `render.yaml`); wiapps.com.br/vila redireciona para lá.
