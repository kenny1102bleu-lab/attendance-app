$path = "c:\Users\kenny\.gemini\antigravity\scratch\attendance_app\谷田部APP_Code.gs"
$lines = Get-Content -Path $path -Encoding UTF8
$part1 = New-Object System.Collections.Generic.List[string]
$part2 = New-Object System.Collections.Generic.List[string]
$part3 = New-Object System.Collections.Generic.List[string]
$current = 1

foreach ($line in $lines) {
    if ($current -eq 1 -and $line -match "// LINE Webhook イベント処理") {
        if ($part1.Count -gt 0) {
            $part1.RemoveAt($part1.Count - 1)
        }
        $part2.Add("// ===================================================")
        $part2.Add($line)
        $current = 2
        continue
    }
    if ($current -eq 2 -and ($line -match "// 【臨時機能】" -or $line -match "// 全シート一括更新")) {
        if ($part2.Count -gt 0) {
            $part2.RemoveAt($part2.Count - 1)
        }
        $part3.Add("// ===================================================")
        $part3.Add($line)
        $current = 3
        continue
    }

    if ($current -eq 1) { $part1.Add($line) }
    elseif ($current -eq 2) { $part2.Add($line) }
    elseif ($current -eq 3) { $part3.Add($line) }
}

[IO.File]::WriteAllLines("c:\Users\kenny\.gemini\antigravity\scratch\attendance_app\1_Main.gs", $part1, [System.Text.Encoding]::UTF8)
[IO.File]::WriteAllLines("c:\Users\kenny\.gemini\antigravity\scratch\attendance_app\2_LINE_Process.gs", $part2, [System.Text.Encoding]::UTF8)
[IO.File]::WriteAllLines("c:\Users\kenny\.gemini\antigravity\scratch\attendance_app\3_System.gs", $part3, [System.Text.Encoding]::UTF8)

Write-Output "Files split successfully: 1_Main.gs, 2_LINE_Process.gs, 3_System.gs"
