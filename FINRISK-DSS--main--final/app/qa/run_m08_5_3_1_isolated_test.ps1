param(
    [string]$PgBin = 'C:\PostgreSQL\pgsql\bin',
    [string]$TestDataDir = "$env:LOCALAPPDATA\FinRisk\M08_5_3_1_Test_Data",
    [int]$TestPort = 55432,
    [string]$PythonExe = ''
)

$ErrorActionPreference = 'Stop'
$AppRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$InitDb = Join-Path $PgBin 'initdb.exe'
$PgCtl = Join-Path $PgBin 'pg_ctl.exe'
$Psql = Join-Path $PgBin 'psql.exe'
$RoleBootstrap = Join-Path $PSScriptRoot 'M08_5_3_1_TEST_ROLE_BOOTSTRAP.sql'
$MigrationsDir = Join-Path $AppRoot 'database\migrations'
$TestSql = Join-Path $PSScriptRoot 'M08_5_3_1_TEST_ASSERTIONS.sql'
$DefaultPython = Join-Path $AppRoot '.venv\Scripts\python.exe'
$Python = $null
$PythonPrefixArgs = @()
$MigrationRunner = Join-Path $AppRoot 'backend_api\migrate.py'
$LogFile = Join-Path (Split-Path -Parent $TestDataDir) 'M08_5_3_1_Test_PostgreSQL.log'
$DatabaseName = 'finrisk_app_db'
$StartedByThisRun = $false
$PasswordBstr = [IntPtr]::Zero
$PasswordPlain = $null
$securePassword = $null
$HadOriginalPgPassword = Test-Path Env:PGPASSWORD
$OriginalPgPassword = $env:PGPASSWORD
$HadOriginalMigrationDsn = Test-Path Env:FINRISK_MIGRATION_DATABASE_URL
$OriginalMigrationDsn = $env:FINRISK_MIGRATION_DATABASE_URL
$MarkerFile = Join-Path $TestDataDir '.m08_5_3_1_isolated_test_cluster'

function Assert-Path([string]$Path, [string]$Label) {
    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
        throw "$Label not found: $Path"
    }
}

function Invoke-Psql([string]$Database, [string[]]$ExtraArgs) {
    $baseArgs = @(
        '-X', '-v', 'ON_ERROR_STOP=1',
        '-h', '127.0.0.1', '-p', "$TestPort", '-U', 'postgres', '-d', $Database
    )
    $allArgs = $baseArgs + $ExtraArgs
    & $Psql @allArgs
    if ($LASTEXITCODE -ne 0) {
        throw "psql failed (exit code $LASTEXITCODE) while processing database '$Database'."
    }
}

function Get-PsqlScalar([string]$Database, [string]$Sql) {
    $queryArgs = @(
        '-X', '-A', '-t', '-q',
        '-h', '127.0.0.1', '-p', "$TestPort", '-U', 'postgres', '-d', $Database,
        '-c', $Sql
    )
    $output = & $Psql @queryArgs
    if ($LASTEXITCODE -ne 0) {
        throw "Read-only psql query failed on '$Database'."
    }
    return (($output -join "`n").Trim())
}

