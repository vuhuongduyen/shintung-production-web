[CmdletBinding()]
param([string]$ConfigPath = "$PSScriptRoot\config.json")
$ErrorActionPreference = 'Stop'
if (-not (Test-Path $ConfigPath)) { throw "Khong tim thay config.json. Hay chay Initialize-OnspaBackup.ps1 truoc." }
$config = Get-Content $ConfigPath -Raw | ConvertFrom-Json
$root = $config.DestinationPath
$drive = [System.IO.Path]::GetPathRoot($root)
if (-not (Test-Path $drive)) { throw "Khong tim thay o dia $drive. Hay gan o F: hoac sua DestinationPath trong config.json." }
New-Item -ItemType Directory -Force -Path $root, "$root\logs", "$root\temp", "$root\restore-test" | Out-Null
$probe = "$root\.write-test-$PID.tmp"
try { [IO.File]::WriteAllText($probe, 'ONSPA write test', [Text.Encoding]::UTF8) } finally { Remove-Item $probe -Force -ErrorAction SilentlyContinue }
$freeMB = [math]::Floor((Get-PSDrive -Name $drive.Substring(0,1)).Free / 1MB)
if ($freeMB -lt [int]$config.MinimumFreeSpaceMB) { throw "Dung luong trong chi con $freeMB MB; yeu cau toi thieu $($config.MinimumFreeSpaceMB) MB." }
Write-Host "OK - O dia, thu muc, quyen ghi va dung luong deu dat." -ForegroundColor Green
Write-Host "Che do: $($config.Mode). API database that van dang bi khoa an toan."
