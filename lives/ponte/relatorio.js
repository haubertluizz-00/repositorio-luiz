// Mostra o resumo do teste: node relatorio.js        (por dia)
//                           node relatorio.js 2026-11-12   (por hora daquele dia)
// 1 diamante ≈ US$ 0,005 para o criador (estimativa comum; o TikTok não publica o valor exato).
'use strict';
const fs = require('fs');
const path = require('path');

let dados;
try { dados = JSON.parse(fs.readFileSync(path.join(__dirname, 'dados', 'metricas.json'), 'utf8')); }
catch { console.log('Ainda não há dados. A ponte salva em dados/metricas.json a cada minuto de live.'); process.exit(0); }

const somar = baldes => baldes.reduce((t, b) => {
  for (const k of ['minutosAoVivo', 'comentarios', 'likes', 'seguidores', 'compartilhamentos', 'presentes', 'diamantes']) t[k] += b[k];
  t.espectadoresPico = Math.max(t.espectadoresPico, b.espectadoresPico);
  b.pessoas.forEach(p => t.pessoas.add(p)); b.doadores.forEach(p => t.doadores.add(p));
  return t;
}, { minutosAoVivo: 0, comentarios: 0, likes: 0, seguidores: 0, compartilhamentos: 0, presentes: 0, diamantes: 0, espectadoresPico: 0, pessoas: new Set(), doadores: new Set() });

const linha = (rotulo, t) => ({
  [rotulo.includes(':') ? 'hora' : 'dia']: rotulo,
  'horas ao vivo': +(t.minutosAoVivo / 60).toFixed(1),
  'pico espect.': t.espectadoresPico,
  pessoas: t.pessoas.size,
  coment: t.comentarios,
  likes: t.likes,
  seguiram: t.seguidores,
  doadores: t.doadores.size,
  diamantes: t.diamantes,
  'diam/hora': t.minutosAoVivo ? Math.round(t.diamantes / (t.minutosAoVivo / 60)) : 0,
  'US$ aprox': +(t.diamantes * 0.005).toFixed(2),
});

const dia = process.argv[2];
if (dia) {
  if (!dados[dia]) { console.log(`Sem dados em ${dia}. Dias: ${Object.keys(dados).join(', ')}`); process.exit(0); }
  console.table(Object.keys(dados[dia]).sort().map(h => linha(`${h}:00`, somar([dados[dia][h]]))));
} else {
  const dias = Object.keys(dados).sort();
  console.table(dias.map(d => linha(d, somar(Object.values(dados[d])))));
  console.log('Total:', linha('total', somar(dias.flatMap(d => Object.values(dados[d])))));
}
