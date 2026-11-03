[CmdletBinding()]
param([string]$ConfigPath = "$PSScriptRoot\config.json", [switch]$Automatic)
$ErrorActionPreference = 'Stop'
& "$PSScriptRoot\Test-OnspaBackup.ps1" -ConfigPath $ConfigPath
$config = Get-Content $ConfigPath -Raw | ConvertFrom-Json
$root = $config.DestinationPath
$log = "$root\logs\backup-$(Get-Date -Format yyyy-MM).log"
$mutex = New-Object Threading.Mutex($false, 'Local\ONSPA_Backup_Client')
if (-not $mutex.WaitOne(0)) { Add-Content $log "$(Get-Date -Format o) SKIP: another job is running"; exit 10 }
try {
  $calendar = [Globalization.CultureInfo]::InvariantCulture.Calendar
  $week = $calendar.GetWeekOfYear((Get-Date), [Globalization.CalendarWeekRule]::FirstFourDayWeek, [DayOfWeek]::Monday)
  $weekMarker = "$root\logs\automatic-$((Get-Date).Year)-$week.ok"
  if ($Automatic -and (Test-Path $weekMarker)) { Add-Content $log "$(Get-Date -Format o) SKIP: automatic backup already completed this ISO week"; exit 0 }
  $stamp = Get-Date -Format 'yyyy-MM-dd_HHmmss'
  $name = "backup_$stamp.zip"
  $stage = "$root\temp\$stamp"
  $download = "$root\temp\$name.download"
  New-Item -ItemType Directory -Force -Path "$stage\database", "$stage\uploads", "$stage\application", "$stage\configuration" | Out-Null
  if ($config.Mode -eq 'TEST_LOCAL') {
    '{"mode":"TEST_LOCAL","warning":"Khong chua database ONSPA that"}' | Set-Content "$stage\database\test-records.json" -Encoding UTF8
    '{"system":"ONSPA","backupClient":"Windows test kit"}' | Set-Content "$stage\application\version.json" -Encoding UTF8
  } else {
    throw 'API_BACKUP chua duoc kich hoat. Khong co du lieu that nao duoc tai.'
  }
  $files = Get-ChildItem $stage -Recurse -File | ForEach-Object {
    [pscustomobject]@{ path=$_.FullName.Substring($stage.Length+1).Replace('\','/'); size=$_.Length; sha256=(Get-FileHash $_.FullName -Algorithm SHA256).Hash.ToLower() }
  }
  $manifest = [ordered]@{ createdAt=(Get-Date).ToUniversalTime().ToString('o'); timezone='Asia/Ho_Chi_Minh'; type='TEST_LOCAL'; complete=$false; systemVersion='BKP-20260908-02'; database='Cloudflare D1 / SQLite - NOT EXPORTED IN TEST'; sources=@('local-test-fixture'); files=$files; result='TEST_SUCCESS'; missing=@('production database','uploads','backend secrets') }
  $manifest | ConvertTo-Json -Depth 8 | Set-Content "$stage\manifest.json" -Encoding UTF8
  Add-Type -AssemblyName System.IO.Compression.FileSystem
  [IO.Compression.ZipFile]::CreateFromDirectory($stage, $download)
  $zip = [IO.Compression.ZipFile]::OpenRead($download)
  try { if (-not ($zip.Entries | Where-Object FullName -eq 'manifest.json')) { throw 'ZIP thieu manifest.json' } } finally { $zip.Dispose() }
  Move-Item $download "$root\$name" -Force
  (Get-FileHash "$root\$name" -Algorithm SHA256).Hash.ToLower() | Set-Content "$root\$name.sha256" -Encoding ASCII
  if ($Automatic) { Set-Content $weekMarker $name -Encoding UTF8 }
  Add-Content $log "$(Get-Date -Format o) SUCCESS TEST_LOCAL $name"
  Write-Host "Da tao ban TEST: $root\$name" -ForegroundColor Green
  Write-Warning 'Day la goi TEST_LOCAL, khong phai ban sao luu day du cua database ONSPA.'
  exit 0
} catch {
  Remove-Item $download -Force -ErrorAction SilentlyContinue
  Add-Content $log "$(Get-Date -Format o) FAILED $($_.Exception.Message)"
  Write-Error $_
  exit 20
} finally { if ($mutex) { $mutex.ReleaseMutex(); $mutex.Dispose() }; Remove-Item $stage -Recurse -Force -ErrorAction SilentlyContinue }
