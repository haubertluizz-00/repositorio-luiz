// Arena das Bolinhas (3D) — cada pessoa da live vira uma bolinha com a foto de perfil.
// Comentar = entrar e dar um empurrão. Like = dash. Presentes = força, onda de choque, gigante, meteoros, terremoto.
// A arena encolhe; quem cair no abismo sai. A última bolinha em pé vence a rodada.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';

// ---------- Ajustes do jogo ----------
const CFG = {
  R0: 10,              // raio da arena no começo
  R_MIN: 3.6,          // raio mínimo depois de encolher
  ESPERA_SEG: 20,      // tempo de entrada antes de cada rodada
  ENCOLHE_DE: 35,      // segundos de luta antes de começar a encolher
  ENCOLHE_ATE: 150,    // segundo da luta em que chega no raio mínimo (rodada de ~2,5 a 3 min)
  RECARGA_PULO: 5,     // comentário "2"/"pula"
  RECARGA_SEGURA: 8,   // comentário "3"/"segura"
  LIKES_SUPER: 60,     // likes acumulados para soltar um SUPER EMPURRÃO automático
  VITORIA_SEG: 7,
  MIN_NA_RODADA: 6,    // completa com bolinhas CPU se tiver pouca gente
  MAX_BOLAS: 50,
  INATIVO_SEG: 300,
  RECARGA_COMENT: 1.5,
  RECARGA_LIKE: 0.35,
};
const W = 720, H = 1280;
const SOM = (n, i) => window.SONS && window.SONS.tocar(n, i);
const rnd = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const CORES = ['#ff3df0', '#36e4ff', '#ffd34d', '#7cff6b', '#ff7a3d', '#a07bff', '#ff4766', '#3dffc5', '#ffffff', '#ff9ad5'];

// ---------- Renderização ----------
const palco = document.getElementById('palco');
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(1);
renderer.setSize(W, H);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.85;
palco.prepend(renderer.domElement);

const rotulos = new CSS2DRenderer({ element: document.getElementById('rotulos') });
rotulos.setSize(W, H);

const cena = new THREE.Scene();
cena.background = new THREE.Color('#05030f');
cena.fog = new THREE.FogExp2('#0a0620', 0.016);

const camera = new THREE.PerspectiveCamera(56, W / H, 0.1, 400);
const CAM_BASE = new THREE.Vector3(0, 30, 29);
camera.position.copy(CAM_BASE);
const alvoCam = new THREE.Vector3(0, -1.5, 0), olharCam = alvoCam.clone();

const composer = new EffectComposer(renderer);
composer.setSize(W, H);
composer.addPass(new RenderPass(cena, camera));
composer.addPass(new UnrealBloomPass(new THREE.Vector2(W, H), 0.55, 0.4, 0.88));
composer.addPass(new OutputPass());

// ---------- Luzes ----------
cena.add(new THREE.HemisphereLight('#8a7dff', '#1a0b2e', 0.45));
const sol = new THREE.DirectionalLight('#ffffff', 1.8);
sol.position.set(6, 22, 9);
sol.castShadow = true;
sol.shadow.mapSize.set(2048, 2048);
Object.assign(sol.shadow.camera, { left: -14, right: 14, top: 14, bottom: -14, near: 1, far: 60 });
sol.shadow.bias = -0.0005;
cena.add(sol);
const luzRosa = new THREE.PointLight('#ff3df0', 70, 40, 1.6); luzRosa.position.set(-13, 5, -4); cena.add(luzRosa);
const luzCiano = new THREE.PointLight('#36e4ff', 70, 40, 1.6); luzCiano.position.set(13, 5, -4); cena.add(luzCiano);
const luzAbismo = new THREE.PointLight('#7b2cff', 160, 70, 1.4); luzAbismo.position.set(0, -14, 0); cena.add(luzAbismo);
const holofote = new THREE.SpotLight('#ffe9a8', 0, 40, 0.35, 0.5, 1.2);
holofote.position.set(0, 20, 0); cena.add(holofote); cena.add(holofote.target);

// ---------- Cenário ----------
function texturaPlataforma() {
  const c = document.createElement('canvas'); c.width = c.height = 1024;
  const g = c.getContext('2d'), m = 512;
  const grad = g.createRadialGradient(m, m, 0, m, m, m);
  grad.addColorStop(0, '#5a43b8'); grad.addColorStop(0.65, '#33267a'); grad.addColorStop(1, '#1d1550');
  g.fillStyle = grad; g.fillRect(0, 0, 1024, 1024);
  g.strokeStyle = 'rgba(54,228,255,.45)'; g.lineWidth = 4;
  for (let r = 80; r < m; r += 80) { g.beginPath(); g.arc(m, m, r, 0, Math.PI * 2); g.stroke(); }
  g.strokeStyle = 'rgba(255,61,240,.32)'; g.lineWidth = 3;
  for (let i = 0; i < 24; i++) { const a = i / 24 * Math.PI * 2; g.beginPath(); g.moveTo(m, m); g.lineTo(m + Math.cos(a) * m, m + Math.sin(a) * m); g.stroke(); }
  g.fillStyle = 'rgba(255,255,255,.05)';
  for (let i = 0; i < 400; i++) g.fillRect(Math.random() * 1024, Math.random() * 1024, 2, 2);
  g.strokeStyle = 'rgba(255,211,77,.5)'; g.lineWidth = 6; g.beginPath(); g.arc(m, m, 70, 0, Math.PI * 2); g.stroke();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}
