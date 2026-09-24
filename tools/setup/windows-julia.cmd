@echo off
rem Find a Julia 1.10.x executable without changing the user's PATH or settings.
rem Call this from a script that has already used setlocal. It sets JULIA_EXE to the first
rem candidate that really is Julia 1.10 (each candidate is asked by running it), and JULIA_OTHER
rem to the first Julia of another version, so the caller can say which Julia it found.
rem Order: every julia.exe on PATH, then the official 1.10 installer's per-user and all-users
rem folders, then a juliaup-managed 1.10 already on disk. A newer Julia first on PATH (juliaup's
rem default, or one from an earlier course) therefore cannot hide an installed 1.10.

set "JULIA_EXE="
set "JULIA_OTHER="
for /f "delims=" %%J in ('where julia.exe 2^>nul') do call :try "%%J"
for /d %%D in ("%LOCALAPPDATA%\Programs\Julia-1.10*") do call :try "%%~fD\bin\julia.exe"
for /d %%D in ("%ProgramFiles%\Julia-1.10*") do call :try "%%~fD\bin\julia.exe"
for /d %%D in ("%USERPROFILE%\.julia\juliaup\julia-1.10*") do call :try "%%~fD\bin\julia.exe"
goto :eof

:try
if defined JULIA_EXE goto :eof
if not exist "%~1" goto :eof
"%~1" --startup-file=no --history-file=no -e "exit(VERSION.major == 1 && VERSION.minor == 10 ? 0 : 3)" >nul 2>&1
if errorlevel 1 goto :try_other
set "JULIA_EXE=%~1"
goto :eof

:try_other
if not defined JULIA_OTHER set "JULIA_OTHER=%~1"
goto :eof
