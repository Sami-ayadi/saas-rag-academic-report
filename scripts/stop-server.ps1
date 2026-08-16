$ErrorActionPreference = 'Stop'

$processIds = netstat -ano |
  Select-String '^\s*TCP\s+\S+:3000\s+\S+\s+LISTENING\s+(\d+)\s*$' |
  ForEach-Object { [int]$_.Matches[0].Groups[1].Value } |
  Sort-Object -Unique

if (-not $processIds) {
  Write-Output 'Port 3000 is already free.'
  exit 0
}

foreach ($processId in $processIds) {
  $serverProcess = Get-Process -Id $processId -ErrorAction Stop
  if ($serverProcess.ProcessName -ne 'node') {
    throw "Refusing to stop non-Node process $($serverProcess.ProcessName) (PID $processId) on port 3000."
  }

  Stop-Process -Id $processId -Force
  Write-Output "Stopped Node server on port 3000 (PID $processId)."
}
