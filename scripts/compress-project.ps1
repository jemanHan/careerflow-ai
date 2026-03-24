param(
  [string]$OutputPath = "",
  [string]$ProjectRoot = ""
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($ProjectRoot)) {
  $ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
} else {
  $ProjectRoot = (Resolve-Path $ProjectRoot).Path
}

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
if ([string]::IsNullOrWhiteSpace($OutputPath)) {
  $OutputPath = Join-Path $ProjectRoot "careerflow-ai-safe-$timestamp.zip"
}

$stagingRoot = Join-Path $env:TEMP "careerflow-ai-staging-$timestamp"
if (Test-Path $stagingRoot) {
  Remove-Item -Recurse -Force -LiteralPath $stagingRoot
}
New-Item -ItemType Directory -Path $stagingRoot -Force | Out-Null

$excludeDirs = @(
  ".git",
  ".idea",
  ".vscode",
  ".cursor",
  "node_modules",
  ".next",
  "dist",
  "coverage",
  "tmp",
  "temp",
  "logs"
)

$excludeFiles = @(
  ".env",
  ".env.local",
  ".env.development.local",
  ".env.test.local",
  ".env.production.local",
  "*.log",
  "*.tmp",
  "*.sqlite",
  "*.sqlite3",
  "*.db"
)

function Should-ExcludeDirectory {
  param([string]$relativePath)
  foreach ($dirName in $excludeDirs) {
    if ($relativePath -eq $dirName -or $relativePath.StartsWith("$dirName\")) {
      return $true
    }
    if ($relativePath -like "*\$dirName" -or $relativePath -like "*\$dirName\*") {
      return $true
    }
  }
  return $false
}

function Should-ExcludeFile {
  param([string]$fileName)
  foreach ($pattern in $excludeFiles) {
    if ($fileName -like $pattern) {
      return $true
    }
  }
  return $false
}

$allItems = Get-ChildItem -Path $ProjectRoot -Recurse -Force
foreach ($item in $allItems) {
  $relativePath = $item.FullName.Substring($ProjectRoot.Length).TrimStart("\")
  if ([string]::IsNullOrWhiteSpace($relativePath)) {
    continue
  }

  if ($item.PSIsContainer) {
    if (Should-ExcludeDirectory -relativePath $relativePath) {
      continue
    }
    $targetDir = Join-Path $stagingRoot $relativePath
    if (!(Test-Path -LiteralPath $targetDir)) {
      New-Item -ItemType Directory -Path $targetDir -Force | Out-Null
    }
    continue
  }

  if (Should-ExcludeDirectory -relativePath $relativePath) {
    continue
  }
  if (Should-ExcludeFile -fileName $item.Name) {
    continue
  }

  $targetFile = Join-Path $stagingRoot $relativePath
  $targetParent = Split-Path -Parent $targetFile
  if (!(Test-Path -LiteralPath $targetParent)) {
    New-Item -ItemType Directory -Path $targetParent -Force | Out-Null
  }
  Copy-Item -LiteralPath $item.FullName -Destination $targetFile -Force
}

if (Test-Path $OutputPath) {
  Remove-Item -Force -LiteralPath $OutputPath
}

Compress-Archive -Path (Join-Path $stagingRoot "*") -DestinationPath $OutputPath -CompressionLevel Optimal
Remove-Item -Recurse -Force -LiteralPath $stagingRoot

Write-Host "Archive created: $OutputPath"