const plataforma = new THREE.Mesh(
  new THREE.CylinderGeometry(1, 1, 0.9, 128),
  [new THREE.MeshStandardMaterial({ color: '#241a4d', roughness: 0.6, metalness: 0.3 }),
   (() => { const t = texturaPlataforma(); return new THREE.MeshStandardMaterial({ map: t, emissiveMap: t, emissive: '#ffffff', emissiveIntensity: 0.35, roughness: 0.7, metalness: 0.1 }); })(),
   new THREE.MeshStandardMaterial({ color: '#120c26' })]);
plataforma.position.y = -0.45; plataforma.receiveShadow = true;
cena.add(plataforma);
const matBorda = new THREE.MeshStandardMaterial({ color: '#36e4ff', emissive: '#36e4ff', emissiveIntensity: 2 });
const borda = new THREE.Mesh(new THREE.TorusGeometry(1, 0.012, 12, 200), matBorda);
borda.rotation.x = Math.PI / 2; borda.position.y = 0.02;
cena.add(borda);
function raioArena(r) { plataforma.scale.set(r, 1, r); borda.scale.set(r, r, 1); }

// abismo brilhante lá embaixo
const fundo = new THREE.Mesh(new THREE.CircleGeometry(60, 64), new THREE.MeshBasicMaterial({ color: '#2a0f5e' }));
fundo.rotation.x = -Math.PI / 2; fundo.position.y = -30; cena.add(fundo);

function pontos(qtd, espalhar, tam, cor, aditivo = true) {
  const geo = new THREE.BufferGeometry(), p = new Float32Array(qtd * 3);
  for (let i = 0; i < qtd; i++) espalhar(p, i * 3);
  geo.setAttribute('position', new THREE.BufferAttribute(p, 3));
  const mat = new THREE.PointsMaterial({ size: tam, color: cor, transparent: true, opacity: 0.9, depthWrite: false, blending: aditivo ? THREE.AdditiveBlending : THREE.NormalBlending });
  const obj = new THREE.Points(geo, mat); cena.add(obj); return obj;
}
pontos(900, (p, i) => { const a = Math.random() * Math.PI * 2, r = rnd(40, 120); p[i] = Math.cos(a) * r; p[i + 1] = rnd(-20, 80); p[i + 2] = Math.sin(a) * r - 30; }, 0.5, '#ffffff', false);
const brasas = pontos(260, (p, i) => { p[i] = rnd(-16, 16); p[i + 1] = rnd(-30, 2); p[i + 2] = rnd(-16, 16); }, 0.22, '#ff6bf5');

