# Guerra dos Países — live interativa 24/7

Jogo para live vertical (TikTok) em que o público controla tudo:

| O público faz | Acontece no jogo |
|---|---|
| Comenta um país (`brasil`, `portugal`, 🇧🇷…) | Entra no time desse país com a foto de perfil |
| Curte a live | Cura e fica um pouco mais forte |
| Segue | Escudo por 10s |
| Compartilha | 3 soldados do seu país |
| Presente 1–4 💎 | Mais força |
| Presente 5+ 💎 | Soldados (até 12) |
| Presente 30+ 💎 | BOMBA em um inimigo |
| Presente 100+ 💎 | Vira TITÃ (gigante com escudo) |
| Presente 500+ 💎 | CONQUISTA: pinta um pedaço enorme do mapa |

Cada bonequinho pinta o chão com a cor do país. Rodada de 3 minutos: vence o país com mais território.
Quando a live está vazia, entram bots (só bandeiras, sem nome) para a arena não ficar parada.

## Pastas

- `jogo/` — o jogo (página web). `paises.js` tem a lista de países e os nomes aceitos nos comentários.
- `ponte/` — programa que lê a live do TikTok e manda os eventos para o jogo. Também serve o jogo em `http://localhost:8787`.
- `transmitir/` — script que abre o jogo numa tela invisível e transmite via RTMP, religando sozinho se cair.

## Testar no seu computador (sem live)

Abra `jogo/index.html?sim=1` no navegador. O painel do lado simula comentários, likes e presentes.
O botão **Auto-simular** cria um público de teste, útil para gravar vídeos para o perfil.
**Não use o auto-simular na live de verdade:** seria público falso.

## Instalar na VPS (Ubuntu/Debian)

```bash
sudo apt update && sudo apt install -y git nodejs npm ffmpeg xvfb chromium fonts-noto-color-emoji
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
- O TikTok exige trilha de áudio: sem `MUSICA`, vai áudio mudo. Use só música que você tem direito de usar.
