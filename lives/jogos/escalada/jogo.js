// Escalada dos Países — cada pessoa da live é um alpinista com nome, foto e nível.
// Comentar = subir. Like = subir um pouco. Presente = corda, jetpack, pedra no líder, avalanche.
// Quem chegar no topo primeiro vence a rodada. O nível e as vitórias ficam salvos.
(() => {
  'use strict';

  const CFG = {
    W: 720, H: 1280,
    PAREDE: { x: 76, y: 300, w: 624, h: 650 },
    ALTURA: 500,               // metros até o topo
    RODADA_SEG: 180,           // tempo máximo da rodada
    FIM_SEG: 7,                // comemoração do vencedor
    RECARGA_COMENT: 1.5,       // segundos entre comentários que contam para subir
    INATIVO_SEG: 300,          // some da parede quem não interage há 5 min
    MAX_NA_PAREDE: 60,
    BOTS: 4,                   // alpinistas de enfeite quando a live está vazia
  };
  // Quanto cada ação faz subir (metros) — ajuste aqui
  const SOBE = { comentario: 8, like: 2, seguir: 15, compartilhar: 30 };

  const { desenhar: bandeira, paisDoTexto } = window.BANDEIRAS;
  const POR_COD = Object.fromEntries(window.PAISES.map(p => [p.cod, p]));
  const SOM = (n, i) => window.SONS && window.SONS.tocar(n, i);

  const canvas = document.getElementById('tela');
  const ctx = canvas.getContext('2d');
  canvas.width = CFG.W; canvas.height = CFG.H;

  // ---------- Estado ----------
  let perfis = {};              // id -> { nome, xp, vitorias, pais }  (salvo)
  let vitoriasPais = {};        // cod -> vitórias (salvo)
  let campeao = null;           // país da última vitória (bandeira no topo)
  const parede = new Map();     // id -> alpinista ativo
  const pedras = [], particulas = [], textos = [], feed = [];
  let agora = 0, tempo = CFG.RODADA_SEG, fim = null, banner = null, tremor = 0, sujo = false;

  const rnd = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const nivelDe = xp => 1 + Math.floor(Math.sqrt(xp / 5));
  const mult = j => Math.min(3, 1 + 0.04 * (nivelDe(j.perfil.xp) - 1));
  const resiste = j => Math.min(0.5, 0.02 * nivelDe(j.perfil.xp));
  const yDe = alt => CFG.PAREDE.y + CFG.PAREDE.h - (alt / CFG.ALTURA) * CFG.PAREDE.h;
  function hash(s) { let h = 2166136261; for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; }

  // ---------- Fotos ----------
  const fotos = new Map();
  function foto(url) {
    if (!url) return null;
    if (fotos.has(url)) return fotos.get(url);
    const img = new Image(); img.referrerPolicy = 'no-referrer';
    img.onerror = () => fotos.set(url, null);
    img.src = url; fotos.set(url, img);
    return img;
  }

  // ---------- Alpinistas ----------
  function perfilDe(ev) {
    const p = perfis[ev.id] || (perfis[ev.id] = { nome: ev.nome, xp: 0, vitorias: 0, pais: null });
    p.nome = ev.nome;
    return p;
  }

  function humanos() { let n = 0; for (const j of parede.values()) if (!j.bot) n++; return n; }

  function entrar(ev, paisPedido) {
    const perfil = perfilDe(ev);
    if (paisPedido && perfil.pais !== paisPedido.cod) {
      perfil.pais = paisPedido.cod;
      const j0 = parede.get(ev.id);
      if (j0) { j0.pais = paisPedido; noFeed(`${ev.nome} agora sobe por ${paisPedido.nome}`, paisPedido.cor); }
    }
    let j = parede.get(ev.id);
    if (!j) {
      const pais = POR_COD[perfil.pais] || POR_COD.BRA;
      if (!perfil.pais) perfil.pais = pais.cod;
      j = {
        id: ev.id, perfil, pais, bot: false, foto: foto(ev.foto),
        x: CFG.PAREDE.x + 40 + hash(ev.id) % (CFG.PAREDE.w - 80),
        alt: 0, altVis: 0, escudoAte: 0, ultimoComent: -99, ativo: agora, balao: null, golpeAte: 0,
      };
      parede.set(ev.id, j);
      noFeed(`${ev.nome} começou a escalar (Nv ${nivelDe(perfil.xp)})`, pais.cor);
      flutuar(j.x, yDe(0) - 30, 'ENTROU!', pais.cor);
      SOM('entrou', 0.2);
      // bots saem quando chega gente de verdade
      if (humanos() >= 3) for (const b of [...parede.values()]) if (b.bot) parede.delete(b.id);
      limitar();
    }
    if (ev.foto && !j.foto) j.foto = foto(ev.foto);
    j.ativo = agora;
    return j;
  }

  function limitar() {
    if (parede.size <= CFG.MAX_NA_PAREDE) return;
    const ordem = [...parede.values()].sort((a, b) => (b.bot - a.bot) || (a.ativo - b.ativo));
    while (parede.size > CFG.MAX_NA_PAREDE) parede.delete(ordem.shift().id);
  }

  function ganharXp(j, xp) {
    if (j.bot) return;
    const antes = nivelDe(j.perfil.xp);
    j.perfil.xp += xp; sujo = true;
    const depois = nivelDe(j.perfil.xp);
    if (depois > antes) { flutuar(j.x, yDe(j.altVis) - 44, `NÍVEL ${depois}!`, '#7bed9f', 1.3); SOM('escudo', 0.3); }
  }

  function subir(j, m) {
    if (fim) return;
    const ganho = m * (j.bot ? 1 : mult(j));
    j.alt = Math.min(CFG.ALTURA, j.alt + ganho);
    if (j.alt >= CFG.ALTURA && !j.bot) vencer(j);
  }

  function cair(j, m, quem) {
    if (fim) return;
    if (agora < j.escudoAte) { flutuar(j.x, yDe(j.altVis) - 30, 'BLOQUEOU!', '#74b9ff'); return; }
    const perda = Math.round(m * (j.bot ? 1 : 1 - resiste(j)));
    j.alt = Math.max(0, j.alt - perda);
    j.golpeAte = agora + 0.6;
    flutuar(j.x, yDe(j.altVis) - 30, `-${perda}m`, '#ff6b6b', 1.2);
    SOM('queda', 0.15);
    if (quem && !j.bot) noFeed(`${quem} derrubou ${j.perfil.nome} (-${perda}m)`, '#ff6b6b');
  }

  function lider(excetoId) {
    let m = null;
    for (const j of parede.values()) if (!j.bot && j.id !== excetoId && (!m || j.alt > m.alt)) m = j;
    return m;
  }

  // ---------- Eventos da live ----------
  function evento(ev) {
    if (!ev || !ev.tipo) return;
    ev.id = String(ev.id || ev.nome || 'anon');
    ev.nome = String(ev.nome || 'anônimo').slice(0, 16);
    if (ev.tipo === 'comentario') {
      const j = entrar(ev, paisDoTexto(ev.texto));
      j.balao = { texto: String(ev.texto || '').slice(0, 26), ate: agora + 2.5 };
      if (agora - j.ultimoComent >= CFG.RECARGA_COMENT) {
        j.ultimoComent = agora; subir(j, SOBE.comentario); ganharXp(j, 1); SOM('subir');
      }
    } else if (ev.tipo === 'like') {
      const n = clamp(ev.likes || 1, 1, 15);
      const j = entrar(ev, null);
      subir(j, SOBE.like * n); ganharXp(j, 0.2 * n);
      for (let i = 0; i < Math.min(n, 4); i++) flutuar(j.x + rnd(-14, 14), yDe(j.altVis) - 26, '❤', '#ff4d6d', 0.8);
    } else if (ev.tipo === 'seguir') {
      const j = entrar(ev, null);
      j.escudoAte = agora + 15; subir(j, SOBE.seguir); ganharXp(j, 5);
      noFeed(`${ev.nome} seguiu → escudo 15s`, '#74b9ff'); SOM('escudo');
    } else if (ev.tipo === 'compartilhar') {
      const j = entrar(ev, null);
      subir(j, SOBE.compartilhar); ganharXp(j, 5);
      noFeed(`${ev.nome} compartilhou → +${SOBE.compartilhar}m`, j.pais.cor);
    } else if (ev.tipo === 'presente') {
      presente(ev);
    }
  }

  function presente(ev) {
    const d = Math.max(1, (ev.diamantes || 1) * (ev.qtd || 1));
    const j = entrar(ev, null);
    ganharXp(j, d * 3);
    let efeito = `+${Math.round(Math.min(5 * d, 40))}m`;
    subir(j, Math.min(5 * d, 40));
    if (d >= 5) { j.escudoAte = Math.max(j.escudoAte, agora + 10); subir(j, 20); efeito = 'CORDA + escudo'; }
    if (d >= 30) {
      const alvo = lider(j.id);
      if (alvo && alvo.alt > 0) { soltarPedra(alvo.x, 34, 60, ev.nome); efeito = `PEDRA em ${alvo.perfil.nome}`; }
    }
    if (d >= 100) {
      j.escudoAte = Math.max(j.escudoAte, agora + 15); subir(j, 100); efeito = 'JETPACK!';
      mostrarBanner(`${ev.nome} ligou o JETPACK`, `+100m e escudo · ${j.pais.nome}`, j.pais.cor);
    }
    if (d >= 500) {
      for (const o of parede.values()) if (o !== j) cair(o, 80, null);
      tremor = 1.2; efeito = 'AVALANCHE!';
      mostrarBanner('AVALANCHE!', `${ev.nome} derrubou todo mundo`, '#dfe6e9');
      SOM('pedra');
    }
    flutuar(j.x, yDe(j.altVis) - 50, efeito, '#ffd32a', 1.4);
    noFeed(`${ev.nome} mandou ${ev.presente || 'presente'} → ${efeito}`, '#ffd32a');
    SOM('presente', 0.15);
  }

  // ---------- Pedras ----------
  function soltarPedra(x, r = 18, dano = 25, quem = null) {
    pedras.push({ x, y: CFG.PAREDE.y - 30, r, dano, quem, vy: 380, rot: 0, atingidos: new Set() });
  }

  // ---------- Rodada ----------
  function vencer(j) {
    fim = { j, ate: agora + CFG.FIM_SEG };
    j.perfil.vitorias++; vitoriasPais[j.pais.cod] = (vitoriasPais[j.pais.cod] || 0) + 1;
    campeao = j.pais; sujo = true; salvar();
    tremor = 0.6; SOM('vitoria');
    for (let i = 0; i < 120; i++) {
      const a = rnd(0, Math.PI * 2), s = rnd(100, 600);
      particulas.push({ x: j.x, y: yDe(CFG.ALTURA), vx: Math.cos(a) * s, vy: Math.sin(a) * s - 200, vida: rnd(0.8, 2), cor: i % 2 ? j.pais.cor : '#ffd32a', t: rnd(4, 8) });
    }
  }

  function novaRodada() {
    fim = null; tempo = CFG.RODADA_SEG; pedras.length = 0;
    for (const j of [...parede.values()]) {
      if (!j.bot && agora - j.ativo > CFG.INATIVO_SEG) { parede.delete(j.id); continue; }
      j.alt = 0;
    }
  }

  function fimDoTempo() {
    const l = lider(null);
    if (l && l.alt > 0) vencer(l); else novaRodada();
  }

  // ---------- Bots ----------
  let nBot = 0;
  function manterBots() {
    if (humanos() > 0) return;
    let bots = 0; for (const j of parede.values()) if (j.bot) bots++;
    if (bots >= CFG.BOTS) return;
    const cod = window.PAISES_BOTS[Math.floor(Math.random() * window.PAISES_BOTS.length)];
    const id = 'bot' + (++nBot);
    parede.set(id, {
      id, perfil: { nome: '', xp: 0 }, pais: POR_COD[cod], bot: true, foto: null,
      x: CFG.PAREDE.x + 40 + Math.random() * (CFG.PAREDE.w - 80),
      alt: rnd(0, CFG.ALTURA * 0.3), altVis: 0, escudoAte: 0, ativo: agora, balao: null, golpeAte: 0, vel: rnd(1, 3),
    });
  }

  // ---------- Feed / textos ----------
  function noFeed(txt, cor) { feed.unshift({ txt, cor, em: agora }); if (feed.length > 5) feed.pop(); }
  function flutuar(x, y, txt, cor, escala = 1) { textos.push({ x, y, txt, cor, vida: 1.5, escala }); }
  function mostrarBanner(titulo, sub, cor) { banner = { titulo, sub, cor, ate: agora + 3.5 }; }

  // ---------- Atualização ----------
  let proxPedra = 6;
  function atualizar(dt) {
    agora += dt;
    if (fim) { if (agora >= fim.ate) novaRodada(); }
    else { tempo -= dt; if (tempo <= 0) fimDoTempo(); }
    manterBots();

    for (const j of parede.values()) {
      if (j.bot && !fim) j.alt = Math.min(CFG.ALTURA * 0.7, j.alt + j.vel * dt); // bots nunca vencem
      j.altVis += (j.alt - j.altVis) * Math.min(1, dt * 4);
    }

    // pedras naturais
    proxPedra -= dt;
    if (proxPedra <= 0 && !fim) { proxPedra = rnd(5, 9); soltarPedra(rnd(CFG.PAREDE.x + 30, CFG.PAREDE.x + CFG.PAREDE.w - 30)); }
    for (const p of pedras) {
      p.vy += 300 * dt; p.y += p.vy * dt; p.rot += dt * 6;
      for (const j of parede.values()) {
        if (p.atingidos.has(j.id)) continue;
        const jy = yDe(j.altVis);
        if (Math.abs(p.x - j.x) < p.r + 20 && Math.abs(p.y - jy) < p.r + 20) {
          p.atingidos.add(j.id); cair(j, p.dano, p.quem);
          SOM('pedra', 0.2);
          for (let i = 0; i < 14; i++) particulas.push({ x: p.x, y: p.y, vx: rnd(-200, 200), vy: rnd(-250, 50), vida: rnd(0.3, 0.7), cor: '#8d6e63', t: rnd(3, 6) });
        }
      }
    }
    for (let i = pedras.length - 1; i >= 0; i--) if (pedras[i].y > CFG.PAREDE.y + CFG.PAREDE.h + 40) pedras.splice(i, 1);

    for (const p of particulas) { p.vy += 400 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.98; p.vida -= dt; }
    for (let i = particulas.length - 1; i >= 0; i--) if (particulas[i].vida <= 0) particulas.splice(i, 1);
    for (const t of textos) { t.y -= 35 * dt; t.vida -= dt; }
    for (let i = textos.length - 1; i >= 0; i--) if (textos[i].vida <= 0) textos.splice(i, 1);
    if (banner && agora > banner.ate) banner = null;
    tremor = Math.max(0, tremor - dt);
  }

  // ---------- Cenário (desenhado uma vez) ----------
  const cenario = document.createElement('canvas');
  cenario.width = CFG.W; cenario.height = CFG.H;
  (function desenharCenario() {
    const c = cenario.getContext('2d'), P = CFG.PAREDE;
    let s = 7; const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
    const ceu = c.createLinearGradient(0, 0, 0, CFG.H);
    ceu.addColorStop(0, '#0b1030'); ceu.addColorStop(0.5, '#2a1f4f'); ceu.addColorStop(1, '#0d1226');
    c.fillStyle = ceu; c.fillRect(0, 0, CFG.W, CFG.H);
    for (let i = 0; i < 140; i++) { c.fillStyle = `rgba(255,255,255,${r() * 0.7})`; c.fillRect(r() * CFG.W, r() * 900, 2, 2); }
    // montanhas ao fundo
    c.fillStyle = '#1b1838';
    c.beginPath(); c.moveTo(0, 900);
    for (let x = 0; x <= CFG.W; x += 60) c.lineTo(x, 520 + r() * 260);
    c.lineTo(CFG.W, CFG.H); c.lineTo(0, CFG.H); c.fill();
    // paredão
    const g = c.createLinearGradient(0, P.y, 0, P.y + P.h);
    g.addColorStop(0, '#4c5170'); g.addColorStop(1, '#262a3d');
    c.fillStyle = g;
    c.beginPath();
    c.moveTo(P.x, P.y + P.h); c.lineTo(P.x + 10, P.y + 40);
    c.lineTo(P.x + P.w * 0.42, P.y - 12); c.lineTo(P.x + P.w * 0.5, P.y - 40); c.lineTo(P.x + P.w * 0.58, P.y - 12);
    c.lineTo(P.x + P.w - 10, P.y + 40); c.lineTo(P.x + P.w, P.y + P.h); c.closePath(); c.fill();
    c.save(); c.clip();
    for (let i = 0; i < 260; i++) {
      const x = P.x + r() * P.w, y = P.y - 40 + r() * (P.h + 40), w = 10 + r() * 40;
      c.fillStyle = `rgba(${r() < 0.5 ? '0,0,0' : '255,255,255'},${0.04 + r() * 0.08})`;
      c.beginPath(); c.moveTo(x, y); c.lineTo(x + w, y + r() * 12); c.lineTo(x + w * 0.6, y + w * 0.5); c.closePath(); c.fill();
    }
    // neve no topo
    const ng = c.createLinearGradient(0, P.y - 40, 0, P.y + 70);
    ng.addColorStop(0, 'rgba(255,255,255,.9)'); ng.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = ng; c.fillRect(P.x, P.y - 40, P.w, 70);
    c.restore();
    // régua de altura
    c.font = 'bold 15px system-ui, sans-serif'; c.textAlign = 'right';
    for (let m = 0; m <= CFG.ALTURA; m += CFG.ALTURA / 10) {
      const y = yDe(m);
      c.fillStyle = 'rgba(255,255,255,.55)'; c.fillText(m === CFG.ALTURA ? 'TOPO' : `${m}m`, P.x - 8, y + 5);
      c.fillStyle = 'rgba(255,255,255,.12)'; c.fillRect(P.x, y, P.w, 1);
    }
  })();

  // ---------- Desenho ----------
  function arred(x, y, w, h, r) {
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  function texto(t, x, y, tam, cor = '#fff', alinhar = 'left', peso = 'bold') {
    ctx.font = `${peso} ${tam}px system-ui, sans-serif`; ctx.textAlign = alinhar;
    ctx.lineWidth = Math.max(3, tam / 6); ctx.strokeStyle = 'rgba(0,0,0,.85)'; ctx.strokeText(t, x, y);
    ctx.fillStyle = cor; ctx.fillText(t, x, y);
  }
  function coroa(x, y, s) {
    ctx.fillStyle = '#ffd32a'; ctx.strokeStyle = '#7a5c00'; ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x - s, y); ctx.lineTo(x - s, y - s * 0.9); ctx.lineTo(x - s * 0.5, y - s * 0.4); ctx.lineTo(x, y - s * 1.1);
    ctx.lineTo(x + s * 0.5, y - s * 0.4); ctx.lineTo(x + s, y - s * 0.9); ctx.lineTo(x + s, y); ctx.closePath();
    ctx.fill(); ctx.stroke();
  }

  const DICAS = [
    '💬 Comente para SUBIR a montanha',
    '🌎 Comente seu país e escale pela bandeira',
    '❤️ Curtir também sobe  ·  ➕ Seguir = escudo',
    '🎁 Presente = corda, JETPACK, pedra no líder',
    '🏔️ Quem chegar no TOPO primeiro vence!',
  ];

  function desenharAlpinista(j, ehLider, comNome) {
    const y = yDe(j.altVis), r = ehLider ? 28 : 22;
    // corda até o chão
    ctx.strokeStyle = 'rgba(255,255,255,.22)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(j.x, y + r); ctx.lineTo(j.x, CFG.PAREDE.y + CFG.PAREDE.h); ctx.stroke();
    const sac = agora < j.golpeAte ? rnd(-4, 4) : 0;
    const x = j.x + sac;
    if (j.foto && j.foto.complete && j.foto.naturalWidth) {
      ctx.save(); ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.clip();
      ctx.drawImage(j.foto, x - r, y - r, r * 2, r * 2); ctx.restore();
      bandeira(ctx, j.pais, x + r * 0.75, y + r * 0.75, 10);
    } else {
      bandeira(ctx, j.pais, x, y, r);
    }
    ctx.lineWidth = 4; ctx.strokeStyle = agora < j.golpeAte ? '#ff4d4d' : j.pais.cor;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke();
    if (agora < j.escudoAte) {
      ctx.strokeStyle = `rgba(116,185,255,${0.6 + 0.4 * Math.sin(agora * 10)})`; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(x, y, r + 7, 0, Math.PI * 2); ctx.stroke();
    }
    if (ehLider) coroa(x, y - r - 4, 14);
    if (!j.bot && comNome) {
      texto(`${j.perfil.nome} · Nv${nivelDe(j.perfil.xp)}`, x, y + r + 17, ehLider ? 18 : 15, ehLider ? '#ffd32a' : '#fff', 'center');
    }
    if (j.balao && agora < j.balao.ate) {
      ctx.font = 'bold 15px system-ui, sans-serif';
      const w = ctx.measureText(j.balao.texto).width + 16;
      const bx = clamp(x - w / 2, CFG.PAREDE.x, CFG.PAREDE.x + CFG.PAREDE.w - w), by = y - r - (ehLider ? 52 : 38);
      ctx.fillStyle = 'rgba(255,255,255,.95)'; arred(bx, by, w, 24, 10); ctx.fill();
      ctx.fillStyle = '#111'; ctx.textAlign = 'left'; ctx.fillText(j.balao.texto, bx + 8, by + 17);
    }
  }

  function desenhar() {
    ctx.save();
    if (tremor > 0) ctx.translate(rnd(-9, 9) * tremor, rnd(-9, 9) * tremor);
    ctx.drawImage(cenario, 0, 0);
    const P = CFG.PAREDE;

    // bandeira do último campeão no topo
    const topoX = P.x + P.w * 0.5, topoY = P.y - 40;
    ctx.strokeStyle = '#ddd'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(topoX, topoY); ctx.lineTo(topoX, topoY - 50); ctx.stroke();
    if (campeao) bandeira(ctx, campeao, topoX + 16, topoY - 40, 13);

    // dica rotativa
    ctx.fillStyle = 'rgba(0,0,0,.35)'; arred(20, 128, CFG.W - 40, 48, 24); ctx.fill();
    texto(DICAS[Math.floor(agora / 4) % DICAS.length], CFG.W / 2, 161, 25, '#fff', 'center');

    // título e tempo
    texto('ESCALADA DOS PAÍSES', 24, 215, 30, '#ffd32a', 'left', '900');
    const s = Math.max(0, Math.ceil(tempo));
    texto(`${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`, CFG.W - 24, 215, 30, s <= 15 ? '#ff4d4d' : '#fff', 'right', '900');

    // pódio da rodada
    const ordem = [...parede.values()].filter(j => !j.bot).sort((a, b) => b.alt - a.alt);
    ordem.slice(0, 3).forEach((j, i) => {
      const x = 24 + i * 228;
      bandeira(ctx, j.pais, x + 11, 248, 11);
      texto(`${i + 1}º ${j.perfil.nome.slice(0, 9)} ${Math.round(j.alt)}m`, x + 28, 254, 17, i === 0 ? '#ffd32a' : '#fff');
    });
    if (!ordem.length) texto('Comente para ser o primeiro a escalar!', CFG.W / 2, 254, 18, '#ccc', 'center');

    // alpinistas (líder por último, por cima)
    const lid = ordem[0];
    const lista = [...parede.values()].sort((a, b) => (a === lid) - (b === lid) || a.altVis - b.altVis);
    // nome só dos 10 mais altos e de quem acabou de comentar, para não embolar
    const comNome = new Set(ordem.slice(0, 10));
    for (const j of lista) desenharAlpinista(j, j === lid && lid.alt > 0, comNome.has(j) || (j.balao && agora < j.balao.ate));

    for (const p of pedras) {
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
      ctx.fillStyle = '#6d4c41'; ctx.beginPath();
      for (let i = 0; i < 7; i++) { const a = i / 7 * Math.PI * 2, rr = p.r * (0.8 + (i % 2) * 0.2); ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#4e342e'; ctx.beginPath(); ctx.arc(-p.r * 0.3, -p.r * 0.2, p.r * 0.25, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      if (p.quem) texto(p.quem, p.x, p.y - p.r - 6, 14, '#ffb142', 'center');
    }
    for (const p of particulas) { ctx.globalAlpha = clamp(p.vida, 0, 1); ctx.fillStyle = p.cor; ctx.fillRect(p.x, p.y, p.t, p.t); }
    ctx.globalAlpha = 1;
    for (const t of textos) { ctx.globalAlpha = clamp(t.vida, 0, 1); texto(t.txt, t.x, t.y, Math.round(20 * t.escala), t.cor, 'center', '900'); }
    ctx.globalAlpha = 1;

    // rodapé: feed (esquerda) + hall da fama (direita)
    feed.forEach((f, i) => {
      ctx.globalAlpha = clamp(1 - (agora - f.em) / 25, 0.35, 1);
      ctx.fillStyle = f.cor; ctx.beginPath(); ctx.arc(30, 1036 + i * 27, 5, 0, Math.PI * 2); ctx.fill();
      texto(f.txt.slice(0, 34), 42, 1042 + i * 27, 16);
    });
    ctx.globalAlpha = 1;
    const fama = Object.values(perfis).filter(p => p.vitorias > 0).sort((a, b) => b.vitorias - a.vitorias || b.xp - a.xp).slice(0, 5);
    ctx.fillStyle = 'rgba(255,211,42,.1)'; arred(460, 1015, 236, 150, 14); ctx.fill();
    texto('🏆 HALL DA FAMA', 474, 1041, 16, '#ffd32a', 'left', '900');
    if (!fama.length) texto('ninguém ainda…', 474, 1068, 14, '#bbb');
    fama.forEach((p, i) => {
      if (p.pais && POR_COD[p.pais]) bandeira(ctx, POR_COD[p.pais], 482, 1062 + i * 21, 7);
      texto(`${p.nome.slice(0, 11)}`, 494, 1067 + i * 21, 14);
      texto(`${p.vitorias}`, 684, 1067 + i * 21, 14, '#ffd32a', 'right');
    });

    if (banner && !fim) {
      const y = P.y + 60;
      ctx.fillStyle = 'rgba(0,0,0,.75)'; ctx.fillRect(0, y, CFG.W, 100);
      ctx.fillStyle = banner.cor; ctx.fillRect(0, y, CFG.W, 6); ctx.fillRect(0, y + 94, CFG.W, 6);
      texto(banner.titulo.slice(0, 30), CFG.W / 2, y + 52, 34, '#fff', 'center', '900');
      texto(banner.sub.slice(0, 44), CFG.W / 2, y + 82, 19, '#ddd', 'center');
    }

    if (fim) {
      const j = fim.j;
      ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(0, P.y - 50, CFG.W, P.h + 60);
      const cy = P.y + 220, r = 90;
      if (j.foto && j.foto.complete && j.foto.naturalWidth) {
        ctx.save(); ctx.beginPath(); ctx.arc(CFG.W / 2, cy, r, 0, Math.PI * 2); ctx.clip();
        ctx.drawImage(j.foto, CFG.W / 2 - r, cy - r, r * 2, r * 2); ctx.restore();
      } else bandeira(ctx, j.pais, CFG.W / 2, cy, r);
      ctx.strokeStyle = '#ffd32a'; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(CFG.W / 2, cy, r, 0, Math.PI * 2); ctx.stroke();
      coroa(CFG.W / 2, cy - r - 8, 34);
      texto(`${j.perfil.nome.toUpperCase()}`, CFG.W / 2, cy + r + 60, 46, '#ffd32a', 'center', '900');
      texto('CHEGOU NO TOPO!', CFG.W / 2, cy + r + 105, 32, '#fff', 'center', '900');
      texto(`${j.pais.nome} · Nível ${nivelDe(j.perfil.xp)} · ${j.perfil.vitorias} vitória(s)`, CFG.W / 2, cy + r + 145, 22, '#ddd', 'center');
      texto('Nova escalada já vai começar…', CFG.W / 2, cy + r + 190, 20, '#aaa', 'center');
    }
    ctx.restore();
  }

  // ---------- Salvar / carregar (níveis e vitórias) ----------
  let ws = null;
  function dados() {
    // guarda só os 5000 perfis com mais XP para o arquivo não crescer sem limite
    const lista = Object.entries(perfis).sort((a, b) => b[1].xp - a[1].xp).slice(0, 5000);
    return { perfis: Object.fromEntries(lista), vitoriasPais, campeao: campeao && campeao.cod };
  }
  function carregar(d) {
    if (!d || typeof d !== 'object') return;
    perfis = Object.assign(d.perfis || {}, perfis);
    vitoriasPais = d.vitoriasPais || vitoriasPais;
    if (d.campeao && POR_COD[d.campeao]) campeao = POR_COD[d.campeao];
    for (const j of parede.values()) if (!j.bot && perfis[j.id]) j.perfil = perfis[j.id];
  }
  function salvar() {
    const d = dados();
    if (ws && ws.readyState === 1) ws.send(JSON.stringify({ tipo: 'salvar', jogo: 'escalada', dados: d }));
    try { localStorage.setItem('escalada_dados', JSON.stringify(d)); } catch { /* sem storage */ }
    sujo = false;
  }
  try { carregar(JSON.parse(localStorage.getItem('escalada_dados') || 'null')); } catch { /* sem storage */ }
  setInterval(() => { if (sujo) salvar(); }, 20000);

  function conectarPonte() {
    if (!/^https?:$/.test(location.protocol)) return;
    ws = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`);
    ws.onopen = () => { ws.send(JSON.stringify({ tipo: 'pedir_dados', jogo: 'escalada' })); window.dispatchEvent(new CustomEvent('ponte', { detail: true })); };
    ws.onmessage = m => {
      let ev; try { ev = JSON.parse(m.data); } catch { return; }
      if (ev.tipo === 'dados') carregar(ev.dados); else evento(ev);
    };
    ws.onclose = () => { window.dispatchEvent(new CustomEvent('ponte', { detail: false })); setTimeout(conectarPonte, 3000); };
  }
  conectarPonte();

  // ---------- Laço ----------
  let ultimo = performance.now();
  function quadro(t) {
    const dt = Math.min(0.05, (t - ultimo) / 1000); ultimo = t;
    atualizar(dt); desenhar();
    requestAnimationFrame(quadro);
  }
  requestAnimationFrame(quadro);

  window.jogo = { evento, estado: () => ({ naParede: parede.size, tempo, fim: !!fim, perfis: Object.keys(perfis).length }) };
})();
