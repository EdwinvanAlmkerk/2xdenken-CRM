$ErrorActionPreference = 'Stop'
$conflicts = Get-Content "x:\Edwin\crm project\_facturen_conflicts.json" -Raw -Encoding utf8 | ConvertFrom-Json
$all       = Get-Content "x:\Edwin\crm project\_facturen_extracted.json" -Raw -Encoding utf8 | ConvertFrom-Json

# Advies bepalen per type
function Get-Advies { param($c)
  $issues = $c.issues
  $adv = @()
  if ($issues -match 'debnr-mismatch') {
    if ($c.nummer -eq '202615') { $adv += 'Betreft="PCBO Amersfoort..." -> overzicht (DB43) lijkt correct' }
    elseif ($c.nummer -in @('202616','202651')) { $adv += 'Betreft="De Wijde Wereld..." -> sheet (DB04) lijkt correct' }
    else { $adv += 'Debiteurnr-conflict: handmatig nakijken' }
  }
  if ($issues -match 'datum-mismatch') {
    if ($c.nummer -in @('202602','202603','202605','202606','202607','202608')) {
      $adv += '1 dag verschil (12 vs 13 feb) - waarschijnlijk overzicht 13-02 correct'
    } elseif ($c.nummer -in @('202648','202649','202650')) {
      $adv += '18 dagen verschil - check welke factuurdatum echt verzonden is'
    } else {
      $adv += 'Datum-conflict: kies de daadwerkelijke verzenddatum'
    }
  }
  if ($issues -match 'bedrag-mismatch') {
    $adv += "Bedrag-verschil EUR $([math]::Abs($c.bedrag_sheet - $c.bedrag_ovz)) - check reiskosten/afronding"
  }
  if ($issues -match 'factuurnr-mismatch') {
    $adv += 'Typo in werkblad: sheetnaam (=factuurnummer) is leidend'
  }
  return ($adv -join ' | ')
}

$excel = New-Object -ComObject Excel.Application
$excel.Visible = $false; $excel.DisplayAlerts = $false
$wb = $excel.Workbooks.Add()

# ─── Tabblad 1: Conflicten ─────────────────────────────────────────
$s = $wb.Worksheets.Item(1)
$s.Name = 'Conflicten'

$headers = @('Factuurnr','Debnr sheet','Debnr overzicht','Datum sheet','Datum overzicht','Bedrag sheet','Bedrag overzicht','Aantal regels','Betreft','Soort conflict','Advies')
for ($i=0; $i -lt $headers.Count; $i++) {
  $cell = $s.Cells.Item(1, $i+1)
  $cell.Value2 = $headers[$i]
  $cell.Font.Bold = $true
  $cell.Interior.Color = 15132390  # licht blauw
}

$r = 2
foreach ($c in $conflicts) {
  $s.Cells.Item($r, 1).Value2  = $c.nummer
  $s.Cells.Item($r, 2).Value2  = $c.debnr_sheet
  $s.Cells.Item($r, 3).Value2  = $c.debnr_ovz
  $s.Cells.Item($r, 4).Value2  = $c.datum_sheet
  $s.Cells.Item($r, 5).Value2  = $c.datum_ovz
  $s.Cells.Item($r, 6).Value2  = [double]$c.bedrag_sheet
  $s.Cells.Item($r, 7).Value2  = [double]$c.bedrag_ovz
  $s.Cells.Item($r, 8).Value2  = [double]$c.regels_count
  $s.Cells.Item($r, 9).Value2  = $c.betreft
  $s.Cells.Item($r,10).Value2  = $c.issues
  $s.Cells.Item($r,11).Value2  = (Get-Advies $c)
  # Bedrag-kolommen als currency
  $s.Cells.Item($r,6).NumberFormat = ([char]0x20AC + ' #,##0.00')
  $s.Cells.Item($r,7).NumberFormat = ([char]0x20AC + ' #,##0.00')
  $r++
}
$s.UsedRange.Columns.AutoFit() | Out-Null
# Wrap voor lange kolommen
$s.Range('I:I').WrapText = $true
$s.Range('J:J').WrapText = $true
$s.Range('K:K').WrapText = $true
$s.Range('I:I').ColumnWidth = 55
$s.Range('J:J').ColumnWidth = 45
$s.Range('K:K').ColumnWidth = 60
$s.Rows.AutoFit() | Out-Null
# Freeze top row
$s.Activate() | Out-Null
$s.Application.ActiveWindow.SplitRow = 1
$s.Application.ActiveWindow.FreezePanes = $true

# ─── Tabblad 2: Alle 46 OK-facturen (preview wat geïmporteerd zou worden) ─────
$s2 = $wb.Worksheets.Add()
$s2.Move([System.Reflection.Missing]::Value, $wb.Worksheets.Item($wb.Worksheets.Count))
$s2.Name = 'OK (46 importeerbaar)'

$h2 = @('Factuurnr','Debiteurnr','Datum','T.a.v.','Betreft','Totaal','Aantal regels','Status (betaald?)')
for ($i=0; $i -lt $h2.Count; $i++) {
  $cell = $s2.Cells.Item(1, $i+1)
  $cell.Value2 = $h2[$i]
  $cell.Font.Bold = $true
  $cell.Interior.Color = 14021957  # licht groen
}

$conflictNrs = $conflicts | ForEach-Object { $_.nummer }
$r = 2
foreach ($f in $all) {
  if ($conflictNrs -contains $f.nummer) { continue }
  $s2.Cells.Item($r,1).Value2 = $f.nummer
  $s2.Cells.Item($r,2).Value2 = $f.debnr_sheet
  $s2.Cells.Item($r,3).Value2 = $f.datum_sheet
  $s2.Cells.Item($r,4).Value2 = $f.tav
  $s2.Cells.Item($r,5).Value2 = $f.betreft
  $s2.Cells.Item($r,6).Value2 = [double]$f.totaal_sheet
  $s2.Cells.Item($r,7).Value2 = [double](($f.regels | Measure-Object).Count)
  $s2.Cells.Item($r,8).Value2 = if ($f.ovz.betaald_ovz) { 'betaald' } else { 'verzonden' }
  $s2.Cells.Item($r,6).NumberFormat = ([char]0x20AC + ' #,##0.00')
  $r++
}
$s2.UsedRange.Columns.AutoFit() | Out-Null
$s2.Range('E:E').ColumnWidth = 55
$s2.Range('E:E').WrapText = $true
$s2.Rows.AutoFit() | Out-Null
$s2.Activate() | Out-Null
$s2.Application.ActiveWindow.SplitRow = 1
$s2.Application.ActiveWindow.FreezePanes = $true

# Zet conflicten weer als actieve tab
$wb.Worksheets.Item('Conflicten').Activate() | Out-Null

$outPath = "x:\Edwin\crm project\Facturen-import 202601-202659 - conflictrapport.xlsx"
$wb.SaveAs($outPath, 51) | Out-Null  # 51 = xlOpenXMLWorkbook (xlsx)
$wb.Close($false) | Out-Null
$excel.Quit() | Out-Null
[System.Runtime.InteropServices.Marshal]::ReleaseComObject($wb) | Out-Null
[System.Runtime.InteropServices.Marshal]::ReleaseComObject($excel) | Out-Null

"Geschreven: $outPath"
