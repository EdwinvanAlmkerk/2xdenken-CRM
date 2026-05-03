param(
    [string]$WorkbookPath = 'x:\Edwin\crm project\Administratie en facturatie 2xDenken 2025 compleet.xlsx',
    [int]$ExpectedCount = 0,
    [double]$ExpectedTotal = -1,
    [switch]$DryRun
)

$ErrorActionPreference = 'Stop'

function Get-ConfigValue {
    param([string]$Text, [string]$Name)
    $m = [regex]::Match($Text, "$Name\s*=\s*'([^']+)'")
    if (-not $m.Success) { throw "Kon $Name niet vinden in config.js" }
    return $m.Groups[1].Value
}

function Parse-EuroNumber {
    param([string]$Text)
    $value = 0.0
    if ([string]::IsNullOrWhiteSpace($Text)) { return 0.0 }
    $matches = [regex]::Matches($Text, '(?<!\d)(?:\d{1,3}(?:\.\d{3})*|\d+)(?:,\d{1,2})?(?!\d)')
    foreach ($m in $matches) {
        $raw = $m.Value.Trim()
        if (-not $raw) { continue }
        $normalized = $raw.Replace('.', '').Replace(',', '.')
        $number = 0.0
        if ([double]::TryParse($normalized, [System.Globalization.NumberStyles]::Any, [System.Globalization.CultureInfo]::InvariantCulture, [ref]$number)) {
            $value += $number
        }
    }
    return [math]::Round($value, 2)
}

function Parse-AmountCell {
    param([string]$Text)
    $clean = Cleanup-Text $Text
    if (-not $clean) { return 0.0 }
    $hasEuro = $clean.IndexOf([char]0x20AC) -ge 0
    if (-not $hasEuro -and $clean -notmatch '(?i)eur') { return 0.0 }
    return Parse-EuroNumber $clean
}

function Convert-InvoiceDate {
    param([string]$Text)
    if ([string]::IsNullOrWhiteSpace($Text)) { return $null }
    $trimmed = $Text.Trim()
    $m = [regex]::Match($trimmed, '(\d{1,2})-(\d{1,2})-''?(\d{2,4})')
    if ($m.Success) {
        $day = [int]$m.Groups[1].Value
        $month = [int]$m.Groups[2].Value
        $year = [int]$m.Groups[3].Value
        if ($year -lt 100) { $year += 2000 }
        return (Get-Date -Year $year -Month $month -Day $day).ToString('yyyy-MM-dd')
    }
    try {
        return (Get-Date $trimmed).ToString('yyyy-MM-dd')
    } catch {
        return $null
    }
}

function Cleanup-Text {
    param([string]$Text)
    if ($null -eq $Text) { return '' }
    return (($Text -replace '\s+$', '') -replace '^\s+', '').Trim()
}

function Clean-Tav {
    param([string]$Text)
    $t = Cleanup-Text $Text
    if (-not $t) { return $null }
    $t = $t -replace '^(?i)t\.?a\.?v\.?\s*', ''
    return $t.Trim(' .')
}

function Get-NumericSum {
    param(
        [System.Collections.IEnumerable]$Items,
        [string]$Property
    )

    $sum = 0.0
    foreach ($item in $Items) {
        if ($null -eq $item) { continue }
        $value = if ($item -is [System.Collections.IDictionary]) { $item[$Property] } else { $item.$Property }
        if ($null -eq $value -or "$value" -eq '') { continue }
        try {
            $sum += [double]$value
        } catch {}
    }

    return [math]::Round($sum, 2)
}

function New-SupaHeaders {
    param([string]$ApiKey)
    return @{
        apikey = $ApiKey
        Authorization = "Bearer $ApiKey"
        Accept = 'application/json'
        'Content-Type' = 'application/json; charset=utf-8'
        Prefer = 'return=representation'
    }
}

