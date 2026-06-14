@echo off
title Sushi Control - Servidor (auto-reinicio)
color 0A

:: ============================================================
::  WATCHDOG — mantem o servidor SEMPRE no ar.
::  Se o Node encerrar por qualquer motivo (crash, erro, queda),
::  este loop religa sozinho em poucos segundos. Com o banco em
::  modo WAL, reiniciar e seguro: nada de dado e perdido nem
::  embolado. E a blindagem da "Camada 1".
:: ============================================================

set "NODE_PATH=C:\Program Files\nodejs"
set "PATH=%NODE_PATH%;%PATH%"
cd /d "%~dp0"

if not exist "%~dp0data" mkdir "%~dp0data"

:loop
echo.
echo  ============================================
echo    SUSHI CONTROL rodando   (%date% %time%)
echo    PC:      http://localhost:3001
echo    Celular: http://192.168.15.4:3001
echo  ============================================
echo.

node src/index.js

echo.
echo  [watchdog] Servidor encerrou (codigo %errorlevel%) em %date% %time%
echo  %date% %time% - servidor reiniciado (codigo %errorlevel%) >> "%~dp0data\watchdog.log"
:: Alerta sonoro no appliance (avisa que algo derrubou o servidor)
powershell -NoProfile -Command "[console]::beep(900,250);[console]::beep(600,300)" >nul 2>&1
echo  [watchdog] Religando em 3 segundos...  (feche esta janela para parar de vez)
timeout /t 3 /nobreak > nul
goto loop
