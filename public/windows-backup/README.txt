ONSPA WINDOWS BACKUP - BO TEST AN TOAN

1. Giai nen goi ZIP.
2. Bam chuot phai PowerShell, khong can Run as Administrator trong truong hop thong thuong.
3. Chay:
   powershell -ExecutionPolicy Bypass -File .\Initialize-OnspaBackup.ps1
4. Kiem tra:
   powershell -ExecutionPolicy Bypass -File "$env:LOCALAPPDATA\ONSPA\BackupClient\Test-OnspaBackup.ps1"
5. Tao goi test:
   powershell -ExecutionPolicy Bypass -File "$env:LOCALAPPDATA\ONSPA\BackupClient\Invoke-OnspaBackup.ps1"
6. Khoi phuc test:
   powershell -ExecutionPolicy Bypass -File "$env:LOCALAPPDATA\ONSPA\BackupClient\Restore-OnspaBackupTest.ps1" -ZipPath "F:\CompanyBackups\backup_YYYY-MM-DD_HHmmss.zip"
7. Cai lich thu Bay 12:00:
   powershell -ExecutionPolicy Bypass -File "$env:LOCALAPPDATA\ONSPA\BackupClient\Install-OnspaBackupTask.ps1"

Luu y: TEST_LOCAL chi kiem tra quy trinh tren may Windows. No KHONG chua database ONSPA that.
Token API khong duoc ghi trong bo file nay. Che do API_BACKUP van bi khoa cho den khi co backend xac thuc.
