param([switch]$Install, [switch]$Loop, [switch]$BackupNow, [string]$Root = 'C:\website onspa')
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$Root = [IO.Path]::GetFullPath($Root).TrimEnd('\')
$Origin = 'https://onspa-sku-master-preview.shintung-vn-4458.chatgpt.site'
$Project = 'appgprj_6a8f9b8b6bc48191b07d8293bcb8402a'
$Control = Join-Path $Root '_sync'
$ConfigPath = Join-Path $Control 'config.json'
$Current = Join-Path $Root 'source'
$Backups = Join-Path $Root 'versions'
$ManifestName = '_ONSPA_SOURCE.json'
$TaskName = 'ONSPA-source-sync-' + ([BitConverter]::ToString([Security.Cryptography.SHA256]::Create().ComputeHash([Text.Encoding]::UTF8.GetBytes($Root))).Replace('-','').Substring(0,12))
function Assert-PlainPath([string]$Path) {
    $Cursor = $Path
    while ($Cursor) {
        if (Test-Path -LiteralPath $Cursor) {
            if ((Get-Item -LiteralPath $Cursor -Force).Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'Folder lien ket/junction khong duoc dung de dong bo.' }
        }
        $Parent = Split-Path -Parent $Cursor
        if ($Parent -eq $Cursor) { break }
        $Cursor = $Parent
    }
}
function Write-Status([string]$Message) {
    $Line = (Get-Date -Format 'dd/MM/yyyy HH:mm:ss') + ' | ' + $Message
    Write-Host $Line
    $Log = Join-Path $Control 'dong-bo.log'
    if ((Test-Path -LiteralPath $Log) -and (Get-Item -LiteralPath $Log).Length -gt 1048576) { Move-Item -LiteralPath $Log -Destination (Join-Path $Control 'dong-bo-truoc.log') -Force }
    Add-Content -LiteralPath $Log -Value $Line -Encoding UTF8
}
function Get-Api([string]$Suffix, [hashtable]$Headers) {
    $Response = Invoke-WebRequest -UseBasicParsing -Uri ($Origin + '/api/source-sync/' + $Suffix) -Headers $Headers -TimeoutSec 90 -MaximumRedirection 0
    return ($Response.Content | ConvertFrom-Json)
}
function Safe-Relative([string]$Path) {
    if (-not $Path -or $Path -match '[<>"|?*\x00-\x1F]' -or $Path.Contains('\') -or $Path.Contains(':') -or $Path.StartsWith('/') -or ($Path.Split('/') | Where-Object { $_ -eq '..' -or $_ -eq '.' -or $_ -eq '' -or $_.EndsWith('.') -or $_.EndsWith(' ') -or $_ -match '^(?i:CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\.|$)' })) { throw 'Goi source co duong dan khong an toan.' }
}
function Validate-Files([string]$Folder, $Manifest) {
    if ($Manifest.format -ne 'ONSPA-SOURCE-v1' -or $Manifest.projectId -ne $Project -or $Manifest.snapshotId -notmatch '^[a-f0-9]{64}$') { throw 'Manifest khong dung du an ONSPA.' }
    $Known = @{}
    foreach ($File in $Manifest.files) {
        Safe-Relative $File.path
        if ($Known.ContainsKey($File.path) -or $File.path -eq $ManifestName -or $File.sha256 -notmatch '^[a-f0-9]{64}$') { throw 'Manifest trung ten hoac sai checksum.' }
        $Known[$File.path] = $true
        $Full = Join-Path $Folder ($File.path.Replace('/','\'))
        if (-not (Test-Path -LiteralPath $Full -PathType Leaf)) { throw ('Thieu file: ' + $File.path) }
        if ((Get-Item -LiteralPath $Full).Length -ne $File.size -or (Get-FileHash -LiteralPath $Full -Algorithm SHA256).Hash.ToLowerInvariant() -ne $File.sha256) { throw ('File da thay doi hoac bi loi: ' + $File.path + '. Giu nguyen folder, khong ghi de.') }
    }
    foreach ($Item in Get-ChildItem -LiteralPath $Folder -Force -Recurse) {
        if ($Item.Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'Folder source co lien ket; da dung dong bo.' }
        if (-not $Item.PSIsContainer) {
            $Relative = $Item.FullName.Substring($Folder.Length + 1).Replace('\','/')
            if ($Relative -ne $ManifestName -and -not $Known.ContainsKey($Relative)) { throw ('Co file rieng trong source: ' + $Relative + '. Hay chuyen file rieng ra ngoai folder source.') }
        }
    }
}
function Sync-Source {
    Assert-PlainPath $Root
    Assert-PlainPath $Control
    New-Item -ItemType Directory -Force -Path $Control | Out-Null
    $Lock = $null; $Stage = $null; $Zip = $null; $Secure = $null; $Pointer = [IntPtr]::Zero
    try {
        try { $Lock = [IO.File]::Open((Join-Path $Control 'sync.lock'), [IO.FileMode]::OpenOrCreate, [IO.FileAccess]::ReadWrite, [IO.FileShare]::None) } catch { Write-Host 'Mot lan dong bo khac dang chay.'; return }
        $Config = Get-Content -LiteralPath $ConfigPath -Raw -Encoding UTF8 | ConvertFrom-Json
        if ($Config.origin -ne $Origin -or $Config.projectId -ne $Project -or $Config.root -ne $Root) { throw 'Cau hinh khong dung du an hoac folder.' }
        $Secure = ConvertTo-SecureString $Config.protectedCode
        $Pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($Secure)
        $DeviceCode = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($Pointer)
        $Headers = @{ Authorization = ('Bearer ' + $DeviceCode) }
        $Meta = Get-Api 'manifest' $Headers
        if ($Meta.projectId -ne $Project -or $Meta.format -ne 'ONSPA-SOURCE-v1' -or $Meta.snapshotId -notmatch '^[a-f0-9]{64}$' -or $Meta.sha256 -notmatch '^[a-f0-9]{64}$' -or $Meta.size -le 0 -or $Meta.size -gt 52428800 -or $Meta.fileCount -le 0 -or $Meta.fileCount -gt 10000) { throw 'Thong tin ban source khong hop le.' }
        $Previous = $null
        if (Test-Path -LiteralPath $Current) {
            Assert-PlainPath $Current
            if (-not (Test-Path -LiteralPath (Join-Path $Current $ManifestName))) { throw 'Folder source da co du lieu rieng. Khong tu ghi de.' }
            $Previous = Get-Content -LiteralPath (Join-Path $Current $ManifestName) -Raw -Encoding UTF8 | ConvertFrom-Json
            Validate-Files $Current $Previous
            if ($Previous.snapshotId -eq $Meta.snapshotId) { Write-Status ('Source da la ban moi nhat: ' + $Meta.snapshotId.Substring(0,12)); return }
        }
        $ID = [Guid]::NewGuid().ToString('N')
        $Stage = Join-Path $Root ('_source-moi-' + $ID)
        $Zip = Join-Path $Control ($ID + '.zip')
        Invoke-WebRequest -UseBasicParsing -Uri ($Origin + '/api/source-sync/download') -Headers $Headers -OutFile $Zip -TimeoutSec 180 -MaximumRedirection 0
        if ((Get-Item -LiteralPath $Zip).Length -ne $Meta.size -or (Get-FileHash -LiteralPath $Zip -Algorithm SHA256).Hash.ToLowerInvariant() -ne $Meta.sha256) { throw 'Checksum goi tai ve khong khop. Folder cu duoc giu nguyen.' }
        Add-Type -AssemblyName System.IO.Compression.FileSystem
        New-Item -ItemType Directory -Path $Stage | Out-Null
        $Archive = [IO.Compression.ZipFile]::OpenRead($Zip)
        try {
            $Total = 0; $Names = @{}
            if ($Archive.Entries.Count -ne ($Meta.fileCount + 1)) { throw 'So file ZIP khong khop.' }
            foreach ($Entry in $Archive.Entries) {
                Safe-Relative $Entry.FullName
                if ($Names.ContainsKey($Entry.FullName) -or (($Entry.ExternalAttributes -shr 16) -band 61440) -eq 40960) { throw 'ZIP trung ten hoac co symlink.' }
                $Names[$Entry.FullName] = $true; $Total += $Entry.Length
                if ($Total -gt 157286400) { throw 'ZIP vuot dung luong giai nen cho phep.' }
                $Destination = [IO.Path]::GetFullPath((Join-Path $Stage $Entry.FullName.Replace('/','\')))
                if (-not $Destination.StartsWith($Stage + '\', [StringComparison]::OrdinalIgnoreCase)) { throw 'ZIP co duong dan ngoai folder.' }
                New-Item -ItemType Directory -Force -Path (Split-Path -Parent $Destination) | Out-Null
                $InputStream = $Entry.Open(); $OutputStream = [IO.File]::Create($Destination)
                try { $InputStream.CopyTo($OutputStream) } finally { $InputStream.Dispose(); $OutputStream.Dispose() }
            }
        } finally { $Archive.Dispose() }
        $NewManifest = Get-Content -LiteralPath (Join-Path $Stage $ManifestName) -Raw -Encoding UTF8 | ConvertFrom-Json
        if ($NewManifest.snapshotId -ne $Meta.snapshotId -or $NewManifest.files.Count -ne $Meta.fileCount) { throw 'Ban source thay doi trong luc tai; thu lai lan sau.' }
        Validate-Files $Stage $NewManifest
        $Backup = $null
        if (Test-Path -LiteralPath $Current) {
            # Recheck immediately before replacing, in case a file was edited during download.
            Validate-Files $Current $Previous
            New-Item -ItemType Directory -Force -Path $Backups | Out-Null
            $Backup = Join-Path $Backups ((Get-Date -Format 'yyyyMMdd-HHmmss') + '-' + $Previous.snapshotId.Substring(0,12) + '-' + $ID.Substring(0,6))
            Move-Item -LiteralPath $Current -Destination $Backup
        }
        try { Move-Item -LiteralPath $Stage -Destination $Current; $Stage = $null } catch { if ($Backup -and -not (Test-Path -LiteralPath $Current)) { Move-Item -LiteralPath $Backup -Destination $Current }; throw }
        Write-Status ('Da cap nhat source: ' + $Meta.snapshotId.Substring(0,12) + ' vao ' + $Current)
    } finally {
        if ($Pointer -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($Pointer) }
        if ($Secure) { $Secure.Dispose() }
        if ($Stage -and (Test-Path -LiteralPath $Stage)) { Remove-Item -LiteralPath $Stage -Recurse -Force }
        if ($Zip -and (Test-Path -LiteralPath $Zip)) { Remove-Item -LiteralPath $Zip -Force }
        if ($Lock) { $Lock.Dispose() }
    }
}
function Backup-Full([bool]$Force = $false) {
    Assert-PlainPath $Root
    Assert-PlainPath $Control
    New-Item -ItemType Directory -Force -Path $Control | Out-Null
    $DataRoot = Join-Path $Root 'backups'
    $LastPath = Join-Path $Control 'sao-luu-cuoi.json'
    $Lock = $null; $Stage = $null; $Secure = $null; $Pointer = [IntPtr]::Zero
    try {
        try { $Lock = [IO.File]::Open((Join-Path $Control 'backup.lock'), [IO.FileMode]::OpenOrCreate, [IO.FileAccess]::ReadWrite, [IO.FileShare]::None) } catch { Write-Host 'Mot ban sao luu dang chay.'; return }
        if (-not $Force -and (Test-Path -LiteralPath $LastPath)) {
            $Last = Get-Content -LiteralPath $LastPath -Raw -Encoding UTF8 | ConvertFrom-Json
            if ($Last.completedDate -eq (Get-Date -Format 'yyyy-MM-dd') -and (Test-Path -LiteralPath (Join-Path $Last.folder 'HOAN-TAT.json'))) { return }
        }
        $Config = Get-Content -LiteralPath $ConfigPath -Raw -Encoding UTF8 | ConvertFrom-Json
        if ($Config.origin -ne $Origin -or $Config.projectId -ne $Project -or $Config.root -ne $Root) { throw 'Cau hinh khong dung du an.' }
        $Secure = ConvertTo-SecureString $Config.protectedCode
        $Pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($Secure)
        $Headers = @{ Authorization = ('Bearer ' + [Runtime.InteropServices.Marshal]::PtrToStringBSTR($Pointer)) }
        $Capability = Get-Api 'manifest' $Headers
        if (-not $Capability.PSObject.Properties['backupAllowed'] -or -not $Capability.backupAllowed) { Write-Status 'Ma hien tai chi tai source. Tao ma sao luu day du tren web va cai lai de sao luu DB/files.'; return }
        Write-Status 'Dang sao luu toan bo DB, file goc va source...'
        $Reply = Invoke-WebRequest -UseBasicParsing -Uri ($Origin + '/api/full-backup/start') -Method Post -ContentType 'application/json' -Body '{}' -Headers $Headers -TimeoutSec 300 -MaximumRedirection 0
        $Manifest = $Reply.Content | ConvertFrom-Json
        if ($Manifest.format -ne 'ONSPA-FULL-BACKUP-v1' -or $Manifest.projectId -ne $Project -or $Manifest.id -notmatch '^[a-f0-9-]{36}$' -or $Manifest.entries.Count -lt 2 -or $Manifest.entries.Count -gt 100000 -or $Manifest.fileCount -ne ($Manifest.entries.Count - 2)) { throw 'Manifest sao luu khong hop le.' }
        Assert-PlainPath $DataRoot
        New-Item -ItemType Directory -Force -Path $DataRoot | Out-Null
        $Stage = Join-Path $DataRoot ('_dang-tai-' + $Manifest.id)
        New-Item -ItemType Directory -Path $Stage | Out-Null
        $Names = @{}; $Checksums = @()
        for ($i=0; $i -lt $Manifest.entries.Count; $i++) {
            $Entry = $Manifest.entries[$i]
            Safe-Relative $Entry.path
            if ($Names.ContainsKey($Entry.path) -or $Entry.path -notmatch '^(database/database\.sql|source/ONSPA-source\.zip|files/[0-9]{8}\.bin)$' -or $Entry.size -lt 0) { throw 'Duong dan/dung luong ban sao luu khong hop le.' }
            $Names[$Entry.path] = $true
            $Destination = Join-Path $Stage $Entry.path.Replace('/','\')
            New-Item -ItemType Directory -Force -Path (Split-Path -Parent $Destination) | Out-Null
            Invoke-WebRequest -UseBasicParsing -Uri ($Origin + '/api/full-backup/item?id=' + $Manifest.id + '&index=' + $i) -Headers $Headers -OutFile $Destination -TimeoutSec 600 -MaximumRedirection 0
            $SHA = (Get-FileHash -LiteralPath $Destination -Algorithm SHA256).Hash.ToLowerInvariant()
            if ((Get-Item -LiteralPath $Destination).Length -ne $Entry.size) { throw ('Thieu du lieu file: ' + $Entry.path) }
            if ($Entry.PSObject.Properties['sha256'] -and $SHA -ne $Entry.sha256) { throw ('Sai checksum file: ' + $Entry.path) }
            $Checksums += @{path=$Entry.path; sha256=$SHA; size=$Entry.size}
        }
        if (-not $Names.ContainsKey('database/database.sql') -or -not $Names.ContainsKey('source/ONSPA-source.zip')) { throw 'Ban sao luu thieu source hoac DB.' }
        # Complete only after local checks and a final server check of all R2 object identities.
        $Body = @{id=$Manifest.id} | ConvertTo-Json -Compress
        $CompleteReply = Invoke-WebRequest -UseBasicParsing -Uri ($Origin + '/api/full-backup/complete') -Method Post -ContentType 'application/json' -Body $Body -Headers $Headers -TimeoutSec 300 -MaximumRedirection 0
        $Complete = $CompleteReply.Content | ConvertFrom-Json
        if (-not $Complete.ok -or $Complete.id -ne $Manifest.id) { throw 'Web chua xac nhan ban sao luu day du.' }
        $Manifest | ConvertTo-Json -Depth 50 | Set-Content -LiteralPath (Join-Path $Stage 'manifest.json') -Encoding UTF8
        $Checksums | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath (Join-Path $Stage 'checksums.json') -Encoding UTF8
        @'
ONSPA - BAN SAO LUU DAY DU
- database/database.sql: cau truc va toan bo bang/ban ghi D1, tai khoan, quyen, nhat ky.
- source/ONSPA-source.zip: ma nguon dung ban trien khai luc sao luu.
- files/*.bin: noi dung goc tat ca object R2. manifest.json luu object key, metadata va duong dan tuong ung.
- checksums.json: SHA-256 va dung luong tung file da kiem tra tren may.
- HOAN-TAT.json: chi xuat hien khi tai va kiem tra tat ca thanh cong.
Phuc hoi: dung moi truong trong, giai nen source, nap database.sql vao SQLite/D1,
tra tung files/*.bin ve object key va metadata trong manifest.json, kiem tra checksum va so ban ghi.
Vo hieu auth_sessions va cap lai ma thiet bi sau phuc hoi. Thiet lap secrets moi cho moi truong dich.
Ban nay KHONG tu ghi de web. Bao mat folder vi chua du lieu nhan su va hash mat khau.
'@ | Set-Content -LiteralPath (Join-Path $Stage 'HUONG-DAN-PHUC-HOI.txt') -Encoding UTF8
        @{id=$Manifest.id;completedAt=(Get-Date).ToString('o');files=$Manifest.fileCount;records=$Manifest.recordCount} | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $Stage 'HOAN-TAT.json') -Encoding UTF8
        $Final = Join-Path $DataRoot ((Get-Date -Format 'yyyyMMdd-HHmmss') + '-' + $Manifest.id.Substring(0,8))
        Move-Item -LiteralPath $Stage -Destination $Final; $Stage = $null
        @{completedDate=(Get-Date -Format 'yyyy-MM-dd');folder=$Final} | ConvertTo-Json | Set-Content -LiteralPath $LastPath -Encoding UTF8
        Write-Status ('SAO LUU DAY DU THANH CONG: ' + $Manifest.recordCount + ' ban ghi, ' + $Manifest.fileCount + ' files. Folder: ' + $Final)
    } finally {
        if ($Pointer -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($Pointer) }
        if ($Secure) { $Secure.Dispose() }
        if ($Stage -and (Test-Path -LiteralPath $Stage)) { Remove-Item -LiteralPath $Stage -Recurse -Force }
        if ($Lock) { $Lock.Dispose() }
    }
}
try {
    Assert-PlainPath $Root
    Assert-PlainPath $Control
    New-Item -ItemType Directory -Force -Path $Control | Out-Null
    if ($Install) {
        Write-Host ('Cai dong bo source va sao luu day du ONSPA vao ' + $Root)
        Write-Host 'Dan ma ket noi tu menu Sao luu & Ban giao. Ma khong hien khi nhap.'
        $Code = Read-Host 'Ma ket noi' -AsSecureString
        $CodePointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($Code)
        try { if ([Runtime.InteropServices.Marshal]::PtrToStringBSTR($CodePointer) -notmatch '^[a-f0-9]{64}$') { throw 'Ma ket noi phai la 64 ky tu. Hay sao chep lai tu web.' } } finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($CodePointer) }
        $Settings = @{ root=$Root; origin=$Origin; projectId=$Project; protectedCode=(ConvertFrom-SecureString $Code) }
        $Settings | ConvertTo-Json | Set-Content -LiteralPath $ConfigPath -Encoding UTF8
        $Code.Dispose()
        $InstalledScript = Join-Path $Control 'OnspaSync.ps1'
        if ($PSCommandPath -ne $InstalledScript) { Copy-Item -LiteralPath $PSCommandPath -Destination $InstalledScript -Force }
        Sync-Source
        Backup-Full $true
        # Stop only the prior per-user runner for this exact installed script.
        $RunnerPath = Join-Path $Control 'tien-trinh.txt'
        if (Test-Path -LiteralPath $RunnerPath) {
            $RunnerID = 0
            if ([int]::TryParse((Get-Content -LiteralPath $RunnerPath -Raw).Trim(), [ref]$RunnerID) -and $RunnerID -ne $PID) {
                $Runner = Get-CimInstance Win32_Process -Filter ('ProcessId = ' + $RunnerID)
                if ($Runner -and $Runner.Name -eq 'powershell.exe' -and $Runner.CommandLine -and $Runner.CommandLine.Contains('-File "' + $InstalledScript + '"') -and $Runner.CommandLine.Contains('-Root "' + $Root + '"') -and $Runner.CommandLine.Contains('-Loop')) { Stop-Process -Id $RunnerID -ErrorAction SilentlyContinue }
            }
        }
        $PowerShell = "$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe"
        $Arguments = '-NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass -File "' + $InstalledScript + '" -Loop -Root "' + $Root + '"'
        $Startup = [Environment]::GetFolderPath('Startup')
        $Shortcut = (New-Object -ComObject WScript.Shell).CreateShortcut((Join-Path $Startup ($TaskName + '.lnk')))
        $Shortcut.TargetPath = $PowerShell; $Shortcut.Arguments = $Arguments; $Shortcut.WorkingDirectory = $Control; $Shortcut.WindowStyle = 7
        $Shortcut.Description = 'Dong bo source moi 15 phut va sao luu day du moi ngay'; $Shortcut.Save()
        Start-Process -FilePath $PowerShell -ArgumentList $Arguments -WindowStyle Hidden
        Write-Status 'Da cai tu chay: source moi 15 phut; sao luu DB/files/source moi ngay. Mat mang se thu lai.'
        Write-Host ('Xem nhat ky: ' + (Join-Path $Control 'dong-bo.log'))
    } elseif ($Loop) {
        $LoopMutex = [Threading.Mutex]::new($false, ('Local\' + $TaskName + '-loop'))
        if (-not $LoopMutex.WaitOne(0)) { $LoopMutex.Dispose(); exit 0 }
        try {
            $PID | Set-Content -LiteralPath (Join-Path $Control 'tien-trinh.txt')
            while ($true) {
                try { Sync-Source } catch { Write-Status ('DUNG/LOI: ' + $_.Exception.Message + '. Kiem tra ma ket noi va mang; se thu lai sau 15 phut.') }
                try { Backup-Full } catch { Write-Status ('SAO LUU LOI: ' + $_.Exception.Message + '. Chua tao ban hoan tat; se thu lai.') }
                Start-Sleep -Seconds 900
            }
        } finally { $LoopMutex.ReleaseMutex(); $LoopMutex.Dispose() }
    } elseif ($BackupNow) { Backup-Full $true } else { Sync-Source; Backup-Full }
} catch {
    $Status = 0
    if ($_.Exception.PSObject.Properties['Response'] -and $_.Exception.Response) { $Status = [int]$_.Exception.Response.StatusCode }
    if ($Status -eq 401 -or $Status -eq 403) { $Message = 'Ma het han/bi thu hoi hoac tai khoan doi quyen/mat khau. Tao ma moi tren web va chay lai Cai-dong-bo.cmd.' }
    else { $Message = $_.Exception.Message }
    Write-Status ('DUNG/LOI: ' + $Message)
    exit 1
}
