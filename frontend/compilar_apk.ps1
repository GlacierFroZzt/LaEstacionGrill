# Script de compilacion oficial del APK para tablets y moviles
$ErrorActionPreference = "Stop"
$env:JAVA_HOME = "D:\ANDROID STUDIO\jbr"
Write-Host "Iniciando compilacion de APK con Gradle y JDK de Android Studio..." -ForegroundColor Cyan

Set-Location -Path "$PSScriptRoot\.."
& ".\gradlew.bat" assembleRestauranteDebug

if ($LASTEXITCODE -eq 0) {
    Copy-Item "app/build/outputs/apk/restaurante/debug/app-restaurante-debug.apk" "LaEstacionGrill-v1.2.3.apk" -Force
    Write-Host "APK generado exitosamente en: LaEstacionGrill-v1.2.3.apk" -ForegroundColor Green
} else {
    Write-Host "Error en la compilacion de Gradle" -ForegroundColor Red
    exit $LASTEXITCODE
}
