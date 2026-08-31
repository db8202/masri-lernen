@echo off
title Masri Lernen - Lokaler Server
cd /d "%~dp0"

echo.
echo  ========================================
echo   Masri Lernen - Server startet...
echo  ========================================
echo.

where python >nul 2>&1
if errorlevel 1 (
  echo  FEHLER: Python ist nicht installiert!
  pause
  exit /b 1
)

set PORT=8080

:try_port
netstat -ano | findstr ":%PORT% " | findstr "LISTENING" >nul 2>&1
if not errorlevel 1 (
  echo  Port %PORT% belegt - versuche 8081...
  set PORT=8081
  if %PORT% GTR 8090 goto :port_fail
  goto try_port
)

for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /c:"IPv4"') do (
  set IP=%%a
  goto :found
)
:found
set IP=%IP:~1%

echo  Am PC:     http://127.0.0.1:%PORT%
echo             http://localhost:%PORT%
echo  Am Handy:  http://%IP%:%PORT%
echo.
echo  WICHTIG: Dieses Fenster OFFEN lassen!
echo  Beenden: Strg+C
echo  ========================================
echo.

REM Kein --bind 127.0.0.1! Sonst scheitert localhost (IPv6) in Firefox.
python -m http.server %PORT% --directory "%~dp0"
goto :end

:port_fail
echo  Kein freier Port gefunden (8080-8090).
pause
exit /b 1

:end
if errorlevel 1 pause
