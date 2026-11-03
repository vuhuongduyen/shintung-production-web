@echo off
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0OnspaSync.ps1" -Install -Root "C:\website onspa"
echo.
pause
