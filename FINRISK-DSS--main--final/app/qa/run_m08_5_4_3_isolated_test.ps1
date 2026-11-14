param(
    [string]$PgBin = 'C:\PostgreSQL\pgsql\bin',
    [string]$TestDataDir = "$env:LOCALAPPDATA\FinRisk\M08_5_3_1_Test_Data_PostLF_20261112",
    [int]$TestPort = 55432,
    [string]$PythonExe = ''
)

$ErrorActionPreference = 'Stop'
$AppRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$PgCtl = Join-Path $PgBin 'pg_ctl.exe'
$Psql = Join-Path $PgBin 'psql.exe'
$IntegrationRunner = Join-Path $PSScriptRoot 'test_m08_5_4_3_integration.py'
$DefaultPython = Join-Path $AppRoot '.venv\Scripts\python.exe'
$MarkerFile = Join-Path $TestDataDir '.m08_5_3_1_isolated_test_cluster'
$LogFile = Join-Path (Split-Path -Parent $TestDataDir) 'M08_5_4_3_Integration_Test_PostgreSQL.log'
$StartedByThisRun = $false
$PasswordBstr = [IntPtr]::Zero
$PasswordPlain = $null
$securePassword = $null

try {
    if ($TestPort -ne 55432 -or $TestPort -eq 5432) {
        throw 'M08.5.4.3 isolated test is pinned to loopback port 55432; production port 5432 is forbidden.'
    }

    if (-not (Test-Path -LiteralPath $MarkerFile -PathType Leaf)) {
        throw "Isolated cluster marker not found: $MarkerFile"
    }

    $Python = if ($PythonExe) { (Resolve-Path -LiteralPath $PythonExe).Path } else { $DefaultPython }

    $statusOutput = & $PgCtl -D $TestDataDir status 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Host 'Starting isolated PostgreSQL 17 test cluster on 127.0.0.1:55432 ...' -ForegroundColor Cyan
        & $PgCtl -D $TestDataDir -l $LogFile -o '-h 127.0.0.1 -p 55432' -w start
        if ($LASTEXITCODE -ne 0) {
            throw "Could not start isolated cluster on 55432. Check $LogFile."
        }
        $StartedByThisRun = $true
    } else {
        Write-Host 'Using already-running isolated PostgreSQL 17 test cluster on 127.0.0.1:55432.' -ForegroundColor Cyan
    }

    $securePassword = Read-Host 'Enter the postgres password for the ISOLATED TEST cluster (55432) only (input hidden)' -AsSecureString
    if ($securePassword.Length -eq 0) {
        throw 'A non-empty isolated test-cluster password is required.'
    }
    $PasswordBstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)
    $PasswordPlain = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($PasswordBstr)
    [void]$securePassword.Dispose()
    $securePassword = $null

    $encodedPassword = [System.Uri]::EscapeDataString($PasswordPlain)
    $env:FINRISK_M08543_TEST_DSN = "postgresql://postgres:$encodedPassword@127.0.0.1:55432/finrisk_app_db"
    $env:PGPASSWORD = $PasswordPlain

    $identitySql = "SELECT current_database() || '|' || session_user || '|' || host(inet_server_addr()) || '|' || inet_server_port() || '|' || current_setting('server_version_num');"
    $identity = (& $Psql -X -A -t -q -v ON_ERROR_STOP=1 -h 127.0.0.1 -p 55432 -U postgres -d finrisk_app_db -c $identitySql | Out-String).Trim()
    if ($LASTEXITCODE -ne 0 -or $identity -notmatch '^finrisk_app_db\|postgres\|127\.0\.0\.1\|55432\|17') {
        throw "Unexpected isolated endpoint response: $identity"
    }
    Write-Host 'PASS | Verified isolated endpoint 127.0.0.1:55432 / finrisk_app_db / PostgreSQL 17' -ForegroundColor Green

    & $Python $IntegrationRunner
    if ($LASTEXITCODE -ne 0) {
        throw 'M08.5.4.3 integration test runner reported failures.'
    }

    Write-Host 'Production PostgreSQL service/port 5432: NOT USED' -ForegroundColor Green
    Write-Host 'H16 / CORE4 / H18 Freeze: NOT MODIFIED' -ForegroundColor Green
} finally {
    Remove-Item Env:FINRISK_M08543_TEST_DSN -ErrorAction SilentlyContinue
    Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
    $PasswordPlain = $null
    if ($null -ne $securePassword) { [void]$securePassword.Dispose() }
    if ($PasswordBstr -ne [IntPtr]::Zero) {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($PasswordBstr)
    }
    if ($StartedByThisRun) {
        Write-Host 'Stopping isolated PostgreSQL test cluster on 55432 ...' -ForegroundColor Cyan
        & $PgCtl -D $TestDataDir -m fast -w stop
    }
}
