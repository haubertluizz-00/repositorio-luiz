// A LAJE DO TIO JUCA — lista de vídeos e de presentes.
// Para trocar um vídeo de teste pelo vídeo de verdade, coloque o arquivo novo em clipes/ com o MESMO nome
// (ou mude o nome aqui). Pode ter quantos vídeos "parados" e "falas" quiser: quanto mais, menos parece loop.
window.LAJE = {
  titulo: 'A LAJE DO TIO JUCA',

  // Vídeos do tio parado na laje (sem falar ou só resmungando). O tocador sorteia trechos deles.
  parados: ['tio-parado.mp4'],   // Higgsfield (Kling 2.5 Pro), ida e volta: 1º quadro = último

  // Tio FALANDO (boca abrindo e fechando, sem som). Toca em loop enquanto a voz da IA fala.
  // Truque: tem que COMEÇAR e TERMINAR na mesma pose dos vídeos parados, aí a troca e o loop não aparecem.
  falando: ['tio-falando.mp4'],

  // true = mostra também o texto do que o tio fala (legenda). false = ele só FALA (o texto aparece só se a voz faltar).
  legenda: false,

  // Falas soltas ("comenta aí, caramba!"). Tocam inteiras, de vez em quando, entre os trechos parados.
  falas: [],   // (fala1/fala2.mp4 são de teste; a fala agora vem da IA + vídeo "falando")
  falaACada: [35, 70],          // segundos entre uma fala e outra (sorteado entre os dois números)

  // Presentes: 'min' é o valor mínimo em moedas do TikTok. Nome e ícone são trocados sozinhos
  // pelos presentes reais da sala quando a live está no ar.
  // Sem vídeo (arquivo: null) o presente só mostra o nome de quem mandou e o Tio Juca agradece (o vídeo dele não é cortado).
  // A tabela "manda que aparece na laje" só aparece quando algum presente tiver vídeo.
  // Quando tiver o vídeo de verdade, coloque o nome dele em 'arquivo' (ex.: 'galinha.mp4').
  presentes: [
    { min: 1,    nome: 'Rosa',      ico: '🌹', evento: 'Galinha na laje',   arquivo: null },
    { min: 5,    nome: 'Coração',   ico: '💗', evento: 'Balde da vizinha',  arquivo: null },
    { min: 30,   nome: 'Rosquinha', ico: '🍩', evento: 'Piscina na laje',   arquivo: null },
    { min: 100,  nome: 'Confete',   ico: '🎉', evento: 'Helicóptero da TV', arquivo: null },
    { min: 500,  nome: 'Leão',      ico: '🦁', evento: 'Onça na laje',      arquivo: null },
    { min: 1000, nome: 'Galáxia',   ico: '🌌', evento: 'Disco voador',      arquivo: null },
  ],
};
