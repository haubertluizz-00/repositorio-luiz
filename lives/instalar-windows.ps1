# Instalador da live interativa para Windows (tudo no D:, sem precisar instalar nada antes).
# Uso no PowerShell:
#   irm https://raw.githubusercontent.com/haubertluizz-00/repositorio-luiz/claude/bold-volta-0fz7a5/lives/instalar-windows.ps1 | iex
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'   # sem isso o PowerShell 5.1 baixa muito devagar
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

function Passo($t) { Write-Host ""; Write-Host ">> $t" -ForegroundColor Cyan }

$base = if (Test-Path 'D:\') { 'D:\lives' } else { 'C:\lives' }
New-Item -ItemType Directory -Force $base | Out-Null
Write-Host "Instalando em $base" -ForegroundColor Green

$conta = (Read-Host 'Digite o @ da conta do TikTok que vai fazer a live (pode ser sem o @)').Trim().TrimStart('@')
if (-not $conta) { throw 'Precisa digitar o @ da conta.' }

# 1) Node.js portátil (não precisa instalar no C:)
$node = Join-Path $base 'node'
if (-not (Test-Path (Join-Path $node 'node.exe'))) {
  Passo 'Baixando o Node.js (1 a 3 minutos)...'
  # (no PowerShell 5.1 a lista precisa ir para uma variável antes, senão vem tudo junto)
  $lts = $null
  try { $lista = Invoke-RestMethod 'https://nodejs.org/dist/index.json'; $lts = ($lista | Where-Object { $_.lts } | Select-Object -First 1).version } catch { }
  if (-not $lts -or $lts -isnot [string]) { $lts = 'v24.11.1' }
  $zip = Join-Path $base 'node.zip'
  Invoke-WebRequest "https://nodejs.org/dist/$lts/node-$lts-win-x64.zip" -OutFile $zip -UseBasicParsing
  Passo 'Descompactando o Node.js...'
  $tmp = Join-Path $base 'node-tmp'
  if (Test-Path $tmp) { Remove-Item $tmp -Recurse -Force }
  Expand-Archive $zip $tmp -Force
  if (Test-Path $node) { Remove-Item $node -Recurse -Force }
  Move-Item (Get-ChildItem $tmp -Directory | Select-Object -First 1).FullName $node
  Remove-Item $tmp -Recurse -Force; Remove-Item $zip -Force
}
$env:Path = "$node;$env:Path"

# 2) O jogo (baixa sempre a versão mais nova, mas guarda os níveis salvos)
# se o jogo estiver ligado (janela preta aberta), desliga antes de atualizar
Get-Process node -ErrorAction SilentlyContinue | Where-Object { $_.Path -like "$node*" } | Stop-Process -Force -ErrorAction SilentlyContinue
Get-Process cmd -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowTitle -like '*NAO FECHE*' } | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2
Passo 'Baixando o jogo...'
$proj = Join-Path $base 'projeto'
$dados = Join-Path $proj 'lives\ponte\dados'
$backup = Join-Path $base 'dados-backup'
if (Test-Path $dados) { if (Test-Path $backup) { Remove-Item $backup -Recurse -Force }; Copy-Item $dados $backup -Recurse }
$zip = Join-Path $base 'projeto.zip'
Invoke-WebRequest 'https://github.com/haubertluizz-00/repositorio-luiz/archive/refs/heads/claude/bold-volta-0fz7a5.zip' -OutFile $zip -UseBasicParsing
$tmp = Join-Path $base 'projeto-tmp'
if (Test-Path $tmp) { Remove-Item $tmp -Recurse -Force }
Expand-Archive $zip $tmp -Force
$novo = (Get-ChildItem $tmp -Directory | Select-Object -First 1).FullName
# copia por cima em vez de apagar a pasta (o Windows não deixa apagar pasta aberta em alguma janela)
if (Test-Path $proj) { robocopy $novo $proj /E /NFL /NDL /NJH /NJS /NP | Out-Null; if ($LASTEXITCODE -ge 8) { throw 'Falha ao copiar a versao nova do jogo.' } } else { Move-Item $novo $proj }
Remove-Item $tmp -Recurse -Force; Remove-Item $zip -Force
if (Test-Path $backup) { Copy-Item $backup $dados -Recurse -Force }

