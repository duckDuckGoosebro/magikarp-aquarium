@echo off
title Idle Scape (offline)
set ROOT=%~dp0
rem Uses the Java bundled in this folder, so nothing needs to be installed and no internet is needed.
set JAVA=%ROOT%jre\bin\java.exe
if not exist "%JAVA%" set JAVA=java

netstat -ano | findstr ":43594" | findstr "LISTENING" >nul
if not errorlevel 1 (
  echo Idle Scape is already running - opening the browser.
  start "" "http://localhost:8080/play.html?world=1"
  exit /b 0
)

echo Starting Idle Scape server (offline)...
start "Idle Scape Server" /D "%ROOT%server" "%JAVA%" -jar game\build\libs\void-server-dev.jar
:wait
timeout /t 3 /nobreak >nul
netstat -ano | findstr ":43594" | findstr "LISTENING" >nul
if errorlevel 1 goto wait

echo Opening Idle Scape in your browser...
start "" "http://localhost:8080/play.html?world=1"
echo.
echo Log in with account name  Idle  (it gets admin rights), then use the menu.
echo To use the desktop client instead, run Play-Desktop-Client.bat
timeout /t 8 >nul
