param(
    [string]$PgBin = 'C:\PostgreSQL\pgsql\bin',
    [string]$TestDataDir = "$env:LOCALAPPDATA\FinRisk\M08_5_3_1_Test_Data_PostLF_20261112",
    [int]$TestPort = 55432,
    [string]$PythonExe = '',
    [switch]$CleanupOnly
)

$ErrorActionPreference = 'Stop'
$AppRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$InitDb = Join-Path $PgBin 'initdb.exe'
$PgCtl = Join-Path $PgBin 'pg_ctl.exe'
$Psql = Join-Path $PgBin 'psql.exe'
$PocSql = Join-Path $PSScriptRoot 'M08_5_4_2_ACTOR_ASSERTION_POC.sql'
$PocRunner = Join-Path $PSScriptRoot 'test_m08_5_4_2_signed_actor_assertion.py'
$DefaultPython = Join-Path $AppRoot '.venv\Scripts\python.exe'
$Python = $null
$StartedByThisRun = $false
$PasswordBstr = [IntPtr]::Zero
$PasswordPlain = $null
$securePassword = $null
$HadOriginalDsn = Test-Path Env:FINRISK_M08542_TEST_DSN
$OriginalDsn = $env:FINRISK_M08542_TEST_DSN
$HadOriginalPgPassword = Test-Path Env:PGPASSWORD
$OriginalPgPassword = $env:PGPASSWORD
$MarkerFile = Join-Path $TestDataDir '.m08_5_3_1_isolated_test_cluster'
$LogFile = Join-Path (Split-Path -Parent $TestDataDir) 'M08_5_4_2_Actor_Assertion_Test_PostgreSQL.log'

function Assert-Leaf([string]$Path, [string]$Label) {
    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
        throw "$Label not found: $Path"
    }
}

