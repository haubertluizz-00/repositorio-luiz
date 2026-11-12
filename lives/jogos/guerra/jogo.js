// Guerra dos Países — jogo interativo para live vertical (720x1280).
// Recebe eventos da live (comentário, like, presente, seguir, compartilhar)
// pela ponte (WebSocket) ou pelo simulador (?sim=1).
(() => {
  'use strict';

  // ---------- Configuração ----------
  const CFG = {
    W: 720, H: 1280,
    ARENA: { x: 20, y: 300, w: 680, h: 680 },
    CELULA: 20,
    RODADA_SEG: 180,          // duração de cada rodada
    BANNER_SEG: 6,            // tempo mostrando o vencedor
    MIN_UNIDADES: 10,         // abaixo disso entram bots para a arena não ficar vazia
    MAX_UNIDADES: 260,
    TROCA_TIME_SEG: 30,       // tempo mínimo para trocar de país comentando outro
  };

  const PAISES = window.PAISES;
  const POR_COD = Object.fromEntries(PAISES.map(p => [p.cod, p]));
  const POR_ISO = Object.fromEntries(PAISES.map(p => [p.iso, p]));

  // ---------- Canvas ----------
  const canvas = document.getElementById('tela');
  const ctx = canvas.getContext('2d');
  canvas.width = CFG.W; canvas.height = CFG.H;

  // ---------- Estado ----------
  const cols = Math.floor(CFG.ARENA.w / CFG.CELULA);
  const rows = Math.floor(CFG.ARENA.h / CFG.CELULA);
  const grade = new Array(cols * rows).fill(null); // código do país dono de cada célula

  const unidades = new Map();   // chave -> unidade
  const memoria = new Map();    // id do usuário -> código do país (lembra o time)
  const particulas = [];
  const textos = [];            // textos flutuantes
  const feed = [];              // últimos eventos
  const doadores = new Map();   // id -> { nome, diamantes } na rodada
  let vitorias = carregarVitorias();
  let tempoRodada = CFG.RODADA_SEG;
  let banner = null;            // { titulo, sub, cor, ate }
  let fimDeRodada = null;       // { vencedor, ate }
  let tremor = 0;
  let porcentagens = [];        // [{ pais, pct, unidades }]
  let contadorBot = 0;
  let agora = 0;

  // ---------- Utilidades ----------
  const rnd = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const normalizar = s => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

  function carregarVitorias() {
    try { return JSON.parse(localStorage.getItem('gdp_vitorias') || '{}'); } catch { return {}; }
  }
  function salvarVitorias() {
    try { localStorage.setItem('gdp_vitorias', JSON.stringify(vitorias)); } catch { /* sem storage */ }
  }

  // Descobre o país citado num comentário (nome, sigla ou bandeira em emoji).
  function paisDoTexto(texto) {
    if (!texto) return null;
    const flags = texto.match(/\p{Regional_Indicator}{2}/gu);
    if (flags) {
      for (const f of flags) {
        const iso = [...f].map(c => String.fromCharCode(c.codePointAt(0) - 0x1F1E6 + 65)).join('');
        if (POR_ISO[iso]) return POR_ISO[iso];
      }
    }
    const limpo = ' ' + normalizar(texto).replace(/[^a-z0-9]+/g, ' ').trim() + ' ';
    for (const p of PAISES) {
      for (const n of p.nomes) if (limpo.includes(' ' + n + ' ')) return p;
    }
    return null;
  }

  // ---------- Fotos de perfil ----------
  const fotos = new Map();
  function foto(url) {
    if (!url) return null;
    if (fotos.has(url)) return fotos.get(url);
    const img = new Image();
    img.referrerPolicy = 'no-referrer';
    img.onerror = () => fotos.set(url, null);
    img.src = url;
    fotos.set(url, img);
    return img;
  }

  // ---------- Unidades ----------
  function raio(u) { return Math.min(14 + Math.sqrt(u.poder) * 3.2, 72); }
  function vidaMax(u) { return 100 + u.poder * 15; }

  function posicaoLivre() {
    const A = CFG.ARENA;
    return { x: rnd(A.x + 40, A.x + A.w - 40), y: rnd(A.y + 40, A.y + A.h - 40) };
  }

  function timeComMenosGente() {
    const contagem = new Map();
    for (const u of unidades.values()) if (u.viva) contagem.set(u.pais.cod, (contagem.get(u.pais.cod) || 0) + 1);
    if (contagem.size === 0) return POR_COD.BRA;
    let melhor = null, menor = Infinity;
    for (const [cod, n] of contagem) if (n < menor) { menor = n; melhor = cod; }
    return POR_COD[melhor];
  }

  function criarUnidade(chave, { nome, fotoUrl, pais, bot = false, poder = 1, dono = null }) {
    const p = posicaoLivre();
    const ang = rnd(0, Math.PI * 2);
    const u = {
      chave, nome, pais, bot, dono,
      foto: foto(fotoUrl),
      x: p.x, y: p.y, vx: Math.cos(ang), vy: Math.sin(ang), ang,
      poder, vida: 0, viva: true, abates: 0,
      escudoAte: 0, balao: null, alvoTimer: 0, nasceu: agora,
    };
    u.vida = vidaMax(u);
    unidades.set(chave, u);
    limitarUnidades();
    return u;
  }

  function limitarUnidades() {
    if (unidades.size <= CFG.MAX_UNIDADES) return;
    // remove primeiro bots e reforços mais antigos
    const ordem = [...unidades.values()].sort((a, b) => (b.bot - a.bot) || (a.nasceu - b.nasceu));
    while (unidades.size > CFG.MAX_UNIDADES && ordem.length) unidades.delete(ordem.shift().chave);
  }

  // Garante que o usuário tenha um bonequinho vivo na arena.
  function garantirJogador(ev, paisPedido) {
    const chave = 'u:' + ev.id;
    let u = unidades.get(chave);
    const lembrado = memoria.get(ev.id);
    if (u && u.viva) {
      if (paisPedido && paisPedido !== u.pais && agora - (u.trocouEm || -999) > CFG.TROCA_TIME_SEG) {
        u.pais = paisPedido; u.trocouEm = agora;
        memoria.set(ev.id, paisPedido.cod);
        noFeed(`${ev.nome} mudou para ${paisPedido.nome}`, paisPedido.cor);
      }
      if (ev.foto && !u.foto) u.foto = foto(ev.foto);
      return u;
    }
    const pais = paisPedido || (lembrado && POR_COD[lembrado]) || timeComMenosGente();
    memoria.set(ev.id, pais.cod);
    const poderAnterior = u ? Math.max(1, u.poder * 0.5) : 1;
    u = criarUnidade(chave, { nome: ev.nome || 'anônimo', fotoUrl: ev.foto, pais, poder: poderAnterior });
    flutuar(u.x, u.y - 30, 'ENTROU!', pais.cor);
    noFeed(`${ev.nome} entrou por ${pais.nome}`, pais.cor);
    return u;
  }

  function reforcos(pais, n, dono) {
    for (let i = 0; i < n; i++) {
      const u = criarUnidade('r:' + (++contadorBot), { nome: '', pais, bot: true, poder: 3, dono });
      if (dono) { u.x = dono.x + rnd(-30, 30); u.y = dono.y + rnd(-30, 30); }
    }
  }

  // ---------- Eventos da live ----------
  function evento(ev) {
    if (!ev || !ev.tipo) return;
    ev.id = String(ev.id || ev.nome || 'anon');
    ev.nome = (ev.nome || 'anônimo').slice(0, 18);
    switch (ev.tipo) {
      case 'comentario': {
        const u = garantirJogador(ev, paisDoTexto(ev.texto));
        u.balao = { texto: (ev.texto || '').slice(0, 28), ate: agora + 3 };
        break;
      }
      case 'like': {
        const n = clamp(ev.likes || 1, 1, 50);
        const u = garantirJogador(ev, null);
        u.vida = Math.min(vidaMax(u), u.vida + 8 * n);
        u.poder += Math.min(0.1 * n, 1.5);
        for (let i = 0; i < Math.min(n, 5); i++) flutuar(u.x + rnd(-15, 15), u.y - 20, '❤', '#ff4d6d', 0.8);
        break;
      }
      case 'seguir': {
        const u = garantirJogador(ev, null);
        u.escudoAte = agora + 10; u.poder += 3;
        flutuar(u.x, u.y - 30, 'ESCUDO!', '#74b9ff');
        noFeed(`${ev.nome} seguiu → escudo`, '#74b9ff');
        break;
      }
      case 'compartilhar': {
        const u = garantirJogador(ev, null);
        reforcos(u.pais, 3, u);
        noFeed(`${ev.nome} compartilhou → 3 soldados`, u.pais.cor);
        break;
      }
      case 'presente': presente(ev); break;
    }
  }

  function presente(ev) {
    const total = Math.max(1, (ev.diamantes || 1) * (ev.qtd || 1));
    const u = garantirJogador(ev, null);
    const d = doadores.get(ev.id) || { nome: ev.nome, diamantes: 0, pais: u.pais };
    d.diamantes += total; d.pais = u.pais; doadores.set(ev.id, d);

    u.poder += total;
    u.vida = vidaMax(u);
    let efeito = `+${total} de força`;

    if (total >= 5) {
      const n = Math.min(2 + Math.floor(total / 5), 12);
      reforcos(u.pais, n, u);
      efeito = `${n} soldados`;
    }
    if (total >= 30) { bomba(u.pais); efeito = 'BOMBA!'; }
    if (total >= 100) {
      u.escudoAte = agora + 20; u.poder += 100;
      efeito = 'virou TITÃ!';
      mostrarBanner(`${ev.nome} virou TITÃ`, `${u.pais.nome} ganhou um gigante`, u.pais.cor);
    }
    if (total >= 500) {
      conquista(u.pais);
      efeito = 'CONQUISTA!';
      mostrarBanner(`CONQUISTA DE ${u.pais.nome.toUpperCase()}`, `presente de ${ev.nome}`, u.pais.cor);
    }
    flutuar(u.x, u.y - 40, efeito, '#ffd32a', 1.6);
    noFeed(`${ev.nome} mandou ${ev.presente || 'presente'} → ${efeito}`, '#ffd32a');
  }

  function bomba(pais) {
    const inimigos = [...unidades.values()].filter(v => v.viva && v.pais !== pais);
    const alvo = inimigos.length ? inimigos[Math.floor(Math.random() * inimigos.length)] : posicaoLivre();
    explosao(alvo.x, alvo.y, 150, pais, 400);
  }

  function conquista(pais) {
    const p = posicaoLivre();
    explosao(p.x, p.y, 260, pais, 99999);
    tremor = 1.2;
  }

  function explosao(x, y, r, pais, dano) {
    pintarCirculo(x, y, r, pais.cod);
    for (const v of unidades.values()) {
      if (!v.viva || v.pais === pais) continue;
      if (Math.hypot(v.x - x, v.y - y) < r + raio(v)) ferir(v, dano, null);
    }
    for (let i = 0; i < 60; i++) {
      const a = rnd(0, Math.PI * 2), s = rnd(100, 500);
      particulas.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, vida: rnd(0.4, 1), cor: i % 3 ? pais.cor : '#ffd32a', t: rnd(3, 7) });
    }
    tremor = Math.max(tremor, 0.5);
  }

  function ferir(v, dano, atacante) {
    if (agora < v.escudoAte) return;
    v.vida -= dano;
    if (v.vida <= 0 && v.viva) {
      v.viva = false; v.morreuEm = agora;
      if (atacante) atacante.abates++;
      for (let i = 0; i < 18; i++) {
        const a = rnd(0, Math.PI * 2), s = rnd(60, 260);
        particulas.push({ x: v.x, y: v.y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, vida: rnd(0.3, 0.8), cor: v.pais.cor, t: rnd(2, 5) });
      }
      if (!v.bot && atacante && !atacante.bot) noFeed(`${atacante.nome} derrubou ${v.nome}`, atacante.pais.cor);
      if (v.bot) unidades.delete(v.chave);
    }
  }

  // ---------- Território ----------
  function pintarCirculo(x, y, r, cod) {
    const A = CFG.ARENA, C = CFG.CELULA;
    const c0 = clamp(Math.floor((x - r - A.x) / C), 0, cols - 1), c1 = clamp(Math.floor((x + r - A.x) / C), 0, cols - 1);
    const r0 = clamp(Math.floor((y - r - A.y) / C), 0, rows - 1), r1 = clamp(Math.floor((y + r - A.y) / C), 0, rows - 1);
    for (let cy = r0; cy <= r1; cy++) for (let cx = c0; cx <= c1; cx++) {
      const mx = A.x + cx * C + C / 2, my = A.y + cy * C + C / 2;
      if ((mx - x) ** 2 + (my - y) ** 2 <= r * r) grade[cy * cols + cx] = cod;
    }
  }

  function calcularPorcentagens() {
    const cont = new Map();
    for (const c of grade) if (c) cont.set(c, (cont.get(c) || 0) + 1);
    const vivos = new Map();
    for (const u of unidades.values()) if (u.viva) vivos.set(u.pais.cod, (vivos.get(u.pais.cod) || 0) + 1);
    const cods = new Set([...cont.keys(), ...vivos.keys()]);
    porcentagens = [...cods].map(cod => ({
      pais: POR_COD[cod], pct: (cont.get(cod) || 0) / grade.length * 100, unidades: vivos.get(cod) || 0,
    })).sort((a, b) => b.pct - a.pct || b.unidades - a.unidades);
  }

  // ---------- Rodadas ----------
  function terminarRodada() {
    calcularPorcentagens();
    const v = porcentagens[0];
    if (v) {
      vitorias[v.pais.cod] = (vitorias[v.pais.cod] || 0) + 1; salvarVitorias();
      const mvp = [...doadores.values()].sort((a, b) => b.diamantes - a.diamantes)[0];
      fimDeRodada = { vencedor: v, mvp, ate: agora + CFG.BANNER_SEG };
    } else {
      fimDeRodada = { vencedor: null, ate: agora + 1 };
    }
  }

  function novaRodada() {
    grade.fill(null);
    doadores.clear();
    for (const u of [...unidades.values()]) {
      if (u.bot || !u.viva) { unidades.delete(u.chave); continue; }
      const p = posicaoLivre(); u.x = p.x; u.y = p.y;
      u.poder = 1 + (u.poder - 1) * 0.5; // metade da força passa para a próxima rodada
      u.vida = vidaMax(u);
    }
    tempoRodada = CFG.RODADA_SEG;
    fimDeRodada = null;
  }

  // ---------- Feed / textos / banner ----------
  function noFeed(txt, cor) { feed.unshift({ txt, cor, em: agora }); if (feed.length > 5) feed.pop(); }
  function flutuar(x, y, txt, cor, escala = 1) { textos.push({ x, y, txt, cor, vida: 1.4, escala }); }
  function mostrarBanner(titulo, sub, cor) { banner = { titulo, sub, cor, ate: agora + 3.5 }; }

  // ---------- Bots para a arena nunca ficar vazia ----------
  function manterBots() {
    let vivos = 0;
    for (const u of unidades.values()) if (u.viva) vivos++;
    if (vivos >= CFG.MIN_UNIDADES) return;
    const cod = window.PAISES_BOTS[Math.floor(Math.random() * window.PAISES_BOTS.length)];
    criarUnidade('b:' + (++contadorBot), { nome: '', pais: POR_COD[cod], bot: true, poder: rnd(1, 4) });
  }

  // ---------- Simulação ----------
  function atualizar(dt) {
    agora += dt;
    if (fimDeRodada) {
      if (agora >= fimDeRodada.ate) novaRodada();
    } else {
      tempoRodada -= dt;
      if (tempoRodada <= 0) terminarRodada();
    }
    manterBots();

    const A = CFG.ARENA;
    const lista = [...unidades.values()].filter(u => u.viva);
    const congelado = !!fimDeRodada;

    for (const u of lista) {
      const r = raio(u);
      // procura inimigo próximo de tempos em tempos
      u.alvoTimer -= dt;
      if (u.alvoTimer <= 0) {
        u.alvoTimer = rnd(0.4, 0.9);
        let melhor = null, md = 260;
        for (const v of lista) {
          if (v.pais === u.pais) continue;
          const d = Math.hypot(v.x - u.x, v.y - u.y);
          if (d < md) { md = d; melhor = v; }
        }
        u.alvo = melhor;
      }
      u.ang += rnd(-2.2, 2.2) * dt;
      let dx = Math.cos(u.ang), dy = Math.sin(u.ang);
      if (u.alvo && u.alvo.viva) {
        const ax = u.alvo.x - u.x, ay = u.alvo.y - u.y, d = Math.hypot(ax, ay) || 1;
        dx = dx * 0.5 + ax / d * 0.5; dy = dy * 0.5 + ay / d * 0.5;
      }
      const vel = congelado ? 20 : clamp(120 - r * 0.9, 45, 120);
      u.vx += (dx * vel - u.vx) * Math.min(1, dt * 3);
      u.vy += (dy * vel - u.vy) * Math.min(1, dt * 3);
      u.x += u.vx * dt; u.y += u.vy * dt;
      if (u.x < A.x + r) { u.x = A.x + r; u.ang = Math.PI - u.ang; u.vx = Math.abs(u.vx); }
      if (u.x > A.x + A.w - r) { u.x = A.x + A.w - r; u.ang = Math.PI - u.ang; u.vx = -Math.abs(u.vx); }
      if (u.y < A.y + r) { u.y = A.y + r; u.ang = -u.ang; u.vy = Math.abs(u.vy); }
      if (u.y > A.y + A.h - r) { u.y = A.y + A.h - r; u.ang = -u.ang; u.vy = -Math.abs(u.vy); }
      if (!congelado) pintarCirculo(u.x, u.y, r * 0.9, u.pais.cod);
      u.vida = Math.min(vidaMax(u), u.vida + 2 * dt);
    }

    // colisões e combate
    for (let i = 0; i < lista.length; i++) {
      const a = lista[i]; if (!a.viva) continue;
      for (let j = i + 1; j < lista.length; j++) {
        const b = lista[j]; if (!b.viva) continue;
        const ra = raio(a), rb = raio(b);
        const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy);
        if (d >= ra + rb || d === 0) continue;
        const sobre = (ra + rb - d) / 2, nx = dx / d, ny = dy / d;
        const pa = rb / (ra + rb), pb = ra / (ra + rb); // o maior empurra mais
        a.x -= nx * sobre * pa * 2; a.y -= ny * sobre * pa * 2;
        b.x += nx * sobre * pb * 2; b.y += ny * sobre * pb * 2;
        if (a.pais !== b.pais && !congelado) {
          ferir(b, (12 + a.poder * 3) * dt, a);
          ferir(a, (12 + b.poder * 3) * dt, b);
        }
      }
    }
    // jogadores derrubados somem da memória depois de 10 min sem interagir
    for (const u of [...unidades.values()]) if (!u.viva && agora - u.morreuEm > 600) unidades.delete(u.chave);

    for (const p of particulas) { p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.94; p.vy *= 0.94; p.vida -= dt; }
    for (let i = particulas.length - 1; i >= 0; i--) if (particulas[i].vida <= 0) particulas.splice(i, 1);
    for (const t of textos) { t.y -= 40 * dt; t.vida -= dt; }
    for (let i = textos.length - 1; i >= 0; i--) if (textos[i].vida <= 0) textos.splice(i, 1);
    if (banner && agora > banner.ate) banner = null;
    tremor = Math.max(0, tremor - dt);
  }

  // ---------- Desenho ----------
  function desenharBandeira(p, x, y, r) {
    const b = p.bandeira;
    ctx.save();
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.clip();
    const L = x - r, T = y - r, S = r * 2;
    const faixas = (c, vert) => c.forEach((cor, i) => {
      ctx.fillStyle = cor;
      if (vert) ctx.fillRect(L + S * i / c.length, T, S / c.length + 1, S);
      else ctx.fillRect(L, T + S * i / c.length, S, S / c.length + 1);
    });
    switch (b.t) {
      case 'h': faixas(b.c, false); break;
      case 'v': faixas(b.c, true); break;
      case 'br':
        ctx.fillStyle = '#009c3b'; ctx.fillRect(L, T, S, S);
        ctx.fillStyle = '#ffdf00'; ctx.beginPath();
        ctx.moveTo(x, T + S * 0.12); ctx.lineTo(L + S * 0.95, y); ctx.lineTo(x, T + S * 0.88); ctx.lineTo(L + S * 0.05, y); ctx.fill();
        ctx.fillStyle = '#002776'; ctx.beginPath(); ctx.arc(x, y, r * 0.42, 0, Math.PI * 2); ctx.fill();
        break;
      case 'jp':
        ctx.fillStyle = '#fff'; ctx.fillRect(L, T, S, S);
        ctx.fillStyle = '#bc002d'; ctx.beginPath(); ctx.arc(x, y, r * 0.5, 0, Math.PI * 2); ctx.fill();
        break;
      case 'kr':
        ctx.fillStyle = '#fff'; ctx.fillRect(L, T, S, S);
        ctx.fillStyle = '#cd2e3a'; ctx.beginPath(); ctx.arc(x, y, r * 0.45, Math.PI, 0); ctx.fill();
        ctx.fillStyle = '#0047a0'; ctx.beginPath(); ctx.arc(x, y, r * 0.45, 0, Math.PI); ctx.fill();
        break;
      case 'cn':
        ctx.fillStyle = '#de2910'; ctx.fillRect(L, T, S, S);
        ctx.fillStyle = '#ffde00'; ctx.beginPath(); ctx.arc(x - r * 0.35, y - r * 0.3, r * 0.28, 0, Math.PI * 2); ctx.fill();
        break;
      case 'ca':
        faixas(['#d80621', '#ffffff', '#ffffff', '#d80621'], true);
        ctx.fillStyle = '#d80621'; ctx.beginPath(); ctx.arc(x, y, r * 0.3, 0, Math.PI * 2); ctx.fill();
        break;
      case 'en':
        ctx.fillStyle = '#fff'; ctx.fillRect(L, T, S, S);
        ctx.fillStyle = '#ce1124'; ctx.fillRect(x - r * 0.18, T, r * 0.36, S); ctx.fillRect(L, y - r * 0.18, S, r * 0.36);
        break;
      case 'us':
        for (let i = 0; i < 7; i++) { ctx.fillStyle = i % 2 ? '#fff' : '#b22234'; ctx.fillRect(L, T + S * i / 7, S, S / 7 + 1); }
        ctx.fillStyle = '#3c3b6e'; ctx.fillRect(L, T, S * 0.5, S * 0.55);
        break;
    }
    ctx.restore();
  }

  function desenharUnidade(u) {
    const r = raio(u);
    ctx.save();
    if (u.foto && u.foto.complete && u.foto.naturalWidth) {
      ctx.beginPath(); ctx.arc(u.x, u.y, r, 0, Math.PI * 2); ctx.clip();
      ctx.drawImage(u.foto, u.x - r, u.y - r, r * 2, r * 2);
      ctx.restore(); ctx.save();
      // bandeirinha no canto
      desenharBandeira(u.pais, u.x + r * 0.7, u.y + r * 0.7, Math.max(7, r * 0.35));
    } else {
      desenharBandeira(u.pais, u.x, u.y, r);
    }
    ctx.lineWidth = u.bot ? 2 : 3.5;
    ctx.strokeStyle = u.pais.cor;
    ctx.beginPath(); ctx.arc(u.x, u.y, r, 0, Math.PI * 2); ctx.stroke();
    if (agora < u.escudoAte) {
      ctx.strokeStyle = 'rgba(116,185,255,' + (0.6 + 0.4 * Math.sin(agora * 10)) + ')';
      ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(u.x, u.y, r + 6, 0, Math.PI * 2); ctx.stroke();
    }
    // barra de vida
    const vm = vidaMax(u);
    if (u.vida < vm - 1) {
      const w = r * 1.6;
      ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(u.x - w / 2, u.y - r - 10, w, 5);
      ctx.fillStyle = '#2ecc71'; ctx.fillRect(u.x - w / 2, u.y - r - 10, w * clamp(u.vida / vm, 0, 1), 5);
    }
    if (!u.bot) {
      ctx.font = `bold ${clamp(10 + r * 0.25, 12, 22)}px system-ui, sans-serif`;
      ctx.textAlign = 'center'; ctx.lineWidth = 3; ctx.strokeStyle = '#000'; ctx.fillStyle = '#fff';
      ctx.strokeText(u.nome, u.x, u.y + r + 15); ctx.fillText(u.nome, u.x, u.y + r + 15);
    }
    if (u.balao && agora < u.balao.ate) {
      ctx.font = 'bold 15px system-ui, sans-serif';
      const w = ctx.measureText(u.balao.texto).width + 16;
      const bx = clamp(u.x - w / 2, CFG.ARENA.x, CFG.ARENA.x + CFG.ARENA.w - w), by = u.y - r - 40;
      ctx.fillStyle = 'rgba(255,255,255,.95)';
      arredondado(bx, by, w, 24, 10); ctx.fill();
      ctx.fillStyle = '#111'; ctx.textAlign = 'left'; ctx.fillText(u.balao.texto, bx + 8, by + 17);
    }
    ctx.restore();
  }

  function arredondado(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }

  const DICAS = [
    '💬 Comente seu PAÍS para entrar no time',
    '❤️ Curta a live: cura e deixa mais forte',
    '🎁 Presente = força + soldados + BOMBA',
    '➕ Seguir = escudo  ·  🔁 Compartilhar = soldados',
    '🏆 Quem dominar mais território vence a rodada',
  ];

  function desenhar() {
    const A = CFG.ARENA, C = CFG.CELULA;
    ctx.save();
    if (tremor > 0) ctx.translate(rnd(-8, 8) * tremor, rnd(-8, 8) * tremor);

    // fundo
    const g = ctx.createLinearGradient(0, 0, 0, CFG.H);
    g.addColorStop(0, '#0a0f24'); g.addColorStop(1, '#111a3a');
    ctx.fillStyle = g; ctx.fillRect(-20, -20, CFG.W + 40, CFG.H + 40);

    // dica rotativa (y 128-176)
    const dica = DICAS[Math.floor(agora / 4) % DICAS.length];
    ctx.fillStyle = 'rgba(255,255,255,.1)'; arredondado(20, 128, CFG.W - 40, 48, 24); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = 'bold 25px system-ui, sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(dica, CFG.W / 2, 161);

    // título + tempo
    ctx.textAlign = 'left'; ctx.font = '900 30px system-ui, sans-serif'; ctx.fillStyle = '#ffd32a';
    ctx.fillText('GUERRA DOS PAÍSES', 24, 214);
    const s = Math.max(0, Math.ceil(tempoRodada));
    ctx.textAlign = 'right'; ctx.fillStyle = s <= 10 ? '#ff4d4d' : '#fff';
    ctx.fillText(`${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`, CFG.W - 24, 214);

    // ranking (top 4)
    const top = porcentagens.slice(0, 4);
    top.forEach((t, i) => {
      const x = 24 + (i % 2) * 340, y = 232 + Math.floor(i / 2) * 32;
      desenharBandeira(t.pais, x + 12, y + 12, 12);
      ctx.fillStyle = 'rgba(255,255,255,.12)'; ctx.fillRect(x + 30, y + 4, 230, 16);
      ctx.fillStyle = t.pais.cor; ctx.fillRect(x + 30, y + 4, 230 * clamp(t.pct / 100, 0, 1), 16);
      ctx.font = 'bold 17px system-ui, sans-serif'; ctx.textAlign = 'left';
      ctx.lineWidth = 4; ctx.strokeStyle = '#000'; ctx.fillStyle = '#fff';
      ctx.strokeText(`${t.pais.cod} ${t.pct.toFixed(0)}%`, x + 36, y + 18);
      ctx.fillText(`${t.pais.cod} ${t.pct.toFixed(0)}%`, x + 36, y + 18);
      const v = vitorias[t.pais.cod] || 0;
      if (v) { ctx.textAlign = 'right'; ctx.fillText(`🏆${v}`, x + 320, y + 18); }
    });

    // arena
    ctx.fillStyle = '#141b38'; arredondado(A.x - 4, A.y - 4, A.w + 8, A.h + 8, 14); ctx.fill();
    for (let cy = 0; cy < rows; cy++) for (let cx = 0; cx < cols; cx++) {
      const cod = grade[cy * cols + cx];
      if (!cod) continue;
      ctx.fillStyle = POR_COD[cod].cor;
      ctx.globalAlpha = 0.55;
      ctx.fillRect(A.x + cx * C, A.y + cy * C, C, C);
    }
    ctx.globalAlpha = 1;
    ctx.strokeStyle = 'rgba(255,255,255,.04)'; ctx.lineWidth = 1;
    for (let cx = 0; cx <= cols; cx++) { ctx.beginPath(); ctx.moveTo(A.x + cx * C, A.y); ctx.lineTo(A.x + cx * C, A.y + rows * C); ctx.stroke(); }
    for (let cy = 0; cy <= rows; cy++) { ctx.beginPath(); ctx.moveTo(A.x, A.y + cy * C); ctx.lineTo(A.x + cols * C, A.y + cy * C); ctx.stroke(); }

    const vivas = [...unidades.values()].filter(u => u.viva).sort((a, b) => raio(a) - raio(b));
    for (const u of vivas) desenharUnidade(u);

    for (const p of particulas) {
      ctx.globalAlpha = clamp(p.vida, 0, 1); ctx.fillStyle = p.cor;
      ctx.fillRect(p.x - p.t / 2, p.y - p.t / 2, p.t, p.t);
    }
    ctx.globalAlpha = 1;
    for (const t of textos) {
      ctx.globalAlpha = clamp(t.vida, 0, 1);
      ctx.font = `900 ${Math.round(22 * t.escala)}px system-ui, sans-serif`; ctx.textAlign = 'center';
      ctx.lineWidth = 4; ctx.strokeStyle = '#000'; ctx.strokeText(t.txt, t.x, t.y);
      ctx.fillStyle = t.cor; ctx.fillText(t.txt, t.x, t.y);
    }
    ctx.globalAlpha = 1;

    // rodapé: feed + top presentes (y 995-1270)
    ctx.textAlign = 'left';
    feed.forEach((f, i) => {
      ctx.globalAlpha = clamp(1 - (agora - f.em) / 20, 0.35, 1);
      ctx.font = 'bold 18px system-ui, sans-serif';
      ctx.fillStyle = f.cor; ctx.fillText('● ', 24, 1022 + i * 28);
      ctx.fillStyle = '#fff'; ctx.fillText(f.txt.slice(0, 40), 44, 1022 + i * 28);
    });
    ctx.globalAlpha = 1;
    const tops = [...doadores.values()].sort((a, b) => b.diamantes - a.diamantes).slice(0, 3);
    if (tops.length) {
      ctx.fillStyle = 'rgba(255,211,42,.12)'; arredondado(24, 1170, CFG.W - 48, 90, 14); ctx.fill();
      ctx.fillStyle = '#ffd32a'; ctx.font = '900 18px system-ui, sans-serif';
      ctx.fillText('TOP PRESENTES DA RODADA', 40, 1196);
      tops.forEach((d, i) => {
        const x = 40 + i * 215;
        desenharBandeira(d.pais, x + 10, 1230, 10);
        ctx.fillStyle = '#fff'; ctx.font = 'bold 17px system-ui, sans-serif';
        ctx.fillText(`${i + 1}. ${d.nome.slice(0, 11)}`, x + 26, 1236);
      });
    }

    // banner de presente grande
    if (banner) faixaCentral(banner.titulo, banner.sub, banner.cor);
    // fim de rodada
    if (fimDeRodada && fimDeRodada.vencedor) {
      const v = fimDeRodada.vencedor;
      ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(A.x, A.y, A.w, A.h);
      desenharBandeira(v.pais, CFG.W / 2, A.y + 230, 90);
      ctx.textAlign = 'center'; ctx.fillStyle = '#ffd32a'; ctx.font = '900 46px system-ui, sans-serif';
      ctx.fillText(`${v.pais.nome.toUpperCase()} VENCEU!`, CFG.W / 2, A.y + 380);
      ctx.fillStyle = '#fff'; ctx.font = 'bold 26px system-ui, sans-serif';
      ctx.fillText(`${v.pct.toFixed(0)}% do mapa  ·  ${vitorias[v.pais.cod] || 1} vitória(s)`, CFG.W / 2, A.y + 425);
      if (fimDeRodada.mvp) ctx.fillText(`MVP: ${fimDeRodada.mvp.nome}`, CFG.W / 2, A.y + 465);
      ctx.font = 'bold 22px system-ui, sans-serif'; ctx.fillStyle = '#ccc';
      ctx.fillText('Nova rodada já vai começar…', CFG.W / 2, A.y + 520);
    }
    ctx.restore();
  }

  function faixaCentral(titulo, sub, cor) {
    const y = CFG.ARENA.y + 40;
    ctx.fillStyle = 'rgba(0,0,0,.75)'; ctx.fillRect(0, y, CFG.W, 100);
    ctx.fillStyle = cor; ctx.fillRect(0, y, CFG.W, 6); ctx.fillRect(0, y + 94, CFG.W, 6);
    ctx.textAlign = 'center'; ctx.fillStyle = '#fff'; ctx.font = '900 34px system-ui, sans-serif';
    ctx.fillText(titulo.slice(0, 30), CFG.W / 2, y + 50);
    ctx.font = 'bold 20px system-ui, sans-serif'; ctx.fillStyle = '#ddd';
    ctx.fillText(sub.slice(0, 44), CFG.W / 2, y + 80);
  }

  // ---------- Laço principal ----------
  let ultimo = performance.now(), acumPct = 0;
  function quadro(t) {
    const dt = Math.min(0.05, (t - ultimo) / 1000); ultimo = t;
    atualizar(dt);
    acumPct += dt; if (acumPct > 0.5) { acumPct = 0; calcularPorcentagens(); }
    desenhar();
    requestAnimationFrame(quadro);
  }
  requestAnimationFrame(quadro);

  // ---------- Conexão com a ponte (eventos reais da live) ----------
  function conectarPonte() {
    if (!/^https?:$/.test(location.protocol)) return;
    const ws = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws?k=${encodeURIComponent(new URLSearchParams(location.search).get('k') || '')}`);
    ws.onmessage = m => { try { evento(JSON.parse(m.data)); } catch { /* ignora mensagem inválida */ } };
    ws.onopen = () => window.dispatchEvent(new CustomEvent('ponte', { detail: true }));
    ws.onclose = () => { window.dispatchEvent(new CustomEvent('ponte', { detail: false })); setTimeout(conectarPonte, 3000); };
  }
  conectarPonte();

  // API para o simulador e testes
  window.jogo = { evento, paisDoTexto, PAISES, estado: () => ({ unidades: unidades.size, porcentagens, tempoRodada }) };
})();
