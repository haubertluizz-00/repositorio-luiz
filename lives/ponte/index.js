// Ponte: lê a live do TikTok e manda os eventos para o jogo.
// Também serve os arquivos do jogo em http://localhost:PORTA
//
// Uso:
//   node index.js --usuario paisitottk          (conecta na live de verdade)
//   node index.js                               (só serve o jogo, sem TikTok)
//   node index.js --jogo guerra                 (escolhe o jogo; padrão: escalada)
//
// Variáveis opcionais:
//   PORTA=8787
//   JOGO=escalada
//   EULER_API_KEY=...   chave do Euler Stream (assinatura); sem ela usa o plano grátis, que tem limite
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');

const args = process.argv.slice(2);
const arg = (nome, padrao) => { const i = args.indexOf('--' + nome); return i >= 0 ? args[i + 1] : padrao; };

const PORTA = Number(process.env.PORTA || arg('porta', 8787));
const USUARIO = (arg('usuario', process.env.TIKTOK_USUARIO || '') || '').replace(/^@/, '');
const JOGO = arg('jogo', process.env.JOGO || 'escalada');
const PASTA_JOGOS = path.resolve(__dirname, '..', 'jogos');
const PASTA_DADOS = path.resolve(__dirname, 'dados');
const TIPOS = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css', '.png': 'image/png', '.mp3': 'audio/mpeg' };

const log = (...m) => console.log(new Date().toISOString().slice(11, 19), ...m);

