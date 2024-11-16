# A PowerShell script to deploy the app to any directory from Windows.
# Can be used to replace the app in a running Docker container.
#
# Usage: powershell -File ./deploy.ps1 <path>

param (
    [string]$destinationPath
)

if (-not $destinationPath) {
    Write-Output "Usage: powershell -File ./deploy.ps1 <path>"
    exit
}

# Get the current directory
$sourcePath = Get-Location

if (-not (Test-Path -Path $destinationPath)) {
    New-Item -Path $destinationPath -ItemType Directory
    Write-Output "Directory created: $destinationPath"
}

# Copy all .js, .json, and .md files from the project root to the destination path
$files = @(
    Get-ChildItem -Path $sourcePath -Filter *.js -File
    Get-ChildItem -Path $sourcePath -Filter *.json -File
    Get-ChildItem -Path $sourcePath -Filter *.md -File
    Get-ChildItem -Path $sourcePath -Filter LICENSE -File
)

$files | ForEach-Object {
    Copy-Item -Path $_.FullName -Destination $destinationPath
    Write-Output "File $($_.FullName) copied."
}

# Create a stop file to signal the app to stop, docker container will restart
if (-not (Test-Path -Path "$($destinationPath)\stop")) {
    New-Item -Path "$($destinationPath)\stop" -ItemType File
}

Write-Output "App deployed to $destinationPath, restarting..."
