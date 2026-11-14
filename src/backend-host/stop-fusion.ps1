$ErrorActionPreference='Stop'
$fusionRoot=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
[IO.Directory]::CreateDirectory((Join-Path $fusionRoot 'evidence')) | Out-Null
$fusionExe=Join-Path $fusionRoot 'ocs-lab\XueBuTong.exe'
$pythonExe=Join-Path $fusionRoot 'python3144\python.exe'
$owned=@(Get-Process | Where-Object {try{$_.Path -eq $fusionExe}catch{$false}})
foreach($process in $owned){if($process.MainWindowHandle -ne 0){$null=$process.CloseMainWindow()}}
$deadline=[DateTime]::UtcNow.AddSeconds(15)
do{
 $remaining=@(Get-Process | Where-Object {try{$_.Path -eq $fusionExe}catch{$false}})
 if(-not $remaining.Count){break}
 Start-Sleep -Milliseconds 250
}while([DateTime]::UtcNow -lt $deadline)
foreach($process in $remaining){Stop-Process -Id $process.Id -ErrorAction SilentlyContinue}
# Closing the parent ends the private stdin pipes; each backend exits through its original stop method.
Start-Sleep -Milliseconds 1500
$backend=@(Get-Process | Where-Object {try{$_.Path -eq $pythonExe}catch{$false}})
foreach($process in $backend){
 try{if(-not $process.WaitForExit(10000)){Stop-Process -Id $process.Id -ErrorAction SilentlyContinue}}catch{}
}
$left=@(Get-Process | Where-Object {try{$_.Path -eq $fusionExe -or $_.Path -eq $pythonExe}catch{$false}})
@{checkedAt=[DateTimeOffset]::Now.ToString('o');remainingOwnedProcesses=$left.Count;originalSoftwareStopped=$false} | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $fusionRoot 'evidence\last-stop.json') -Encoding utf8
if($left.Count){throw '部分融合版进程仍在运行，请查看进程状态。'}
Write-Output '融合版及其后端已停止。账号配置已保留。'
