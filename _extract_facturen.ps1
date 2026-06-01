$ErrorActionPreference = 'Stop'

# ── Parsehulp ────────────────────────────────────────────────────────
function Convert-NLDate {
  param([string]$s)
  if (-not $s) { return $null }
  $s = $s -replace "[‘’‚‛′]", "'"
  $s = $s.Trim()
  if ($s -match "(\d{1,2})-(\d{1,2})-'?(\d{2})") {
    $d = [int]$Matches[1]; $m = [int]$Matches[2]; $y = 2000 + [int]$Matches[3]
    return ('{0:D4}-{1:D2}-{2:D2}' -f $y, $m, $d)
  }
  return $null
}
function Add-Days-ISO { param([string]$iso, [int]$n)
  if (-not $iso) { return $null }
  $d = [datetime]::ParseExact($iso, 'yyyy-MM-dd', $null)
  return $d.AddDays($n).ToString('yyyy-MM-dd')
}
function Parse-Bedrag { param([string]$s)
  if (-not $s) { return @() }
  $matches2 = [regex]::Matches($s, '\d{1,3}(?:\.\d{3})*(?:,\d{1,2})?(?!\d)')
  $bedragen = @()
  foreach ($mm in $matches2) {
    $raw = $mm.Value
    $clean = $raw -replace '\.', '' -replace ',', '.'
    $val = [double]::Parse($clean, [System.Globalization.CultureInfo]::InvariantCulture)
    $bedragen += $val
  }
  return ,$bedragen
}
function Get-CellText { param($cell)
  $v = $cell.Text
  if ($null -eq $v) { return '' }
  return ($v.ToString().Trim())
}

# ── Excel openen ─────────────────────────────────────────────────────
$excel = New-Object -ComObject Excel.Application
$excel.Visible = $false; $excel.DisplayAlerts = $false
$wb = $excel.Workbooks.Open("x:\Edwin\crm project\Administratie en facturatie 2xDenken 2026 2.xlsx", $false, $true)

# ── Overzicht inlezen (betaald-status en bedragen) ───────────────────
$ovz = @{}
$so = $wb.Worksheets.Item("Uitstaande facturen")
for ($r=4; $r -le 62; $r++) {
  $nr = (Get-CellText $so.Cells.Item($r,2))
  if (-not $nr) { continue }
  $datum = (Get-CellText $so.Cells.Item($r,3))
  $deb   = (Get-CellText $so.Cells.Item($r,4))
  $naam  = (Get-CellText $so.Cells.Item($r,5))
  $bedr  = (Get-CellText $so.Cells.Item($r,10))
  $bet   = (Get-CellText $so.Cells.Item($r,11))
  $bedrArr = Parse-Bedrag $bedr
  $bedrVal = if ($bedrArr.Count -gt 0) { $bedrArr[0] } else { 0 }
  $ovz[$nr] = [pscustomobject]@{
    nummer       = $nr
    datum_ovz    = Convert-NLDate $datum
    debiteurnr_ovz = $deb.Trim()
    naam_ovz     = $naam.Trim()
    bedrag_ovz   = $bedrVal
    betaald_ovz  = ($bet.Trim().ToLower() -eq 'ja')
  }
}

