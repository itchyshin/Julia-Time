@echo off
rem Manual local launcher for the extracted Julia Time folder.
rem It never installs software or changes user/system configuration.
setlocal
set "JULIA_NUM_THREADS=4"
set "OPENBLAS_NUM_THREADS=1"

set "COURSE_ROOT=%~dp0\..\.."
if not exist "%COURSE_ROOT%\Project.toml" goto :folder_missing
if not exist "%COURSE_ROOT%\run.jl" goto :folder_missing

call "%~dp0windows-julia.cmd"
if not defined JULIA_EXE goto :julia_missing

for /f "tokens=3" %%V in ('"%JULIA_EXE%" --version') do set "JULIA_VERSION=%%V"
echo Julia version: %JULIA_VERSION%
echo %JULIA_VERSION% | findstr /r "^1\.10\." >nul
if errorlevel 1 goto :julia_unsupported

pushd "%COURSE_ROOT%"
"%JULIA_EXE%" --startup-file=no --history-file=no --project=. run.jl
set "EXIT_CODE=%ERRORLEVEL%"
popd
endlocal & exit /b %EXIT_CODE%

:folder_missing
echo COURSE_FOLDER_INVALID — keep this launcher inside the extracted Julia Time folder.
endlocal & exit /b 1

:julia_missing
echo JULIA_MISSING — install Julia 1.10 manually, then run this launcher again.
echo This launcher checks the normal per-user Julia installer location as well as PATH.
echo Open: https://julialang.org/downloads/manual-downloads/#long-term-support-release
endlocal & exit /b 1

:julia_unsupported
echo JULIA_UNSUPPORTED — Julia Time needs Julia 1.10.x. Install or select it manually, then try again.
endlocal & exit /b 1
