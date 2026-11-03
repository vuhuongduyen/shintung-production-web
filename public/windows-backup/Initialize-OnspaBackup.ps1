[CmdletBinding()]
param([string]$InstallPath = "$env:LOCALAPPDATA\ONSPA\BackupClient")
$ErrorActionPreference = 'Stop'
$source = Split-Path -Parent $MyInvocation.MyCommand.Path
New-Item -ItemType Directory -Force -Path $InstallPath | Out-Null
Get-ChildItem $source -File | Where-Object Name -ne 'ONSPA-Windows-Backup-Test-Kit.zip' | Copy-Item -Destination $InstallPath -Force
if (-not (Test-Path "$InstallPath\config.json")) {
  Copy-Item "$InstallPath\config.example.json" "$InstallPath\config.json"
}
Write-Host "Da cai bo test vao: $InstallPath" -ForegroundColor Green
Write-Host "Buoc tiep theo: PowerShell -ExecutionPolicy Bypass -File `"$InstallPath\Test-OnspaBackup.ps1`""
