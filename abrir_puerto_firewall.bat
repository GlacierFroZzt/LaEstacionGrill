@echo off
title Taqueria Km 243 - Habilitar Puerto 3001 en Firewall de Windows
echo ===================================================================
echo Configurando regla de Firewall para permitir conexion de dispositivos...
echo ===================================================================
netsh advfirewall firewall add rule name="Taqueria Km 243 SQL (Puerto 3001 TCP)" dir=in action=allow protocol=TCP localport=3001 profile=any
echo.
echo [OK] Regla agregada correctamente. Los celulares ya podran conectarse.
echo Presiona cualquier tecla para salir.
pause >nul
