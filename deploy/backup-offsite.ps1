#Requires -Version 5.1
<#
.SYNOPSIS
    UpKorean zaxiralarini serverdan shu kompyuterga tortib oladi.

.DESCRIPTION
    Server har 24 soatda /opt/upkorean/data/backups/ ga nusxa oladi va faqat oxirgi 14 tasini
    saqlaydi (apps/api/db.js, backupDb). Ular jonli baza bilan bitta diskda turibdi, ya'ni disk
    yoki server yo'qolsa ular ham yo'qoladi. Shu skript ularni boshqa mashinaga ko'chiradi va
    serverda o'chirib yuborilganlarini ham saqlab qoladi.

    Ulanish shu kompyuterdan boshlanadi ("pull"), shuning uchun serverda hech qanday yangi
    kalit saqlanmaydi: server sindirilsa ham bu nusxalarga undan yetib bo'lmaydi. Evaziga
    kompyuter o'chiq bo'lgan kun o'tkazib yuboriladi - bu ataylab qabul qilingan kelishuv.

.EXAMPLE
    powershell -NoProfile -ExecutionPolicy Bypass -File D:\UPKOREAN\deploy\backup-offsite.ps1

.EXAMPLE
    .\backup-offsite.ps1 -Destination E:\zaxira\upkorean -MaxAgeHours 72

