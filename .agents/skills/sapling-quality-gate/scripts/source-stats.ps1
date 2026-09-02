[CmdletBinding()]
param(
    [Parameter()]
    [string]$RepositoryRoot = (Get-Location).Path
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$resolvedRepositoryRoot = (Resolve-Path -LiteralPath $RepositoryRoot).Path
$areas = @(
    [pscustomobject]@{ Name = 'Backend'; RelativePath = 'backend\src' },
    [pscustomobject]@{ Name = 'Frontend'; RelativePath = 'frontend\src' }
)
$excludedDirectoryPattern = '(^|[\\/])(node_modules|dist|coverage|\.git)([\\/]|$)'

function Invoke-SlocSummary {
    param(
        [Parameter(Mandatory)]
        [string]$RelativePath
    )

    $slocCommand = Get-Command sloc -ErrorAction SilentlyContinue
    if ($null -ne $slocCommand) {
        $rawOutput = & $slocCommand.Source --format json --exclude $excludedDirectoryPattern $RelativePath
    }
    else {
        $npxCommand = Get-Command npx -ErrorAction Stop
        $rawOutput = & $npxCommand.Source --yes sloc --format json --exclude $excludedDirectoryPattern $RelativePath
    }

    if ($LASTEXITCODE -ne 0) {
        throw "sloc failed for $RelativePath with exit code $LASTEXITCODE"
    }

    $result = ($rawOutput | Out-String) | ConvertFrom-Json
    if ($null -eq $result.summary -or $null -eq $result.files) {
        throw "sloc returned an unexpected result for $RelativePath"
    }

    return [pscustomobject]@{
        Files = [long]$result.files.Count
        Lines = [long]$result.summary.source
    }
}

Push-Location -LiteralPath $resolvedRepositoryRoot
try {
    $statistics = foreach ($area in $areas) {
        $sourceRoot = Join-Path -Path $resolvedRepositoryRoot -ChildPath $area.RelativePath
        if (-not (Test-Path -LiteralPath $sourceRoot -PathType Container)) {
            throw "Missing source directory: $sourceRoot"
        }

        $summary = Invoke-SlocSummary -RelativePath $area.RelativePath
        [pscustomobject]@{
            Area  = $area.Name
            Files = $summary.Files
            Lines = $summary.Lines
        }
    }
}
finally {
    Pop-Location
}

$totalFiles = [long](($statistics | Measure-Object -Property Files -Sum).Sum)
$totalLines = [long](($statistics | Measure-Object -Property Lines -Sum).Sum)
$statistics += [pscustomobject]@{
    Area  = 'Total'
    Files = $totalFiles
    Lines = $totalLines
}

Write-Output 'SLOC statistics (backend/src and frontend/src only):'
foreach ($row in $statistics) {
    Write-Output ("{0}: {1} files, {2} source lines" -f $row.Area, $row.Files, $row.Lines)
}
