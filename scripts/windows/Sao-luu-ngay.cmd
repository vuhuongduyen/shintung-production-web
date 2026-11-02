@echo off
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "C:\website onspa\_sync\OnspaSync.ps1" -BackupNow -Root "C:\website onspa"
pause