function Invoke-SupaJson {
    param(
        [string]$Method,
        [string]$Uri,
        [hashtable]$Headers,
        $Body = $null
    )

    if ($null -ne $Body) {
        $json = $Body | ConvertTo-Json -Depth 12 -Compress
        $bytes = [System.Text.Encoding]::UTF8.GetBytes($json)
        return Invoke-RestMethod -Uri $Uri -Headers $Headers -Method $Method -Body $bytes
    }

    return Invoke-RestMethod -Uri $Uri -Headers $Headers -Method $Method
}

function Send-Batches {
    param(
        [string]$Uri,
        [hashtable]$Headers,
        [System.Collections.IList]$Items,
        [int]$BatchSize = 25
    )

    for ($i = 0; $i -lt $Items.Count; $i += $BatchSize) {
        $end = [Math]::Min($i + $BatchSize - 1, $Items.Count - 1)
        $batch = @($Items[$i..$end])
        Invoke-SupaJson -Method 'POST' -Uri $Uri -Headers $Headers -Body $batch | Out-Null
        Write-Output ("Batch verwerkt: {0}-{1}" -f ($i + 1), ($end + 1))
    }
}

$configText = Get-Content 'x:\Edwin\crm project\js\config.js' -Raw
$SUPA_URL = Get-ConfigValue -Text $configText -Name 'SUPA_URL'
$SUPA_KEY = Get-ConfigValue -Text $configText -Name 'SUPA_KEY'
$headers = New-SupaHeaders -ApiKey $SUPA_KEY

$schools = Invoke-SupaJson -Method 'GET' -Uri "$SUPA_URL/rest/v1/scholen?select=id,naam,debiteurnr&order=naam" -Headers $headers
$schoolByDeb = @{}
foreach ($school in $schools) {
    if ($school.debiteurnr) {
        $schoolByDeb[$school.debiteurnr.Trim()] = $school
    }
}

$currentFacturen = Invoke-SupaJson -Method 'GET' -Uri "$SUPA_URL/rest/v1/facturen?select=id,nummer" -Headers $headers
$currentFacturenByNumber = @{}
foreach ($factuur in $currentFacturen) {
    if ($factuur.nummer) {
        $currentFacturenByNumber[$factuur.nummer.Trim()] = $factuur.id
    }
}

$currentDossiers = Invoke-SupaJson -Method 'GET' -Uri "$SUPA_URL/rest/v1/dossiers?select=id,school_id,onderwerp" -Headers $headers
$currentDossierKeys = @{}
foreach ($dossier in $currentDossiers) {
    $key = "$($dossier.school_id)|$($dossier.onderwerp)"
    $currentDossierKeys[$key] = $true
}

if (-not (Test-Path $WorkbookPath)) {
    throw "Workbook niet gevonden: $WorkbookPath"
}

$excel = New-Object -ComObject Excel.Application
$excel.Visible = $false
$excel.DisplayAlerts = $false

$facturenToInsert = New-Object System.Collections.ArrayList
$facturenToUpdate = New-Object System.Collections.ArrayList
$dossiersToInsert = New-Object System.Collections.ArrayList
$warnings = New-Object System.Collections.ArrayList
$summaryByNumber = @{}
$invoiceNumbers = New-Object System.Collections.ArrayList
$expectedDossierKeys = @{}

