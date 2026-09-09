@echo off
rem Resolve a supported Julia executable without changing the user's PATH.
rem Call this from a script that has already used setlocal.  The normal Julia
rem Windows installer puts its per-user copies below LocalAppData; use that
rem narrow fallback only after an ordinary PATH lookup.

set "JULIA_EXE="
for /f "delims=" %%J in ('where julia.exe 2^>nul') do if not defined JULIA_EXE set "JULIA_EXE=%%J"
if defined JULIA_EXE exit /b 0

for /d %%D in ("%LOCALAPPDATA%\Programs\Julia-1.10*") do (
  if not defined JULIA_EXE if exist "%%~fD\bin\julia.exe" set "JULIA_EXE=%%~fD\bin\julia.exe"
)

exit /b 0
