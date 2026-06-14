@echo off
title Sushi Control + Tunnel
color 0A

echo ============================================
echo   SUSHI CONTROL + CLOUDFLARE TUNNEL
echo ============================================
echo.

:: Limpa log anterior
if exist "%TEMP%\cf_tunnel.log" del "%TEMP%\cf_tunnel.log"

:: Inicia o tunnel em segundo plano
echo [1/3] Iniciando tunnel Cloudflare...
start "Cloudflare Tunnel" /min cmd /c ""%~dp0cloudflared-windows-amd64.exe" tunnel --url http://localhost:3001 >> "%TEMP%\cf_tunnel.log" 2>&1"

:: Aguarda o link aparecer no log (ate 40 segundos)
echo Aguardando link publico...
set CF_URL=
set /a contador=0

:AGUARDA_LINK
timeout /t 2 /nobreak >nul
set /a contador+=2

:: Extrai a URL completa com https
for /f "delims=" %%a in ('powershell -Command "Select-String -Path \"%TEMP%\cf_tunnel.log\" -Pattern \"https://[a-z0-9\-]+\.trycloudflare\.com\" | ForEach-Object { $_.Matches[0].Value } | Select-Object -First 1" 2^>nul') do set CF_URL=%%a

if defined CF_URL goto LINK_ENCONTRADO
if %contador% geq 40 goto TIMEOUT
goto AGUARDA_LINK

:LINK_ENCONTRADO
echo.
echo ============================================
echo   LINK PUBLICO:
echo   %CF_URL%
echo ============================================
echo.

:: Atualiza o .env com a URL correta
powershell -Command "(Get-Content '%~dp0backend\.env') -replace 'APP_URL=.*', 'APP_URL=%CF_URL%' | Set-Content '%~dp0backend\.env'"
echo [2/3] .env atualizado: APP_URL=%CF_URL%
echo.

:: Inicia o servidor
echo [3/3] Iniciando servidor...
echo.
echo  Sistema:          http://localhost:3001
echo  Cardapio publico: %CF_URL%/cardapio
echo.
echo ============================================
echo  Nao feche esta janela!
echo ============================================
echo.

:: Libera a porta 3001 (evita "address already in use" se ja houver servidor)
for /f "tokens=5" %%a in ('netstat -aon 2^>nul ^| findstr ":3001 "') do taskkill /PID %%a /F >nul 2>&1
cd /d "%~dp0backend"
call "%~dp0backend\watchdog.bat"
goto FIM

:TIMEOUT
echo.
echo AVISO: Link nao detectado em 40s.
echo Iniciando servidor sem tunnel...
echo.
for /f "tokens=5" %%a in ('netstat -aon 2^>nul ^| findstr ":3001 "') do taskkill /PID %%a /F >nul 2>&1
cd /d "%~dp0backend"
call "%~dp0backend\watchdog.bat"

:FIM