// ---------- Partículas ----------
const MAXP = 3000;
const partGeo = new THREE.BufferGeometry();
const pPos = new Float32Array(MAXP * 3), pCor = new Float32Array(MAXP * 3), pVel = new Float32Array(MAXP * 3), pVida = new Float32Array(MAXP);
partGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
partGeo.setAttribute('color', new THREE.BufferAttribute(pCor, 3));
const particulas = new THREE.Points(partGeo, new THREE.PointsMaterial({ size: 0.25, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
particulas.frustumCulled = false; cena.add(particulas);
let pProx = 0;
const corTmp = new THREE.Color();
function explodir(x, y, z, qtd, cor, forca = 8, subir = 4) {
  corTmp.set(cor);
  for (let k = 0; k < qtd; k++) {
    const i = pProx; pProx = (pProx + 1) % MAXP;
    const a = Math.random() * Math.PI * 2, s = rnd(0.3, 1) * forca;
    pPos.set([x, y, z], i * 3);
    pVel.set([Math.cos(a) * s, rnd(0.2, 1) * subir, Math.sin(a) * s], i * 3);
    pCor.set([corTmp.r, corTmp.g, corTmp.b], i * 3);
    pVida[i] = rnd(0.5, 1.3);
  }
}
function atualizarParticulas(dt) {
  for (let i = 0; i < MAXP; i++) {
    if (pVida[i] <= 0) { pPos[i * 3 + 1] = -999; continue; }
    pVida[i] -= dt;
    pVel[i * 3 + 1] -= 14 * dt;
    pPos[i * 3] += pVel[i * 3] * dt; pPos[i * 3 + 1] += pVel[i * 3 + 1] * dt; pPos[i * 3 + 2] += pVel[i * 3 + 2] * dt;
  }
  partGeo.attributes.position.needsUpdate = true; partGeo.attributes.color.needsUpdate = true;
}

// ondas de choque (anéis que crescem)
const ondas = [];
function onda(x, z, raio, cor) {
  const m = new THREE.Mesh(new THREE.RingGeometry(0.85, 1, 64), new THREE.MeshBasicMaterial({ color: cor, transparent: true, opacity: 0.9, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false }));
  m.rotation.x = -Math.PI / 2; m.position.set(x, 0.08, z); cena.add(m);
  ondas.push({ m, raio, t: 0 });
}

// ---------- Fotos e texturas das bolinhas ----------
const geoBola = new THREE.SphereGeometry(1, 48, 32);
geoBola.rotateY(-Math.PI / 2); // centro da textura passa a olhar para +Z (usado com lookAt)

function desenharAvatar(canvas, cor, img, texto) {
  const g = canvas.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, cor); grad.addColorStop(1, '#1a1033');
  g.fillStyle = grad; g.fillRect(0, 0, 512, 256);
  g.save(); g.beginPath(); g.arc(256, 128, 74, 0, Math.PI * 2); g.clip();
  if (img) g.drawImage(img, 256 - 74, 128 - 74, 148, 148);
  else {
    g.fillStyle = '#ffffff22'; g.fillRect(180, 52, 152, 152);
    g.fillStyle = '#fff'; g.font = '900 86px "Segoe UI", system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(texto, 256, 134);
  }
  g.restore();
  g.lineWidth = 8; g.strokeStyle = '#ffffff'; g.beginPath(); g.arc(256, 128, 76, 0, Math.PI * 2); g.stroke();
}
function urlFoto(u) { return u && /^https?:$/.test(location.protocol) ? '/foto?u=' + encodeURIComponent(u) : null; }

// ---------- Estado ----------
let perfis = {};                 // id -> { nome, vitorias, abates } (salvo)
const bolas = new Map();         // id -> bola
const feedLista = [];
let estado = 'espera', tEstado = 0, tLuta = 0, R = CFG.R0, vencedor = null, tremor = 0, agora = 0, sujo = false, nCpu = 0;

function perfilDe(ev) {
  const p = perfis[ev.id] || (perfis[ev.id] = { nome: ev.nome, vitorias: 0, abates: 0 });
  p.nome = ev.nome; return p;
}
function corDe(id) { let h = 0; for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0; return CORES[h % CORES.length]; }

function criarBola(id, { nome, foto, bot = false }) {
  const cor = corDe(id);
  const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 256;
  const inicial = bot ? '🤖' : (nome || '?').trim().charAt(0).toUpperCase();
  desenharAvatar(canvas, cor, null, inicial);
  const tex = new THREE.CanvasTexture(canvas); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  const url = urlFoto(foto);
  if (url) { const img = new Image(); img.onload = () => { desenharAvatar(canvas, cor, img, inicial); tex.needsUpdate = true; }; img.src = url; }

  const grupo = new THREE.Group();
  const corpo = new THREE.Mesh(geoBola, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.4, metalness: 0.05 }));
  corpo.castShadow = true; grupo.add(corpo);
  const anel = new THREE.Mesh(new THREE.RingGeometry(1.05, 1.3, 48), new THREE.MeshBasicMaterial({ color: cor, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false }));
  anel.rotation.x = -Math.PI / 2; cena.add(anel);
  const escudo = new THREE.Mesh(new THREE.SphereGeometry(1.28, 32, 16), new THREE.MeshBasicMaterial({ color: '#36e4ff', transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false }));
  escudo.visible = false; grupo.add(escudo);

  const div = document.createElement('div'); div.className = 'nome'; div.style.setProperty('--cor', cor);
  const txt = document.createElement('span'); txt.textContent = bot ? 'CPU' : nome; div.appendChild(txt);
  const barra = document.createElement('div'); barra.className = 'energia'; const enchimento = document.createElement('i'); barra.appendChild(enchimento);
  if (!bot) div.appendChild(barra);
  const rot = new CSS2DObject(div); grupo.add(rot);
  cena.add(grupo);

  const b = {
    id, nome, bot, cor, grupo, corpo, anel, escudo, rot, div, txt, enchimento,
    x: 0, z: 0, y: 8, vx: 0, vz: 0, vy: 0, poder: 1, gigAte: 0, escudoAte: 0,
    viva: true, caindo: false, entrando: true, ia: rnd(0.5, 1.5), ultimoGolpe: null,
    ultimoComent: -99, ultimoLike: -99, ultimoPulo: -99, ultimaAncora: -99, ancoraAte: 0, pulando: false, energia: 0,
    ativo: agora, balao: null, lider: false,
  };
  soltar(b);
  bolas.set(id, b);
  return b;
}

function raio(b) { return clamp(0.8 + 0.06 * Math.sqrt(b.poder), 0.8, 1.8) * (agora < b.gigAte ? 1.6 : 1); }
function massa(b) { const r = raio(b); return r * r * (agora < b.gigAte ? 4 : 1) * (agora < b.ancoraAte ? 3 : 1); }

function soltar(b) {
  const a = Math.random() * Math.PI * 2, d = Math.sqrt(Math.random()) * R * 0.65;
  b.x = Math.cos(a) * d; b.z = Math.sin(a) * d; b.y = rnd(6, 9);
  b.vx = b.vz = b.vy = 0; b.caindo = false; b.entrando = true; b.viva = true;
  b.grupo.visible = true; b.anel.visible = true; b.div.style.display = '';
}

function remover(b) {
  cena.remove(b.grupo); cena.remove(b.anel);
  b.corpo.material.map.dispose(); b.corpo.material.dispose(); b.anel.material.dispose(); b.escudo.material.dispose();
  b.div.remove(); bolas.delete(b.id);
}

function humanos(soVivos = false) { let n = 0; for (const b of bolas.values()) if (!b.bot && (!soVivos || (b.viva && !b.caindo))) n++; return n; }
function vivas() { const l = []; for (const b of bolas.values()) if (b.viva && !b.caindo) l.push(b); return l; }

// ---------- Ações ----------
function dash(b, forca) {
  if (!b.viva || b.caindo || b.entrando) return;
  let alvo = null, md = Infinity;
  for (const o of bolas.values()) {
    if (o === b || !o.viva || o.caindo) continue;
    const d = Math.hypot(o.x - b.x, o.z - b.z);
    if (d < md) { md = d; alvo = o; }
  }
  let dx, dz;
  if (alvo) { dx = alvo.x - b.x; dz = alvo.z - b.z; } else { dx = -b.x; dz = -b.z; }
  const d = Math.hypot(dx, dz) || 1, k = forca / Math.pow(massa(b), 0.25);
  b.vx += dx / d * k; b.vz += dz / d * k;
}

