# Libera espaço no C: e manda os arquivos temporários dos instaladores para o D:.
# Uso no PowerShell:
#   irm https://raw.githubusercontent.com/haubertluizz-00/repositorio-luiz/claude/bold-volta-0fz7a5/lives/liberar-espaco.ps1 | iex
$ProgressPreference = 'SilentlyContinue'
function Livre($l) { try { [math]::Round((Get-PSDrive $l).Free / 1GB, 1) } catch { '?' } }
Write-Host "Espaco livre no C: antes: $(Livre 'C') GB" -ForegroundColor Yellow

# 1) Pasta temporária no D: (instaladores baixam aqui em vez do C:)
if (Test-Path 'D:\') {
  $tmp = 'D:\temp'
  New-Item -ItemType Directory -Force $tmp | Out-Null
  [Environment]::SetEnvironmentVariable('TEMP', $tmp, 'User')
  [Environment]::SetEnvironmentVariable('TMP', $tmp, 'User')
  Write-Host "Pasta temporaria agora e $tmp" -ForegroundColor Green
}

# 2) Limpa temporários antigos do C:
$antigos = @("$env:LOCALAPPDATA\Temp", "$env:WINDIR\Temp")
foreach ($p in $antigos) {
  if (Test-Path $p) { Get-ChildItem $p -Force -ErrorAction SilentlyContinue | Remove-Item -Recurse -Force -ErrorAction SilentlyContinue }
}
# caches de navegador e de atualizações que podem ser apagados com segurança
$caches = @(
  "$env:LOCALAPPDATA\Google\Chrome\User Data\Default\Cache",
  "$env:LOCALAPPDATA\Google\Chrome\User Data\Default\Code Cache",
  "$env:LOCALAPPDATA\Microsoft\Edge\User Data\Default\Cache",
  "$env:LOCALAPPDATA\CrashDumps",
  "$env:LOCALAPPDATA\npm-cache"
)
foreach ($p in $caches) { if (Test-Path $p) { Remove-Item "$p\*" -Recurse -Force -ErrorAction SilentlyContinue } }

# 3) Lixeira
try { Clear-RecycleBin -Force -ErrorAction SilentlyContinue } catch { }

Write-Host "Espaco livre no C: depois: $(Livre 'C') GB" -ForegroundColor Green
Write-Host ""
Write-Host "Pronto. FECHE e abra de novo o instalador do LIVE Studio para ele usar a pasta do D:." -ForegroundColor Cyan
Write-Host "Se ainda faltar espaco: menu Iniciar > 'Limpeza de Disco' > C: > 'Limpar arquivos do sistema'." -ForegroundColor Cyan
