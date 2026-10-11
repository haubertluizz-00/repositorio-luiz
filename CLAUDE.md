# repositorio-luiz

## Motions com HyperFrames

O plugin `hyperframes@hyperframes` (HeyGen) está declarado em `.claude/settings.json`.
Para qualquer pedido de motion/vídeo, comece pela skill `/hyperframes:hyperframes`
(ou `/hyperframes:motion-graphics` para peças curtas sem narração).

- Rode o CLI pelo launcher do plugin, não por `npx hyperframes`:
  `node ~/.claude/plugins/cache/hyperframes/hyperframes/<versão>/skills/hyperframes/scripts/plugin-cli.mjs <comando>`
- Projetos de vídeo ficam em `videos/<nome-do-projeto>/`.
- Na nuvem, o hook `.claude/hooks/session-start.sh` aponta `HYPERFRAMES_BROWSER_PATH`
  para o Chrome Headless Shell já instalado no container.
- `cdn.jsdelivr.net` é bloqueado pela política de rede deste ambiente. Os templates
  carregam GSAP de lá, o que quebra o render (`sub_timeline_script_failure`).
  Instale a biblioteca pelo npm no projeto (`npm install gsap@<versão>`), copie o
  `.min.js` para a pasta do projeto e referencie o arquivo local no `<script src>`.