try {
    $wb = $excel.Workbooks.Open($WorkbookPath)
    $summarySheet = $null
    foreach ($candidateSheet in $wb.Worksheets) {
        $candidateName = Cleanup-Text ([string]$candidateSheet.Name)
        if ($candidateName -match '(?i)uitsta+a?nde\s+facturen') {
            $summarySheet = $candidateSheet
            break
        }
    }
    if (-not $summarySheet) {
        throw "Geen tabblad met uitstaande facturen gevonden in $WorkbookPath"
    }

    $summaryHeaderRow = 3
    $summaryCols = @{ nummer = 2; datum = 3; debiteurnr = 4; naam = 5; bedrag = 6; betaald = 7 }
    for ($scanRow = 1; $scanRow -le [Math]::Min(10, $summarySheet.UsedRange.Rows.Count); $scanRow++) {
        $rowText = @()
        for ($c = 1; $c -le $summarySheet.UsedRange.Columns.Count; $c++) {
            $header = Cleanup-Text ([string]$summarySheet.Cells.Item($scanRow, $c).Text)
            if ($header) { $rowText += $header }
            $norm = $header.ToLowerInvariant()
            if ($norm -match '^factuurnr') { $summaryCols.nummer = $c; $summaryHeaderRow = $scanRow }
            elseif ($norm -match '^factuur\s*datum|^factuurdatum') { $summaryCols.datum = $c }
            elseif ($norm -match '^debiteur') { $summaryCols.debiteurnr = $c }
            elseif ($norm -eq 'naam') { $summaryCols.naam = $c }
            elseif ($norm -eq 'bedrag') { $summaryCols.bedrag = $c }
            elseif ($norm -match 'betaald') { $summaryCols.betaald = $c }
        }
        if (($rowText -join ' ') -match '(?i)factuurnr' -and ($rowText -join ' ') -match '(?i)debiteur') {
            $summaryHeaderRow = $scanRow
            break
        }
    }

    for ($r = $summaryHeaderRow + 1; $r -le $summarySheet.UsedRange.Rows.Count; $r++) {
        $nummer = Cleanup-Text ([string]$summarySheet.Cells.Item($r, $summaryCols.nummer).Text)
        $debiteurnr = Cleanup-Text ([string]$summarySheet.Cells.Item($r, $summaryCols.debiteurnr).Text)
        if ($nummer -match '^\d{5,}$' -and $debiteurnr -match '^DB\d+$') {
            $summaryByNumber[$nummer] = [ordered]@{
                nummer = $nummer
                datum = Cleanup-Text ([string]$summarySheet.Cells.Item($r, $summaryCols.datum).Text)
                debiteurnr = $debiteurnr
                betreft = Cleanup-Text ([string]$summarySheet.Cells.Item($r, $summaryCols.naam).Text)
                totaal = Parse-EuroNumber ([string]$summarySheet.Cells.Item($r, $summaryCols.bedrag).Text)
                betaald = Cleanup-Text ([string]$summarySheet.Cells.Item($r, $summaryCols.betaald).Text)
            }
        }
    }

    $summarySheetName = Cleanup-Text ([string]$summarySheet.Name)
    foreach ($sheet in $wb.Worksheets) {
        $sheetName = Cleanup-Text ([string]$sheet.Name)
        if ($sheetName -eq $summarySheetName) { continue }

        $invoiceNum = if ($summaryByNumber.ContainsKey($sheetName)) {
            $sheetName
        } else {
            Cleanup-Text ([string]$sheet.Cells.Item(14, 6).Text)
        }
        if (-not $invoiceNum) { $invoiceNum = $sheetName }

        $meta = $summaryByNumber[$invoiceNum]
        if (-not $meta) {
            [void]$warnings.Add("Geen samenvattingsregel gevonden voor factuur $invoiceNum (tabblad $sheetName)")
            continue
        }

        $invoiceDateText = (Cleanup-Text ([string]$sheet.Cells.Item(15, 5).Text))
        if (-not $invoiceDateText) { $invoiceDateText = $meta.datum }
        $invoiceDate = Convert-InvoiceDate $invoiceDateText
        if (-not $invoiceDate) { $invoiceDate = Convert-InvoiceDate $meta.datum }

        $debText = (Cleanup-Text ([string]$sheet.Cells.Item(16, 5).Text))
        $debMatch = [regex]::Match($debText, 'DB\d+', 'IgnoreCase')
        $debiteurnr = if ($debMatch.Success) { $debMatch.Value.ToUpper() } else { $meta.debiteurnr }

        $school = $schoolByDeb[$debiteurnr]
        if (-not $school) {
            throw "Geen school gevonden voor debiteurnummer $debiteurnr bij factuur $invoiceNum"
        }

        $tavRaw = Cleanup-Text ([string]$sheet.Cells.Item(9, 2).Text)
        if (-not $tavRaw -or $tavRaw -notmatch '(?i)t\.?a\.?v') {
            $tavRaw = Cleanup-Text ([string]$sheet.Cells.Item(10, 2).Text)
        }
        $tav = Clean-Tav $tavRaw

        $betreftRaw = Cleanup-Text ([string]$sheet.Cells.Item(18, 2).Text)
        if (-not $betreftRaw) { $betreftRaw = Cleanup-Text ([string]$sheet.Cells.Item(17, 2).Text) }
        $betreft = if ($betreftRaw -match '(?i)betreft\s*:\s*(.+)$') { $matches[1].Trim() } else { $meta.betreft }
        if (-not $betreft) { $betreft = $meta.betreft }

        $regels = New-Object System.Collections.ArrayList
        $usedRows = $sheet.UsedRange.Rows.Count
        $headerRow = 19
        for ($scanRow = 1; $scanRow -le [Math]::Min($usedRows, 25); $scanRow++) {
            $colB = Cleanup-Text ([string]$sheet.Cells.Item($scanRow, 2).Text)
            $colD = Cleanup-Text ([string]$sheet.Cells.Item($scanRow, 4).Text)
            $colE = Cleanup-Text ([string]$sheet.Cells.Item($scanRow, 5).Text)
            $colF = Cleanup-Text ([string]$sheet.Cells.Item($scanRow, 6).Text)
            if (($colB -match '(?i)^omschrijving$' -or $colF -match '(?i)bedrag') -and ($colD -match '(?i)datum' -or $colE -match '(?i)uren')) {
                $headerRow = $scanRow
                break
            }
        }

        for ($row = $headerRow + 1; $row -le $usedRows; $row++) {
            $omschrijving = Cleanup-Text ([string]$sheet.Cells.Item($row, 2).Text)
            $toelichting = Cleanup-Text ([string]$sheet.Cells.Item($row, 3).Text)
            $regelDatum = Cleanup-Text ([string]$sheet.Cells.Item($row, 4).Text)
            $uren = Cleanup-Text ([string]$sheet.Cells.Item($row, 5).Text)
            $bedragText = Cleanup-Text ([string]$sheet.Cells.Item($row, 6).Text)
            $joined = (@($omschrijving, $toelichting, $regelDatum, $uren, $bedragText) -join ' ').Trim()

            if (-not $joined) { continue }
            if ($joined -match '(?i)u wordt verzocht|rekeningnummer|kvk|btw-nummer') {
                break
            }
            if ($joined -match '(?i)totaalbedrag') {
                break
            }

            $hasEuroAmount = $bedragText.IndexOf([char]0x20AC) -ge 0
            $isAmountOnlySubtotal = (-not $omschrijving -and -not $toelichting -and -not $regelDatum -and -not $uren -and $hasEuroAmount)
            $isHoursSummary = ($uren -match '(?i)^totaal\s*:?' -or $bedragText -match '(?i)^totaal\s*:?' )
            if ($isAmountOnlySubtotal -or $isHoursSummary) {
                continue
            }

            $bedrag = Parse-AmountCell $bedragText
            $hasContent = [bool]($omschrijving -or $toelichting -or $regelDatum -or $uren -or ($bedrag -gt 0))
            if (-not $hasContent) { continue }

            [void]$regels.Add([ordered]@{
                id = [guid]::NewGuid().ToString()
                omschrijving = $omschrijving
                toelichting = $toelichting
                datum = $regelDatum
                uren = $uren
                bedrag = [math]::Round($bedrag, 2)
            })
        }

        $summaryTotal = [math]::Round([double]$meta.totaal, 2)
        $regelsTotaal = if ($regels.Count -gt 0) { Get-NumericSum -Items $regels -Property 'bedrag' } else { 0.0 }

        if ($regels.Count -eq 0) {
            [void]$regels.Add([ordered]@{
                id = [guid]::NewGuid().ToString()
                omschrijving = $betreft
                toelichting = 'Geïmporteerd uit administratie 2025'
                datum = $invoiceDate
                uren = ''
                bedrag = $summaryTotal
            })
            $regelsTotaal = $summaryTotal
        }

        if ([math]::Abs($regelsTotaal - $summaryTotal) -gt 0.01) {
            [void]$warnings.Add(("Factuur {0}: regelsom € {1} wijkt af van officieel totaal € {2}; Excel-totaal wordt aangehouden." -f $invoiceNum, ($regelsTotaal.ToString('0.00').Replace('.', ',')), ($summaryTotal.ToString('0.00').Replace('.', ','))))
        }

        $status = if ($meta.betaald -match '^(?i)ja$') { 'betaald' } else { 'verzonden' }
        $vervalDatum = if ($invoiceDate) { (Get-Date $invoiceDate).AddDays(14).ToString('yyyy-MM-dd') } else { $null }

        $factuurPayload = [ordered]@{
            school_id = $school.id
            contact_id = $null
            tav = $tav
            nummer = $invoiceNum
            debiteurnr = $debiteurnr
            datum = $invoiceDate
            vervaldatum = $vervalDatum
            status = $status
            betreft = $betreft
            regels = @($regels)
            totaal = $summaryTotal
        }

        if (@($invoiceNumbers) -contains $invoiceNum) {
            [void]$warnings.Add("Dubbel factuurtab gevonden voor $invoiceNum; eerste versie wordt gebruikt.")
            continue
        }
        [void]$invoiceNumbers.Add($invoiceNum)

        if ($currentFacturenByNumber.ContainsKey($invoiceNum)) {
            [void]$facturenToUpdate.Add([ordered]@{
                id = $currentFacturenByNumber[$invoiceNum]
                payload = $factuurPayload
            })
        } else {
            [void]$facturenToInsert.Add([ordered]@{
                id = [guid]::NewGuid().ToString()
                school_id = $factuurPayload.school_id
                contact_id = $factuurPayload.contact_id
                tav = $factuurPayload.tav
                nummer = $factuurPayload.nummer
                debiteurnr = $factuurPayload.debiteurnr
                datum = $factuurPayload.datum
                vervaldatum = $factuurPayload.vervaldatum
                status = $factuurPayload.status
                betreft = $factuurPayload.betreft
                regels = $factuurPayload.regels
                totaal = $factuurPayload.totaal
            })
        }

        $dossierOnderwerp = "Factuur $invoiceNum"
        $dossierKey = "$($school.id)|$dossierOnderwerp"
        if (-not $currentDossierKeys.ContainsKey($dossierKey)) {
            $tekst = @(
                'Factuur geïmporteerd uit administratie 2025',
                "Betreft: $betreft",
                "Debiteurnummer: $debiteurnr",
                "Bedrag: € $(([math]::Round($summaryTotal,2)).ToString('0.00').Replace('.',','))",
                "Status: $status"
            ) -join "`n"

            [void]$dossiersToInsert.Add([ordered]@{
                id = [guid]::NewGuid().ToString()
                school_id = $school.id
                contact_id = $null
                datum = if ($invoiceDate) { "${invoiceDate}T12:00:00" } else { (Get-Date).ToString('s') }
                type = 'notitie'
                onderwerp = $dossierOnderwerp
                tekst = $tekst
                bron_naam = 'Import boekhouding 2025'
                bestanden = @()
            })
            $currentDossierKeys[$dossierKey] = $true
        }
        $expectedDossierKeys[$dossierKey] = $true
    }

    foreach ($invoiceNum in ($summaryByNumber.Keys | Sort-Object)) {
        if (@($invoiceNumbers) -contains $invoiceNum) { continue }

        $meta = $summaryByNumber[$invoiceNum]
        $debiteurnr = $meta.debiteurnr
        $school = $schoolByDeb[$debiteurnr]
        if (-not $school) {
            throw "Geen school gevonden voor debiteurnummer $debiteurnr bij samenvattingsfactuur $invoiceNum"
        }

        [void]$warnings.Add("Geen bruikbaar factuurtab gevonden voor $invoiceNum; samenvattingsregel wordt gebruikt.")
        [void]$invoiceNumbers.Add($invoiceNum)

        $invoiceDate = Convert-InvoiceDate $meta.datum
        $summaryTotal = [math]::Round([double]$meta.totaal, 2)
        $status = if ($meta.betaald -match '^(?i)ja$') { 'betaald' } else { 'verzonden' }
        $vervalDatum = if ($invoiceDate) { (Get-Date $invoiceDate).AddDays(14).ToString('yyyy-MM-dd') } else { $null }
        $betreft = if ($meta.betreft) { $meta.betreft } else { "Factuur $invoiceNum" }
        $regels = @([ordered]@{
            id = [guid]::NewGuid().ToString()
            omschrijving = $betreft
            toelichting = 'Geïmporteerd op basis van de samenvattingsregel in de boekhouding'
            datum = $invoiceDate
            uren = ''
            bedrag = $summaryTotal
        })

        $factuurPayload = [ordered]@{
            school_id = $school.id
            contact_id = $null
            tav = $null
            nummer = $invoiceNum
            debiteurnr = $debiteurnr
            datum = $invoiceDate
            vervaldatum = $vervalDatum
            status = $status
            betreft = $betreft
            regels = $regels
            totaal = $summaryTotal
        }

        if ($currentFacturenByNumber.ContainsKey($invoiceNum)) {
            [void]$facturenToUpdate.Add([ordered]@{
                id = $currentFacturenByNumber[$invoiceNum]
                payload = $factuurPayload
            })
        } else {
            [void]$facturenToInsert.Add([ordered]@{
                id = [guid]::NewGuid().ToString()
                school_id = $factuurPayload.school_id
                contact_id = $factuurPayload.contact_id
                tav = $factuurPayload.tav
                nummer = $factuurPayload.nummer
                debiteurnr = $factuurPayload.debiteurnr
                datum = $factuurPayload.datum
                vervaldatum = $factuurPayload.vervaldatum
                status = $factuurPayload.status
                betreft = $factuurPayload.betreft
                regels = $factuurPayload.regels
                totaal = $factuurPayload.totaal
            })
        }

        $dossierOnderwerp = "Factuur $invoiceNum"
        $dossierKey = "$($school.id)|$dossierOnderwerp"
        $expectedDossierKeys[$dossierKey] = $true
        if (-not $currentDossierKeys.ContainsKey($dossierKey)) {
            $tekst = @(
                'Factuur geïmporteerd uit administratie',
                "Betreft: $betreft",
                "Debiteurnummer: $debiteurnr",
                "Bedrag: EUR $(([math]::Round($summaryTotal,2)).ToString('0.00').Replace('.',','))",
                "Status: $status"
            ) -join "`n"

            [void]$dossiersToInsert.Add([ordered]@{
                id = [guid]::NewGuid().ToString()
                school_id = $school.id
                contact_id = $null
                datum = if ($invoiceDate) { "${invoiceDate}T12:00:00" } else { (Get-Date).ToString('s') }
                type = 'notitie'
                onderwerp = $dossierOnderwerp
                tekst = $tekst
                bron_naam = 'Import boekhouding'
                bestanden = @()
            })
            $currentDossierKeys[$dossierKey] = $true
        }
    }
}
finally {
    if ($summarySheet) {
        try { [System.Runtime.Interopservices.Marshal]::ReleaseComObject($summarySheet) | Out-Null } catch {}
    }
    if ($wb) {
        try { $wb.Close($false) } catch {}
        try { [System.Runtime.Interopservices.Marshal]::ReleaseComObject($wb) | Out-Null } catch {}
    }
    if ($excel) {
        try { $excel.Quit() } catch {}
        try { [System.Runtime.Interopservices.Marshal]::ReleaseComObject($excel) | Out-Null } catch {}
    }
    [gc]::Collect()
    [gc]::WaitForPendingFinalizers()
}

