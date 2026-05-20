Add-Type -AssemblyName System.Windows.Forms
$path = [System.IO.Path]::Combine($env:USERPROFILE, ".gemini", "antigravity", "scratch", "attendance_app", "APP会社", "GAS_KCS合同会社_Backend.gs")
$text = [System.IO.File]::ReadAllText($path, [System.Text.Encoding]::UTF8)
[System.Windows.Forms.Clipboard]::SetText($text)
Write-Host "OK - copied $($text.Length) chars"
