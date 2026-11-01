# Vila Sossego — Cara de Pau + Ninguém Dorme

Dois jogos de festa no mesmo universo (Vila Sossego), cada jogador no seu celular. Node 18+ sem dependências:
`node server.js` (ou `node server.js 3010`) e abra http://localhost:3000. Leia o README.md antes de começar.

- `salas.js`: salas genéricas (saguão, anfitrião, bots, chat, reações, relógio) usadas pelos dois jogos.
- `cara-de-pau/` e `ninguem-dorme/`: `logica.js` (regras puras, testadas) e `jogo.js` (opções, relógio, bots).
- `public/comum/`: base das telas (`vila.js`), Passaporte da Vila (`perfil.js`), personagens, sons, QR e CSS.
- `public/<jogo>/`: tela de cada jogo; dados de expansão em `moradores.js` e `papeis.js`.

## Regras
- Textos do jogo em português do Brasil.
- Mecânica e textos próprios: não copiar nomes, cartas ou textos de Coup, Werewolf/Lobisomem ou outros jogos.
- Mantenha a stack atual (HTML/JS puro, sem build); não adicione frameworks sem o usuário pedir.
- Rode `npm test` depois de cada mudança (regras, passaporte e partidas inteiras com bots pela API).
- Faça commit das mudanças; push só quando o usuário pedir.