try {
    if ($TestPort -eq 5432) {
        throw 'Port 5432 is reserved for your existing PostgreSQL service. Use the isolated test port 55432 or another free port.'
    }
    $resolvedTestDataDir = [System.IO.Path]::GetFullPath($TestDataDir).TrimEnd('\')
    $knownProductionDataDir = 'C:\PostgreSQL\data'
    if ($resolvedTestDataDir.Equals($knownProductionDataDir, [StringComparison]::OrdinalIgnoreCase) -or
        $resolvedTestDataDir.StartsWith($knownProductionDataDir + '\', [StringComparison]::OrdinalIgnoreCase)) {
        throw 'Refusing to use the known production PostgreSQL data directory or one of its subdirectories.'
    }

    Assert-Path $InitDb 'initdb.exe'
    Assert-Path $PgCtl 'pg_ctl.exe'
    Assert-Path $Psql 'psql.exe'
    $initDbVersion = (& $InitDb --version | Out-String).Trim()
    if ($LASTEXITCODE -ne 0 -or $initDbVersion -notmatch 'PostgreSQL\)\s+17(?:\.|$)') {
        throw "PostgreSQL 17 initdb is required. Detected: $initDbVersion"
    }
    $pgCtlVersion = (& $PgCtl --version | Out-String).Trim()
    if ($LASTEXITCODE -ne 0 -or $pgCtlVersion -notmatch 'PostgreSQL\)\s+17(?:\.|$)') {
        throw "PostgreSQL 17 pg_ctl is required. Detected: $pgCtlVersion"
    }
    $psqlVersion = (& $Psql --version | Out-String).Trim()
    if ($LASTEXITCODE -ne 0 -or $psqlVersion -notmatch 'PostgreSQL\)\s+17(?:\.|$)') {
        throw "PostgreSQL 17 psql is required. Detected: $psqlVersion"
    }
    Assert-Path $RoleBootstrap 'Role bootstrap SQL'
    Assert-Path (Join-Path $MigrationsDir '0001_initial_schema.sql') 'Migration 0001'
    Assert-Path (Join-Path $MigrationsDir '0002_runtime_grants.sql') 'Migration 0002'
    Assert-Path (Join-Path $MigrationsDir '0003_business_rule_registry.sql') 'Migration 0003'
    Assert-Path $TestSql 'Test assertions SQL'
    Assert-Path $MigrationRunner 'FinRisk migration runner'
    if ($PythonExe) {
        Assert-Path $PythonExe 'Selected Python interpreter'
        $Python = (Resolve-Path -LiteralPath $PythonExe).Path
    } elseif (Test-Path -LiteralPath $DefaultPython -PathType Leaf) {
        $Python = $DefaultPython
    } else {
        $PyLauncher = Get-Command py.exe -ErrorAction SilentlyContinue
        if ($null -eq $PyLauncher) {
            throw 'No app .venv Python and no py.exe launcher found. Create app\.venv with database\requirements-postgres.txt, or pass -PythonExe.'
        }
        & $PyLauncher.Source -3 -c 'import psycopg' 2>$null
        if ($LASTEXITCODE -ne 0) {
            throw 'The fallback Python does not have psycopg. Create app\.venv, install database\requirements-postgres.txt, then rerun; or pass -PythonExe.'
        }
        $Python = $PyLauncher.Source
        $PythonPrefixArgs = @('-3')
    }

    $expected = @(
        '0001_initial_schema.sql',
        '0002_runtime_grants.sql',
        '0003_business_rule_registry.sql'
    )
    $actual = @(Get-ChildItem -LiteralPath $MigrationsDir -Filter '*.sql' -File | Sort-Object Name | ForEach-Object { $_.Name })
    if (($actual -join '|') -ne ($expected -join '|')) {
        throw "Expected exactly migration files $($expected -join ', '). Found: $($actual -join ', '). Stop and inspect the migrations folder."
    }

    $parentDir = Split-Path -Parent $TestDataDir
    if (-not (Test-Path -LiteralPath $parentDir)) {
        New-Item -ItemType Directory -Path $parentDir -Force | Out-Null
    }

    $pgVersionFile = Join-Path $TestDataDir 'PG_VERSION'
    if (Test-Path -LiteralPath $TestDataDir) {
        if ((Test-Path -LiteralPath $pgVersionFile) -and -not (Test-Path -LiteralPath $MarkerFile)) {
            throw "Existing PostgreSQL cluster has no M08.5.3.1 isolation marker: $TestDataDir. Choose a new test directory; nothing was modified."
        }
        if (-not (Test-Path -LiteralPath $pgVersionFile)) {
            $contents = @(Get-ChildItem -LiteralPath $TestDataDir -Force -ErrorAction SilentlyContinue)
            if ($contents.Count -gt 0) {
                throw "Test data directory exists but is not a PostgreSQL cluster: $TestDataDir. Nothing was deleted. Choose another directory."
            }
        }
    } else {
        New-Item -ItemType Directory -Path $TestDataDir -Force | Out-Null
    }

    if (-not (Test-Path -LiteralPath $pgVersionFile)) {
        Write-Host 'Initializing a separate PostgreSQL test cluster (version 17).' -ForegroundColor Cyan
        Write-Host "Test data directory: $TestDataDir"
        Write-Host "Test port: $TestPort (the existing service on port 5432 is not used)"
        & $InitDb -D $TestDataDir -U postgres --encoding=UTF8 --auth-local=trust --auth-host=scram-sha-256 -W
        if ($LASTEXITCODE -ne 0) {
            throw 'initdb failed. The existing PostgreSQL service/data directory has not been touched.'
        }
        Set-Content -LiteralPath $MarkerFile -Value 'Dedicated M08.5.3.1 isolated test cluster; not production.' -Encoding ASCII
    } else {
        $markerValue = (Get-Content -LiteralPath $MarkerFile -Raw).Trim()
        if ($markerValue -ne 'Dedicated M08.5.3.1 isolated test cluster; not production.') {
            throw 'The isolated-cluster marker is invalid. Choose a new test data directory; nothing was changed.'
        }
        $clusterVersion = (Get-Content -LiteralPath $pgVersionFile -Raw).Trim()
        if ($clusterVersion -ne '17') {
            throw "The existing test cluster is PostgreSQL $clusterVersion, but this test pack targets 17.11. Nothing was changed."
        }
        Write-Host "Reusing existing isolated PostgreSQL 17 test cluster: $TestDataDir" -ForegroundColor Cyan
    }

    $statusOutput = & $PgCtl -D $TestDataDir status 2>&1
    $statusCode = $LASTEXITCODE
    if ($statusCode -ne 0) {
        Write-Host "Starting isolated PostgreSQL test cluster on 127.0.0.1:$TestPort ..." -ForegroundColor Cyan
        & $PgCtl -D $TestDataDir -l $LogFile -o "-h 127.0.0.1 -p $TestPort" -w start
        if ($LASTEXITCODE -ne 0) {
            throw "Could not start isolated test cluster. Review log: $LogFile. The existing service on port 5432 was not stopped or modified."
        }
        $StartedByThisRun = $true
    } else {
        Write-Host 'The isolated test cluster is already running.' -ForegroundColor Cyan
    }

    $securePassword = Read-Host 'Enter the postgres password for the isolated TEST cluster (input hidden)' -AsSecureString
    if ($securePassword.Length -eq 0) {
        throw 'A non-empty test-cluster postgres password is required.'
    }
    $PasswordBstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)
    $PasswordPlain = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($PasswordBstr)
    [void]$securePassword.Dispose()
    $securePassword = $null
    $env:PGPASSWORD = $PasswordPlain

    $connectedPort = Get-PsqlScalar 'postgres' 'SELECT inet_server_port();'
    $connectedAddress = Get-PsqlScalar 'postgres' 'SELECT host(inet_server_addr());'
    if ($connectedPort -ne "$TestPort" -or $connectedAddress -ne '127.0.0.1') {
        throw "Refusing unexpected PostgreSQL endpoint $connectedAddress`:$connectedPort; expected 127.0.0.1`:$TestPort."
    }

    # Idempotent creation: the test cluster only. No SQL is sent to the live port 5432.
    Invoke-Psql 'postgres' @('-f', $RoleBootstrap)
    $dbExists = Get-PsqlScalar 'postgres' "SELECT EXISTS (SELECT 1 FROM pg_database WHERE datname = '$DatabaseName');"
    if ($dbExists -ne 't') {
        Invoke-Psql 'postgres' @('-c', "CREATE DATABASE $DatabaseName OWNER finrisk_owner ENCODING 'UTF8' TEMPLATE template0;")
        Write-Host "Created isolated test database: $DatabaseName" -ForegroundColor Green
    } else {
        Write-Host "Reusing isolated test database: $DatabaseName" -ForegroundColor Cyan
    }

    # The actual FinRisk migration runner is used, but its DSN is temporarily
    # redirected to this isolated cluster. No .env file is changed or displayed.
    $encodedPassword = [System.Uri]::EscapeDataString($PasswordPlain)
    $env:FINRISK_MIGRATION_DATABASE_URL = "postgresql://postgres:$encodedPassword@127.0.0.1:$TestPort/$DatabaseName"

    Write-Host "`nApplying migrations with the project's backend_api\migrate.py against the isolated test cluster ..." -ForegroundColor Cyan
    $runMigrationArgs = $PythonPrefixArgs + @($MigrationRunner)
    & $Python @runMigrationArgs
    if ($LASTEXITCODE -ne 0) {
        throw "FinRisk migration runner failed (exit code $LASTEXITCODE). Review the preceding migration error. The working database was not connected."
    }

    Write-Host "`nVerifying migration status and SHA-256 checksums ..." -ForegroundColor Cyan
    $statusArgs = $PythonPrefixArgs + @($MigrationRunner, '--status')
    & $Python @statusArgs
    if ($LASTEXITCODE -ne 0) {
        throw "FinRisk migration status check failed (exit code $LASTEXITCODE)."
    }

    Write-Host "`nRunning migration, RLS, grants, trigger and governance assertions ..." -ForegroundColor Cyan
    Invoke-Psql $DatabaseName @('-1', '-f', $TestSql)

    Write-Host "`nM08.5.3.1 isolated PostgreSQL test completed successfully." -ForegroundColor Green
    Write-Host "Cluster: $TestDataDir"
    Write-Host "Port: $TestPort"
    Write-Host "Database: $DatabaseName"
    Write-Host 'Production cluster/service on port 5432: NOT USED'
    Write-Host 'Production database finrisk_app_db: NOT CONNECTED'
} finally {
    if ($HadOriginalPgPassword) {
        $env:PGPASSWORD = $OriginalPgPassword
    } else {
        Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
    }
    if ($HadOriginalMigrationDsn) {
        $env:FINRISK_MIGRATION_DATABASE_URL = $OriginalMigrationDsn
    } else {
        Remove-Item Env:FINRISK_MIGRATION_DATABASE_URL -ErrorAction SilentlyContinue
    }
    $PasswordPlain = $null
    if ($null -ne $securePassword) {
        [void]$securePassword.Dispose()
    }
    if ($PasswordBstr -ne [IntPtr]::Zero) {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($PasswordBstr)
    }
    if ($StartedByThisRun) {
        Write-Host 'Stopping only the isolated test cluster started by this script ...' -ForegroundColor Cyan
        & $PgCtl -D $TestDataDir -m fast -w stop
        if ($LASTEXITCODE -ne 0) {
            Write-Warning "Could not stop the isolated test cluster automatically. It can be stopped with pg_ctl -D `"$TestDataDir`" -m fast -w stop."
        }
    }
}
