@echo off
rem One-time local setup for an extracted Julia Time folder.
rem It never installs software or changes user/system configuration.
setlocal
set "JULIA_NUM_THREADS=4"
set "OPENBLAS_NUM_THREADS=1"

set "COURSE_ROOT=%~dp0\..\.."
if not exist "%COURSE_ROOT%\Project.toml" goto :folder_missing
if not exist "%COURSE_ROOT%\check_setup.jl" goto :folder_missing

call "%~dp0windows-julia.cmd"
if not defined JULIA_EXE goto :julia_missing

for /f "tokens=3" %%V in ('"%JULIA_EXE%" --version') do set "JULIA_VERSION=%%V"
echo Julia version: %JULIA_VERSION%
echo %JULIA_VERSION% | findstr /r "^1\.10\." >nul
if errorlevel 1 goto :julia_unsupported

pushd "%COURSE_ROOT%"
"%JULIA_EXE%" --startup-file=no --history-file=no --project=. check_setup.jl
set "EXIT_CODE=%ERRORLEVEL%"
popd
if not "%EXIT_CODE%"=="0" goto :setup_failed

echo.
echo SETUP_COMPLETE — Julia Time is ready.
echo Next: double-click tools\setup\launch-windows.cmd to open the Case Board.
goto :finish

:folder_missing
echo COURSE_FOLDER_INVALID — keep this helper inside the extracted Julia Time folder.
set "EXIT_CODE=1"
goto :finish

:julia_missing
echo JULIA_MISSING — install Julia 1.10 manually, then run this helper again.
echo This helper checks the normal per-user Julia installer location as well as PATH.
echo Open: https://julialang.org/downloads/manual-downloads/#long-term-support-release
set "EXIT_CODE=1"
goto :finish

:julia_unsupported
echo JULIA_UNSUPPORTED — Julia Time needs Julia 1.10.x. Install or select it manually, then try again.
set "EXIT_CODE=1"
goto :finish

:setup_failed
echo SETUP_NOT_READY — read the final Julia Time lines above before trying again.

:finish
echo.
pause
endlocal & exit /b %EXIT_CODE%
