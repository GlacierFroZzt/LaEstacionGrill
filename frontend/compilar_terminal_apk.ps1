# Script de compilación oficial del APK de la Terminal / Visor de Auditoría y Crashes
$ErrorActionPreference = "Stop"
$env:JAVA_HOME = "D:\ANDROID STUDIO\jbr"
Write-Host "1. Compilando visor-logs para empaquetado nativo..." -ForegroundColor Cyan

Set-Location -Path "$PSScriptRoot\.."
& pnpm --filter ./visor-logs run build

Write-Host "2. Copiando activos a app/src/terminal/assets/web/..." -ForegroundColor Cyan
Remove-Item -Recurse -Force "app/src/terminal/assets/web/*" -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force -Path "app/src/terminal/assets/web" | Out-Null
Copy-Item -Recurse -Force "visor-logs/dist/*" "app/src/terminal/assets/web/"

Write-Host "3. Compilando APK nativo de Terminal con Gradle..." -ForegroundColor Cyan
& ".\gradlew.bat" assembleTerminalDebug

if ($LASTEXITCODE -eq 0) {
    Copy-Item "app/build/outputs/apk/terminal/debug/app-terminal-debug.apk" "TerminalAdmin-v1.0.0.apk" -Force
    Write-Host "¡APK de Terminal generado exitosamente en: TerminalAdmin-v1.0.0.apk!" -ForegroundColor Green
} else {
    Write-Host "Error en la compilación de Gradle para Terminal" -ForegroundColor Red
    exit $LASTEXITCODE
}