function empurrarArea(origem, x, z, alcance, forca) {
  for (const o of bolas.values()) {
    if (o === origem || !o.viva || o.caindo || o.entrando) continue;
    const dx = o.x - x, dz = o.z - z, d = Math.hypot(dx, dz);
    if (d > alcance || d === 0) continue;
    if (agora < o.escudoAte) continue;
    const k = forca * (1 - d / alcance * 0.6) / Math.pow(massa(o), 0.4);
    o.vx += dx / d * k; o.vz += dz / d * k;
    if (origem && !origem.bot) o.ultimoGolpe = { id: origem.id, t: agora };
  }
}

// meteoros (presente de 100+)
const meteoros = [];
function meteoro(dono) {
  const alvos = vivas().filter(o => o !== dono && !o.entrando);
  const alvo = alvos.length ? alvos[Math.floor(Math.random() * alvos.length)] : null;
  const x = alvo ? alvo.x : rnd(-R, R) * 0.6, z = alvo ? alvo.z : rnd(-R, R) * 0.6;
  const m = new THREE.Mesh(new THREE.SphereGeometry(0.7, 16, 12), new THREE.MeshStandardMaterial({ color: '#ff7a3d', emissive: '#ff5a1f', emissiveIntensity: 4 }));
  m.position.set(x + rnd(-6, 6), 30, z + rnd(-6, 6)); cena.add(m);
  meteoros.push({ m, x, z, dono });
}

function mostrarFaixa(titulo, sub, cor = '#ffd34d') {
  const f = document.getElementById('faixa');
  f.querySelector('.t').textContent = titulo; f.querySelector('.s').textContent = sub;
  f.style.borderColor = cor; f.classList.add('ver');
  clearTimeout(mostrarFaixa.t); mostrarFaixa.t = setTimeout(() => f.classList.remove('ver'), 3200);
}
function noFeed(txt, cor = '#fff') {
  feedLista.unshift({ txt, cor }); if (feedLista.length > 5) feedLista.pop();
  const el = document.getElementById('feed'); el.textContent = '';
  for (const f of feedLista) {
    const d = document.createElement('div'), i = document.createElement('i');
    i.style.setProperty('--c', f.cor); d.appendChild(i); d.appendChild(document.createTextNode(f.txt)); el.appendChild(d);
  }
}

// ---------- Eventos da live ----------
function entrar(ev) {
  perfilDe(ev);
  let b = bolas.get(ev.id);
  if (!b) {
    if (bolas.size >= CFG.MAX_BOLAS) {
      const cpu = [...bolas.values()].find(o => o.bot);
      if (cpu) remover(cpu); else return null;
    }
    b = criarBola(ev.id, { nome: ev.nome, foto: ev.foto });
    if ((estado === 'luta' && R < CFG.R0 * 0.55) || estado === 'vitoria') { b.viva = false; b.grupo.visible = false; b.anel.visible = false; b.div.style.display = 'none'; noFeed(`${ev.nome} entra na próxima rodada`, b.cor); }
    else { noFeed(`${ev.nome} entrou na arena`, b.cor); SOM('entrou', 0.15); }
  }
  b.ativo = agora;
  return b;
}

function evento(ev) {
  if (!ev || !ev.tipo) return;
  ev.id = String(ev.id || ev.nome || 'anon');
  ev.nome = String(ev.nome || 'anônimo').slice(0, 16);
  if (ev.tipo === 'comentario') {
    const b = entrar(ev); if (!b) return;
    const texto = String(ev.texto || '').trim();
    b.balao = { texto: texto.slice(0, 24), ate: agora + 2.5 };
    comando(b, texto.toLowerCase());
  } else if (ev.tipo === 'like') {
    const b = entrar(ev); if (!b) return;
    const n = clamp(ev.likes || 1, 1, 30);
    if (agora - b.ultimoLike > CFG.RECARGA_LIKE) { b.ultimoLike = agora; dash(b, 3 + Math.min(n, 10) * 0.4); }
    b.energia += n;
    if (b.energia >= CFG.LIKES_SUPER) { b.energia = 0; superEmpurrao(b); }
  } else if (ev.tipo === 'seguir') {
    const b = entrar(ev); if (!b) return;
    const perfil = perfis[ev.id];
    // escudo só na PRIMEIRA vez que a pessoa segue (deixar de seguir e seguir de novo não vale)
    if (perfil.seguiu) return;
    perfil.seguiu = true; sujo = true;
    b.escudoAte = agora + 20; SOM('escudo');
    noFeed(`${ev.nome} seguiu → ESCUDO 20s`, '#36e4ff');
  } else if (ev.tipo === 'compartilhar') {
    const b = entrar(ev); if (!b) return;
    b.energia += 20;
    if (b.energia >= CFG.LIKES_SUPER) { b.energia = 0; superEmpurrao(b); }
    noFeed(`${ev.nome} compartilhou → +energia`, b.cor);
  } else if (ev.tipo === 'presente') {
    presente(ev);
  }
}

