@echo off
chcp 65001 >nul
title Masri Lernen – GitHub Pages Deploy
cd /d "%~dp0"

echo.
echo  ╔══════════════════════════════════════════════════════╗
echo  ║   Masri Lernen – Online hosten (GitHub Pages, 0 €)   ║
echo  ╚══════════════════════════════════════════════════════╝
echo.

where git >nul 2>&1
if errorlevel 1 (
  echo  FEHLER: Git ist nicht installiert.
  echo  Download: https://git-scm.com/download/win
  pause
  exit /b 1
)

where gh >nul 2>&1
if errorlevel 1 (
  echo  GitHub CLI fehlt. Installiere mit:
  echo    winget install GitHub.cli
  echo.
  echo  Oder manuell: https://cli.github.com
  pause
  exit /b 1
)

echo  Schritt 1: Bei GitHub anmelden (einmalig)
echo  -----------------------------------------
gh auth status >nul 2>&1
if errorlevel 1 (
  echo  Browser oeffnet sich gleich...
  gh auth login -w -p https -s repo,workflow,read:org
  if errorlevel 1 (
    echo  Anmeldung fehlgeschlagen.
    pause
    exit /b 1
  )
)
echo  ✓ Angemeldet
echo.

echo  Schritt 2: Repository erstellen ^& hochladen
echo  --------------------------------------------
set /p REPO_NAME="Repository-Name [masri-lernen]: "
if "%REPO_NAME%"=="" set REPO_NAME=masri-lernen

git rev-parse --is-inside-work-tree >nul 2>&1
if errorlevel 1 git init -b main

git add -A
git diff --cached --quiet
if errorlevel 1 (
  git commit -m "Masri Lernen – PWA Vokabeltrainer"
)

git remote get-url origin >nul 2>&1
if errorlevel 1 (
  gh repo create %REPO_NAME% --public --source=. --remote=origin --push
) else (
  git push -u origin main
)

if errorlevel 1 (
  echo.
  echo  Push fehlgeschlagen. Pruefe: gh auth status
  pause
  exit /b 1
)

echo.
echo  Schritt 3: GitHub Pages aktivieren
echo  -----------------------------------
for /f "delims=" %%u in ('gh api user -q .login 2^>nul') do set GH_USER=%%u
echo  1. Oeffne: https://github.com/%GH_USER%/%REPO_NAME%/settings/pages
echo  2. Source: GitHub Actions
echo  3. Warte 1-2 Minuten nach dem Push
echo.
echo  Deine App-URL:
echo  https://%GH_USER%.github.io/%REPO_NAME%/
echo.
echo  Beispiel fuer dieses Projekt:
echo  https://db8202.github.io/masri-lernen/
echo.
echo  Dann am Handy:
echo  - URL oeffnen - Zum Startbildschirm hinzufuegen
echo  - Tab Meine Woerter - Offline-Paket laden
echo.
pause
