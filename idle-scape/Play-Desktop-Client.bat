@echo off
set ROOT=%~dp0
set JAVA=%ROOT%jre\bin\java.exe
if not exist "%JAVA%" set JAVA=java
start "Idle Scape" "%JAVA%" -jar "%ROOT%client\client\build\libs\void-client-1.2.0.jar"
