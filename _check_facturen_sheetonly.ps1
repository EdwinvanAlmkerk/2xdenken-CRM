$ErrorActionPreference = 'Stop'
$data = Get-Content "x:\Edwin\crm project\_facturen_extracted.json" -Raw -Encoding utf8 | ConvertFrom-Json

# Bekende debiteurnrs uit DB (scholen) — uit eerdere query
$bekendeDebnrs = @('DB01','DB02','DB03','DB04','DB05','DB06','DB08','DB09','DB10','DB11','DB12','DB13','DB14','DB15','DB16','DB17','DB18','DB19','DB20','DB21','DB22','DB23','DB24','DB25','DB26','DB27','DB28','DB29','DB30','DB31','DB32','DB33','DB34','DB35','DB36','DB37','DB38','DB39','DB40','DB41','DB42','DB43','DB44','DB45','DB46','DB47','DB48','DB49')

$problems = @()
$warnings = @()
$clean = @()

foreach ($f in $data) {
  $errs = @()
  $warns = @()

  if (-not $f.debnr_sheet)       { $errs += 'debnr ontbreekt' }
  elseif ($bekendeDebnrs -notcontains $f.debnr_sheet) { $errs += "debnr '$($f.debnr_sheet)' niet bekend als school" }

  if (-not $f.datum_sheet)       { $errs += 'datum ontbreekt' }
  if (-not $f.betreft)           { $warns += 'betreft leeg' }
  if (-not $f.tav)               { $warns += 'tav leeg' }
  if (-not $f.regels -or $f.regels.Count -eq 0) { $errs += 'geen regels' }

  $somRegels = ($f.regels | Measure-Object -Property bedrag -Sum).Sum
  if ($f.totaal_sheet -gt 0 -and [math]::Abs([double]$somRegels - [double]$f.totaal_sheet) -gt 0.05) {
    $warns += "som regels ($somRegels) wijkt af van totaal-rij ($($f.totaal_sheet))"
  }

  if ($f.factuurnr_sheet -and $f.factuurnr_sheet -ne $f.nummer) {
    $warns += "factuurnr-cel ($($f.factuurnr_sheet)) wijkt af van sheetnaam ($($f.nummer)) - sheetnaam is leidend"
  }

  if ($errs.Count -gt 0) {
    $problems += [pscustomobject]@{ nummer=$f.nummer; debnr=$f.debnr_sheet; datum=$f.datum_sheet; bedrag=$f.totaal_sheet; betreft=$f.betreft; errs=($errs -join ' ; ') }
  } elseif ($warns.Count -gt 0) {
    $warnings += [pscustomobject]@{ nummer=$f.nummer; debnr=$f.debnr_sheet; datum=$f.datum_sheet; bedrag=$f.totaal_sheet; warns=($warns -join ' ; ') }
    $clean += $f.nummer
  } else {
    $clean += $f.nummer
  }
}

"=== PROBLEMEN (blokkeren import): $($problems.Count) ==="
if ($problems.Count -gt 0) { $problems | Format-Table -AutoSize -Wrap | Out-String -Width 200 }

""
"=== WAARSCHUWINGEN (import gaat door): $($warnings.Count) ==="
if ($warnings.Count -gt 0) { $warnings | Format-Table -AutoSize -Wrap | Out-String -Width 200 }

""
"=== IMPORTEERBAAR: $($clean.Count) facturen ==="
$totaalBedrag = ($data | Where-Object { $clean -contains $_.nummer } | Measure-Object -Property totaal_sheet -Sum).Sum
"Totaal: EUR {0:N2}" -f $totaalBedrag

$clean | ConvertTo-Json | Out-File -Encoding utf8 "x:\Edwin\crm project\_facturen_importeerbaar.json"
