@echo off
cd /d "%~dp0"
python fishtank3.py
if errorlevel 1 pause
