$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $projectRoot
try {
    if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
        throw 'Node.js is required. Install Node.js 22.12+ (or 24 LTS), then run this launcher again.'
    }
    if (-not (Test-Path -LiteralPath (Join-Path $projectRoot 'node_modules/express/package.json'))) {
        Write-Host 'Installing application dependencies (first launch only)...'
        & npm.cmd ci
        if ($LASTEXITCODE -ne 0) { throw 'Dependency installation failed. Check your network and retry.' }
    }
    if (-not (Test-Path -LiteralPath (Join-Path $projectRoot 'dist/index.html'))) {
        & npm.cmd run build
        if ($LASTEXITCODE -ne 0) { throw 'Build failed. Check the errors above.' }
    }
    & node server/index.mjs
    if ($LASTEXITCODE -ne 0) { throw 'Server stopped with an error. Check the message above.' }
} catch {
    Write-Host $_.Exception.Message -ForegroundColor Red
    Read-Host 'Press Enter to close'
    exit 1
}
