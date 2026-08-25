[CmdletBinding()]
param(
  [ValidateSet("docker", "native")]
  [string]$Engine = "docker",

  [string]$BaseUrl = "http://localhost:3000/api",

  [string]$TokenFile = "performance-tokens.json",

  [string]$Users = "1,5,10,20,50,100",

  [ValidateRange(1, 1000)]
  [int]$IterationsPerUser = 10,

  [ValidateSet("none", "same-value", "round-trip")]
  [string]$WriteMode = "none",

  [string]$TicketFilter = "",

  [ValidateSet("production", "development", "unknown")]
  [string]$BackendMode = "unknown"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

if ($WriteMode -eq "round-trip" -and [string]::IsNullOrWhiteSpace($TicketFilter)) {
  throw "round-trip requires -TicketFilter so only dedicated performance-test tickets are modified."
}

$resolvedTokenFile = if ([System.IO.Path]::IsPathRooted($TokenFile)) {
  $TokenFile
}
else {
  Join-Path $PSScriptRoot $TokenFile
}

if (-not (Test-Path -LiteralPath $resolvedTokenFile -PathType Leaf)) {
  throw "Token file not found: $resolvedTokenFile"
}

try {
  $rawTokenJson = Get-Content -LiteralPath $resolvedTokenFile -Raw
  $trimmedTokenJson = $rawTokenJson.Trim()
  if (-not $trimmedTokenJson.StartsWith("[") -or -not $trimmedTokenJson.EndsWith("]")) {
    throw "The token file must contain a JSON array."
  }
  $parsedTokens = $trimmedTokenJson | ConvertFrom-Json
  $tokens = @(
    $parsedTokens | ForEach-Object {
      if ($_ -isnot [string] -or [string]::IsNullOrWhiteSpace($_)) {
        throw "Every token array entry must be a non-empty string."
      }
      $_.Trim()
    }
  )
}
catch {
  throw "Could not read tokens from '$resolvedTokenFile': $($_.Exception.Message)"
}

if ($tokens.Count -eq 0) {
  throw "The token file is empty. Add at least one API token to $resolvedTokenFile."
}

$originalEnvironment = @{
  SAPLING_TOKEN = $env:SAPLING_TOKEN
  SAPLING_TOKENS_JSON = $env:SAPLING_TOKENS_JSON
  SAPLING_BASE_URL = $env:SAPLING_BASE_URL
  SAPLING_WRITE_MODE = $env:SAPLING_WRITE_MODE
  SAPLING_TICKET_FILTER = $env:SAPLING_TICKET_FILTER
}

$exitCode = 0

try {
  Remove-Item Env:SAPLING_TOKEN -ErrorAction SilentlyContinue
  $env:SAPLING_TOKENS_JSON = ConvertTo-Json -InputObject $tokens -Compress
  $env:SAPLING_BASE_URL = $BaseUrl.TrimEnd("/")
  $env:SAPLING_WRITE_MODE = $WriteMode

  if ([string]::IsNullOrWhiteSpace($TicketFilter)) {
    Remove-Item Env:SAPLING_TICKET_FILTER -ErrorAction SilentlyContinue
  }
  else {
    $env:SAPLING_TICKET_FILTER = $TicketFilter
  }

  Write-Host ""
  Write-Host "Sapling performance test"
  Write-Host "  Backend:    $($env:SAPLING_BASE_URL)"
  Write-Host "  Engine:     $Engine"
  Write-Host "  Tokens:     $($tokens.Count) identities"
  Write-Host "  Users:      $Users"
  Write-Host "  Iterations: $IterationsPerUser per user"
  Write-Host "  Write mode: $WriteMode"
  Write-Host "  Backend mode: $BackendMode"
  Write-Host ""

  & npm run test:performance -- `
    --engine $Engine `
    --users $Users `
    --iterations $IterationsPerUser `
    --backend-mode $BackendMode
  $exitCode = $LASTEXITCODE
}
finally {
  foreach ($entry in $originalEnvironment.GetEnumerator()) {
    if ($null -eq $entry.Value) {
      Remove-Item "Env:$($entry.Key)" -ErrorAction SilentlyContinue
    }
    else {
      Set-Item "Env:$($entry.Key)" $entry.Value
    }
  }
}

if ($exitCode -ne 0) {
  Write-Error "The performance test finished with exit code $exitCode. Check the generated matrix report for threshold or infrastructure failures."
}
