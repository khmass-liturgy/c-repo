param(
  [string]$RepositoryRoot = (Split-Path -Parent $PSScriptRoot),
  [int]$QuietSeconds = 5,
  [int64]$MaxFileBytes = 94371840
)

$ErrorActionPreference = 'Stop'
$RepositoryRoot = (Resolve-Path -LiteralPath $RepositoryRoot).Path
$Git = (Get-Command git.exe -ErrorAction Stop).Source
$LogDirectory = Join-Path $env:LOCALAPPDATA 'CodexGitAutoPush\c-repo'
$LogPath = Join-Path $LogDirectory 'watch.log'
$MutexName = 'CodexCRepoGitAutoPush'

New-Item -ItemType Directory -Path $LogDirectory -Force | Out-Null

function Write-Log([string]$Message) {
  $line = "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')  $Message"
  Add-Content -LiteralPath $LogPath -Value $line -Encoding utf8
}

function Invoke-Git([string[]]$Arguments) {
  $previousPreference = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  try {
    $result = & $Git -C $RepositoryRoot @Arguments 2>&1
    $exitCode = $LASTEXITCODE
  } finally {
    $ErrorActionPreference = $previousPreference
  }
  if ($exitCode -ne 0) {
    throw "git $($Arguments -join ' ') failed ($exitCode): $($result -join ' ')"
  }
  return @($result)
}

function Test-ExcludedPath([string]$RelativePath) {
  $normalized = $RelativePath.Replace('\', '/')
  return $normalized -match '(?i)(^|/)(\.git|node_modules|\.cache|__pycache__|logs|tmp|temp)(/|$)' -or
    $normalized -match '(?i)(^|/)\.env(\..*)?$' -or
    $normalized -match '(?i)(^|/).+\.(pem|key|p12|pfx|crt|cer)$' -or
    $normalized -match '(?i)(credential|secret|service-account).*\.json$'
}

function Get-ChangedPaths {
  $lines = Invoke-Git @('status', '--porcelain=v1', '--untracked-files=all')
  $paths = New-Object System.Collections.Generic.List[string]
  foreach ($line in $lines) {
    if ($line.Length -lt 4) { continue }
    $path = $line.Substring(3)
    if ($path -match ' -> ') { $path = $path -replace '^.* -> ', '' }
    if (-not [string]::IsNullOrWhiteSpace($path)) { $paths.Add($path) }
  }
  return @($paths | Select-Object -Unique)
}

function Sync-Repository {
  $paths = Get-ChangedPaths
  if (-not $paths.Count) { return }

  $safePaths = New-Object System.Collections.Generic.List[string]
  foreach ($relativePath in $paths) {
    if (Test-ExcludedPath $relativePath) {
      Write-Log "Skipped excluded path: $relativePath"
      continue
    }
    $fullPath = Join-Path $RepositoryRoot $relativePath
    if ((Test-Path -LiteralPath $fullPath -PathType Leaf) -and ((Get-Item -LiteralPath $fullPath).Length -gt $MaxFileBytes)) {
      Write-Log "Skipped oversized file: $relativePath"
      continue
    }
    $safePaths.Add($relativePath)
  }

  if (-not $safePaths.Count) {
    Write-Log 'No safe changes to commit.'
    return
  }

  Invoke-Git (@('add', '-A', '--') + @($safePaths)) | Out-Null
  $hasStagedChanges = & $Git -C $RepositoryRoot diff --cached --quiet
  if ($LASTEXITCODE -eq 0) { return }
  if ($LASTEXITCODE -ne 1) { throw 'Could not determine staged changes.' }

  Invoke-Git @('diff', '--cached', '--check') | Out-Null
  $message = "chore: auto-sync $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
  Invoke-Git @('commit', '-m', $message) | Out-Null
  Invoke-Git @('-c', 'credential.interactive=never', 'push') | Out-Null
  Write-Log "Committed and pushed: $message"
}

$mutex = New-Object System.Threading.Mutex($false, $MutexName)
if (-not $mutex.WaitOne(0, $false)) { exit 0 }

$watcher = New-Object System.IO.FileSystemWatcher
$watcher.Path = $RepositoryRoot
$watcher.Filter = '*'
$watcher.IncludeSubdirectories = $true
$watcher.NotifyFilter = [System.IO.NotifyFilters]'FileName, DirectoryName, LastWrite, Size'
$watcher.EnableRaisingEvents = $true

$subscriptions = @()
$subscriptions += Register-ObjectEvent -InputObject $watcher -EventName Changed -SourceIdentifier 'CRepoChanged'
$subscriptions += Register-ObjectEvent -InputObject $watcher -EventName Created -SourceIdentifier 'CRepoCreated'
$subscriptions += Register-ObjectEvent -InputObject $watcher -EventName Deleted -SourceIdentifier 'CRepoDeleted'
$subscriptions += Register-ObjectEvent -InputObject $watcher -EventName Renamed -SourceIdentifier 'CRepoRenamed'

$pending = $true
$lastChange = Get-Date
Write-Log "Watcher started for $RepositoryRoot"

try {
  while ($true) {
    $event = Wait-Event -Timeout 1
    if ($event) {
      $changedPath = $event.SourceEventArgs.FullPath
      Remove-Event -EventIdentifier $event.EventIdentifier -ErrorAction SilentlyContinue
      $relativePath = [System.IO.Path]::GetRelativePath($RepositoryRoot, $changedPath)
      if (-not (Test-ExcludedPath $relativePath)) {
        $pending = $true
        $lastChange = Get-Date
      }
    }
    if ($pending -and ((Get-Date) - $lastChange).TotalSeconds -ge $QuietSeconds) {
      $pending = $false
      try { Sync-Repository } catch { Write-Log "Sync failed: $($_.Exception.Message)" }
    }
  }
} finally {
  $subscriptions | Unregister-Event -ErrorAction SilentlyContinue
  $watcher.Dispose()
  $mutex.ReleaseMutex() | Out-Null
  $mutex.Dispose()
}