// Comandos pelo chat: 1/empurra (padrão), 2/pula, 3/segura
function comando(b, t) {
  if (/^(2|pula|pulo|pular)\b/.test(t)) {
    if (agora - b.ultimoPulo < CFG.RECARGA_PULO || !b.viva || b.caindo || b.entrando || b.pulando) return;
    b.ultimoPulo = agora; b.pulando = true; b.vy = 13; SOM('entrou', 0.1);
    return;
  }
  if (/^(3|segura|defesa|defende|trava)\b/.test(t)) {
    if (agora - b.ultimaAncora < CFG.RECARGA_SEGURA) return;
    b.ultimaAncora = agora; b.ancoraAte = agora + 3; SOM('escudo', 0.1);
    explodir(b.x, 0.3, b.z, 20, '#bfc8ff', 3, 1);
    return;
  }
  if (agora - b.ultimoComent > CFG.RECARGA_COMENT) { b.ultimoComent = agora; dash(b, 9); }
}

function superEmpurrao(b) {
  if (!b.viva || b.caindo || b.entrando) return;
  dash(b, 18);
  onda(b.x, b.z, 4, '#ffffff'); empurrarArea(b, b.x, b.z, 4, 15);
  explodir(b.x, 0.5, b.z, 40, '#ffffff', 8, 4); SOM('poder', 0.2);
  noFeed(`${b.nome} soltou o SUPER EMPURRÃO (curtidas)`, '#ff9ad5');
}

// Presente: o poder cresce com o valor. Até o menor presente (1 💎) é mais forte que like e seguir.
function presente(ev) {
  const d = Math.max(1, (ev.diamantes || 1) * (ev.qtd || 1));
  const b = entrar(ev); if (!b) return;
  const nivel = Math.log2(1 + d);                 // 1💎=1 · 5💎=2,6 · 30💎=5 · 100💎=6,7 · 500💎=9 · 1000💎=10
  b.poder += 2 * d;
  b.energia += Math.min(d * 5, CFG.LIKES_SUPER);
  let efeito = 'EMPURRÃO';
  if (b.viva && !b.caindo) {
    const alcance = 2.8 + nivel * 0.8, forca = 14 + nivel * 4;
    onda(b.x, b.z, alcance, b.cor); empurrarArea(b, b.x, b.z, alcance, forca);
    explodir(b.x, 0.5, b.z, Math.round(20 + nivel * 12), b.cor, 6 + nivel, 3);
    if (d >= 5) efeito = 'ONDA DE CHOQUE';
    if (d >= 30) { const s = Math.round(clamp(8 + d / 10, 8, 30)); b.gigAte = agora + s; efeito = `GIGANTE por ${s}s`; mostrarFaixa(`${ev.nome} virou GIGANTE`, `por ${s} segundos`, b.cor); }
    if (d >= 100) { const n = clamp(3 + Math.floor(d / 60), 3, 12); for (let i = 0; i < n; i++) setTimeout(() => meteoro(b), i * 300); efeito = `${n} METEOROS`; mostrarFaixa(`${n} METEOROS`, `presente de ${ev.nome}`, '#ff7a3d'); }
    if (d >= 500) {
      b.escudoAte = agora + 20; tremor = 1.6;
      for (const o of bolas.values()) if (o !== b && o.viva && !o.caindo && agora >= o.escudoAte) { const a = Math.atan2(o.z, o.x); o.vx += Math.cos(a) * 16; o.vz += Math.sin(a) * 16; o.ultimoGolpe = { id: b.id, t: agora }; }
      efeito = 'TERREMOTO'; mostrarFaixa('TERREMOTO!', `${ev.nome} sacudiu a arena`, '#ff4766');
    }
  }
  SOM(d >= 5 ? 'poder' : 'presente', 0.12);
  noFeed(`${ev.nome} mandou ${ev.presente || 'presente'} → ${efeito}`, '#ffd34d');
}

// ---------- Rodadas ----------
function completarCpu() {
  let n = vivas().length;
  while (n < CFG.MIN_NA_RODADA && bolas.size < CFG.MAX_BOLAS) { criarBola('cpu' + (++nCpu), { bot: true }); n++; }
}
function mudarEstado(e) { estado = e; tEstado = 0; }

function eliminar(b) {
  b.viva = false;
  SOM('cair', 0.2);
  const g = b.ultimoGolpe && agora - b.ultimoGolpe.t < 3 ? bolas.get(b.ultimoGolpe.id) : null;
  if (!b.bot) {
    if (g && !g.bot) { perfis[g.id].abates++; sujo = true; noFeed(`${g.nome} derrubou ${b.nome}`, g.cor); }
    else noFeed(`${b.nome} caiu no abismo`, '#ff4766');
  }
  if (b.bot) remover(b);
  else { b.grupo.visible = false; b.anel.visible = false; b.div.style.display = 'none'; }
}

function atualizarRodada(dt) {
  tEstado += dt;
  const grande = document.getElementById('grande');
  if (estado === 'espera') {
    R += (CFG.R0 - R) * Math.min(1, dt * 2);
    if (tEstado > CFG.ESPERA_SEG) { completarCpu(); mudarEstado('contagem'); }
  } else if (estado === 'contagem') {
    const n = 3 - Math.floor(tEstado);
    const txt = n > 0 ? String(n) : 'LUTEM!';
    if (grande.textContent !== txt) { grande.textContent = txt; SOM(n > 0 ? 'bip' : 'luta'); }
    grande.className = 'ver' + (n > 0 ? '' : ' pequeno');
    if (tEstado > 3.8) { grande.className = ''; tLuta = 0; mudarEstado('luta'); }
  } else if (estado === 'luta') {
    tLuta += dt;
    const p = clamp((tLuta - CFG.ENCOLHE_DE) / (CFG.ENCOLHE_ATE - CFG.ENCOLHE_DE), 0, 1);
    R = CFG.R0 - (CFG.R0 - CFG.R_MIN) * p;
    if (tLuta > CFG.ENCOLHE_ATE + 20) R = Math.max(1.6, R - dt * 0.15 * (tLuta - CFG.ENCOLHE_ATE - 20));
    const v = vivas().filter(b => !b.entrando);
    if (v.length <= 1 && tLuta > 2) { vencedor = v[0] || null; terminar(); }
  } else if (estado === 'vitoria') {
    if (tEstado > CFG.VITORIA_SEG) novaRodada();
  }
  // borda fica vermelha quando encolhe
  const perigo = clamp((CFG.R0 - R) / (CFG.R0 - CFG.R_MIN), 0, 1);
  matBorda.color.set('#36e4ff').lerp(new THREE.Color('#ff3355'), perigo);
  matBorda.emissive.copy(matBorda.color);
  matBorda.emissiveIntensity = 2 + perigo * 1.5 * (0.5 + 0.5 * Math.sin(agora * 8));
  raioArena(R);
}

