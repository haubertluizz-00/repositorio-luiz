# Projeto: Live automática 24/7 com jogo interativo

Resumo da conversa de planejamento, para continuar em outra sessão.

## Objetivo
- Live rodando 24/7 num servidor (VPS), sem ninguém controlando.
- Um jogo original e/ou um personagem reage a presentes, curtidas e comentários.
- Renda: presentes da live. Depois: curso ensinando a montar (só depois de ter resultado próprio para mostrar).

## Decisões e realidade
- NÃO usar vídeo gravado em loop: não gera presente e o TikTok derruba conteúdo pré-gravado.
- Formato certo: jogo interativo gerado em tempo real (corrida de países, cabo de guerra, personagem que sobrevive...).
- Plataformas:
  - TikTok = principal (presentes viram dinheiro; precisa ter 18+, LIVE liberada e chave de transmissão/RTMP).
  - YouTube = bônus (chave fácil; Super Chat só com Programa de Parcerias).
  - Instagram = só divulgação (live limitada a ~4h, não lê presentes).
- Personagem de IA: usar falas prontas geradas uma vez (barato), não voz gerada a cada presente (caro 24/7).

## Arquitetura
```
VPS (24h)
 ├─ Jogo (página web, navegador sem tela) ─► ffmpeg ─► RTMP TikTok / YouTube
 └─ Leitor de eventos (presentes/curtidas/comentários) ─► manda eventos pro jogo
```

## Próximos passos
1. Jogo no navegador + simulador de presentes (testar sem estar ao vivo).
2. Conexão com o TikTok para ler presentes.
3. Script de transmissão (ffmpeg -> RTMP).
4. Personagem com falas prontas.
5. Guia de instalação na VPS com reinício automático (base do curso).

## Pendências do usuário
- Escolher o jogo (corrida de países / cabo de guerra / personagem que sobrevive / outro).
- Confirmar: 18+ e conta TikTok com LIVE liberada? Tem chave de transmissão?

## Referência analisada: @cobradoabismo (TikTok, 10/11/2026)
- 91,9 mil seguidores, 412 mil curtidas, 232 vídeos, conta de 2018.
- Bio: "Thiago Reyers | Machine Learning — Para criar sua própria cobrinha virtual" + link oboneco.com.br
  -> ele VENDE a ferramenta/método para outros (mesmo modelo de negócio planejado aqui = concorrente direto).
- Última live: "Live Cobra do Abismo", 16:20–17:23 UTC (~1h03), NÃO 24/7.
  - Transmitida por programa externo (live_type_third_party = RTMP/LIVE Studio), categoria Gaming, 720x1280, 3,5 Mbps.
  - 3.841 pessoas entraram, 27 novos seguidores.
  - Presentes: a API pública retorna 0 (dado escondido) -> não dá para saber quanto ganha.
  - Não marcou como conteúdo de IA (aigc_self_disclosure_switch = false).

## Dado real: quando a LIVE liberou (conta @paisitottk)
- Conta criada: 02/11/2026 às 22:09 (Brasília) / 03/11 01:09 UTC.
- LIVE liberou: 11/11/2026 à 00:00 (Brasília), segundo o usuário -> ~8 dias e 2h de conta.
- Na hora: 158 seguidores, 23 vídeos, 1.541 curtidas, 18+.
- Hipóteses (1 dado só, falta confirmar com outras contas):
  - Liberação acontece na virada do dia (lote diário), não na hora exata.
  - Tempo mínimo ~7-8 dias de conta; seguidores >= ~50 parecem suficientes no Brasil.
- Perfil: "Paisito 🌎 — Ache o país, vídeo novo todo dia" -> nicho de países; o jogo da live deve ser de países.

## Status (11/11/2026)
- FEITO: jogo "Guerra dos Países" (lives/jogo), ponte TikTok -> jogo (lives/ponte), transmissão RTMP 24/7 (lives/transmitir), guia em lives/README.md.
- Testado aqui: jogo + simulador, ponte -> jogo via WebSocket, gravação de vídeo pelo pipeline Xvfb + Chromium + ffmpeg.
- NÃO testado: conexão real com a live do TikTok (sessão na nuvem bloqueia o servidor de assinatura) e envio RTMP real.
- Próximo: instalar na VPS, conseguir a chave de transmissão da Paisito, primeira live de teste.

## Estudo: Livecade (livecade.io) — 12/11/2026
- Plataforma pronta: 64 jogos interativos para TikTok LIVE (luta, corrida, quiz, palavras, battle royale).
  Populares: MMA Clash, Blob Battle. De países: Nations Boat Race, Nations Derby, Guess the Flag, Guess the Location, Territory War.
- Como funciona: você copia uma URL de "overlay" e adiciona no TikTok LIVE Studio / OBS / Streamlabs (ou pelo celular, modo "Mobile gaming").
  Lê comentários/presentes/likes pelo @ público (conector não oficial, igual ao nosso). Não pede senha.
- Preço: grátis (60 min de live/dia, só jogos grátis, marca d'água) / Pro US$ 12,99/mês (sem limite, todos os jogos, IA host).
- PONTO CRÍTICO (doc deles, citando regras de monetização do TikTok): o TikTok pode DESMONETIZAR
  "conteúdo gerado ou operado principalmente por sistemas automatizados ... sem presença significativa do criador"
  e "conteúdo passivo ou sem ninguém (unattended)". Também cita batalhas de times só pedindo presente.
  Recomendação deles: rosto na câmera, falar com o chat, pausar a live quando sair.
  -> Live 24/7 sem ninguém = risco direto de perder os presentes (monetização), que é a renda do plano.
