// Países do jogo. Para adicionar um país, copie uma linha e ajuste.
// cor:      cor do território na arena
// bandeira: desenho simplificado da bandeira
//   { t: 'h', c: [...] }  faixas horizontais
//   { t: 'v', c: [...] }  faixas verticais
//   { t: 'br' | 'jp' | 'us' | 'kr' | 'ca' | 'cn' | 'en' }  desenhos especiais
// nomes:    palavras que o público pode comentar para entrar no time (sem acento, minúsculas)
// iso:      código de 2 letras, usado para reconhecer a bandeira em emoji (🇧🇷)
window.PAISES = [
  { cod: 'BRA', nome: 'Brasil',     iso: 'BR', cor: '#22b14c', bandeira: { t: 'br' }, nomes: ['brasil', 'brazil', 'bra', 'br', 'brasileiro', 'brasileira'] },
  { cod: 'ARG', nome: 'Argentina',  iso: 'AR', cor: '#6cb4ee', bandeira: { t: 'h', c: ['#74acdf', '#ffffff', '#74acdf'] }, nomes: ['argentina', 'arg', 'argentino', 'hermanos'] },
  { cod: 'POR', nome: 'Portugal',   iso: 'PT', cor: '#c8102e', bandeira: { t: 'v', c: ['#046a38', '#da291c', '#da291c'] }, nomes: ['portugal', 'por', 'pt', 'tuga', 'portugues', 'portuguesa'] },
  { cod: 'EUA', nome: 'EUA',        iso: 'US', cor: '#3f51b5', bandeira: { t: 'us' }, nomes: ['eua', 'usa', 'estados unidos', 'america', 'americano'] },
  { cod: 'MEX', nome: 'México',     iso: 'MX', cor: '#0b7a4b', bandeira: { t: 'v', c: ['#006847', '#ffffff', '#ce1126'] }, nomes: ['mexico', 'mex', 'mexicano'] },
  { cod: 'JAP', nome: 'Japão',      iso: 'JP', cor: '#ff4d6d', bandeira: { t: 'jp' }, nomes: ['japao', 'japan', 'jap', 'jpn', 'japones'] },
  { cod: 'FRA', nome: 'França',     iso: 'FR', cor: '#1e90ff', bandeira: { t: 'v', c: ['#0055a4', '#ffffff', '#ef4135'] }, nomes: ['franca', 'france', 'fra', 'frances'] },
  { cod: 'ALE', nome: 'Alemanha',   iso: 'DE', cor: '#d4a017', bandeira: { t: 'h', c: ['#000000', '#dd0000', '#ffce00'] }, nomes: ['alemanha', 'germany', 'ale', 'ger', 'alemao'] },
  { cod: 'ESP', nome: 'Espanha',    iso: 'ES', cor: '#ff8c00', bandeira: { t: 'h', c: ['#aa151b', '#f1bf00', '#f1bf00', '#aa151b'] }, nomes: ['espanha', 'spain', 'espana', 'esp', 'espanhol'] },
  { cod: 'ITA', nome: 'Itália',     iso: 'IT', cor: '#00b894', bandeira: { t: 'v', c: ['#009246', '#ffffff', '#ce2b37'] }, nomes: ['italia', 'italy', 'ita', 'italiano'] },
  { cod: 'ING', nome: 'Inglaterra', iso: 'GB', cor: '#dfe6e9', bandeira: { t: 'en' }, nomes: ['inglaterra', 'england', 'ing', 'reino unido', 'uk', 'ingles'] },
  { cod: 'COL', nome: 'Colômbia',   iso: 'CO', cor: '#ffe14d', bandeira: { t: 'h', c: ['#fcd116', '#fcd116', '#003893', '#ce1126'] }, nomes: ['colombia', 'col', 'colombiano'] },
  { cod: 'CHI', nome: 'Chile',      iso: 'CL', cor: '#9b1d20', bandeira: { t: 'h', c: ['#ffffff', '#d52b1e'] }, nomes: ['chile', 'chi', 'chileno'] },
  { cod: 'URU', nome: 'Uruguai',    iso: 'UY', cor: '#a0c4ff', bandeira: { t: 'h', c: ['#ffffff', '#0038a8', '#ffffff', '#0038a8', '#ffffff'] }, nomes: ['uruguai', 'uruguay', 'uru', 'uruguaio'] },
  { cod: 'PAR', nome: 'Paraguai',   iso: 'PY', cor: '#8e44ad', bandeira: { t: 'h', c: ['#d52b1e', '#ffffff', '#0038a8'] }, nomes: ['paraguai', 'paraguay', 'par', 'paraguaio'] },
  { cod: 'PER', nome: 'Peru',       iso: 'PE', cor: '#e84393', bandeira: { t: 'v', c: ['#d91023', '#ffffff', '#d91023'] }, nomes: ['peru', 'per', 'peruano'] },
  { cod: 'VEN', nome: 'Venezuela',  iso: 'VE', cor: '#ff6b35', bandeira: { t: 'h', c: ['#ffcc00', '#00247d', '#cf142b'] }, nomes: ['venezuela', 'ven', 'venezuelano'] },
  { cod: 'BOL', nome: 'Bolívia',    iso: 'BO', cor: '#6ab04c', bandeira: { t: 'h', c: ['#d52b1e', '#f9e300', '#007934'] }, nomes: ['bolivia', 'bol', 'boliviano'] },
  { cod: 'ANG', nome: 'Angola',     iso: 'AO', cor: '#e55039', bandeira: { t: 'h', c: ['#cc092f', '#000000'] }, nomes: ['angola', 'ang', 'angolano'] },
  { cod: 'MOC', nome: 'Moçambique', iso: 'MZ', cor: '#16a085', bandeira: { t: 'h', c: ['#009739', '#000000', '#fce100'] }, nomes: ['mocambique', 'mozambique', 'moc', 'mocambicano'] },
  { cod: 'CHN', nome: 'China',      iso: 'CN', cor: '#ff1e1e', bandeira: { t: 'cn' }, nomes: ['china', 'chn', 'chines'] },
  { cod: 'COR', nome: 'Coreia',     iso: 'KR', cor: '#b2bec3', bandeira: { t: 'kr' }, nomes: ['coreia', 'korea', 'coreia do sul', 'coreano'] },
  { cod: 'IND', nome: 'Índia',      iso: 'IN', cor: '#ffa94d', bandeira: { t: 'h', c: ['#ff9933', '#ffffff', '#138808'] }, nomes: ['india', 'ind', 'indiano'] },
  { cod: 'CAN', nome: 'Canadá',     iso: 'CA', cor: '#ff7675', bandeira: { t: 'ca' }, nomes: ['canada', 'can', 'canadense'] },
];

// Países que aparecem como "bots" quando a live está vazia.
window.PAISES_BOTS = ['BRA', 'ARG', 'POR', 'EUA', 'MEX', 'JAP'];
