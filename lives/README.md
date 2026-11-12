# Lives interativas 24/7

## Jeito mais simples: PC com Windows + TikTok LIVE Studio

1. Instale o **Node.js** (nodejs.org, botão LTS), o **Chrome** e o **TikTok LIVE Studio**.
2. Baixe este projeto (GitHub → branch `claude/bold-volta-0fz7a5` → Code → Download ZIP) e descompacte.
3. Na pasta `lives/ponte`, clique com o botão direito → **Abrir no Terminal** e rode:
   ```
   npm install
   node index.js --usuario SUA_CONTA
   ```
   (deixe a janela aberta; com chave do Euler: `$env:EULER_API_KEY="SUA_CHAVE"; node index.js --usuario SUA_CONTA`)
4. No Chrome, abra `http://localhost:8787` (abre a **Arena das Bolinhas**; para trocar: `--jogo escalada` ou `--jogo guerra`).
5. No LIVE Studio: conta da live, formato vertical, **Adicionar fonte → Captura de janela → Chrome**, **Go LIVE**.
   A ponte conecta sozinha quando a live entra no ar (tenta de novo a cada minuto).
6. Pode desligar o **monitor** pelo botão, mas não deixe o PC suspender e **não minimize o Chrome**.

Teste sem live: `http://localhost:8787/?sim=1` (painel para simular comentários, likes e presentes).

Três jogos para live vertical (TikTok) em que o público entra com nome e foto e controla tudo.
A ponte abre a **Arena das Bolinhas** por padrão; para trocar, use `--jogo escalada` / `--jogo guerra` (ou `JOGO=` em `/etc/lives.env`).

## Arena das Bolinhas (3D, padrão)

Cada pessoa vira uma bolinha 3D com a foto de perfil. A arena encolhe e quem cai no abismo sai; a última em pé vence.
Rodada: 20s para entrar + luta de ~2,5 a 3 minutos (a arena só começa a encolher depois de 35s).

| O público faz | Acontece no jogo |
|---|---|
| Comenta qualquer coisa / `1` | Entra na arena; depois, EMPURRÃO (1 a cada 1,5s) |
| Comenta `2` ou `pula` | PULA (desvia de empurrões) e cai com impacto (a cada 5s) |
| Comenta `3` ou `segura` | SEGURA: fica 3x mais pesada por 3s (a cada 8s) |
| Curte | Dash pequeno + enche a barra; 60 curtidas = SUPER EMPURRÃO automático |
| Segue | Escudo 20s **só na primeira vez** (deixar de seguir e seguir de novo não vale; fica salvo) |
| Compartilha | +20 na barra do super |
| Presente (qualquer) | Onda de choque **proporcional ao valor** (1 💎 já é mais forte que like) + fica maior |
| Presente 30+ 💎 | GIGANTE por 8 a 30s (quanto mais 💎, mais tempo) |
| Presente 100+ 💎 | 3 a 12 METEOROS nos adversários (quanto mais 💎, mais meteoros) |
| Presente 500+ 💎 | TERREMOTO: todo mundo é jogado para a borda |

Com pouca gente, entram bolinhas "CPU" para completar 6 por rodada. Vitórias e derrubadas ficam no Hall da Fama.
Ajustes no começo de `jogos/arena/arena.js` (`CFG`). Precisa de placa de vídeo para ficar liso (no PC normal fica).

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


## Medir o teste 24/7

A ponte anota tudo que acontece na live em `ponte/dados/metricas.json` (por dia e por hora, horário de Brasília).
Para ver o resumo na VPS:

```bash
cd /opt/repositorio-luiz/lives/ponte
node relatorio.js              # um resumo por dia
node relatorio.js 2026-11-15   # hora a hora de um dia
```

Mostra horas ao vivo, pico de espectadores, pessoas, comentários, likes, seguidores, doadores, diamantes,
diamantes por hora e uma estimativa em dólar (1 💎 ≈ US$ 0,005, valor não oficial).
Junto com isso, anote todo dia se chegou alguma restrição em **LIVE Center → Rules and guidance → Restrictions**.

## Pontos de atenção

- **Chave de transmissão:** precisa ter acesso a transmitir pelo computador (RTMP). Em algumas contas a chave muda a cada live; se for o caso, é preciso atualizar `/etc/lives.env` e reiniciar `lives-transmitir`.
- **Leitura dos presentes** usa uma biblioteca não oficial (`tiktok-live-connector`). Pode parar de funcionar quando o TikTok muda algo; atualize com `npm install tiktok-live-connector@latest`.
- O som do jogo vai junto na live (precisa do `pulseaudio`). `MUSICA=arquivo.mp3` mistura uma música de fundo; use só música que você tem direito de usar.
