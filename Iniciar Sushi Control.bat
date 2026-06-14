@echo off
title Sushi Control
color 0A

set "NODE_PATH=C:\Program Files\nodejs"
set "PATH=%NODE_PATH%;%PATH%"
set "PROJECT=%~dp0"

echo.
echo  ================================================
echo    SUSHI CONTROL - Iniciando...
echo  ================================================
echo.

:: Verifica Node.js
if not exist "%NODE_PATH%\node.exe" (
    echo  ERRO: Node.js nao encontrado em %NODE_PATH%
    echo  Instale em https://nodejs.org
    pause
    exit /b 1
)

:: Mata qualquer processo anterior na porta 3001
echo  Liberando porta 3001...
for /f "tokens=5" %%a in ('netstat -aon 2^>nul ^| findstr ":3001 "') do (
    taskkill /PID %%a /F >nul 2>&1
)
timeout /t 1 /nobreak > nul

:: Inicia o backend com WATCHDOG (auto-reinicio se cair) — Camada 1 de blindagem
echo  Iniciando servidor (com auto-reinicio)...
start "Sushi Control - Servidor" cmd /c ""%PROJECT%backend\watchdog.bat""

:: Aguarda o servidor responder (testa ate 20 segundos)
echo  Aguardando servidor responder...
set /a TENTATIVAS=0
:AGUARDA
timeout /t 2 /nobreak > nul
curl -s http://localhost:3001/api/health > nul 2>&1
if %errorlevel% == 0 goto PRONTO
set /a TENTATIVAS+=1
if %TENTATIVAS% LSS 10 goto AGUARDA
echo  AVISO: servidor demorou para responder, abrindo mesmo assim...

:PRONTO
echo  Servidor respondendo!
echo.

:: Abre no navegador
echo  Abrindo navegador...
start "" "http://localhost:3001"

echo.
echo  ================================================
echo    Pronto! Pode fechar esta janela.
echo    O servidor continua na outra janela.
echo  ================================================
echo.
timeout /t 4 /nobreak > nul
