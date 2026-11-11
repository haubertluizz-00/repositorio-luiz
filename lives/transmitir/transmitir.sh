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
#   MUSICA     arquivo .mp3 tocado em loop (sem isso vai áudio mudo; o TikTok exige trilha de áudio)
#   BITRATE    (padrão 2500k)
#   CHROME     caminho do navegador (padrão: procura chromium/google-chrome)
set -u

LARG=720; ALT=1280; FPS=30
TELA=":${TELA_NUM:-99}"
URL_JOGO="${URL_JOGO:-http://localhost:8787/}"
BITRATE="${BITRATE:-2500k}"
CHROME="${CHROME:-$(command -v chromium || command -v chromium-browser || command -v google-chrome || true)}"
PERFIL="$(mktemp -d /tmp/chrome-live.XXXX)"
PID_CHROME=""; PID_FF=""; PID_X=""

if [ -z "$CHROME" ]; then echo "Navegador não encontrado. Instale: sudo apt install chromium" >&2; exit 1; fi
if [ -z "${DESTINOS:-}" ] && [ -z "${TESTE_ARQUIVO:-}" ]; then echo "Defina DESTINOS (rtmp://...) ou TESTE_ARQUIVO" >&2; exit 1; fi

limpar() { kill $PID_FF $PID_CHROME $PID_X 2>/dev/null; sleep 1; rm -rf "$PERFIL" 2>/dev/null; }
trap 'limpar; exit 0' INT TERM
trap limpar EXIT

Xvfb "$TELA" -screen 0 "${LARG}x${ALT}x24" -nolisten tcp >/dev/null 2>&1 &
PID_X=$!
sleep 1

abrir_navegador() {
  DISPLAY="$TELA" "$CHROME" --no-sandbox --kiosk --no-first-run --disable-infobars --disable-gpu \
    --window-position=0,0 --window-size="${LARG},${ALT}" --force-device-scale-factor=1 \
    --autoplay-policy=no-user-gesture-required --disable-features=Translate,TranslateUI --lang=pt-BR \
    --user-data-dir="$PERFIL" "$URL_JOGO" >/dev/null 2>&1 &
  PID_CHROME=$!
  sleep 4
}

if [ -n "${MUSICA:-}" ]; then AUDIO=(-stream_loop -1 -i "$MUSICA"); else AUDIO=(-f lavfi -i anullsrc=r=44100:cl=stereo); fi
CODIF=(-c:v libx264 -preset veryfast -tune zerolatency -b:v "$BITRATE" -maxrate "$BITRATE" -bufsize 5000k
       -g $((FPS * 2)) -pix_fmt yuv420p -c:a aac -b:a 128k -ar 44100)

while true; do
  { [ -n "$PID_CHROME" ] && kill -0 "$PID_CHROME" 2>/dev/null; } || abrir_navegador
  ENTRADA=(-f x11grab -draw_mouse 0 -video_size "${LARG}x${ALT}" -framerate "$FPS" -i "$TELA")
  if [ -n "${TESTE_ARQUIVO:-}" ]; then
    ffmpeg -loglevel error -y "${ENTRADA[@]}" "${AUDIO[@]}" "${CODIF[@]}" -t "${DURACAO:-20}" "$TESTE_ARQUIVO"
    echo "Vídeo de teste salvo em $TESTE_ARQUIVO"
    exit 0
  fi
  read -r -a LISTA <<< "$DESTINOS"
  if [ "${#LISTA[@]}" -eq 1 ]; then
    SAIDA=(-f flv "${LISTA[0]}")
  else
    TEE=""; for d in "${LISTA[@]}"; do TEE+="${TEE:+|}[f=flv:onfail=ignore]$d"; done
    SAIDA=(-map 0:v -map 1:a -f tee "$TEE")
  fi
  echo "$(date '+%F %T') transmitindo para ${#LISTA[@]} destino(s)"
  ffmpeg -loglevel warning "${ENTRADA[@]}" "${AUDIO[@]}" "${CODIF[@]}" "${SAIDA[@]}" &
  PID_FF=$!
  wait "$PID_FF"
  echo "$(date '+%F %T') transmissão caiu; religando em 10s"
  sleep 10
done
