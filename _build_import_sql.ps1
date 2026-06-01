$ErrorActionPreference = 'Stop'
$data = Get-Content "x:\Edwin\crm project\_facturen_extracted.json" -Raw -Encoding utf8 | ConvertFrom-Json

function Esc-SQL { param([string]$s)
  if ($null -eq $s) { return 'NULL' }
  return "'" + ($s.Replace("'", "''")) + "'"
}
function Esc-JSONB-Array { param($arr)
  if ($null -eq $arr -or $arr.Count -eq 0) { return "'[]'::jsonb" }
  $json = ConvertTo-Json -InputObject @($arr) -Compress -Depth 10
  if ($json -is [array]) { $json = $json -join '' }
  if (-not $json.StartsWith('[')) { $json = '[' + $json + ']' }
  # JSON-output van ConvertTo-Json escape't apostrofs als '; converteer terug naar '
  $json = $json -replace '\\u0027', "'"
  # En SQL-escape alle apostrofs door ze te verdubbelen
  $json = $json.Replace("'", "''")
  return "'" + $json + "'::jsonb"
}
function Add-Days { param([string]$iso, [int]$n)
  if (-not $iso) { return $null }
  $d = [datetime]::ParseExact($iso, 'yyyy-MM-dd', $null)
  return $d.AddDays($n).ToString('yyyy-MM-dd')
}

$rows = @()
foreach ($f in $data) {
  $id  = [Guid]::NewGuid().ToString()
  $nr  = $f.nummer
  $deb = $f.debnr_sheet
  $datum = $f.datum_sheet
  $verval = Add-Days $datum 14
  $tav = if ($f.tav) { $f.tav } else { '' }
  $betreft = if ($f.betreft) { $f.betreft } else { '' }

  # Gebruik totaal_sheet (totaal-rij uit werkblad); valt terug op som regels als 0
  $totaal = [double]$f.totaal_sheet
  if ($totaal -le 0) {
    $totaal = ($f.regels | Measure-Object -Property bedrag -Sum).Sum
  }

  # Regels: voeg id toe per regel
  $regels = @()
  foreach ($r in $f.regels) {
    $regels += [ordered]@{
      id           = [Guid]::NewGuid().ToString()
      omschrijving = if ($r.omschrijving) { $r.omschrijving } else { '' }
      toelichting  = if ($r.toelichting)  { $r.toelichting }  else { '' }
      datum        = if ($r.datum)        { $r.datum }        else { '' }
      uren         = if ($r.uren)         { $r.uren }         else { '' }
      bedrag       = [double]$r.bedrag
    }
  }

  $valStr = "(" +
    (Esc-SQL $id) + ", " +
    "(SELECT id FROM scholen WHERE debiteurnr = " + (Esc-SQL $deb) + " LIMIT 1), " +
    "NULL, NULL, " +
    (Esc-SQL $nr) + ", " +
    (Esc-SQL $deb) + ", " +
    (Esc-SQL $tav) + ", " +
    (Esc-SQL $datum) + ", " +
    (Esc-SQL $verval) + ", " +
    "'verzonden', " +
    (Esc-SQL $betreft) + ", " +
    ([string]::Format([System.Globalization.CultureInfo]::InvariantCulture, "{0}", $totaal)) + ", " +
    (Esc-JSONB-Array $regels) +
    ")"
  $rows += $valStr
}

$sql = @"
INSERT INTO facturen
  (id, school_id, bestuur_id, contact_id, nummer, debiteurnr, tav, datum, vervaldatum, status, betreft, totaal, regels)
VALUES
$($rows -join ",`n")
;
"@

$sql | Out-File -Encoding utf8 "x:\Edwin\crm project\_facturen_import.sql"
"Geschreven: $($rows.Count) rijen naar _facturen_import.sql ($([math]::Round((Get-Item 'x:\Edwin\crm project\_facturen_import.sql').Length/1024,1)) KB)"