$plannedCount = $facturenToInsert.Count + $facturenToUpdate.Count
$plannedItems = @($facturenToInsert) + @($facturenToUpdate | ForEach-Object { $_.payload })
$plannedTotal = if ($plannedCount -gt 0) {
    Get-NumericSum -Items $plannedItems -Property 'totaal'
} else {
    0.0
}

Write-Output ("Voorbereid: {0} facturen ({1} nieuw, {2} update)" -f $plannedCount, $facturenToInsert.Count, $facturenToUpdate.Count)
Write-Output ("Voorbereid dossieritems: {0}" -f $dossiersToInsert.Count)
Write-Output ("Totaalbedrag import: EUR {0}" -f ($plannedTotal.ToString('0.00').Replace('.', ',')))

if ($ExpectedCount -gt 0 -and $plannedCount -ne $ExpectedCount) {
    throw ("Verificatie mislukt: verwacht {0} facturen, gevonden {1} in workbook {2}" -f $ExpectedCount, $plannedCount, $WorkbookPath)
}
if ($ExpectedTotal -ge 0 -and [math]::Abs($plannedTotal - $ExpectedTotal) -gt 0.01) {
    throw ("Verificatie mislukt: verwacht totaal {0}, gevonden {1} in workbook {2}" -f $ExpectedTotal.ToString('0.00'), $plannedTotal.ToString('0.00'), $WorkbookPath)
}

