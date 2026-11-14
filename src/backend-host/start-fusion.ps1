param([switch]$DebugMode)
$ErrorActionPreference='Stop'
$fusionRoot=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$fusionExe=Join-Path $fusionRoot 'ocs-lab\XueBuTong.exe'
$existing=@(Get-Process | Where-Object {try{$_.Path -eq $fusionExe}catch{$false}})
if($existing.Count){Write-Output '融合版已经运行。';return}
$ports=@(18539)
if($DebugMode){$ports+=18540}
foreach($port in $ports){
 $probe=[Net.Sockets.TcpListener]::new([Net.IPAddress]::Loopback,$port)
 try{$probe.Start()}catch{throw ('融合版端口已被占用：'+$port)}finally{$probe.Stop()}
}
$launcherArgs=@('-I','-S','-B','-X','utf8',(Join-Path $PSScriptRoot 'launch_fusion.py'))
if($DebugMode){$launcherArgs+='--debug'}
& (Join-Path $fusionRoot 'python3144\python.exe') @launcherArgs
if($LASTEXITCODE -ne 0){throw '融合版启动失败。'}
