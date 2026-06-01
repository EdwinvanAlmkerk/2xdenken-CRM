$ErrorActionPreference = 'Stop'
$lines = Get-Content "x:\Edwin\crm project\_facturen_import.sql" -Encoding utf8
# Lines 1-3 = INSERT INTO ... VALUES, lines 4-62 = 59 value-rijen, line 63 = ; (of inline op laatste rij)
$header = $lines[0..2] -join "`n"
$valueLines = $lines | Where-Object { $_ -match '^\(' }
"Aantal value-rijen: $($valueLines.Count)"

$batchSize = 10
$batchNr = 0
for ($i = 0; $i -lt $valueLines.Count; $i += $batchSize) {
  $batchNr++
  $end = [Math]::Min($i + $batchSize - 1, $valueLines.Count - 1)
  $slice = $valueLines[$i..$end]
  # Verwijder eventuele trailing komma's en plak met komma's
  $clean = $slice | ForEach-Object { ($_ -replace ',\s*$', '') }
  $body = $clean -join ",`n"
  $sql = $header + "`n" + $body + ";`n"
  $path = "x:\Edwin\crm project\_facturen_batch_$batchNr.sql"
  $sql | Out-File -Encoding utf8 $path
  $kb = [math]::Round((Get-Item $path).Length / 1024, 1)
  "Batch ${batchNr}: rijen $($i+1)..$($end+1), $kb KB"
}
