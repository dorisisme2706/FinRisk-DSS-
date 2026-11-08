param([string]$Snapshot = "", [int]$Port = 8080)
$ErrorActionPreference = "Stop"
$appRoot = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $appRoot
try {
    Remove-Item Env:\GROQ_API_KEY -ErrorAction SilentlyContinue
    $secureKey = Read-Host "Paste NEW Groq API key here, then Enter (input hidden)" -AsSecureString
    $env:GROQ_API_KEY = [System.Net.NetworkCredential]::new("", $secureKey).Password
    Remove-Variable secureKey
    if ([string]::IsNullOrWhiteSpace($env:GROQ_API_KEY)) { throw "API key is empty." }
    $env:FINRISK_CHAT_PROVIDER = "groq"
    $env:FINRISK_CHAT_MODEL = "openai/gpt-oss-20b"
    if ([string]::IsNullOrWhiteSpace($Snapshot)) {
        $defaultSnapshot = "D:\DSS\FinRisk_CORE4_Snapshot"
        $defaultAvailable = Test-Path -LiteralPath (Join-Path $defaultSnapshot "data\feature_matrix.parquet") -PathType Leaf
        $prompt = if ($defaultAvailable) { "CORE4 snapshot path (Enter = $defaultSnapshot)" } else { "CORE4 snapshot folder (Enter = FAQ only, no ML score)" }
        $answer = Read-Host $prompt
        if (-not [string]::IsNullOrWhiteSpace($answer)) { $Snapshot = $answer.Trim().Trim('"') }
        elseif ($defaultAvailable) { $Snapshot = $defaultSnapshot }
    }
    if ($Snapshot -and -not (Test-Path -LiteralPath (Join-Path $Snapshot "data\feature_matrix.parquet") -PathType Leaf)) {
        throw "SNAPSHOT_PATH_INVALID: choose the folder containing data\feature_matrix.parquet."
    }
    $arguments = @((Join-Path $appRoot "backend_api\server.py"), "--port", "$Port")
    if ($Snapshot) { $arguments += @("--snapshot", $Snapshot) }
    $venv = Join-Path $appRoot ".venv\Scripts\python.exe"
    Write-Host "Open http://127.0.0.1:$Port . Keep this window open. Ctrl+C stops the server."
    if (Test-Path -LiteralPath $venv -PathType Leaf) { & $venv @arguments }
    elseif (Get-Command py -ErrorAction SilentlyContinue) { & py -3 @arguments }
    elseif (Get-Command python -ErrorAction SilentlyContinue) { & python @arguments }
    else { throw "PYTHON_NOT_FOUND: install Python or restore this project's .venv." }
    if ($LASTEXITCODE -ne 0) { throw "Backend stopped with exit code $LASTEXITCODE. Check the message above." }
} catch {
    Write-Host $_.Exception.Message -ForegroundColor Red
    exit 1
} finally {
    # Clear only the child launcher session; no key file or persistent user env is written.
    Remove-Item Env:\GROQ_API_KEY -ErrorAction SilentlyContinue
}
