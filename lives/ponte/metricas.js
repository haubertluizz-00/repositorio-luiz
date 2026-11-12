// Anota os números da live por dia e por hora (horário de Brasília) em dados/metricas.json.
// Para ver o resumo: node relatorio.js
'use strict';
const fs = require('fs');
const path = require('path');

const ARQ = path.join(__dirname, 'dados', 'metricas.json');
let dados = {};
try { dados = JSON.parse(fs.readFileSync(ARQ, 'utf8')); } catch { /* começa vazio */ }
let sujo = false;
let aoVivo = false;

function agoraBR() {
  // "2026-11-12 14" no fuso de São Paulo
  const p = new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23' }).format(new Date());
  const [dia, hora] = p.split(' ');
  return { dia, hora: hora.slice(0, 2) };
}

function balde() {
  const { dia, hora } = agoraBR();
  const d = dados[dia] || (dados[dia] = {});
  return d[hora] || (d[hora] = {
    minutosAoVivo: 0, espectadoresPico: 0, comentarios: 0, likes: 0, seguidores: 0,
    compartilhamentos: 0, presentes: 0, diamantes: 0, pessoas: [], doadores: [],
  });
}

function pessoa(b, campo, id) { if (id && b[campo].length < 5000 && !b[campo].includes(id)) b[campo].push(id); }

const metricas = {
  setAoVivo(v) { aoVivo = v; },
  evento(ev) {
    const b = balde();
    pessoa(b, 'pessoas', ev.id);
    if (ev.tipo === 'comentario') b.comentarios++;
    else if (ev.tipo === 'like') b.likes += ev.likes || 1;
    else if (ev.tipo === 'seguir') b.seguidores++;
    else if (ev.tipo === 'compartilhar') b.compartilhamentos++;
    else if (ev.tipo === 'presente') {
      b.presentes += ev.qtd || 1;
      b.diamantes += (ev.diamantes || 1) * (ev.qtd || 1);
      pessoa(b, 'doadores', ev.id);
    }
    sujo = true;
  },
  espectadores(n) { const b = balde(); if (n > b.espectadoresPico) { b.espectadoresPico = n; sujo = true; } },
};

// conta minutos ao vivo e salva a cada minuto
setInterval(() => {
  if (aoVivo) { balde().minutosAoVivo++; sujo = true; }
  if (!sujo) return;
  fs.mkdirSync(path.dirname(ARQ), { recursive: true });
  fs.writeFile(ARQ + '.tmp', JSON.stringify(dados), err => { if (!err) fs.rename(ARQ + '.tmp', ARQ, () => {}); });
  sujo = false;
}, 60000).unref();

module.exports = metricas;
