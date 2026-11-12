// Funções compartilhadas: desenhar bandeira redonda e descobrir país num comentário.
window.BANDEIRAS = (() => {
  const PAISES = window.PAISES;
  const POR_ISO = Object.fromEntries(PAISES.map(p => [p.iso, p]));
  const normalizar = s => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

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
    for (const p of PAISES) for (const n of p.nomes) if (limpo.includes(' ' + n + ' ')) return p;
    return null;
  }

  function desenhar(ctx, p, x, y, r) {
    const b = p.bandeira;
    ctx.save();
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.clip();
    const L = x - r, T = y - r, S = r * 2;
    const faixas = (c, vert) => c.forEach((cor, i) => {
      ctx.fillStyle = cor;
      if (vert) ctx.fillRect(L + S * i / c.length, T, S / c.length + 1, S);
      else ctx.fillRect(L, T + S * i / c.length, S, S / c.length + 1);
    });
    const circ = (cx, cy, rr, cor) => { ctx.fillStyle = cor; ctx.beginPath(); ctx.arc(cx, cy, rr, 0, Math.PI * 2); ctx.fill(); };
    switch (b.t) {
      case 'h': faixas(b.c, false); break;
      case 'v': faixas(b.c, true); break;
      case 'br':
        ctx.fillStyle = '#009c3b'; ctx.fillRect(L, T, S, S);
        ctx.fillStyle = '#ffdf00'; ctx.beginPath();
        ctx.moveTo(x, T + S * 0.12); ctx.lineTo(L + S * 0.95, y); ctx.lineTo(x, T + S * 0.88); ctx.lineTo(L + S * 0.05, y); ctx.fill();
        circ(x, y, r * 0.42, '#002776');
        break;
      case 'jp': ctx.fillStyle = '#fff'; ctx.fillRect(L, T, S, S); circ(x, y, r * 0.5, '#bc002d'); break;
      case 'kr':
        ctx.fillStyle = '#fff'; ctx.fillRect(L, T, S, S);
        ctx.fillStyle = '#cd2e3a'; ctx.beginPath(); ctx.arc(x, y, r * 0.45, Math.PI, 0); ctx.fill();
        ctx.fillStyle = '#0047a0'; ctx.beginPath(); ctx.arc(x, y, r * 0.45, 0, Math.PI); ctx.fill();
        break;
      case 'cn': ctx.fillStyle = '#de2910'; ctx.fillRect(L, T, S, S); circ(x - r * 0.35, y - r * 0.3, r * 0.28, '#ffde00'); break;
      case 'ca': faixas(['#d80621', '#ffffff', '#ffffff', '#d80621'], true); circ(x, y, r * 0.3, '#d80621'); break;
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

  return { paisDoTexto, desenhar, normalizar };
})();