# ── Facturen-sheets inlezen ──────────────────────────────────────────
$facturen = @()
for ($n = 1; $n -le 59; $n++) {
  $nr = "2026{0:D2}" -f $n
  # Sommige sheets hebben een trailing space; zoek de juiste
  $found = $null
  foreach ($s in $wb.Worksheets) {
    if ($s.Name.Trim() -eq $nr) { $found = $s; break }
  }
  if (-not $found) { Write-Host "SKIP: sheet $nr niet gevonden"; continue }
  $s = $found

  $rows = $s.UsedRange.Rows.Count
  $cols = $s.UsedRange.Columns.Count

  # Velden zoeken
  $factuurnr_sheet = $null
  $datum_sheet = $null
  $debnr_sheet = $null
  $tav = $null
  $betreft = $null

  for ($r=1; $r -le [Math]::Min($rows, 20); $r++) {
    for ($c=1; $c -le $cols; $c++) {
      $t = Get-CellText $s.Cells.Item($r,$c)
      if (-not $t) { continue }
      if ($t -match '^Factuurnummer:?\s*$' -and $c -lt $cols) {
        $factuurnr_sheet = (Get-CellText $s.Cells.Item($r,$c+1)).Trim()
      } elseif ($t -match '^Factuurdatum:?\s*(.*)$') {
        $datum_sheet = Convert-NLDate $Matches[1]
        if (-not $datum_sheet -and $c -lt $cols) {
          $datum_sheet = Convert-NLDate (Get-CellText $s.Cells.Item($r,$c+1))
        }
      } elseif ($t -match '^Debiteurnr:?\s*(.*)$') {
        $debnr_sheet = $Matches[1].Trim()
        if (-not $debnr_sheet -and $c -lt $cols) {
          $debnr_sheet = (Get-CellText $s.Cells.Item($r,$c+1)).Trim()
        }
      } elseif ($t -match '^t\.?a\.?v\.?\s+(.*)$') {
        $tav = $Matches[1].Trim()
      } elseif ($t -match '^Betreft:\s*(.*)$') {
        $betreft = $Matches[1].Trim()
      }
    }
  }

  # Regels: vanaf row na "Omschrijving"-header
  $headerRow = $null
  for ($r=1; $r -le $rows; $r++) {
    if ((Get-CellText $s.Cells.Item($r,2)) -eq 'Omschrijving') { $headerRow = $r; break }
  }
  $regels = @()
  $totaal_sheet = 0
  if ($headerRow) {
    for ($r = $headerRow + 1; $r -le $rows; $r++) {
      $c2 = Get-CellText $s.Cells.Item($r,2)
      $c3 = Get-CellText $s.Cells.Item($r,3)
      $c4 = Get-CellText $s.Cells.Item($r,4)
      $c5 = Get-CellText $s.Cells.Item($r,5)
      $c6 = Get-CellText $s.Cells.Item($r,6)

      $euro = [char]0x20AC
      $isTotaalRij = ($c5 -match 'Totaalbedrag' -or ($c2 -eq '' -and $c5 -eq '' -and $c6 -match [regex]::Escape($euro)))
      $isPaymentInstruction = ($c2 -match 'verzocht' -or $c2 -match 'KvK')
      $isEmpty = (-not $c2 -and -not $c6)

      if ($isPaymentInstruction) { break }
      if ($isTotaalRij) {
        $b = Parse-Bedrag $c6
        if ($b.Count -gt 0) { $totaal_sheet = $b[0] }
        break
      }
      if ($isEmpty) { continue }

      # Data-rij
      $bedragen = Parse-Bedrag $c6
      $regelBedrag = ($bedragen | Measure-Object -Sum).Sum
      $regels += [pscustomobject]@{
        omschrijving = $c2
        toelichting  = $c3
        datum        = $c4
        uren         = $c5
        bedrag       = [double]$regelBedrag
      }
    }
  }
  if ($totaal_sheet -eq 0) {
    $totaal_sheet = ($regels | Measure-Object -Property bedrag -Sum).Sum
  }

  $row = [pscustomobject]@{
    nummer          = $nr
    sheet_name      = $s.Name
    factuurnr_sheet = $factuurnr_sheet
    datum_sheet     = $datum_sheet
    debnr_sheet     = $debnr_sheet
    tav             = $tav
    betreft         = $betreft
    regels          = $regels
    totaal_sheet    = [double]$totaal_sheet
    ovz             = $ovz[$nr]
  }
  $facturen += $row
}

$wb.Close($false) | Out-Null
$excel.Quit() | Out-Null
[System.Runtime.InteropServices.Marshal]::ReleaseComObject($wb) | Out-Null
[System.Runtime.InteropServices.Marshal]::ReleaseComObject($excel) | Out-Null

# ── Schrijven naar JSON ──────────────────────────────────────────────
$facturen | ConvertTo-Json -Depth 10 | Out-File -Encoding utf8 "x:\Edwin\crm project\_facturen_extracted.json"
"Geschreven: $($facturen.Count) facturen naar _facturen_extracted.json"
