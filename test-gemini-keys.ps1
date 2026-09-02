# test-gemini-keys.ps1 — run this directly in your project root.
# Grabs every GEMINI_API_KEY* line from .env by NAME (not by guessing the
# value's format) so it works regardless of what the key string looks like.

$envContent = Get-Content ".env"
$keyLines = $envContent | Where-Object { $_ -match "^GEMINI_API_KEY(_\d+)?\s*=\s*(.+)$" }

$keys = @()
foreach ($line in $keyLines) {
    if ($line -match "^(GEMINI_API_KEY(?:_\d+)?)\s*=\s*(.+)$") {
        $keys += [PSCustomObject]@{ Name = $matches[1]; Value = $matches[2].Trim() }
    }
}

Write-Host "Found $($keys.Count) GEMINI_API_KEY* entries in .env`n"

# Try a couple of plausible model names since we don't yet know the exact
# one your app uses — a 404 on ALL of these for a key that DOES work on one
# of them tells us the model name (not the key) is the real problem.
$modelsToTry = @("gemini-2.0-flash", "gemini-1.5-flash", "gemini-2.5-flash")

foreach ($k in $keys) {
    Write-Host "--- $($k.Name) (...$($k.Value.Substring([Math]::Max(0,$k.Value.Length-6)))) ---"
    foreach ($model in $modelsToTry) {
        $url = "https://generativelanguage.googleapis.com/v1beta/models/$($model):generateContent?key=$($k.Value)"
        try {
            Invoke-WebRequest -Uri $url -Method POST -ContentType "application/json" -Body '{"contents":[{"parts":[{"text":"hi"}]}]}' -ErrorAction Stop | Out-Null
            Write-Host "    $model -> OK"
        } catch {
            $code = $_.Exception.Response.StatusCode.value__
            Write-Host "    $model -> FAIL ($code)"
        }
        Start-Sleep -Milliseconds 250
    }
}
