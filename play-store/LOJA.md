# Play Store: Ninguém Dorme e Intruso (Vila Sossego)

Dois apps separados na loja (cada um aparece na sua busca), por dentro o mesmo servidor e o mesmo Passaporte da Vila.

| | Ninguém Dorme | Intruso |
|---|---|---|
| Pacote | `br.com.vilasossego.ninguemdorme` | `br.com.intruso.jogo` |
| Projeto Android | `vila-sossego/android/` | `Intruso/android/` |
| Abre | https://vila-sossego.onrender.com/ninguem-dorme/ | https://vila-sossego.onrender.com/intruso/ |
| APK de teste | `android/saida/ninguem-dorme-debug.apk` | `Intruso/android/saida/intruso-debug.apk` |

## Antes de publicar (checklist)
1. **Servidor sem dormir**: plano pago do Render (Starter, ~US$ 7/mês) no serviço `vila-sossego`. No grátis, a 1ª abertura leva até 50 s.
2. **Banco online** (passaporte, ranking, A Turma): projeto Supabase `vila-sossego` (ref `ypjifpwftiagauejafeg`, São Paulo,
   grátis) já criado com a tabela `vila_kv`. Falta pôr no Render (Environment): `SUPABASE_URL=https://ypjifpwftiagauejafeg.supabase.co`
   e `SUPABASE_SERVICE_KEY` (Supabase → Project Settings → API Keys → chave secreta / service_role). Sem isso, os dados ficam
   num arquivo que some a cada atualização do servidor.
3. **AdMob** (Ninguém Dorme): criar o app e dois blocos (intersticial e premiado) e preencher em `android/gradle.properties`
   (`ADMOB_APP_ID`, `INTERSTITIAL_ID`, `REWARDED_ID`). Sem isso o app usa anúncios de TESTE.
4. **Produtos no Play Console** (Monetizar → Produtos → Produtos únicos), nos dois apps:
   | ID | Tipo no app | Preço sugerido | O que libera |
   |---|---|---|---|
   | `passe_noite` | consumível (o app consome) | R$ 2,99 | 24h de tudo liberado para a sala de quem comprou |
   | `vila_completa` | permanente | R$ 14,90 | tudo para sempre e sem anúncios |
   | `remove_ads` | permanente | R$ 6,90 | só tira os anúncios (já existe no Intruso) |
   | `avatar_pack` | permanente | R$ 4,90 | personagens do Intruso (já existe) |
5. **Chave de assinatura**: `keystore.properties` em cada pasta `android/` (ver `keystore.properties.example`), subir
   `versionCode` e gerar o AAB (`./gradlew bundleRelease`, JBR 21, caminho sem acento).
6. **Classificação**: público-alvo **13+** (não marcar "para crianças": as regras de família do Google restringem anúncios).
   O Modo Família continua como opção dentro do jogo.
7. **Segurança dos dados**: coleta nome/apelido e progresso do jogo (opcional, para salvar o passaporte); foto da sala fica só
   na memória do servidor enquanto a sala existe; sem localização, contatos ou e-mail. Política: `/privacidade.html`.

## Ninguém Dorme — textos da loja
**Nome (30):** Ninguém Dorme: Cidade Dorme
**Descrição curta (80):** Jogo de detetive em grupo: ache os capangas antes que eles tomem a vila!

**Descrição completa:**
Toda noite alguém some na Vila Sossego. De dia, a vila conversa e vota. Quem são os capangas?

Ninguém Dorme é o clássico "cidade dorme" para jogar com a família e os amigos, cada um no seu celular. O celular vira o narrador, com voz, grilos, coruja e galo cantando no amanhecer.

🌙 PAPÉIS: Capanga, Delegada, Vó Zefa, Cotinha, Prefeito, Vigia, Zé Pinguço (acha que é a Delegada!), Coveiro e o Casal apaixonado.
📺 TELÃO: abra na TV e a festa inteira acompanha a votação, as revelações e a cerimônia de premiação.
📖 MISTÉRIOS DA VILA: partidas com história, um capítulo por noite e final próprio.
🎙️ VOZES DO NARRADOR: Vó Contadora, Locutor de Futebol, Voz do Além e Plantão da Vila.
🎉 NOITE DE FESTA: emende várias partidas (Ninguém Dorme, Cara de Pau e Intruso) com um placar só e prendas para quem perde.
👨‍👩‍👧 MODO FAMÍLIA: textos leves e tempos mais folgados quando tem criança ou vó na roda.
🤖 BOTS: faltou gente? Complete a mesa com bots que conversam, desconfiam e mentem.
🏆 A TURMA: hall da fama da família, rivalidades e ranking da semana.
🕵️ Bônus: Cara de Pau (jogo de blefe) e o Intruso Diário, um desafio novo por dia.

Os convidados não precisam instalar nada: entram pelo link ou QR code.

## Intruso — textos da loja
**Nome (30):** Intruso: Jogo do Impostor
**Descrição curta (80):** Todo mundo sabe a palavra, menos um. Descubra o intruso com a turma!

**Descrição completa:**
Todos recebem a mesma palavra secreta, menos o intruso. Cada um dá uma dica sem entregar a palavra… e o intruso blefa para não ser descoberto. Votem, desconfiem e riam!

🕵️ Mais de 3.000 palavras em 22 categorias, palavra parecida, cúmplice e lista da turma.
✏️ Dica desenhada e 🤸 mímica (modo 1 celular): perfeito para criança e para quem não gosta de escrever.
👥 Times, 🤖 bots, 📺 telão na TV e 🎉 Noite de Festa com prendas.
🧩 INTRUSO DIÁRIO: um desafio por dia, igual para todo mundo. Compartilhe seus quadradinhos com a turma!
🏆 Passaporte da Vila: níveis, conquistas, temporada do mês e ranking.

Os convidados entram pelo link ou QR code, sem instalar.
