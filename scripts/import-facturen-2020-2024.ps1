param(
    [switch]$DryRun
)

$ErrorActionPreference = 'Stop'
$scriptPath = Join-Path $PSScriptRoot 'import-facturen-2025.ps1'

$jobs = @(
    @{ Jaar = '2024'; Path = 'x:\Edwin\crm project\Administratie 2024.xlsx'; Count = 122; Total = 124305.59 },
    @{ Jaar = '2023'; Path = 'x:\Edwin\crm project\Administratie 2023.xlsx'; Count = 124; Total = 116919.27 },
    @{ Jaar = '2022'; Path = 'x:\Edwin\crm project\Administratie 2022.xlsx'; Count = 132; Total = 96140.50 },
    @{ Jaar = '2021'; Path = 'x:\Edwin\crm project\Administratie 2021.xlsx'; Count = 82;  Total = 63270.21 },
    @{ Jaar = '2020'; Path = 'x:\Edwin\crm project\Administratie 2020.xlsx'; Count = 66;  Total = 38087.74 }
)

foreach ($job in $jobs) {
    Write-Output ('')
    Write-Output ('===== IMPORT ' + $job.Jaar + ' =====')
    if ($DryRun) {
        & $scriptPath -WorkbookPath $job.Path -ExpectedCount $job.Count -ExpectedTotal $job.Total -DryRun
    } else {
        & $scriptPath -WorkbookPath $job.Path -ExpectedCount $job.Count -ExpectedTotal $job.Total
    }
}

Write-Output ''
Write-Output 'Alle importtaken zijn voltooid.'