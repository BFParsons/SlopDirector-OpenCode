# Optional local audio analysis, transcription and stem separation. CPU baseline;
# SLOPSTUDIO_PYTHON may point at a separate CUDA-enabled environment instead.
$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
$venvRoot = Join-Path $repoRoot '.venv'
$pythonExe = Join-Path $venvRoot 'Scripts\python.exe'
if (-not (Test-Path -LiteralPath $pythonExe)) {
    & python -m venv $venvRoot
    if ($LASTEXITCODE -ne 0) { throw 'Could not create Python virtual environment' }
}
& $pythonExe -m pip install torch torchaudio --index-url https://download.pytorch.org/whl/cpu
if ($LASTEXITCODE -ne 0) { throw 'Could not install CPU PyTorch' }
& $pythonExe -m pip install openai-whisper librosa demucs torchcodec
if ($LASTEXITCODE -ne 0) { throw 'Could not install audio tools' }
Write-Host 'Audio tools installed. Restart SlopStudio; native launchers discover .venv automatically.'
