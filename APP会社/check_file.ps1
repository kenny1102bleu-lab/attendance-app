$filePath = "GAS_KCS合同会社_Backend.gs"
$encoding = [System.Text.Encoding]::UTF8
$fullPath = Join-Path (Get-Location) $filePath
Write-Host "Full path: $fullPath"
$content = [System.IO.File]::ReadAllText($fullPath, $encoding)
Write-Host "File length: $($content.Length)"

$searchStr = "if (body.action === 'get_pending_replies')"
Write-Host "Contains search: $($content.Contains($searchStr))"
