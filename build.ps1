param(
    [string]$DependencyRoot = '',
    [string]$WorkRoot = '',
    [string]$OutputRoot = ''
)

$ErrorActionPreference = 'Stop'
$taskSourceRoot = [IO.Path]::GetFullPath($PSScriptRoot)
$taskParent = Split-Path -Parent $taskSourceRoot
if (-not $DependencyRoot) { $DependencyRoot = Join-Path $taskParent 'XueBuTong_构建依赖' }
if (-not $WorkRoot) {
    $taskStamp = Get-Date -Format 'yyyyMMdd-HHmmss-fff'
    $taskLeaf = (Split-Path -Leaf $taskSourceRoot) + '-' + $taskStamp
    $WorkRoot = Join-Path (Join-Path $taskParent 'XueBuTong_构建缓存') $taskLeaf
}
if (-not $OutputRoot) { $OutputRoot = Join-Path (Join-Path $taskParent 'XueBuTong_构建缓存') '2.5.15-20261124-output' }
function Resolve-BuildPath([string]$Value) {
    if (-not [IO.Path]::IsPathRooted($Value)) { $Value = Join-Path (Get-Location).ProviderPath $Value }
    return [IO.Path]::GetFullPath($Value)
}
$DependencyRoot = Resolve-BuildPath $DependencyRoot
$WorkRoot = Resolve-BuildPath $WorkRoot
$OutputRoot = Resolve-BuildPath $OutputRoot
$taskPython = Join-Path $DependencyRoot 'runtime\python3144\python.exe'
if (-not (Test-Path -LiteralPath $taskPython -PathType Leaf)) {
    throw '缺少离线构建依赖：runtime\python3144\python.exe。请将完整的 XueBuTong_构建依赖 文件夹放在源码文件夹旁，或指定 -DependencyRoot。'
}

& $taskPython -I -S -B -X utf8 (Join-Path $taskSourceRoot 'build\build.py') `
    --source-root $taskSourceRoot --dependency-root $DependencyRoot `
    --work-root $WorkRoot --output-root $OutputRoot
if ($LASTEXITCODE -ne 0) { throw ('构建失败，退出码：' + $LASTEXITCODE + '。若已创建工作目录，请检查其中 build-result.json 和 build-log.jsonl。') }
