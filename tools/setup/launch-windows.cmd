@echo off
rem Local launcher for the extracted Julia Time folder (Play-Julia-Time-Windows.cmd at the top of
rem the folder calls this). The first time, it runs the one-time setup (check_setup.jl) itself.
rem It never installs software or changes user/system configuration. Every way out goes through
rem :finish, which keeps the window open after a problem so the learner can read what happened.
setlocal
set "JULIA_NUM_THREADS=4"
set "OPENBLAS_NUM_THREADS=1"
set "EXIT_CODE=1"

set "COURSE_ROOT=%~dp0..\.."
if not exist "%COURSE_ROOT%\Project.toml" goto :folder_missing
if not exist "%COURSE_ROOT%\run.jl" goto :folder_missing

call "%~dp0windows-julia.cmd"
if not defined JULIA_EXE goto :julia_missing
echo Using Julia: "%JULIA_EXE%"
"%JULIA_EXE%" --version

pushd "%COURSE_ROOT%"
rem The same readiness signal run.jl uses: a fresh folder cannot load JuliaTime until the
rem one-time setup has installed its packages.
"%JULIA_EXE%" --startup-file=no --history-file=no --project=. -e "using JuliaTime" >nul 2>&1
if not errorlevel 1 goto :play
echo Julia Time has not finished its one-time setup yet. Running it once now; this can take several minutes.
"%JULIA_EXE%" --startup-file=no --history-file=no --project=. check_setup.jl
set "EXIT_CODE=%ERRORLEVEL%"
if not "%EXIT_CODE%"=="0" goto :setup_failed

:play
echo Starting Julia Time. Keep this window open while you play; press Enter here to stop.
"%JULIA_EXE%" --startup-file=no --history-file=no --project=. run.jl
set "EXIT_CODE=%ERRORLEVEL%"
popd
goto :finish

:setup_failed
popd
echo SETUP_NOT_READY - read the final Julia Time lines above before trying again.
goto :finish

:folder_missing
echo COURSE_FOLDER_INVALID - keep this launcher inside the extracted Julia Time folder.
goto :finish

:julia_missing
if defined JULIA_OTHER goto :julia_unsupported
echo JULIA_MISSING - install Julia 1.10, then run this launcher again.
echo This launcher looks on PATH and in the usual Julia 1.10 installation folders.
echo Open: https://julialang.org/downloads/manual-downloads/#long_term_support_release
goto :finish

:julia_unsupported
echo JULIA_UNSUPPORTED - Julia Time needs Julia 1.10.x. The only Julia found here is:
echo   "%JULIA_OTHER%"
echo Install Julia 1.10 as well (it can sit beside your other Julia), then run this launcher again.
echo Open: https://julialang.org/downloads/manual-downloads/#long_term_support_release
goto :finish

:finish
if not "%EXIT_CODE%"=="0" (
  echo.
  echo Julia Time stopped with a problem. Read the lines above, then press any key to close this window.
  pause >nul
)
endlocal & exit /b %EXIT_CODE%
