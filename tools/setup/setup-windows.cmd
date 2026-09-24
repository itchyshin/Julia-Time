@echo off
rem One-time local setup for an extracted Julia Time folder. Optional: Play-Julia-Time-Windows.cmd
rem (and tools\setup\launch-windows.cmd) run this same setup the first time by themselves.
rem It never installs software or changes user/system configuration.
setlocal
set "JULIA_NUM_THREADS=4"
set "OPENBLAS_NUM_THREADS=1"
set "EXIT_CODE=0"

set "COURSE_ROOT=%~dp0..\.."
if not exist "%COURSE_ROOT%\Project.toml" goto :folder_missing
if not exist "%COURSE_ROOT%\check_setup.jl" goto :folder_missing

call "%~dp0windows-julia.cmd"
if not defined JULIA_EXE goto :julia_missing
echo Using Julia: "%JULIA_EXE%"
"%JULIA_EXE%" --version

pushd "%COURSE_ROOT%"
"%JULIA_EXE%" --startup-file=no --history-file=no --project=. check_setup.jl
set "EXIT_CODE=%ERRORLEVEL%"
popd
if not "%EXIT_CODE%"=="0" goto :setup_failed

echo.
echo SETUP_COMPLETE - Julia Time is ready.
echo Next: double-click Play-Julia-Time-Windows in the Julia Time folder to open the Case Board.
goto :finish

:folder_missing
echo COURSE_FOLDER_INVALID - keep this helper inside the extracted Julia Time folder.
set "EXIT_CODE=1"
goto :finish

:julia_missing
set "EXIT_CODE=1"
if defined JULIA_OTHER goto :julia_unsupported
echo JULIA_MISSING - install Julia 1.10, then run this helper again.
echo This helper looks on PATH and in the usual Julia 1.10 installation folders.
echo Open: https://julialang.org/downloads/manual-downloads/#long_term_support_release
goto :finish

:julia_unsupported
echo JULIA_UNSUPPORTED - Julia Time needs Julia 1.10.x. The only Julia found here is:
echo   "%JULIA_OTHER%"
echo Install Julia 1.10 as well (it can sit beside your other Julia), then run this helper again.
echo Open: https://julialang.org/downloads/manual-downloads/#long_term_support_release
goto :finish

:setup_failed
echo SETUP_NOT_READY - read the final Julia Time lines above before trying again.

:finish
echo.
pause
endlocal & exit /b %EXIT_CODE%