function terminar() {
  mudarEstado('vitoria');
  const v = document.getElementById('vitoria');
  if (vencedor) {
    const humano = !vencedor.bot;
    if (humano) { perfis[vencedor.id].vitorias++; sujo = true; salvar(); }
    v.querySelector('.quem').textContent = humano ? vencedor.nome.toUpperCase() : 'A CPU';
    v.querySelector('.info').textContent = humano ? `${perfis[vencedor.id].vitorias} vitória(s) · ${perfis[vencedor.id].abates} derrubada(s)` : 'Comente para entrar na próxima!';
    holofote.intensity = 150; holofote.target.position.set(vencedor.x, 0, vencedor.z);
    for (let i = 0; i < 6; i++) setTimeout(() => vencedor && explodir(vencedor.x, 3, vencedor.z, 80, CORES[i % CORES.length], 12, 12), i * 250);
  } else {
    v.querySelector('.quem').textContent = 'EMPATE'; v.querySelector('.info').textContent = 'ninguém sobrou em pé';
  }
  v.classList.add('ver'); SOM('vitoria');
}

function novaRodada() {
  document.getElementById('vitoria').classList.remove('ver');
  holofote.intensity = 0; vencedor = null; R = CFG.R0;
  for (const b of [...bolas.values()]) {
    if (b.bot || agora - b.ativo > CFG.INATIVO_SEG) { remover(b); continue; }
    b.poder = 1 + (b.poder - 1) * 0.5; b.gigAte = 0;
    soltar(b);
  }
  mudarEstado('espera');
}

// ---------- Física ----------
const v3 = new THREE.Vector3();
function fisica(dt) {
  const lista = [...bolas.values()].filter(b => b.viva);
  for (const b of lista) {
    const r = raio(b);
    if (b.entrando) {
      b.vy -= 32 * dt; b.y += b.vy * dt;
      if (b.y <= 0) { b.y = 0; b.vy = 0; b.entrando = false; explodir(b.x, 0.2, b.z, 25, b.cor, 6, 3); onda(b.x, b.z, 2.5, b.cor); SOM('bater', 0.1); }
      continue;
    }
    if (b.pulando) {
      b.vy -= 32 * dt; b.y += b.vy * dt; b.x += b.vx * dt; b.z += b.vz * dt;
      if (b.y <= 0) {
        b.y = 0; b.vy = 0; b.pulando = false;
        if (Math.hypot(b.x, b.z) > R && agora >= b.escudoAte) { b.caindo = true; b.vy = 0; continue; }
        onda(b.x, b.z, 3.5, b.cor); empurrarArea(b, b.x, b.z, 3.5, 13); explodir(b.x, 0.2, b.z, 30, b.cor, 7, 3); SOM('bater', 0.05);
      }
      continue;
    }
    if (b.caindo) {
      b.vy -= 30 * dt; b.y += b.vy * dt; b.x += b.vx * dt; b.z += b.vz * dt;
      if (b.y < -22) { if (estado === 'luta' || estado === 'vitoria') eliminar(b); else soltar(b); }
      continue;
    }
    // inteligência simples: escolhe alguém para empurrar de tempos em tempos
    b.ia -= dt;
    if (b.ia <= 0 && estado !== 'vitoria') {
      b.ia = rnd(1.2, 2.4);
      const d = Math.hypot(b.x, b.z);
      if (d > R * 0.78) { b.vx += -b.x / d * 6; b.vz += -b.z / d * 6; }
      else dash(b, rnd(3.5, 6.5));
    }
    const atrito = Math.exp(-(agora < b.ancoraAte ? 4 : 1.3) * dt);
    b.vx *= atrito; b.vz *= atrito;
    const vel = Math.hypot(b.vx, b.vz); if (vel > 26) { b.vx *= 26 / vel; b.vz *= 26 / vel; }
    b.x += b.vx * dt; b.z += b.vz * dt;
    // saiu da arena?
    const d = Math.hypot(b.x, b.z);
    if (d > R) {
      if (agora < b.escudoAte) {
        const nx = b.x / d, nz = b.z / d, vn = b.vx * nx + b.vz * nz;
        b.x = nx * (R - 0.05); b.z = nz * (R - 0.05);
        if (vn > 0) { b.vx -= 2.2 * vn * nx; b.vz -= 2.2 * vn * nz; }
        onda(b.x, b.z, 2, '#36e4ff');
      } else if (d > R + r * 0.3) { b.caindo = true; b.vy = 2; }
    }
  }
  // colisões
  const ativas = lista.filter(b => !b.caindo && !b.entrando);
  for (let i = 0; i < ativas.length; i++) {
    const a = ativas[i], ra = raio(a), ma = massa(a);
    for (let j = i + 1; j < ativas.length; j++) {
      const b = ativas[j], rb = raio(b);
      const dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz);
      if (d >= ra + rb || d === 0) continue;
      const mb = massa(b), nx = dx / d, nz = dz / d, sobra = ra + rb - d;
      a.x -= nx * sobra * mb / (ma + mb); a.z -= nz * sobra * mb / (ma + mb);
      b.x += nx * sobra * ma / (ma + mb); b.z += nz * sobra * ma / (ma + mb);
      const vn = (b.vx - a.vx) * nx + (b.vz - a.vz) * nz;
      if (vn >= 0) continue;
      const e = 1.25, j2 = -(1 + e) * vn / (1 / ma + 1 / mb);
      a.vx -= j2 / ma * nx; a.vz -= j2 / ma * nz;
      b.vx += j2 / mb * nx; b.vz += j2 / mb * nz;
      if (-vn > 3) {
        SOM('bater', 0.06);
        explodir(a.x + nx * ra, 0.6, a.z + nz * ra, Math.min(30, -vn * 2), '#ffffff', 5, 3);
        if (-vn > 9) tremor = Math.max(tremor, 0.25);
      }
      if (!a.bot) b.ultimoGolpe = { id: a.id, t: agora };
      if (!b.bot) a.ultimoGolpe = { id: b.id, t: agora };
    }
  }
}

