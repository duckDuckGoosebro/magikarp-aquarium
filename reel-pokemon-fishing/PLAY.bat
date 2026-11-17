@echo off
cd /d "%~dp0"
echo.
echo  REEL POKEMON FISHING
echo  --------------------
echo  On this PC open:  http://localhost:8792
echo  On a phone (same Wi-Fi):
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /c:"IPv4"') do echo      http://%%a:8792
echo.
echo  Keep this window open while you play. Close it to stop.
start "" http://localhost:8792
python -m http.server 8792
