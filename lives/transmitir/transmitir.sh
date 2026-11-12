#!/usr/bin/env bash
# Transmite o jogo 24/7: abre o jogo num navegador invisível (tela virtual)
# e manda o vídeo para o TikTok/YouTube via RTMP. Se cair, religa sozinho.
#
# Uso (exemplos):
#   DESTINOS="rtmp://servidor-do-tiktok/app/SUA_CHAVE" ./transmitir.sh
#   DESTINOS="rtmp://a/chave1 rtmp://a.rtmp.youtube.com/live2/chave2" ./transmitir.sh   (várias plataformas)
#   TESTE_ARQUIVO=teste.mp4 DURACAO=20 ./transmitir.sh                                    (grava em arquivo, sem live)
#
# Opcionais:
#   URL_JOGO   (padrão http://localhost:8787/)   — a ponte precisa estar rodando
#   MUSICA     arquivo .mp3 tocado em loop, misturado com os sons do jogo
#   SEM_SOM_JOGO=1  não captura os sons do jogo (por padrão captura, se o PulseAudio estiver instalado)
#   BITRATE    (padrão 2500k)
#   CHROME     caminho do navegador (padrão: procura chromium/google-chrome)
set -u

LARG=720; ALT=1280; FPS=30
TELA=":${TELA_NUM:-99}"
URL_JOGO="${URL_JOGO:-http://localhost:8787/}"
# se a ponte exige senha (CHAVE_JOGO), o navegador da transmissão precisa mandar ela também
if [ -n "${CHAVE_JOGO:-}" ] && ! printf %s "$URL_JOGO" | grep -q "k="; then
  case "$URL_JOGO" in *\?*) URL_JOGO="$URL_JOGO&k=$CHAVE_JOGO" ;; *) URL_JOGO="$URL_JOGO?k=$CHAVE_JOGO" ;; esac
fi
BITRATE="${BITRATE:-2500k}"
CHROME="${CHROME:-$(command -v chromium || command -v chromium-browser || command -v google-chrome || true)}"
PERFIL="$(mktemp -d /tmp/chrome-live.XXXX)"
PID_CHROME=""; PID_FF=""; PID_X=""

if [ -z "$CHROME" ]; then echo "Navegador não encontrado. Instale: sudo apt install chromium" >&2; exit 1; fi
if [ -z "${DESTINOS:-}" ] && [ -z "${TESTE_ARQUIVO:-}" ]; then echo "Defina DESTINOS (rtmp://...) ou TESTE_ARQUIVO" >&2; exit 1; fi

limpar() { kill $PID_FF $PID_CHROME $PID_X 2>/dev/null; [ -n "${PULSE_PROPRIO:-}" ] && pulseaudio --kill 2>/dev/null; sleep 1; rm -rf "$PERFIL" 2>/dev/null; }
trap 'limpar; exit 0' INT TERM
trap limpar EXIT

Xvfb "$TELA" -screen 0 "${LARG}x${ALT}x24" -nolisten tcp >/dev/null 2>&1 &
PID_X=$!
sleep 1

# Som do jogo: cria uma "caixa de som virtual" (PulseAudio) e grava o que o navegador toca nela.
SOM_JOGO=""
if [ -z "${SEM_SOM_JOGO:-}" ] && command -v pulseaudio >/dev/null && command -v pactl >/dev/null; then
  if ! pactl info >/dev/null 2>&1; then
    pulseaudio -D --exit-idle-time=-1 --disallow-exit >/dev/null 2>&1 && PULSE_PROPRIO=1
    sleep 1
  fi
  pactl list short sinks 2>/dev/null | grep -q '^[0-9]*\slive\s' || \
    pactl load-module module-null-sink sink_name=live sink_properties=device.description=live >/dev/null 2>&1
  pactl list short sinks 2>/dev/null | grep -q 'live' && SOM_JOGO=1
fi
[ -n "$SOM_JOGO" ] && echo "som do jogo: capturando" || echo "som do jogo: desligado (instale pulseaudio para ter som)"

abrir_navegador() {
  DISPLAY="$TELA" PULSE_SINK=live "$CHROME" --no-sandbox --kiosk --no-first-run --disable-infobars --use-gl=angle --use-angle=swiftshader --enable-unsafe-swiftshader \
    --window-position=0,0 --window-size="${LARG},${ALT}" --force-device-scale-factor=1 \
    --autoplay-policy=no-user-gesture-required --disable-features=Translate,TranslateUI --lang=pt-BR \
    --user-data-dir="$PERFIL" "$URL_JOGO" >/dev/null 2>&1 &
  PID_CHROME=$!
  sleep 4
}

# Áudio: som do jogo e/ou música. Sem nenhum dos dois vai silêncio (o TikTok exige trilha de áudio).
if [ -n "$SOM_JOGO" ] && [ -n "${MUSICA:-}" ]; then
  AUDIO=(-f pulse -i live.monitor -stream_loop -1 -i "$MUSICA")
  MAPA=(-filter_complex "[1:a][2:a]amix=inputs=2:duration=first:weights=1 0.35[a]" -map 0:v -map "[a]")
elif [ -n "$SOM_JOGO" ]; then
  AUDIO=(-f pulse -i live.monitor); MAPA=(-map 0:v -map 1:a)
elif [ -n "${MUSICA:-}" ]; then
  AUDIO=(-stream_loop -1 -i "$MUSICA"); MAPA=(-map 0:v -map 1:a)
else
  AUDIO=(-f lavfi -i anullsrc=r=44100:cl=stereo); MAPA=(-map 0:v -map 1:a)
fi
CODIF=(-c:v libx264 -preset veryfast -tune zerolatency -b:v "$BITRATE" -maxrate "$BITRATE" -bufsize 5000k
       -g $((FPS * 2)) -pix_fmt yuv420p -c:a aac -b:a 128k -ar 44100)

while true; do
  { [ -n "$PID_CHROME" ] && kill -0 "$PID_CHROME" 2>/dev/null; } || abrir_navegador
  ENTRADA=(-f x11grab -draw_mouse 0 -video_size "${LARG}x${ALT}" -framerate "$FPS" -i "$TELA")
  if [ -n "${TESTE_ARQUIVO:-}" ]; then
    ffmpeg -loglevel error -y "${ENTRADA[@]}" "${AUDIO[@]}" "${MAPA[@]}" "${CODIF[@]}" -t "${DURACAO:-20}" "$TESTE_ARQUIVO"
    echo "Vídeo de teste salvo em $TESTE_ARQUIVO"
    exit 0
  fi
  read -r -a LISTA <<< "$DESTINOS"
  if [ "${#LISTA[@]}" -eq 1 ]; then
    SAIDA=(-f flv "${LISTA[0]}")
  else
    TEE=""; for d in "${LISTA[@]}"; do TEE+="${TEE:+|}[f=flv:onfail=ignore]$d"; done
    SAIDA=(-f tee "$TEE")
  fi
  echo "$(date '+%F %T') transmitindo para ${#LISTA[@]} destino(s)"
  ffmpeg -loglevel warning "${ENTRADA[@]}" "${AUDIO[@]}" "${MAPA[@]}" "${CODIF[@]}" "${SAIDA[@]}" &
  PID_FF=$!
  wait "$PID_FF"
  echo "$(date '+%F %T') transmissão caiu; religando em 10s"
  sleep 10
done