.NOTES
    Chiqish kodlari (Task Scheduler "Last Run Result" da ko'rinadi):
      0 - hammasi joyida
      1 - sozlama xatosi (ssh/scp yo'q, papka ochilmadi)
      2 - serverga ulanib bo'lmadi yoki zaxira papkasi bo'sh
      3 - ko'chirish tugallanmadi (fayl yetib kelmadi)
      4 - tekshiruv yiqildi (eng yangi zaxira juda eski yoki bitta ham nusxa yo'q)
#>
[CmdletBinding()]
param(
    # Nusxalar shu papkaga tushadi. UPKOREAN_BACKUP_DIR muhit o'zgaruvchisi ham qabul qilinadi.
    [string]$Destination,

    # ssh manzili. UPKOREAN_SSH_HOST muhit o'zgaruvchisi ham qabul qilinadi.
    [string]$RemoteHost,

    # Serverdagi zaxira papkasi. UPKOREAN_REMOTE_DIR muhit o'zgaruvchisi ham qabul qilinadi.
    [string]$RemoteDir,

    # Shu kundan eskilari siyraklashtiriladi (pastdagi "Saqlash qoidasi" ga qarang).
    [int]$KeepDays = 180,

    # Necha yangi fayl har qanday holatda ham o'chirilmaydi.
    [int]$KeepMin = 14,

    # Eng yangi zaxira shundan eski bo'lsa, skript xato bilan tugaydi.
    # Server har 24 soatda nusxa oladi, 48 soat bitta o'tkazib yuborilgan kunga bardosh beradi.
    [int]$MaxAgeHours = 48,

    # ssh ulanish kutish vaqti (soniya).
    [int]$TimeoutSec = 30
)

# PowerShell'ning o'z xatolari darhol to'xtatsin; tashqi dasturlar (ssh/scp) esa
# $LASTEXITCODE orqali tekshiriladi - ular xatoni stderr ga yozadi, exception tashlamaydi.
$ErrorActionPreference = 'Stop'

# Server fayllarni shu nom bilan yozadi: upkorean-<UTC vaqt>.db (apps/api/db.js, backupDb).
# Nomdagi vaqt - serverning nusxa olgan payti. Tekshiruv aynan shunga suyanadi, chunki
# faylning lokal mtime'i faqat qachon ko'chirib olinganini bildiradi: server bir oy oldin
# to'xtab qolgan bo'lsa ham u "bugungi" bo'lib ko'rinaveradi.
$BackupNameRe = '^upkorean-\d{4}-\d{2}-\d{2}-\d{2}-\d{2}-\d{2}\.db$'

$script:LogPath = $null
$script:StderrFile = Join-Path $env:TEMP ("upkorean-pull-{0}.err" -f $PID)

function Write-Log {
    param([string]$Message)
    $line = '{0}  {1}' -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $Message
    Write-Host $line
    if ($script:LogPath) {
        # Rejalashtirilgan vazifada konsol ko'rinmaydi, shuning uchun hammasi jurnalga ham yoziladi.
        try { Add-Content -LiteralPath $script:LogPath -Value $line -Encoding UTF8 } catch { }
    }
}

function Stop-WithError {
    param([int]$Code, [string]$Message)
    Write-Log "XATO: $Message"
    Write-Log "Natija: zaxira OLINMADI (kod $Code)."
    exit $Code
}

function Get-Setting {
    param([string]$Value, [string]$EnvName, [string]$Fallback)
    if ($Value) { return $Value }
    $fromEnv = [Environment]::GetEnvironmentVariable($EnvName)
    if ($fromEnv) { return $fromEnv }
    return $Fallback
}

function Invoke-Native {
    param([string]$Exe, [string[]]$Arguments = @())
    # $ErrorActionPreference = 'Stop' bo'lsa, tashqi dasturning stderr'i PowerShell 5.1 da
    # terminating error'ga aylanadi (NativeCommandError) - ssh oddiy ogohlantirish yozsa ham
    # skript qulab tushardi. Shuning uchun chaqiruv vaqtida faqat 'Continue' qilinadi.
    $prev = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    $global:LASTEXITCODE = 0
    try {
        $out = & $Exe @Arguments 2> $script:StderrFile
        $code = $LASTEXITCODE
    } finally {
        $ErrorActionPreference = $prev
    }
    $err = ''
    if (Test-Path -LiteralPath $script:StderrFile) {
        # PowerShell 5.1 tashqi dasturning stderr'ini ErrorRecord qilib o'raydi va ustiga o'zining
        # "At <skript>:<qator> char:<n>", "+ ...", "+ CategoryInfo ..." qatorlarini qo'shadi.
        # Jurnalda faqat ssh/scp'ning haqiqiy xabari qolsin, aks holda asl sabab ko'rinmay ketadi.
        $clean = @()
        foreach ($line in @(Get-Content -LiteralPath $script:StderrFile -ErrorAction SilentlyContinue)) {
            $text = ([string]$line).Trim()
            if (-not $text) { continue }
            if ($text -match '^At\s+\S+:\d+\s+char:\d+') { continue }
            if ($text.StartsWith('+')) { continue }
            if ($text -match '^(CategoryInfo|FullyQualifiedErrorId)\s*:') { continue }
            $clean += ($text -replace '^\S+\.exe\s+:\s*', '')
        }
        $err = (($clean -join ' ') -replace '\s+', ' ').Trim()
        Remove-Item -LiteralPath $script:StderrFile -Force -ErrorAction SilentlyContinue
    }
    return [pscustomobject]@{ ExitCode = $code; Out = $out; Err = $err }
}

function Get-BackupStamp {
    param([string]$Name)
    if ($Name -notmatch $BackupNameRe) { return $null }
    $text = $Name.Substring(9, 19)
    try {
        return [datetime]::ParseExact(
            $text, 'yyyy-MM-dd-HH-mm-ss',
            [Globalization.CultureInfo]::InvariantCulture,
            [Globalization.DateTimeStyles]::AssumeUniversal -bor [Globalization.DateTimeStyles]::AdjustToUniversal)
    } catch { return $null }
}

function Get-LocalBackups {
    param([string]$Dir)
    $items = @()
    $files = Get-ChildItem -LiteralPath $Dir -Filter 'upkorean-*.db' -File -ErrorAction SilentlyContinue
    foreach ($f in $files) {
        $stamp = Get-BackupStamp $f.Name
        if ($stamp) {
            $items += [pscustomobject]@{ Name = $f.Name; Path = $f.FullName; Stamp = $stamp; Length = $f.Length }
        }
    }
    return @($items)
}

# ---------- Sozlamalar ----------

$Destination = Get-Setting $Destination 'UPKOREAN_BACKUP_DIR' (Join-Path $env:USERPROFILE 'UpKorean-zaxira')
$RemoteHost  = Get-Setting $RemoteHost  'UPKOREAN_SSH_HOST'   'root@109.205.177.244'
$RemoteDir   = Get-Setting $RemoteDir   'UPKOREAN_REMOTE_DIR' '/opt/upkorean/data/backups'
$RemoteDir   = $RemoteDir.TrimEnd('/')

$ssh = $null
$scp = $null
$sshCmd = Get-Command 'ssh' -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
$scpCmd = Get-Command 'scp' -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
if ($sshCmd) { $ssh = $sshCmd.Source }
if ($scpCmd) { $scp = $scpCmd.Source }

try {
    $null = New-Item -ItemType Directory -Path $Destination -Force
    $Destination = (Resolve-Path -LiteralPath $Destination).Path
} catch {
    Stop-WithError 1 "papka ochilmadi: $Destination - $($_.Exception.Message)"
}
$script:LogPath = Join-Path $Destination 'pull.log'

Write-Log '--- UpKorean zaxirasini tortish boshlandi ---'
Write-Log "Manba: ${RemoteHost}:$RemoteDir"
Write-Log "Manzil: $Destination"

if (-not $ssh -or -not $scp) {
    Stop-WithError 1 "ssh yoki scp topilmadi. Windows sozlamalarida OpenSSH Client'ni yoqing (Settings > System > Optional features)."
}
Write-Log "Vositalar: $ssh / $scp"

# BatchMode=yes: parol yoki noma'lum host kaliti so'ralsa, so'ramay xato qaytaradi - rejalashtirilgan
# vazifa hech qachon javob kutib osilib qolmaydi. ServerAlive* esa ulanish o'rtada uzilsa
# scp'ni abadiy kutib turishdan saqlaydi.
$sshOpts = @(
    '-o', 'BatchMode=yes',
    '-o', "ConnectTimeout=$TimeoutSec",
    '-o', 'ServerAliveInterval=15',
    '-o', 'ServerAliveCountMax=4'
)

# ---------- Serverdagi ro'yxat ----------

$listing = Invoke-Native $ssh ($sshOpts + @($RemoteHost, "ls -1 -- '$RemoteDir'"))
if ($listing.ExitCode -ne 0) {
    Stop-WithError 2 "serverga ulanib bo'lmadi yoki papka ochilmadi (ssh kodi $($listing.ExitCode)). $($listing.Err)"
}

$remoteNames = @()
foreach ($line in @($listing.Out)) {
    if ($null -ne $line) {
        $name = ([string]$line).Trim()
        if ($name) { $remoteNames += $name }
    }
}
$remoteDb = @($remoteNames | Where-Object { $_ -match $BackupNameRe } | Sort-Object)
if ($remoteDb.Count -eq 0) {
    Stop-WithError 2 "serverda bitta ham zaxira fayli yo'q ($RemoteDir). Ilova ishlayaptimi: systemctl status upkorean"
}
Write-Log "Serverda $($remoteDb.Count) ta zaxira bor, eng yangisi: $($remoteDb[-1])"

# ---------- Ko'chirish ----------

# Yarim ko'chirilgan fayl .part bo'lib qoladi va hech qachon haqiqiy nom ostida saqlanmaydi,
# shuning uchun uzilib qolgan ish yolg'on "zaxira bor" tuyg'usini bermaydi.
Get-ChildItem -LiteralPath $Destination -Filter '*.part' -File -ErrorAction SilentlyContinue |
    ForEach-Object { Remove-Item -LiteralPath $_.FullName -Force -ErrorAction SilentlyContinue }

$pulled = 0
$failed = 0
foreach ($name in $remoteDb) {
    $final = Join-Path $Destination $name
    # Serverda rotatsiya qilingan nusxalar bu yerda qoladi: mavjud fayl qayta ko'chirilmaydi
    # va hech qachon o'chirilmaydi. Serverning 14 talik oynasi aynan shunday yengib o'tiladi.
    if (Test-Path -LiteralPath $final) { continue }

    $part = "$final.part"
    $r = Invoke-Native $scp (@('-p') + $sshOpts + @("${RemoteHost}:$RemoteDir/$name", $part))
    if ($r.ExitCode -ne 0 -or -not (Test-Path -LiteralPath $part)) {
        $failed++
        Remove-Item -LiteralPath $part -Force -ErrorAction SilentlyContinue
        Write-Log "OGOHLANTIRISH: $name ko'chirilmadi (scp kodi $($r.ExitCode)). $($r.Err)"
        continue
    }
    Move-Item -LiteralPath $part -Destination $final -Force
    $pulled++
    Write-Log "Olindi: $name"
}

Write-Log "Yangi olingan fayllar: $pulled"

# ---------- Tekshiruv ----------

if ($failed -gt 0) {
    Stop-WithError 3 "$failed ta fayl ko'chirilmadi. Eski nusxalar joyida qoldi, tozalash o'tkazib yuborildi."
}

# Jimgina hech nima qilmaslikni ushlaydigan asosiy tekshiruv: serverdagi eng yangi fayl
# shu yerda ham bo'lishi shart. "0 ta fayl olindi" o'zi xato emas (kuniga ikki marta ishga
# tushsa, ikkinchisida olinadigan narsa yo'q) - lekin eng yangisi yetib kelmagan bo'lsa, xato.
$newestRemote = $remoteDb[-1]
if (-not (Test-Path -LiteralPath (Join-Path $Destination $newestRemote))) {
    Stop-WithError 3 "serverdagi eng yangi zaxira ($newestRemote) shu yerga yetib kelmadi."
}

$local = Get-LocalBackups $Destination
if ($local.Count -eq 0) {
    Stop-WithError 4 "shu papkada bitta ham zaxira fayli yo'q: $Destination"
}

$newestLocal = $local | Sort-Object Stamp | Select-Object -Last 1
$ageHours = ([datetime]::UtcNow - $newestLocal.Stamp).TotalHours
if ($ageHours -gt $MaxAgeHours) {
    Stop-WithError 4 ("eng yangi zaxira {0:N1} soat oldingi (chegara {1} soat): {2}. Server nusxa olishni to'xtatgan bo'lishi mumkin - journalctl -u upkorean | grep backup" -f $ageHours, $MaxAgeHours, $newestLocal.Name)
}

# ---------- Saqlash qoidasi ----------
# Oxirgi $KeepDays kunlik hamma fayl qoladi. Undan eskilaridan har oyning birinchisi qoladi,
# qolgani o'chiriladi. Bundan tashqari eng yangi $KeepMin fayl hech qachon o'chirilmaydi -
# tortish uzoq vaqt ishlamay qolgan bo'lsa ham hech narsasiz qolinmaydi.
$protected = @{}
foreach ($f in @($local | Sort-Object Stamp -Descending | Select-Object -First $KeepMin)) {
    $protected[$f.Name] = $true
}
foreach ($grp in @($local | Group-Object -Property { $_.Stamp.ToString('yyyy-MM') })) {
    $first = @($grp.Group | Sort-Object Stamp)[0]
    $protected[$first.Name] = $true
}
$cutoff = [datetime]::UtcNow.AddDays(-$KeepDays)
$doomed = @($local | Where-Object { $_.Stamp -lt $cutoff -and -not $protected.ContainsKey($_.Name) })
$removed = 0
foreach ($f in $doomed) {
    try {
        Remove-Item -LiteralPath $f.Path -Force
        $removed++
    } catch {
        Write-Log "OGOHLANTIRISH: eski fayl o'chmadi: $($f.Name) - $($_.Exception.Message)"
    }
}

$keptFiles = @($local | Where-Object { -not ($_.Stamp -lt $cutoff -and -not $protected.ContainsKey($_.Name)) })
$sizeMb = 0
if ($keptFiles.Count -gt 0) {
    $sizeMb = [math]::Round((($keptFiles | Measure-Object -Property Length -Sum).Sum) / 1MB, 1)
}
Write-Log ("Natija: {0} ta nusxa saqlanmoqda ({1} MB), {2} ta eskisi tozalandi, eng yangisi {3:N1} soat oldingi." -f $keptFiles.Count, $sizeMb, $removed, $ageHours)

# Jurnal cheksiz o'smasin: kuniga bir necha qator yoziladi, 500 qator bir necha oyga yetadi.
try {
    if ((Get-Item -LiteralPath $script:LogPath).Length -gt 512KB) {
        $tail = Get-Content -LiteralPath $script:LogPath -Tail 500
        Set-Content -LiteralPath $script:LogPath -Value $tail -Encoding UTF8
    }
} catch { }

exit 0
