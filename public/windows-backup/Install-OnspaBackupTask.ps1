[CmdletBinding()]
param([string]$InstallPath = "$env:LOCALAPPDATA\ONSPA\BackupClient")
$ErrorActionPreference = 'Stop'
$script = "$InstallPath\Invoke-OnspaBackup.ps1"
if (-not (Test-Path $script)) { throw 'Hay chay Initialize-OnspaBackup.ps1 truoc.' }
$action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$script`" -Automatic"
$trigger = New-ScheduledTaskTrigger -Weekly -DaysOfWeek Saturday -At 12:00
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Hours 2)
Register-ScheduledTask -TaskName 'ONSPA Weekly Backup Test' -Action $action -Trigger $trigger -Settings $settings -Description 'ONSPA test backup, Saturday 12:00 local Windows time' -Force | Out-Null
Write-Host 'Da cai lich thu Bay 12:00. Day van la che do TEST_LOCAL.' -ForegroundColor Green
