[CmdletBinding()]
param([string]$InstallPath = "$env:LOCALAPPDATA\ONSPA\BackupClient", [switch]$RemoveProgramFiles)
Unregister-ScheduledTask -TaskName 'ONSPA Weekly Backup Test' -Confirm:$false -ErrorAction SilentlyContinue
if ($RemoveProgramFiles -and (Test-Path $InstallPath)) { Remove-Item $InstallPath -Recurse -Force }
Write-Host 'Da go lich ONSPA. Cac ban backup trong F:\CompanyBackups duoc giu nguyen.' -ForegroundColor Green
