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
if (Test-Path $proj) { Remove-Item $proj -Recurse -Force }
Move-Item (Get-ChildItem $tmp -Directory | Select-Object -First 1).FullName $proj
Remove-Item $tmp -Recurse -Force; Remove-Item $zip -Force
if (Test-Path $backup) { Copy-Item $backup $dados -Recurse -Force }

# 3) Dependências da ponte
Passo 'Instalando as peças do jogo (1 a 2 minutos)...'
Push-Location (Join-Path $proj 'lives\ponte')
& (Join-Path $node 'npm.cmd') install --no-audit --no-fund --loglevel=error
if ($LASTEXITCODE -ne 0) { Pop-Location; throw 'O npm install falhou. Mande um print desta tela.' }
Pop-Location

# 4) Atalho para ligar a live
Passo 'Criando o atalho INICIAR-LIVE...'
$bat = Join-Path $base 'INICIAR-LIVE.bat'
@"
@echo off
title LIVE - NAO FECHE ESTA JANELA
set PATH=$node;%PATH%
cd /d "$proj\lives\ponte"
start "" "http://localhost:8787"
echo.
echo  Jogo ligado. Deixe esta janela aberta enquanto a live estiver no ar.
echo  O jogo conecta sozinho na live de @$conta quando ela entrar no ar.
echo.
node index.js --usuario $conta
pause
"@ | Set-Content -Path $bat -Encoding ASCII
try { Copy-Item $bat (Join-Path ([Environment]::GetFolderPath('Desktop')) 'INICIAR-LIVE.bat') -Force } catch { Write-Host "Nao deu para criar o atalho na Area de Trabalho; use $bat" -ForegroundColor Yellow }

# 5) Não deixar o PC dormir na tomada
try { powercfg /change standby-timeout-ac 0; powercfg /change hibernate-timeout-ac 0 } catch { }

Passo 'PRONTO! Abrindo o jogo...'
Write-Host "Da proxima vez, so clique duas vezes em INICIAR-LIVE na Area de Trabalho." -ForegroundColor Green
Start-Process $bat
