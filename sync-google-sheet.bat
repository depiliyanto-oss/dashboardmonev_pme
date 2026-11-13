@echo off
cd /d "%~dp0"
echo Sinkronisasi data dashboard CARE-I dari Google Sheets...
python scripts\sync_google_sheet.py
if errorlevel 1 (
  echo.
  echo Sinkronisasi gagal. Periksa akses spreadsheet dan koneksi internet.
) else (
  echo.
  echo Berhasil. Refresh dashboard di browser.
)
pause
