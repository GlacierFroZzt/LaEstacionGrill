$distPath = "D:\TaqueriaKm243\visor-logs\dist"
$zipPath = "D:\TaqueriaKm243\terminal-bundle.zip"
if (Test-Path $zipPath) { Remove-Item $zipPath -Force }
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
$zipArchive = [System.IO.Compression.ZipFile]::Open($zipPath, [System.IO.Compression.ZipArchiveMode]::Create)
Get-ChildItem -Path $distPath -Recurse -File | ForEach-Object {
    $rel = $_.FullName.Substring($distPath.Length + 1).Replace("\", "/")
    [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zipArchive, $_.FullName, $rel)
}
$zipArchive.Dispose()
Write-Host "Zip de Terminal creado exitosamente con tamaño: $((Get-Item $zipPath).Length) bytes"
