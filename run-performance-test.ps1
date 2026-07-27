[CmdletBinding()]
param(
  [ValidateSet("docker", "native")]
  [string]$Engine = "docker",

  [string]$BaseUrl = "http://localhost:3000/api",

  [string]$Users = "1,5,10,20,50,100",

  [ValidateRange(1, 1000)]
  [int]$IterationsPerUser = 3,

  [ValidateSet("none", "same-value", "round-trip")]
  [string]$WriteMode = "none",

  [string]$TicketFilter = ""
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

# Optional: Paste a Sapling bearer API token here for a purely one-click run.
# Prefer the SAPLING_TOKEN environment variable or the secure prompt below so
# that a real token cannot accidentally be committed to Git.
$ConfiguredApiToken = ""

if ($WriteMode -eq "round-trip" -and [string]::IsNullOrWhiteSpace($TicketFilter)) {
  throw "round-trip requires -TicketFilter so only dedicated performance-test tickets are modified."
}

$originalEnvironment = @{
  SAPLING_TOKEN = $env:SAPLING_TOKEN
  SAPLING_BASE_URL = $env:SAPLING_BASE_URL
  SAPLING_WRITE_MODE = $env:SAPLING_WRITE_MODE
  SAPLING_TICKET_FILTER = $env:SAPLING_TICKET_FILTER
}

$exitCode = 0

try {
  if (-not [string]::IsNullOrWhiteSpace($ConfiguredApiToken)) {
    $env:SAPLING_TOKEN = $ConfiguredApiToken.Trim()
  }
  elseif (
    [string]::IsNullOrWhiteSpace($env:SAPLING_TOKEN) -and
    [string]::IsNullOrWhiteSpace($env:SAPLING_TOKENS_JSON)
  ) {
    $secureToken = Read-Host "Sapling API token" -AsSecureString
    $tokenPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureToken)
    try {
      $env:SAPLING_TOKEN = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($tokenPointer)
    }
    finally {
      [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($tokenPointer)
    }
  }

  if ([string]::IsNullOrWhiteSpace($env:SAPLING_TOKEN) -and [string]::IsNullOrWhiteSpace($env:SAPLING_TOKENS_JSON)) {
    throw "No API token was provided."
  }

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
  Write-Host "  Users:      $Users"
  Write-Host "  Iterations: $IterationsPerUser per user"
  Write-Host "  Write mode: $WriteMode"
  Write-Host ""

  & npm run test:performance -- `
    --engine $Engine `
    --users $Users `
    --iterations $IterationsPerUser
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