try {
    if ($TestPort -ne 55432 -or $TestPort -eq 5432) {
        throw 'This approved POC is pinned to isolated loopback port 55432; production port 5432 is forbidden.'
    }

    $resolvedTestDataDir = [System.IO.Path]::GetFullPath($TestDataDir).TrimEnd('\')
    $knownProductionDataDir = 'C:\PostgreSQL\data'
    if ($resolvedTestDataDir.Equals($knownProductionDataDir, [StringComparison]::OrdinalIgnoreCase) -or
        $resolvedTestDataDir.StartsWith($knownProductionDataDir + '\', [StringComparison]::OrdinalIgnoreCase)) {
        throw 'Refusing the known production PostgreSQL data directory or one of its subdirectories.'
    }

    Assert-Leaf $InitDb 'initdb.exe'
    Assert-Leaf $PgCtl 'pg_ctl.exe'
    Assert-Leaf $Psql 'psql.exe'
    Assert-Leaf $PocRunner 'Signed actor assertion Python test runner'
    if (-not $CleanupOnly) { Assert-Leaf $PocSql 'Signed actor assertion POC SQL' }
    Assert-Leaf $MarkerFile 'M08.5.3.1 isolated-cluster marker'
    Assert-Leaf (Join-Path $TestDataDir 'PG_VERSION') 'PostgreSQL PG_VERSION'

    $markerValue = (Get-Content -LiteralPath $MarkerFile -Raw).Trim()
    if ($markerValue -ne 'Dedicated M08.5.3.1 isolated test cluster; not production.') {
        throw 'Isolation marker does not match the approved test-cluster marker. Refusing to continue.'
    }
    $clusterVersion = (Get-Content -LiteralPath (Join-Path $TestDataDir 'PG_VERSION') -Raw).Trim()
    if ($clusterVersion -ne '17') {
        throw "Expected PostgreSQL 17 isolated cluster; detected $clusterVersion. Refusing to continue."
    }

    $initVersion = (& $InitDb --version | Out-String).Trim()
    $ctlVersion = (& $PgCtl --version | Out-String).Trim()
    $psqlVersion = (& $Psql --version | Out-String).Trim()
    foreach ($version in @($initVersion, $ctlVersion, $psqlVersion)) {
        if ($version -notmatch 'PostgreSQL\)\s+17(?:\.|$)') {
            throw "PostgreSQL 17 binaries are required. Detected: $version"
        }
    }

    if ($PythonExe) {
        Assert-Leaf $PythonExe 'Selected Python interpreter'
        $Python = (Resolve-Path -LiteralPath $PythonExe).Path
    } elseif (Test-Path -LiteralPath $DefaultPython -PathType Leaf) {
        $Python = $DefaultPython
    } else {
        throw 'Project .venv Python not found. Use app\.venv\Scripts\python.exe or pass -PythonExe.'
    }

    & $Python -c 'import psycopg' 2>$null
    if ($LASTEXITCODE -ne 0) {
        throw 'Selected project Python cannot import psycopg. Do not install into system Python; restore the app .venv dependency first.'
    }

    $statusOutput = & $PgCtl -D $TestDataDir status 2>&1
    $statusCode = $LASTEXITCODE
    if ($statusCode -ne 0) {
        Write-Host 'Starting only the marked isolated PostgreSQL test cluster on 127.0.0.1:55432 ...' -ForegroundColor Cyan
        & $PgCtl -D $TestDataDir -l $LogFile -o '-h 127.0.0.1 -p 55432' -w start
        if ($LASTEXITCODE -ne 0) {
            throw "Could not start the isolated cluster. Review $LogFile. No connection to port 5432 was made."
        }
        $StartedByThisRun = $true
    } else {
        Write-Host 'Using the already-running marked isolated test cluster.' -ForegroundColor Cyan
    }

    $securePassword = Read-Host 'Enter the postgres password for the ISOLATED TEST cluster only (input hidden)' -AsSecureString
    if ($securePassword.Length -eq 0) {
        throw 'A non-empty isolated test-cluster password is required.'
    }
    $PasswordBstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)
    $PasswordPlain = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($PasswordBstr)
    [void]$securePassword.Dispose()
    $securePassword = $null

    $encodedPassword = [System.Uri]::EscapeDataString($PasswordPlain)
    $env:FINRISK_M08542_TEST_DSN = "postgresql://postgres:$encodedPassword@127.0.0.1:55432/finrisk_app_db"
    $env:PGPASSWORD = $PasswordPlain

    # Verify actual endpoint before applying any POC SQL.
    $identitySql = "SELECT current_database() || '|' || session_user || '|' || host(inet_server_addr()) || '|' || inet_server_port() || '|' || current_setting('server_version_num');"
    $identity = (& $Psql -X -A -t -q -v ON_ERROR_STOP=1 -h 127.0.0.1 -p 55432 -U postgres -d finrisk_app_db -c $identitySql | Out-String).Trim()
    if ($LASTEXITCODE -ne 0) { throw 'Could not verify isolated PostgreSQL endpoint.' }
    if ($identity -notmatch '^finrisk_app_db\|postgres\|127\.0\.0\.1\|55432\|17') {
        throw "Unexpected isolated test endpoint. Refusing POC execution. Identity response: $identity"
    }
    Write-Host 'PASS | Connected only to 127.0.0.1:55432 / finrisk_app_db / PostgreSQL 17' -ForegroundColor Green

    if ($CleanupOnly) {
        & $Python $PocRunner --cleanup-only
        if ($LASTEXITCODE -ne 0) { throw 'POC cleanup-only failed; inspect the Python output.' }
    } else {
        Write-Host 'Installing temporary verifier objects in the isolated test database ...' -ForegroundColor Cyan
        & $Psql -X -v ON_ERROR_STOP=1 -h 127.0.0.1 -p 55432 -U postgres -d finrisk_app_db -f $PocSql
        if ($LASTEXITCODE -ne 0) { throw 'POC SQL setup failed. The SQL file is transactional; inspect the PostgreSQL error.' }

        Write-Host 'Running signed actor assertion, tampering, replay and actual RLS tests ...' -ForegroundColor Cyan
        & $Python $PocRunner
        if ($LASTEXITCODE -ne 0) { throw 'Signed actor assertion POC failed. The Python runner attempts to restore the fail-closed baseline in its cleanup.' }
    }

    Write-Host 'Production PostgreSQL service/port 5432: NOT USED' -ForegroundColor Green
    Write-Host 'Production database finrisk_app_db: NOT CONNECTED' -ForegroundColor Green
    Write-Host 'H16 / CORE4 / H18: NOT MODIFIED' -ForegroundColor Green
} finally {
    if ($HadOriginalDsn) { $env:FINRISK_M08542_TEST_DSN = $OriginalDsn }
    else { Remove-Item Env:FINRISK_M08542_TEST_DSN -ErrorAction SilentlyContinue }

    if ($HadOriginalPgPassword) { $env:PGPASSWORD = $OriginalPgPassword }
    else { Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue }

    $PasswordPlain = $null
    if ($null -ne $securePassword) { [void]$securePassword.Dispose() }
    if ($PasswordBstr -ne [IntPtr]::Zero) {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($PasswordBstr)
    }

    if ($StartedByThisRun) {
        Write-Host 'Stopping only the isolated test cluster started by this script ...' -ForegroundColor Cyan
        & $PgCtl -D $TestDataDir -m fast -w stop
        if ($LASTEXITCODE -ne 0) {
            Write-Warning "Could not stop the isolated test cluster automatically. Use pg_ctl -D `"$TestDataDir`" -m fast -w stop."
        }
    }
}
