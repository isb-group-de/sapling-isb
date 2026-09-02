[CmdletBinding()]
param(
    [Parameter()]
    [string]$RepositoryRoot = (Get-Location).Path,

    [Parameter()]
    [ValidateRange(1, [int]::MaxValue)]
    [int]$MaximumLines = 600
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$resolvedRepositoryRoot = (Resolve-Path -LiteralPath $RepositoryRoot).Path
$projectRoots = @('backend', 'frontend')
$sourceExtensions = [System.Collections.Generic.HashSet[string]]::new(
    [System.StringComparer]::OrdinalIgnoreCase
)
@(
    '.ts', '.tsx', '.mts', '.cts',
    '.js', '.jsx', '.mjs', '.cjs',
    '.vue', '.css', '.scss', '.sass', '.less', '.html'
) | ForEach-Object { [void]$sourceExtensions.Add($_) }

$excludedDirectoryPattern = '(^|[\\/])(node_modules|dist|build|coverage|vendor|\.git)([\\/]|$)'
$gitCommand = Get-Command git -ErrorAction SilentlyContinue
$relativeFiles = @()

if ($null -ne $gitCommand) {
    $relativeFiles = @(& $gitCommand.Source -C $resolvedRepositoryRoot ls-files -- $projectRoots 2>$null)
    if ($LASTEXITCODE -ne 0) {
        Write-Verbose 'git ls-files was unavailable for this repository; using a filesystem scan.'
        $relativeFiles = @()
    }
}

if ($relativeFiles.Count -eq 0) {
    $relativeFiles = @(
        foreach ($projectRoot in $projectRoots) {
            $absoluteProjectRoot = Join-Path -Path $resolvedRepositoryRoot -ChildPath $projectRoot
            if (Test-Path -LiteralPath $absoluteProjectRoot -PathType Container) {
                Get-ChildItem -LiteralPath $absoluteProjectRoot -Recurse -File |
                    ForEach-Object {
                        [System.IO.Path]::GetRelativePath($resolvedRepositoryRoot, $_.FullName)
                    }
            }
        }
    )
}

$oversizedFiles = @(
    foreach ($relativeFile in $relativeFiles) {
        if ([string]::IsNullOrWhiteSpace($relativeFile)) {
            continue
        }

        if ($relativeFile -match $excludedDirectoryPattern) {
            continue
        }

        $extension = [System.IO.Path]::GetExtension($relativeFile)
        if (-not $sourceExtensions.Contains($extension)) {
            continue
        }

        $absoluteFile = Join-Path -Path $resolvedRepositoryRoot -ChildPath $relativeFile
        if (-not (Test-Path -LiteralPath $absoluteFile -PathType Leaf)) {
            continue
        }

        $lineCount = 0
        $reader = [System.IO.File]::OpenText($absoluteFile)
        try {
            while ($null -ne $reader.ReadLine()) {
                $lineCount++
            }
        }
        finally {
            $reader.Dispose()
        }

        if ($lineCount -gt $MaximumLines) {
            [pscustomobject]@{
                File  = $relativeFile
                Lines = $lineCount
            }
        }
    }
)

$oversizedFiles = @($oversizedFiles | Sort-Object -Property Lines -Descending)
Write-Output "File-size audit (maintained backend/frontend files, maximum $MaximumLines physical lines):"

if ($oversizedFiles.Count -eq 0) {
    Write-Output 'No files exceed the configured maximum.'
    return
}

foreach ($file in $oversizedFiles) {
    Write-Output ("{0}: {1} lines" -f $file.File, $file.Lines)
}
