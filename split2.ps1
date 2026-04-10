$path = "c:\Users\kenny\.gemini\antigravity\scratch\attendance_app\谷田部APP_Code.gs"
$lines = Get-Content -Path $path -Encoding UTF8
$len = $lines.Length

$split1 = -1
$split2 = -1

for ($i=0; $i -lt $len; $i++) {
    if ($lines[$i] -match "function handleLineWebhook") {
        # find the preceding comment block
        $split1 = $i - 3
    }
    if ($lines[$i] -match "function updateAllSheets") {
        $split2 = $i - 3
    }
}

if ($split1 -gt 0 -and $split2 -gt $split1) {
    [IO.File]::WriteAllLines("c:\Users\kenny\.gemini\antigravity\scratch\attendance_app\1_Main.gs", $lines[0..($split1-1)], [System.Text.Encoding]::UTF8)
    [IO.File]::WriteAllLines("c:\Users\kenny\.gemini\antigravity\scratch\attendance_app\2_LINE_Process.gs", $lines[$split1..($split2-1)], [System.Text.Encoding]::UTF8)
    [IO.File]::WriteAllLines("c:\Users\kenny\.gemini\antigravity\scratch\attendance_app\3_System.gs", $lines[$split2..($len-1)], [System.Text.Encoding]::UTF8)
    Write-Output "Split successful!"
} else {
    Write-Output "Could not find split points!"
}
