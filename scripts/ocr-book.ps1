param(
  [Parameter(Mandatory = $true)] [string]$InputDirectory,
  [Parameter(Mandatory = $true)] [string]$OutputFile
)

$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
Add-Type -AssemblyName System.Runtime.WindowsRuntime
[void][Windows.Media.Ocr.OcrEngine, Windows.Foundation, ContentType = WindowsRuntime]
[void][Windows.Globalization.Language, Windows.Foundation, ContentType = WindowsRuntime]
[void][Windows.Storage.StorageFile, Windows.Storage, ContentType = WindowsRuntime]
[void][Windows.Storage.FileAccessMode, Windows.Storage, ContentType = WindowsRuntime]
[void][Windows.Graphics.Imaging.BitmapDecoder, Windows.Graphics.Imaging, ContentType = WindowsRuntime]
[void][Windows.Graphics.Imaging.SoftwareBitmap, Windows.Graphics.Imaging, ContentType = WindowsRuntime]

function Await-Result($AsyncOperation, [Type]$ResultType) {
  $method = [System.WindowsRuntimeSystemExtensions].GetMethods() |
    Where-Object { $_.Name -eq "AsTask" -and $_.IsGenericMethod -and $_.GetParameters().Count -eq 1 } |
    Select-Object -First 1
  $task = $method.MakeGenericMethod($ResultType).Invoke($null, @($AsyncOperation))
  $task.Wait()
  return $task.Result
}

$language = [Windows.Globalization.Language]::new("ko")
$engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromLanguage($language)
if (-not $engine) { throw "Korean Windows OCR is not installed" }

$inputPath = [System.IO.Path]::GetFullPath($InputDirectory)
$outputPath = [System.IO.Path]::GetFullPath($OutputFile)
$writer = [System.IO.StreamWriter]::new($outputPath, $false, [System.Text.UTF8Encoding]::new($false))
try {
  $files = Get-ChildItem -LiteralPath $inputPath -File | Sort-Object Name
  foreach ($image in $files) {
    $file = Await-Result ([Windows.Storage.StorageFile]::GetFileFromPathAsync($image.FullName)) ([Windows.Storage.StorageFile])
    $stream = Await-Result ($file.OpenAsync([Windows.Storage.FileAccessMode]::Read)) ([Windows.Storage.Streams.IRandomAccessStream])
    $decoder = Await-Result ([Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($stream)) ([Windows.Graphics.Imaging.BitmapDecoder])
    $bitmap = Await-Result ($decoder.GetSoftwareBitmapAsync()) ([Windows.Graphics.Imaging.SoftwareBitmap])
    $result = Await-Result ($engine.RecognizeAsync($bitmap)) ([Windows.Media.Ocr.OcrResult])
    $lines = foreach ($line in $result.Lines) {
      $words = @($line.Words)
      if (-not $words.Count) { continue }
      $left = ($words | ForEach-Object { $_.BoundingRect.X } | Measure-Object -Minimum).Minimum
      $top = ($words | ForEach-Object { $_.BoundingRect.Y } | Measure-Object -Minimum).Minimum
      $right = ($words | ForEach-Object { $_.BoundingRect.X + $_.BoundingRect.Width } | Measure-Object -Maximum).Maximum
      $bottom = ($words | ForEach-Object { $_.BoundingRect.Y + $_.BoundingRect.Height } | Measure-Object -Maximum).Maximum
      [pscustomobject]@{ text = $line.Text; x = [math]::Round($left, 1); y = [math]::Round($top, 1); width = [math]::Round($right-$left, 1); height = [math]::Round($bottom-$top, 1) }
    }
    $page = [int]([regex]::Match($image.BaseName, "\d+").Value)
    $record = [pscustomobject]@{ page = $page; width = $decoder.PixelWidth; height = $decoder.PixelHeight; lines = @($lines) }
    $writer.WriteLine(($record | ConvertTo-Json -Depth 4 -Compress))
    Write-Progress -Activity "OCR book" -Status "Page $page / $($files.Count)" -PercentComplete (($page / $files.Count) * 100)
    $stream.Dispose(); $bitmap.Dispose()
  }
} finally {
  $writer.Dispose()
}