// ---------- Desenho por quadro ----------
function atualizarVisual(dt) {
  // líder = humano vivo com mais força
  let lider = null;
  for (const b of bolas.values()) if (!b.bot && b.viva && !b.caindo && (!lider || b.poder > lider.poder)) lider = b;
  const muitos = bolas.size > 24;
  for (const b of bolas.values()) {
    if (!b.viva) continue;
    const r = raio(b);
    const s = b.corpo.scale.x + (r - b.corpo.scale.x) * Math.min(1, dt * 6);
    b.corpo.scale.setScalar(s); b.escudo.scale.setScalar(s);
    b.grupo.position.set(b.x, b.y + s, b.z);
    b.corpo.lookAt(camera.position);
    b.escudo.visible = agora < b.escudoAte;
    if (b.enchimento) b.enchimento.style.width = clamp(b.energia / CFG.LIKES_SUPER * 100, 0, 100) + '%';
    b.anel.material.color.set(agora < b.ancoraAte ? '#bfc8ff' : b.cor);
    b.anel.position.set(b.x, 0.03, b.z); b.anel.scale.setScalar(s); b.anel.visible = !b.caindo && b.y < 1;
    b.rot.position.set(0, s + 0.55, 0);
    const ehLider = b === lider && estado !== 'espera';
    if (ehLider !== b.lider) {
      b.lider = ehLider; b.div.classList.toggle('lider', ehLider);
      b.txt.textContent = (ehLider ? '👑 ' : '') + (b.bot ? 'CPU' : b.nome);
    }
    const mostrarNome = !b.caindo && (!muitos || b.lider || r > 1.3 || (b.balao && agora < b.balao.ate) || agora - b.ativo < 4);
    b.div.style.display = mostrarNome ? '' : 'none';
    let balao = b.div.querySelector('.balao');
    if (b.balao && agora < b.balao.ate && b.balao.texto) {
      if (!balao) { balao = document.createElement('div'); balao.className = 'balao'; b.div.appendChild(balao); }
      if (balao.textContent !== b.balao.texto) balao.textContent = b.balao.texto;
    } else if (balao) balao.remove();
  }
  for (const m of [...meteoros]) {
    const alvo = new THREE.Vector3(m.x, 0.6, m.z);
    v3.subVectors(alvo, m.m.position);
    const passo = 42 * dt;
    if (v3.length() <= passo) {
      cena.remove(m.m); m.m.geometry.dispose(); m.m.material.dispose(); meteoros.splice(meteoros.indexOf(m), 1);
      empurrarArea(m.dono, m.x, m.z, 4.5, 26); onda(m.x, m.z, 4.5, '#ff7a3d'); explodir(m.x, 0.5, m.z, 90, '#ff7a3d', 12, 8);
      tremor = Math.max(tremor, 0.6); SOM('pedra', 0.1);
    } else {
      m.m.position.addScaledVector(v3.normalize(), passo);
      explodir(m.m.position.x, m.m.position.y, m.m.position.z, 2, '#ffb36b', 1, 0);
    }
  }
  for (const o of [...ondas]) {
    o.t += dt * 2.2;
    o.m.scale.setScalar(0.3 + o.t * o.raio); o.m.material.opacity = Math.max(0, 0.9 - o.t);
    if (o.t >= 1) { cena.remove(o.m); o.m.geometry.dispose(); o.m.material.dispose(); ondas.splice(ondas.indexOf(o), 1); }
  }
  const pb = brasas.geometry.attributes.position;
  for (let i = 0; i < pb.count; i++) { let y = pb.getY(i) + dt * rnd(1, 3); if (y > 1) y = -30; pb.setY(i, y); }
  pb.needsUpdate = true;
  atualizarParticulas(dt);

  // câmera: balança de leve, aproxima no vencedor, treme nos impactos
  if (estado === 'vitoria' && vencedor) {
    alvoCam.set(vencedor.x, 0, vencedor.z);
    v3.set(vencedor.x * 0.6, 15, vencedor.z * 0.6 + 17);
  } else {
    alvoCam.set(0, -1.5, 0);
    v3.copy(CAM_BASE).add(new THREE.Vector3(Math.sin(agora * 0.15) * 2.5, 0, 0));
  }
  camera.position.lerp(v3, Math.min(1, dt * 1.6));
  olharCam.lerp(alvoCam, Math.min(1, dt * 2));
  camera.lookAt(olharCam);
  if (tremor > 0) { camera.position.x += rnd(-0.5, 0.5) * tremor; camera.position.y += rnd(-0.5, 0.5) * tremor; tremor = Math.max(0, tremor - dt * 1.5); }
}

