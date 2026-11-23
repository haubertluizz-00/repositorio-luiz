// Tocador da "A LAJE DO TIO JUCA".
// Fica sorteando trechos dos vídeos "parados" (loop disfarçado: ordem aleatória, ponto de início e duração
// diferentes, troca suave, zoom/câmera diferente a cada trecho, luz do horário real do Rio, pombos passando),
// solta uma "fala" de vez em quando e, quando chega presente, corta para o vídeo do presente com o nome de quem mandou.
(() => {
  'use strict';
  const C = window.LAJE;
  const PASTA = 'clipes/';
  const $ = id => document.getElementById(id);
  const rnd = (a, b) => a + Math.random() * (b - a);
  const agoraS = () => performance.now() / 1000;
  const urlFoto = u => (u && /^https?:$/.test(location.protocol) ? '/foto?u=' + encodeURIComponent(u) : '');
  document.getElementById('titulo').textContent = C.titulo;

  // ---------- dois vídeos, para trocar com fade ----------
  const cams = [{ cam: $('camA'), v: $('vA') }, { cam: $('camB'), v: $('vB') }];
  let atual = 0, somBloqueado = false;

  function esperarEvento(el, nome, ms) {
    return new Promise(r => {
      const f = () => { el.removeEventListener(nome, f); clearTimeout(t); r(true); };
      const t = setTimeout(() => { el.removeEventListener(nome, f); r(false); }, ms);
      el.addEventListener(nome, f);
    });
  }
  async function preparar(v, arquivo, { inicio = 0, inicioFrac = null, seg = 0 } = {}) {
    const url = new URL(PASTA + arquivo, location.href).href;
    if (v.src !== url) { v.src = url; v.load(); await esperarEvento(v, 'loadedmetadata', 6000); }
    const dur = isFinite(v.duration) ? v.duration : 0;
    let ini = inicioFrac !== null ? inicioFrac * Math.max(0, dur - seg - 0.8) : inicio;
    ini = Math.max(0, Math.min(ini, Math.max(0, dur - 1)));
    if (Math.abs(v.currentTime - ini) > 0.05) { v.currentTime = ini; await esperarEvento(v, 'seeked', 4000); }
  }
  async function tocar(v) {
    v.muted = somBloqueado;
    try { await v.play(); }
    catch (e) {
      if (e && e.name === 'NotAllowedError') { somBloqueado = true; v.muted = true; $('som').style.display = 'grid'; try { await v.play(); } catch { /* segue */ } }
    }
  }
  $('som').onclick = () => { somBloqueado = false; $('som').style.display = 'none'; cams.forEach(c => { c.v.muted = false; }); cams[atual].v.play().catch(() => {}); };

  function volumeAte(v, alvo, ms) {
    const ini = v.volume, t0 = performance.now();
    (function f() {
      const p = Math.min(1, (performance.now() - t0) / ms);
      v.volume = Math.max(0, Math.min(1, ini + (alvo - ini) * p));
      if (p < 1) requestAnimationFrame(f);
    })();
  }
  // movimento de câmera (zoom lento e diferente a cada trecho)
  function camera(v, tipo, dur) {
    v.style.transition = 'none';
    if (tipo === 'nenhum') { v.style.transform = 'none'; return; }
    const forte = tipo === 'leve' ? 0.4 : 1;
    const s1 = 1 + rnd(0.02, 0.08) * forte, s2 = 1 + rnd(0.05, 0.14) * forte;
    const p = () => `${rnd(-2.5, 2.5) * forte}%`;
    const de = `scale(${s1}) translate(${p()}, ${p()})`, ate = `scale(${s2}) translate(${p()}, ${p()})`;
    const [a, b] = Math.random() < 0.5 ? [de, ate] : [ate, de];
    v.style.transform = a;
    void v.offsetWidth;
    v.style.transition = `transform ${Math.max(2, dur)}s linear`;
    v.style.transform = b;
  }
  async function trocar(arquivo, { corte = false, cam = 'normal', loop = false, vol = 1, ...op } = {}) {
    const prox = cams[1 - atual], ant = cams[atual];
    await preparar(prox.v, arquivo, op);
    prox.v.loop = loop;
    const dur = isFinite(prox.v.duration) ? prox.v.duration - prox.v.currentTime : 8;
    camera(prox.v, cam, op.seg || dur);
    prox.v.volume = corte ? vol : 0;
    await tocar(prox.v);
    prox.cam.style.transition = ant.cam.style.transition = corte ? 'none' : '';
    if (corte) flash();
    prox.cam.classList.add('ativa'); ant.cam.classList.remove('ativa');
    if (!corte) volumeAte(prox.v, vol, 700);
    volumeAte(ant.v, 0, corte ? 50 : 700);
    setTimeout(() => ant.v.pause(), 900);
    atual = 1 - atual;
    return prox.v;
  }
  function flash() { const f = $('flash'); f.classList.add('on'); requestAnimationFrame(() => requestAnimationFrame(() => f.classList.remove('on'))); }

  // ---------- fila de presentes e o ciclo principal ----------
  const fila = [];
  let acordar = null, pendente = false;
  let tioFalando = false;   // enquanto a voz do tio toca, mostra o vídeo "falando" (boca mexendo)
  const avisar = () => { if (acordar) { const a = acordar; acordar = null; a(); } else pendente = true; };
  const esperarOuPresente = ms => new Promise(r => {
    if (pendente) { pendente = false; r(true); return; }
    const t = setTimeout(() => { acordar = null; r(false); }, ms);
    acordar = () => { clearTimeout(t); r(true); };
  });
  const sortear = (lista, ultimo) => {
    if (lista.length < 2) return lista[0];
    let x; do { x = lista[Math.floor(Math.random() * lista.length)]; } while (x === ultimo);
    return x;
  };

  async function ciclo() {
    let ultimoParado = null, ultimaFala = null, ultimoFalando = null, proxFala = agoraS() + rnd(...C.falaACada);
    for (;;) {
      try {
        // presente COM vídeo corta a cena; presente sem vídeo é animado por cima (laço próprio, lá embaixo)
        const comVideo = fila.findIndex(p => p.faixa.arquivo);
        if (comVideo >= 0) { await tocarPresente(fila.splice(comVideo, 1)[0]); continue; }
        if (tioFalando && (C.falando || []).length) {
          // vídeo "falando" começa e termina no mesmo quadro do "parado": em loop não aparece emenda
          ultimoFalando = sortear(C.falando, ultimoFalando);
          await trocar(ultimoFalando, { inicio: 0, cam: 'nenhum', loop: true, vol: 0.15 });
          while (tioFalando && !fila.some(p => p.faixa.arquivo)) await esperarOuPresente(30000);
          continue;
        }
        if (C.falas.length && agoraS() >= proxFala) {
          proxFala = agoraS() + rnd(...C.falaACada);
          ultimaFala = sortear(C.falas, ultimaFala);
          const v = await trocar(ultimaFala, { inicio: 0, cam: 'leve' });
          await esperarOuPresente(Math.max(1, (v.duration - v.currentTime) - 0.6) * 1000);
          continue;
        }
        if (C.parados.length === 1) {
          // um vídeo parado só (ida e volta, 1º quadro = último): toca em loop direto, sem cortes nem zoom,
          // para emendar perfeito com o vídeo "falando", que começa na mesma pose
          const ativo = cams[atual].v;
          if (!(ativo.loop && ativo.src.endsWith('/' + C.parados[0]))) await trocar(C.parados[0], { inicio: 0, cam: 'nenhum', loop: true });
          await esperarOuPresente(15000);
          continue;
        }
        ultimoParado = sortear(C.parados, ultimoParado);
        const seg = rnd(6, 13);
        const v = await trocar(ultimoParado, { inicioFrac: Math.random(), seg });
        const resta = Math.max(2, Math.min(seg, (v.duration - v.currentTime) - 0.8));
        await esperarOuPresente(resta * 1000);
      } catch (e) {
        console.warn('[laje]', e);
        await new Promise(r => setTimeout(r, 1500));
      }
    }
  }

  // ---------- presente sem vídeo: só o nome na tela (o Tio Juca agradece pela voz) ----------
  const espera = ms => new Promise(r => setTimeout(r, ms));
  async function mostrarPresente(p) {
    mostrarFila();
    const ev = $('evento');
    ev.querySelector('.nome').textContent = p.nome + (p.qtd > 1 ? `  x${p.qtd}` : '');
    ev.querySelector('.linha2').textContent = `🎁 MANDOU ${(p.presente || 'PRESENTE').toUpperCase()} PRO TIO!`;
    const img = ev.querySelector('img');
    if (p.foto) { img.src = urlFoto(p.foto); img.style.display = ''; } else img.style.display = 'none';
    ev.classList.add('ver');
    await espera(4500);
    ev.classList.remove('ver');
    await espera(400);
  }

  let acordarAnim = null;
  async function lacoAnimacoes() {
    for (;;) {
      const i = fila.findIndex(p => !p.faixa.arquivo);
      if (i < 0) { await new Promise(r => { acordarAnim = r; }); acordarAnim = null; continue; }
      try { await mostrarPresente(fila.splice(i, 1)[0]); } catch (e) { console.warn('[laje]', e); }
    }
  }

  async function tocarPresente(p) {
    mostrarFila();
    const ev = $('evento');
    ev.querySelector('.nome').textContent = p.nome + (p.qtd > 1 ? `  x${p.qtd}` : '');
    ev.querySelector('.linha2').textContent = `${p.faixa.ico} ${p.faixa.evento.toUpperCase()}!`;
    const img = ev.querySelector('img');
    if (p.foto) { img.src = urlFoto(p.foto); img.style.display = ''; } else img.style.display = 'none';
    const v = await trocar(p.faixa.arquivo, { inicio: 0, corte: true, cam: 'leve' });
    ev.classList.add('ver');
    const dur = Math.max(2, (v.duration || 8) - v.currentTime);
    await new Promise(r => { const t = setTimeout(r, (dur + 1.5) * 1000); v.onended = () => { clearTimeout(t); r(); }; });
    v.onended = null;
    ev.classList.remove('ver');
  }

  function mostrarFila() {
    const el = $('fila'); el.textContent = '';
    if (!fila.length) return;
    const t = document.createElement('div'); t.textContent = 'PRÓXIMOS NA LAJE:'; el.appendChild(t);
    for (const p of fila.slice(0, 4)) { const d = document.createElement('div'); d.textContent = `🎁 ${p.nome}`; el.appendChild(d); }
    if (fila.length > 4) { const d = document.createElement('div'); d.textContent = `+${fila.length - 4}`; el.appendChild(d); }
  }

  // ---------- eventos da live ----------
  const comentarios = [];
  let curtidas = 0, patroes = { dia: '', top: {} }, sujo = false;
  const diaRio = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Sao_Paulo' }).format(new Date());

  function faixaDe(moedas) { let f = C.presentes[0]; for (const p of C.presentes) if (moedas >= p.min) f = p; return f; }

  function evento(ev) {
    if (!ev || !ev.tipo) return;
    ev.id = String(ev.id || ev.nome || 'anon');
    ev.nome = String(ev.nome || 'anônimo').slice(0, 20);
    if (ev.tipo === 'comentario') {
      const texto = String(ev.texto || '').trim().slice(0, 90);
      if (texto) { comentarios.push({ nome: ev.nome, texto, foto: ev.foto }); if (comentarios.length > 30) comentarios.shift(); }
    } else if (ev.tipo === 'like') {
      const n = Math.max(1, Math.min(ev.likes || 1, 50));
      curtidas += n; $('curtidas').textContent = curtidas.toLocaleString('pt-BR');
      for (let i = 0; i < Math.min(n, 4); i++) setTimeout(coracao, i * 120);
    } else if (ev.tipo === 'seguir') {
      avisoRapido(`➕ ${ev.nome} chegou na laje!`);
    } else if (ev.tipo === 'compartilhar') {
      avisoRapido(`🔁 ${ev.nome} espalhou a laje!`);
    } else if (ev.tipo === 'presente') {
      const moedas = Math.max(1, (ev.diamantes || 1) * (ev.qtd || 1));
      if (patroes.dia !== diaRio()) patroes = { dia: diaRio(), top: {} };
      const t = patroes.top[ev.id] || (patroes.top[ev.id] = { nome: ev.nome, moedas: 0 });
      t.nome = ev.nome; t.moedas += moedas; sujo = true; mostrarPatroes();
      const faixa = faixaDe(ev.diamantes || 1);
      if (!faixa.arquivo) return;   // presente sem vídeo: só entra no ranking; quem agradece é o Tio Juca (pela ponte)
      // junta presentes repetidos da mesma pessoa que ainda estão na fila (vira "x3")
      const igual = fila.find(p => p.id === ev.id && p.faixa === faixa);
      if (igual) igual.qtd += ev.qtd || 1;
      else {
        fila.push({ id: ev.id, nome: ev.nome, foto: ev.foto, faixa, qtd: ev.qtd || 1, presente: String(ev.presente || '').slice(0, 24) });
        if (fila.length > 15) { fila.sort((a, b) => b.faixa.min - a.faixa.min); fila.length = 15; }
      }
      mostrarFila(); avisar(); if (acordarAnim) acordarAnim();
    }
  }

  // o tio "lendo" um comentário de cada vez
  setInterval(() => {
    const c = comentarios.pop(); if (!c) return;
    comentarios.length = Math.min(comentarios.length, 10);
    const el = $('comentario');
    el.querySelector('.quem').textContent = c.nome;
    el.querySelector('.txt').textContent = c.texto;
    const img = el.querySelector('img');
    if (c.foto) { img.src = urlFoto(c.foto); img.style.display = ''; } else img.style.display = 'none';
    el.classList.add('ver');
    setTimeout(() => el.classList.remove('ver'), 5200);
  }, 6500);

  const DICAS = ['💬 Comenta aí que o Tio Juca responde!', '🎙️ O Tio Juca agradece todo presente!', '❤️ Curte aí, rapaz!', '👑 Quem manda mais vira PATRÃO DA LAJE'];
  let tAviso = 0;
  function avisoRapido(txt) { $('dica').textContent = txt; tAviso = agoraS() + 3.5; }
  setInterval(() => { if (agoraS() > tAviso) $('dica').textContent = DICAS[Math.floor(agoraS() / 6) % DICAS.length]; }, 1000);

  let ultimoCor = 0;
  function coracao() {
    if (agoraS() - ultimoCor < 0.08) return; ultimoCor = agoraS();
    const c = document.createElement('div'); c.className = 'cor';
    c.textContent = ['❤️', '💖', '🧡', '❤️‍🔥'][Math.floor(Math.random() * 4)];
    c.style.left = rnd(10, 50) + 'px'; c.style.setProperty('--dx', rnd(-40, 20) + 'px');
    $('coracoes').appendChild(c); setTimeout(() => c.remove(), 2500);
  }

  function mostrarPatroes() {
    const el = $('lista'); el.textContent = '';
    const top = Object.values(patroes.top).sort((a, b) => b.moedas - a.moedas).slice(0, 5);
    if (!top.length) { const d = document.createElement('div'); d.className = 'p'; d.textContent = 'seja o primeiro…'; el.appendChild(d); return; }
    top.forEach((p, i) => {
      const d = document.createElement('div'), a = document.createElement('span'), b = document.createElement('span');
      d.className = 'p'; a.textContent = `${['👑', '🥈', '🥉', '4.', '5.'][i]} ${p.nome}`; b.textContent = '';
      d.append(a, b); el.appendChild(d);
    });
  }

  // ---------- tabela de presentes ----------
  function montarTabela() {
    // sem nenhum vídeo de presente, não tem o que prometer: some com a tabela e fica só o ranking
    const temVideo = C.presentes.some(f => f.arquivo);
    $('presentes').style.display = temVideo ? '' : 'none';
    $('baixo').style.gridTemplateColumns = temVideo ? '' : '260px';
    $('baixo').style.justifyContent = temVideo ? '' : 'end';
    const el = $('tabela'); el.textContent = '';
    for (const f of C.presentes) {
      const l = document.createElement('div'); l.className = 'presente';
      const ico = document.createElement('div'); ico.className = 'ico';
      if (f.img) { const i = document.createElement('img'); i.src = f.img; i.alt = ''; i.onerror = () => { ico.textContent = f.ico; }; ico.appendChild(i); } else ico.textContent = f.ico;
      const n = document.createElement('div'); n.className = 'n'; n.textContent = f.nome;
      const e = document.createElement('div'); e.className = 'e'; e.textContent = f.evento;
      l.append(ico, n, e); el.appendChild(l);
    }
  }
  function usarCatalogo(lista) {
    if (!Array.isArray(lista) || !lista.length) return;
    C.presentes.forEach((f, i) => {
      const ate = (C.presentes[i + 1] || { min: Infinity }).min;
      const c = lista.filter(p => p.moedas >= f.min && p.moedas < ate && p.nome).sort((a, b) => a.moedas - b.moedas)[0];
      if (c) { f.nome = c.nome; f.img = c.imagem ? urlFoto(c.imagem) : null; }
    });
    montarTabela();
  }

  // ---------- ambiente: relógio do Rio, luz do horário, pombos ----------
  function horaRio() {
    const p = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date());
    const h = +p.find(x => x.type === 'hour').value, m = +p.find(x => x.type === 'minute').value;
    return { h, m, txt: `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}` };
  }
  function atualizarLuz() {
    const { h, m, txt } = horaRio(), t = h + m / 60;
    $('relogio').textContent = `AO VIVO DA LAJE · RJ · ${txt}`;
    let cor = 'transparent';
    if (t >= 5 && t < 6.5) cor = 'rgba(255,190,150,.28)';
    else if (t >= 16 && t < 17.8) cor = 'rgba(255,160,70,.30)';
    else if (t >= 17.8 && t < 19) cor = 'rgba(170,90,170,.38)';
    else if (t >= 19 || t < 5) cor = 'rgba(40,50,130,.55)';
    $('luz').style.background = cor;
  }
  atualizarLuz(); setInterval(atualizarLuz, 30000);

  function pombo() {
    const { h } = horaRio();
    if (h >= 6 && h < 18) {
      const p = document.createElement('div'); p.className = 'pombo'; p.textContent = '🕊️';
      const y = rnd(380, 700), daEsq = Math.random() < 0.5;
      p.style.top = y + 'px';
      $('ambiente').appendChild(p);
      p.animate([
        { transform: `translate(${daEsq ? -60 : 780}px, 0) scaleX(${daEsq ? -1 : 1})` },
        { transform: `translate(${daEsq ? 780 : -60}px, ${rnd(-120, 60)}px) scaleX(${daEsq ? -1 : 1})` },
      ], { duration: rnd(5000, 9000), easing: 'ease-in-out' }).onfinish = () => p.remove();
    }
    setTimeout(pombo, rnd(18000, 60000));
  }
  setTimeout(pombo, rnd(5000, 15000));

  // ---------- falas do Tio Juca (vêm da ponte: resposta da IA ou agradecimento) ----------
  const filaFalas = [];
  let falando = false;
  function tioFala(ev) {
    if (!ev || !ev.texto) return;
    filaFalas.push(ev);
    if (filaFalas.length > 4) filaFalas.shift();
    if (!falando) proximaFala();
  }
  async function proximaFala() {
    const ev = filaFalas.shift();
    if (!ev) { falando = false; return; }
    falando = true;
    const el = $('fala');
    el.querySelector('.txt').textContent = String(ev.texto).slice(0, 220);
    el.querySelector('.para').textContent = ev.para && ev.para.nome ? `respondendo ${ev.para.nome}: "${String(ev.para.texto || '').slice(0, 60)}"` : '';
    // com voz, o tio FALA a resposta: o balão escrito só aparece se C.legenda = true (ou se a voz faltar)
    if (!ev.audio || C.legenda) el.classList.add('ver');
    let dur = Math.max(4000, String(ev.texto).length * 70);
    if (ev.audio) {
      // troca para o vídeo do tio falando e abaixa o som do vídeo enquanto a voz toca
      const voz = $('voz');
      voz.src = ev.audio; voz.muted = somBloqueado;
      const temBoca = (C.falando || []).length > 0;
      if (temBoca && !fila.some(p => p.faixa.arquivo)) { tioFalando = true; avisar(); await new Promise(r => setTimeout(r, 450)); }
      else volumeAte(cams[atual].v, 0.2, 300);
      try {
        await voz.play();
        await new Promise(r => { const t = setTimeout(r, 30000); voz.onended = () => { clearTimeout(t); r(); }; });
        dur = 900;
      } catch { /* sem áudio: fica só o texto */ }
      if (tioFalando) { tioFalando = false; avisar(); }
      else volumeAte(cams[atual].v, 1, 500);
    }
    await new Promise(r => setTimeout(r, dur));
    el.classList.remove('ver');
    await new Promise(r => setTimeout(r, 500));
    proximaFala();
  }

  // ---------- salvar ranking do dia / ponte ----------
  let ws = null;
  function salvar() {
    if (ws && ws.readyState === 1) ws.send(JSON.stringify({ tipo: 'salvar', jogo: 'laje', dados: patroes }));
    try { localStorage.setItem('laje_dados', JSON.stringify(patroes)); } catch { /* sem storage */ }
    sujo = false;
  }
  function carregar(d) { if (d && d.dia === diaRio() && d.top) { patroes = d; mostrarPatroes(); } }
  try { carregar(JSON.parse(localStorage.getItem('laje_dados') || 'null')); } catch { /* sem storage */ }
  setInterval(() => { if (sujo) salvar(); }, 15000);

  function conectarPonte() {
    if (!/^https?:$/.test(location.protocol)) return;
    const k = encodeURIComponent(new URLSearchParams(location.search).get('k') || '');
    ws = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws?k=${k}`);
    ws.onopen = () => { ws.send(JSON.stringify({ tipo: 'pedir_dados', jogo: 'laje' })); dispatchEvent(new CustomEvent('ponte', { detail: true })); };
    ws.onmessage = m => {
      let ev; try { ev = JSON.parse(m.data); } catch { return; }
      if (ev.tipo === 'dados') carregar(ev.dados);
      else if (ev.tipo === 'catalogo') usarCatalogo(ev.presentes);
      else if (ev.tipo === 'tio_fala') tioFala(ev);
      else evento(ev);
    };
    ws.onclose = () => { dispatchEvent(new CustomEvent('ponte', { detail: false })); setTimeout(conectarPonte, 3000); };
  }
  conectarPonte();

  montarTabela(); mostrarPatroes();
  ciclo();
  lacoAnimacoes();
  window.laje = { evento, tioFala, fila, estado: () => ({ fila: fila.length, comentarios: comentarios.length, curtidas }) };
})();
