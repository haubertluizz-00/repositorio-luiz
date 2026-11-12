# Lives interativas 24/7

Dois jogos para live vertical (TikTok) em que o público entra com nome e foto e controla tudo.
A ponte abre a **Escalada** por padrão; para trocar, use `JOGO=guerra` em `/etc/lives.env`.

## Escalada dos Países (padrão)

Cada pessoa vira um alpinista com nome, foto, bandeira e **nível que fica salvo** de um dia para o outro.
Quem chegar no topo (500m) primeiro vence a rodada e entra no **Hall da Fama**. Rodada de no máximo 3 minutos.

| O público faz | Acontece no jogo |
|---|---|
| Comenta qualquer coisa | Sobe 8m (no máximo 1 comentário a cada 1,5s conta) |
| Comenta um país (`brasil`, 🇧🇷…) | Escala com a bandeira desse país |
| Curte | Sobe 2m por like |
| Segue | Escudo 15s + 15m |
| Compartilha | +30m |
| Presente 1–4 💎 | Sobe 5m por 💎 |
| Presente 5+ 💎 | CORDA: +20m e escudo 10s |
| Presente 30+ 💎 | PEDRA no líder (derruba 60m) |
| Presente 100+ 💎 | JETPACK: +100m e escudo 15s |
| Presente 500+ 💎 | AVALANCHE: todo mundo cai 80m |

Pedras caem sozinhas de tempos em tempos. Nível mais alto sobe mais rápido e cai menos.
Os números ficam no começo de `jogos/escalada/jogo.js` (`SOBE` e `CFG`) para ajustar.

## Guerra dos Países

Arena onde cada pessoa é uma bolinha do seu país que pinta o chão; vence o país com mais território.
Comentário entra no time, like cura, presentes dão força, soldados, bomba, titã e conquista.

## Pastas

- `jogos/escalada/`, `jogos/guerra/` — os jogos. `jogos/comum/` tem países, bandeiras e sons.
- `ponte/` — lê a live do TikTok, manda os eventos para o jogo e salva níveis em `ponte/dados/`.
- `transmitir/` — abre o jogo numa tela invisível e transmite via RTMP com o som do jogo, religando se cair.

## Testar no seu computador (sem live)

Abra `jogos/escalada/index.html?sim=1` no navegador. O painel do lado simula comentários, likes e presentes.
O botão **Auto-simular** cria um público de teste, útil para gravar vídeos para o perfil.
**Não use o auto-simular na live de verdade:** seria público falso.

## Instalar na VPS (Ubuntu/Debian)

```bash
sudo apt update && sudo apt install -y git nodejs npm ffmpeg xvfb chromium fonts-noto-color-emoji pulseaudio pulseaudio-utils
sudo git clone -b claude/bold-volta-0fz7a5 https://github.com/haubertluizz-00/repositorio-luiz.git /opt/repositorio-luiz
cd /opt/repositorio-luiz/lives/ponte && sudo npm install

# configuração (com a chave de transmissão)
sudo cp /opt/repositorio-luiz/lives/transmitir/lives.env.exemplo /etc/lives.env
sudo nano /etc/lives.env
sudo chmod 600 /etc/lives.env

# serviços que ligam sozinhos e religam se cair
sudo cp /opt/repositorio-luiz/lives/transmitir/systemd/*.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now lives-ponte lives-transmitir

# ver o que está acontecendo
journalctl -u lives-ponte -f
journalctl -u lives-transmitir -f
```

Teste rápido na VPS sem transmitir: `TESTE_ARQUIVO=teste.mp4 DURACAO=20 ./transmitir/transmitir.sh`
(grava 20s do jogo num arquivo).

Mandar um evento de teste para o jogo:
`curl -X POST localhost:8787/evento -d '{"tipo":"presente","id":"1","nome":"luiz","diamantes":100}'`

## Pontos de atenção

- **Chave de transmissão:** precisa ter acesso a transmitir pelo computador (RTMP). Em algumas contas a chave muda a cada live; se for o caso, é preciso atualizar `/etc/lives.env` e reiniciar `lives-transmitir`.
- **Leitura dos presentes** usa uma biblioteca não oficial (`tiktok-live-connector`). Pode parar de funcionar quando o TikTok muda algo; atualize com `npm install tiktok-live-connector@latest`.
- O som do jogo vai junto na live (precisa do `pulseaudio`). `MUSICA=arquivo.mp3` mistura uma música de fundo; use só música que você tem direito de usar.
