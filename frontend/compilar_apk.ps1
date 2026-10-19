# Script de compilacion oficial del APK para tablets y moviles
$ErrorActionPreference = "Stop"
$env:JAVA_HOME = "D:\ANDROID STUDIO\jbr"
Write-Host "Iniciando compilacion de APK con Gradle y JDK de Android Studio..." -ForegroundColor Cyan

Set-Location -Path "$PSScriptRoot\.."
& ".\gradlew.bat" assembleDebug

if ($LASTEXITCODE -eq 0) {
    Write-Host "APK generado exitosamente en: app/build/outputs/apk/debug/app-debug.apk" -ForegroundColor Green
} else {
    Write-Host "Error en la compilacion de Gradle" -ForegroundColor Red
    exit $LASTEXITCODE
}