# 3) Dependências da ponte
Passo 'Instalando as peças do jogo (1 a 2 minutos)...'
Push-Location (Join-Path $proj 'lives\ponte')
& (Join-Path $node 'npm.cmd') install --no-audit --no-fund --loglevel=error
if ($LASTEXITCODE -ne 0) { Pop-Location; throw 'O npm install falhou. Mande um print desta tela.' }
Pop-Location

# 3b) Arquivo de chaves (opcional): IA do Tio Juca e voz
$chaves = Join-Path $base 'chaves.env'
if (-not (Test-Path $chaves)) {
@"
# Chaves opcionais da live. Tire o # do comeco da linha e cole a chave depois do =
# ANTHROPIC_API_KEY=
# TIO_MODELO=claude-haiku-5-5
# TIO_LIMITE_DIA_USD=1
# ELEVENLABS_API_KEY=
# EULER_API_KEY=
"@ | Set-Content -Path $chaves -Encoding ASCII
}

# 4) Atalhos para ligar a live: INICIAR-LIVE (Arena) e INICIAR-LAJE (A Laje do Tio Juca)
function CriarAtalho($nomeArq, $jogo, $titulo) {
  $bat = Join-Path $base $nomeArq
  @"
@echo off
title $titulo - NAO FECHE ESTA JANELA
set PATH=$node;%PATH%
set CHAVES_ARQUIVO=$base\chaves.env
cd /d "$proj\lives\ponte"
set "CHROME="
if exist "%ProgramFiles%\Google\Chrome\Application\chrome.exe" set "CHROME=%ProgramFiles%\Google\Chrome\Application\chrome.exe"
if exist "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" set "CHROME=%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
if exist "%LocalAppData%\Google\Chrome\Application\chrome.exe" set "CHROME=%LocalAppData%\Google\Chrome\Application\chrome.exe"
rem abre o jogo numa janela propria, em pe, que nao pausa quando fica atras de outra janela
if defined CHROME (
  start "" cmd /c "timeout /t 3 >nul & start "" "%CHROME%" --app=http://localhost:8787/$jogo/ --no-first-run --no-default-browser-check --window-size=608,1080 --window-position=0,0 --user-data-dir="$base\chrome-live" --disable-features=CalculateNativeWinOcclusion --disable-backgrounding-occluded-windows --disable-renderer-backgrounding --autoplay-policy=no-user-gesture-required"
) else (
  start "" cmd /c "timeout /t 3 >nul & start "" http://localhost:8787/$jogo/"
)
echo.
echo  $titulo ligado. Deixe esta janela aberta enquanto a live estiver no ar.
echo  O jogo conecta sozinho na live de @$conta quando ela entrar no ar.
echo.
node index.js --usuario $conta --jogo $jogo
pause
"@ | Set-Content -Path $bat -Encoding ASCII
  try { Copy-Item $bat (Join-Path ([Environment]::GetFolderPath('Desktop')) $nomeArq) -Force } catch { Write-Host "Nao deu para criar o atalho na Area de Trabalho; use $bat" -ForegroundColor Yellow }
  return $bat
}
Passo 'Criando os atalhos INICIAR-LIVE e INICIAR-LAJE...'
$bat = CriarAtalho 'INICIAR-LIVE.bat' 'arena' 'ARENA'
$null = CriarAtalho 'INICIAR-LAJE.bat' 'laje' 'LAJE DO TIO JUCA'

# 5) Não deixar o PC dormir na tomada
try { powercfg /change standby-timeout-ac 0; powercfg /change hibernate-timeout-ac 0 } catch { }

Passo 'PRONTO! Abrindo o jogo...'
Write-Host "Da proxima vez: INICIAR-LIVE (Arena) ou INICIAR-LAJE (Tio Juca) na Area de Trabalho." -ForegroundColor Green
Start-Process $bat
