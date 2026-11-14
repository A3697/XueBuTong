param(
 [Parameter(Mandatory=$true)][string]$MsvcRoot,
 [Parameter(Mandatory=$true)][string]$SdkRoot,
 [Parameter(Mandatory=$true)][string]$OutputRoot,
 [string]$SdkVersion='10.0.26100.0',
 [switch]$ProbeOnly,[switch]$Trace
)
$ErrorActionPreference='Stop'
$taskSource=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$taskOutput=[IO.Path]::GetFullPath($OutputRoot)
$taskMsvc=[IO.Path]::GetFullPath($MsvcRoot)
$taskSdk=[IO.Path]::GetFullPath($SdkRoot)
$taskSdkVersion=$SdkVersion
$taskCompiler=Join-Path $taskMsvc 'bin\Hostx64\x64\cl.exe'
if(-not(Test-Path -LiteralPath $taskCompiler -PathType Leaf)){throw '未找到 MSVC x64 cl.exe，请指定正确的 MsvcRoot。'}
if($taskOutput.StartsWith($taskSource+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)){throw '输出目录必须位于源码目录之外。'}
New-Item -ItemType Directory -Path $taskOutput -Force | Out-Null
$taskCommon = @('/nologo','/std:c++17','/EHsc','/O2','/MT','/utf-8','/DUNICODE','/D_UNICODE',('/I'+(Join-Path $taskMsvc 'include')))
if($Trace){$taskCommon += '/DXBT_GUARD_TRACE'}
foreach($taskPart in @('ucrt','shared','um','winrt')) { $taskCommon += '/I'+(Join-Path $taskSdk "Include\$taskSdkVersion\$taskPart") }
$taskLink = @('/link','/MACHINE:X64','/Brepro',('/LIBPATH:'+(Join-Path $taskMsvc 'lib\x64')),('/LIBPATH:'+(Join-Path $taskSdk "Lib\$taskSdkVersion\ucrt\x64")),('/LIBPATH:'+(Join-Path $taskSdk "Lib\$taskSdkVersion\um\x64")),'user32.lib','comctl32.lib','shell32.lib','ole32.lib','propsys.lib')
$taskTargets = @(@{Name='test-native-window-probe';Source='build\test_native_window_probe.cpp';Dll=$false})
if(-not $ProbeOnly) { $taskTargets += @(@{Name='browser-window-guard';Source='src\native-helpers\browser-window-guard.cpp';Dll=$false},@{Name='browser-window-hook';Source='src\native-helpers\browser-window-hook.cpp';Dll=$true}) }
foreach($taskTarget in $taskTargets) {
    $taskExtension = if($taskTarget.Dll){'.dll'}else{'.exe'}
    $taskArguments = $taskCommon + @(('/Fo'+(Join-Path $taskOutput ($taskTarget.Name+'.obj'))),('/Fe'+(Join-Path $taskOutput ($taskTarget.Name+$taskExtension))),(Join-Path $taskSource $taskTarget.Source))
    if($taskTarget.Dll){$taskArguments += '/LD'}
    & $taskCompiler @taskArguments @taskLink
    if($LASTEXITCODE -ne 0){throw "Native build failed: $($taskTarget.Name)"}
}
Get-ChildItem -LiteralPath $taskOutput -File | Where-Object Extension -in '.exe','.dll' | ForEach-Object { Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256 } | Select-Object Path,Hash | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $taskOutput 'binary-hashes.json') -Encoding utf8

