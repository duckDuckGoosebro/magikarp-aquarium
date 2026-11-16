@echo off
rem Builds the two Windows .exe files (needs: pip install pyinstaller pillow). Output goes to the dist folder.
cd /d "%~dp0"
python -m PyInstaller --noconfirm --onefile --windowed --name MagikarpAquarium --add-data "sprites;sprites" fishtank2.py
cd rogue-version
python -m PyInstaller --noconfirm --onefile --windowed --name MagikarpAquarium-Rogue --add-data "sprites;sprites" --paths . --distpath ..\dist fishtank3.py
