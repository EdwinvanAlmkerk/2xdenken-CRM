$ErrorActionPreference = 'Stop'
$data = Get-Content "x:\Edwin\crm project\_facturen_extracted.json" -Raw -Encoding utf8 | ConvertFrom-Json

$conflicts = @()
$ok = @()

foreach ($f in $data) {
  $issues = @()
  $o = $f.ovz

  # 1. Factuurnummer in sheet (mag leeg zijn — niet alle sheets hebben dit ingevuld)
  if ($f.factuurnr_sheet -and $f.factuurnr_sheet -ne $f.nummer) {
    $issues += "factuurnr-mismatch: sheet=$($f.factuurnr_sheet) vs sheetname=$($f.nummer)"
  }

  # 2. Debiteurnr sheet vs overzicht
  if ($f.debnr_sheet -and $o.debiteurnr_ovz -and $f.debnr_sheet -ne $o.debiteurnr_ovz) {
    $issues += "debnr-mismatch: sheet=$($f.debnr_sheet) vs overzicht=$($o.debiteurnr_ovz)"
  }
  if (-not $f.debnr_sheet) {
    $issues += "debnr-ontbreekt in sheet"
  }

  # 3. Datum
  if ($f.datum_sheet -and $o.datum_ovz -and $f.datum_sheet -ne $o.datum_ovz) {
    $issues += "datum-mismatch: sheet=$($f.datum_sheet) vs overzicht=$($o.datum_ovz)"
  }
  if (-not $f.datum_sheet) {
    $issues += "datum-ontbreekt in sheet"
  }

  # 4. Totaalbedrag
  $bedrSheet = [math]::Round([double]$f.totaal_sheet, 2)
  $bedrOvz   = [math]::Round([double]$o.bedrag_ovz, 2)
  if ([math]::Abs($bedrSheet - $bedrOvz) -gt 0.01) {
    $issues += "bedrag-mismatch: sheet=$bedrSheet vs overzicht=$bedrOvz"
  }

  # 5. Regels-check
  if (-not $f.regels -or $f.regels.Count -eq 0) {
    $issues += "geen regels gevonden"
  }

  if ($issues.Count -gt 0) {
    $conflicts += [pscustomobject]@{
      nummer = $f.nummer
      debnr_sheet = $f.debnr_sheet
      debnr_ovz   = $o.debiteurnr_ovz
      datum_sheet = $f.datum_sheet
      datum_ovz   = $o.datum_ovz
      bedrag_sheet = $bedrSheet
      bedrag_ovz   = $bedrOvz
      regels_count = ($f.regels | Measure-Object).Count
      betreft = $f.betreft
      issues  = $issues -join ' ; '
    }
  } else {
    $ok += $f.nummer
  }
}

"=== CONFLICTEN ($($conflicts.Count)) ==="
$conflicts | Format-Table nummer, debnr_sheet, debnr_ovz, datum_sheet, datum_ovz, bedrag_sheet, bedrag_ovz, regels_count, issues -AutoSize -Wrap | Out-String -Width 220
""
"=== OK ($($ok.Count)): $($ok -join ', ') ==="

$conflicts | ConvertTo-Json -Depth 5 | Out-File -Encoding utf8 "x:\Edwin\crm project\_facturen_conflicts.json"
$ok | ConvertTo-Json | Out-File -Encoding utf8 "x:\Edwin\crm project\_facturen_ok.json"
