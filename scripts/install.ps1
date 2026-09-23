<#
.SYNOPSIS
  Installs dsh-whale-musume as a DSH bundle plugin (README Method A), using
  the globally-installed `dsh` CLI: dsh plugin --profile <Profile> add <Source>.
  ("dsh plugin add" just forwards to pnpm inside the profile directory.)

.PARAMETER Profile
  The DSH profile to install into (default: web).

.PARAMETER Source
  Anything pnpm's `add` accepts as a package source. Defaults to this repo's
  own directory, so it installs straight from your local working tree; pass
  e.g. "github:Sutera-Diffusus/dsh-whale-musume" for a release install.
#>
param(
  [string]$Profile = "web",
  [string]$Source
)

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot

$dshCmd = Get-Command dsh -ErrorAction SilentlyContinue
if (-not $dshCmd) {
  throw "dsh CLI not found on PATH. Install it first: npm install -g @deepseek-ai/dsh"
}
Write-Host "Using dsh: $($dshCmd.Source)"

$pnpmCmd = Get-Command pnpm -ErrorAction SilentlyContinue
if (-not $pnpmCmd) {
  throw "'dsh plugin add' forwards to pnpm, which isn't on PATH. Install it: npm install -g pnpm"
}

$dshHome = if ($env:DSH_HOME) { $env:DSH_HOME } else { Join-Path $env:USERPROFILE ".dsh" }
$profileDir = Join-Path $dshHome "profiles\$Profile"
if (-not (Test-Path $profileDir)) {
  $existing = Get-ChildItem (Join-Path $dshHome "profiles") -Directory -ErrorAction SilentlyContinue |
    ForEach-Object { $_.Name }
  throw "Profile '$Profile' not found at $profileDir. Existing profiles: $($existing -join ', ')"
}

if (-not $Source) { $Source = $repoRoot }

Write-Host "Installing '$Source' into profile '$Profile' ($profileDir)..."
dsh plugin --profile $Profile add $Source
if ($LASTEXITCODE -ne 0) { throw "dsh plugin add failed (exit $LASTEXITCODE)" }

Write-Host "Done. Restart 'dsh $Profile' (or 'dsh web') and hard-refresh the page (Ctrl+F5)."
