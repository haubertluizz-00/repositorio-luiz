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