// ---------- Servidor do jogo ----------
const servidor = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  // Teste manual: curl -X POST localhost:8787/evento -d '{"tipo":"presente","nome":"luiz","diamantes":100}'
  if (req.method === 'POST' && url.pathname === '/evento') {
    const local = ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress);
    if (!local) { res.writeHead(403); return res.end(); }
    let corpo = '';
    req.on('data', c => { corpo += c; if (corpo.length > 1e5) req.destroy(); });
    req.on('end', () => {
      try { enviar(JSON.parse(corpo)); res.end('ok\n'); } catch { res.writeHead(400); res.end('json inválido\n'); }
    });
    return;
  }
  if (url.pathname === '/') { res.writeHead(302, { Location: `/${JOGO}/${url.search}` }); return res.end(); }
  let arquivo = path.normalize(path.join(PASTA_JOGOS, decodeURIComponent(url.pathname)));
  if (!arquivo.startsWith(PASTA_JOGOS + path.sep)) { res.writeHead(403); return res.end(); }
  if (url.pathname.endsWith('/')) arquivo = path.join(arquivo, 'index.html');
  fs.readFile(arquivo, (err, dados) => {
    if (err) { res.writeHead(404); return res.end('não encontrado'); }
    res.writeHead(200, { 'Content-Type': TIPOS[path.extname(arquivo)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(dados);
  });
});

// Com a VPS aberta na internet, defina CHAVE_JOGO e abra o jogo com ?k=CHAVE_JOGO.
// Sem a chave certa ninguém conecta no jogo (nem apaga os níveis salvos).
const CHAVE_JOGO = process.env.CHAVE_JOGO || '';
const wss = new WebSocketServer({
  server: servidor, path: '/ws',
  verifyClient: ({ req }) => !CHAVE_JOGO || new URL(req.url, 'http://x').searchParams.get('k') === CHAVE_JOGO,
});
function enviar(ev) {
  const msg = JSON.stringify(ev);
  for (const c of wss.clients) if (c.readyState === 1) c.send(msg);
}
// Níveis e vitórias ficam salvos em ponte/dados/<jogo>.json
const arquivoDados = jogo => /^[a-z]{1,20}$/.test(jogo || '') ? path.join(PASTA_DADOS, `${jogo}.json`) : null;
wss.on('connection', cliente => {
  log('jogo conectado na ponte');
  cliente.on('message', bruto => {
    let m; try { m = JSON.parse(bruto); } catch { return; }
    const arq = arquivoDados(m.jogo);
    if (!arq) return;
    if (m.tipo === 'pedir_dados') {
      fs.readFile(arq, 'utf8', (err, txt) => {
        let dados = null; try { dados = err ? null : JSON.parse(txt); } catch { /* arquivo corrompido */ }
        cliente.send(JSON.stringify({ tipo: 'dados', dados }));
      });
    } else if (m.tipo === 'salvar' && m.dados) {
      const txt = JSON.stringify(m.dados);
      if (txt.length > 5e6) return;
      fs.mkdirSync(PASTA_DADOS, { recursive: true });
      fs.writeFile(arq + '.tmp', txt, err => { if (!err) fs.rename(arq + '.tmp', arq, () => {}); });
    }
  });
});

servidor.listen(PORTA, () => log(`jogo "${JOGO}" em http://localhost:${PORTA}  (teste: http://localhost:${PORTA}/?sim=1)`));

// ---------- TikTok ----------
if (!USUARIO) {
  log('sem --usuario: rodando só o jogo, sem ler a live');
} else {
  conectarTikTok();
}

function usuarioDe(d) {
  const u = d.user || {};
  const fotoUrls = (u.profilePicture && (u.profilePicture.urls || u.profilePicture.url)) || [];
  return {
    id: String(u.userId || u.uniqueId || 'anon'),
    nome: u.nickname || u.uniqueId || 'anônimo',
    foto: Array.isArray(fotoUrls) ? fotoUrls[0] : fotoUrls,
  };
}

function conectarTikTok() {
  const { TikTokLiveConnection, WebcastEvent, ControlEvent } = require('tiktok-live-connector');
  const metricas = require('./metricas');
  const daLive = ev => { metricas.evento(ev); enviar(ev); };
  const opcoes = { enableExtendedGiftInfo: true };
  if (process.env.EULER_API_KEY) opcoes.signApiKey = process.env.EULER_API_KEY;

  let conexao = null;
  let tentando = false;

  async function tentar() {
    if (tentando) return;
    tentando = true;
    conexao = new TikTokLiveConnection(USUARIO, opcoes);

    conexao.on(WebcastEvent.CHAT, d => daLive({ tipo: 'comentario', ...usuarioDe(d), texto: d.comment }));
    conexao.on(WebcastEvent.LIKE, d => daLive({ tipo: 'like', ...usuarioDe(d), likes: d.likeCount || 1 }));
    conexao.on(WebcastEvent.FOLLOW, d => daLive({ tipo: 'seguir', ...usuarioDe(d) }));
    conexao.on(WebcastEvent.SHARE, d => daLive({ tipo: 'compartilhar', ...usuarioDe(d) }));
    conexao.on(WebcastEvent.ROOM_USER, d => metricas.espectadores(d.viewerCount || 0));
    conexao.on(WebcastEvent.GIFT, d => {
      const det = d.giftDetails || {};
      const ext = d.extendedGiftInfo || {};
      // presentes em sequência (combo): só conta quando a sequência termina
      if (det.giftType === 1 && !d.repeatEnd) return;
      const diamantes = det.diamondCount || ext.diamond_count || 1;
      const ev = { tipo: 'presente', ...usuarioDe(d), presente: det.giftName || ext.name || 'presente', diamantes, qtd: d.repeatCount || 1 };
      log(`presente: ${ev.nome} → ${ev.presente} x${ev.qtd} (${diamantes}💎)`);
      daLive(ev);
    });
    conexao.on(WebcastEvent.STREAM_END, () => { log('live terminou'); metricas.setAoVivo(false); religar(60); });
    conexao.on(ControlEvent.DISCONNECTED, () => { log('desconectado do TikTok'); metricas.setAoVivo(false); religar(20); });
    conexao.on(ControlEvent.ERROR, e => log('erro:', (e && (e.info || e.message)) || e));

    try {
      const estado = await conexao.connect();
      log(`conectado na live de @${USUARIO} (sala ${estado.roomId})`);
      metricas.setAoVivo(true);
      tentando = false;
    } catch (e) {
      const offline = e && /offline/i.test(e.constructor?.name + ' ' + e.message);
      log(offline ? `@${USUARIO} não está ao vivo; tento de novo em 60s` : `falha ao conectar: ${e && e.message}`);
      tentando = false;
      religar(offline ? 60 : 30);
    }
  }

  let timer = null;
  function religar(seg) {
    clearTimeout(timer);
    try { conexao && conexao.disconnect(); } catch { /* já desconectado */ }
    timer = setTimeout(tentar, seg * 1000);
  }

  tentar();
}

process.on('unhandledRejection', e => log('erro não tratado:', e && e.message));
