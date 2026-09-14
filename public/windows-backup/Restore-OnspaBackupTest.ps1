[CmdletBinding()]
param([Parameter(Mandatory=$true)][string]$ZipPath, [string]$ConfigPath = "$PSScriptRoot\config.json")
$ErrorActionPreference = 'Stop'
$config = Get-Content $ConfigPath -Raw | ConvertFrom-Json
if (-not (Test-Path $ZipPath)) { throw "Khong tim thay ZIP: $ZipPath" }
$target = "$($config.DestinationPath)\restore-test\$(Get-Date -Format yyyy-MM-dd_HHmmss)"
New-Item -ItemType Directory -Force -Path $target | Out-Null
Expand-Archive -Path $ZipPath -DestinationPath $target -Force
$manifestPath = "$target\manifest.json"
if (-not (Test-Path $manifestPath)) { Remove-Item $target -Recurse -Force; throw 'ZIP thieu manifest.json' }
$manifest = Get-Content $manifestPath -Raw | ConvertFrom-Json
foreach ($entry in $manifest.files) {
  $file = Join-Path $target ($entry.path.Replace('/', '\'))
  if (-not (Test-Path $file)) { throw "Thieu tep: $($entry.path)" }
  if ((Get-FileHash $file -Algorithm SHA256).Hash.ToLower() -ne $entry.sha256) { throw "Sai SHA-256: $($entry.path)" }
}
Write-Host "Khoi phuc TEST thanh cong tai: $target" -ForegroundColor Green
Write-Warning 'Khong co database production nao bi thay doi.'