// ---------- HUD ----------
const DICAS = ['💬 Comente para ENTRAR na arena', '💬 1 = EMPURRA  ·  2 = PULA  ·  3 = SEGURA', '❤️ Curtidas enchem a barra do SUPER EMPURRÃO', '🎁 Quanto MAIOR o presente, MAIOR o poder', '➕ Seguir = escudo (só na 1ª vez)', '🏆 Última bolinha em pé vence!'];
let tHud = 0;
function atualizarHud(dt) {
  tHud -= dt; if (tHud > 0) return; tHud = 0.2;
  document.getElementById('dica').textContent = DICAS[Math.floor(agora / 4) % DICAS.length];
  const ce = document.getElementById('chipEstado');
  const vivosN = vivas().length;
  if (estado === 'espera') { ce.innerHTML = ''; ce.append('Começa em '); const b = document.createElement('b'); b.textContent = Math.max(0, Math.ceil(CFG.ESPERA_SEG - tEstado)) + 's'; ce.append(b); ce.className = 'chip'; }
  else if (estado === 'luta') { const perigo = R < CFG.R0 - 0.5; ce.textContent = perigo ? 'A ARENA ESTÁ ENCOLHENDO!' : 'LUTEM!'; ce.className = 'chip' + (perigo ? ' perigo' : ''); }
  else if (estado === 'vitoria') { ce.textContent = 'Nova rodada em ' + Math.max(0, Math.ceil(CFG.VITORIA_SEG - tEstado)) + 's'; ce.className = 'chip'; }
  else { ce.textContent = 'Preparar…'; ce.className = 'chip'; }
  document.querySelector('#chipVivos b').textContent = vivosN;
  const fama = Object.values(perfis).filter(p => p.vitorias > 0).sort((a, b) => b.vitorias - a.vitorias || b.abates - a.abates).slice(0, 5);
  const fl = document.getElementById('famaLista'); fl.textContent = '';
  if (!fama.length) { const d = document.createElement('div'); d.textContent = 'ninguém ainda…'; fl.appendChild(d); }
  for (const p of fama) {
    const d = document.createElement('div'), a = document.createElement('span'), b = document.createElement('span');
    a.textContent = p.nome.slice(0, 13); b.textContent = '🏆 ' + p.vitorias; d.append(a, b); fl.appendChild(d);
  }
}

// ---------- Salvar / carregar ----------
let ws = null;
function dados() {
  const lista = Object.entries(perfis).filter(([, p]) => p.vitorias || p.abates || p.seguiu).sort((a, b) => b[1].vitorias - a[1].vitorias).slice(0, 5000);
  return { perfis: Object.fromEntries(lista) };
}
function carregar(d) {
  if (!d || !d.perfis) return;
  for (const [id, p] of Object.entries(d.perfis)) if (!perfis[id]) perfis[id] = p;
}
function salvar() {
  const d = dados();
  if (ws && ws.readyState === 1) ws.send(JSON.stringify({ tipo: 'salvar', jogo: 'arena', dados: d }));
  try { localStorage.setItem('arena_dados', JSON.stringify(d)); } catch { /* sem storage */ }
  sujo = false;
}
try { carregar(JSON.parse(localStorage.getItem('arena_dados') || 'null')); } catch { /* sem storage */ }
setInterval(() => { if (sujo) salvar(); }, 20000);

function conectarPonte() {
  if (!/^https?:$/.test(location.protocol)) return;
  const k = encodeURIComponent(new URLSearchParams(location.search).get('k') || '');
  ws = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws?k=${k}`);
  ws.onopen = () => { ws.send(JSON.stringify({ tipo: 'pedir_dados', jogo: 'arena' })); window.dispatchEvent(new CustomEvent('ponte', { detail: true })); };
  ws.onmessage = m => { let ev; try { ev = JSON.parse(m.data); } catch { return; } if (ev.tipo === 'dados') carregar(ev.dados); else evento(ev); };
  ws.onclose = () => { window.dispatchEvent(new CustomEvent('ponte', { detail: false })); setTimeout(conectarPonte, 3000); };
}
conectarPonte();

// ---------- Laço principal ----------
const relogio = new THREE.Timer();
const MANUAL = new URLSearchParams(location.search).has('manual'); // gravação quadro a quadro (testes)
function passo(dt) {
  agora += dt;
  atualizarRodada(dt);
  fisica(dt / 2); fisica(dt / 2);
  atualizarVisual(dt);
  atualizarHud(dt);
  composer.render();
  rotulos.render(cena, camera);
}
function quadro() {
  relogio.update();
  passo(Math.min(0.05, relogio.getDelta()));
  requestAnimationFrame(quadro);
}
completarCpu();
if (!MANUAL) requestAnimationFrame(quadro);

window.jogo = { evento, cfg: CFG, passo, estado: () => ({ estado, bolas: bolas.size, vivas: vivas().length, R: +R.toFixed(2) }) };