if ($warnings.Count -gt 0) {
    Write-Output 'Waarschuwingen:'
    $warnings | ForEach-Object { Write-Output ('- ' + $_) }
}

if ($DryRun) {
    Write-Output 'Dry run voltooid. Er zijn geen wijzigingen naar Supabase geschreven.'
    exit 0
}

if ($facturenToInsert.Count -gt 0) {
    Send-Batches -Uri "$SUPA_URL/rest/v1/facturen" -Headers $headers -Items $facturenToInsert -BatchSize 20
}

foreach ($item in $facturenToUpdate) {
    Invoke-SupaJson -Method 'PATCH' -Uri "$SUPA_URL/rest/v1/facturen?id=eq.$($item.id)" -Headers $headers -Body $item.payload | Out-Null
}

if ($dossiersToInsert.Count -gt 0) {
    Send-Batches -Uri "$SUPA_URL/rest/v1/dossiers" -Headers $headers -Items $dossiersToInsert -BatchSize 25
}

$verifyAllFacturen = Invoke-SupaJson -Method 'GET' -Uri "$SUPA_URL/rest/v1/facturen?select=nummer,totaal,school_id" -Headers $headers
$verifyAllDossiers = Invoke-SupaJson -Method 'GET' -Uri "$SUPA_URL/rest/v1/dossiers?select=onderwerp,school_id" -Headers $headers
$invoiceNumberSet = @{}
foreach ($nr in $invoiceNumbers) { $invoiceNumberSet[$nr] = $true }
$verifyFacturen = @($verifyAllFacturen | Where-Object { $invoiceNumberSet.ContainsKey($_.nummer) })
$verifyDossiers = @($verifyAllDossiers | Where-Object { $expectedDossierKeys.ContainsKey("$($_.school_id)|$($_.onderwerp)") })
$verifyCount = @($verifyFacturen).Count
$verifyTotal = Get-NumericSum -Items @($verifyFacturen) -Property 'totaal'

Write-Output ("VERIFICATIE_FACTUREN={0}" -f $verifyCount)
Write-Output ("VERIFICATIE_TOTAAL=EUR {0}" -f ($verifyTotal.ToString('0.00').Replace('.', ',')))
Write-Output ("VERIFICATIE_DOSSIERS={0}" -f (@($verifyDossiers).Count))

if ($ExpectedCount -gt 0 -and $verifyCount -ne $ExpectedCount) {
    throw ("CRM-verificatie mislukt: verwacht {0} facturen, aanwezig {1}" -f $ExpectedCount, $verifyCount)
}
if ($ExpectedTotal -ge 0 -and [math]::Abs($verifyTotal - $ExpectedTotal) -gt 0.01) {
    throw ("CRM-verificatie mislukt: verwacht totaal {0}, aanwezig {1}" -f $ExpectedTotal.ToString('0.00'), $verifyTotal.ToString('0.00'))
}