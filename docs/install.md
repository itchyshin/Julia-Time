# Install Julia Time

Julia Time is a free game that teaches Julia. It runs on your own computer.

> **What you need**
> - A laptop or desktop computer (Windows, Mac or Linux), not a phone or tablet.
> - Julia **1.10** (the long-term-support version, not the newest Julia).
> - About 1 GB of free disk space (Julia about 0.5 GB, Julia Time plus its packages about 0.3 GB).
> - Internet once, for the setup. After that the game runs offline.
> - R and Python are not needed to play the mystery. Only the optional speed lab uses them.

Want pictures first? In the extracted Julia Time folder, open `web/course/getting-started.html`.

## 1. Download and unpack Julia Time

Go to the [Releases page](https://github.com/itchyshin/Julia-Time/releases/latest) and download the
`Julia-Time-<version>.zip` file under *Assets*. Unpack it to a folder you can find again.
On Windows, first right-click the ZIP, choose Properties, tick **Unblock** if you see it, and click OK; this avoids a
security prompt later. Then right-click the ZIP and choose **Extract All**; do not run the game from inside the ZIP.
Open the inner `Julia-Time-<version>` folder (the one that holds `Play-Julia-Time-Windows`).

## 2. Install Julia 1.10

Julia Time needs Julia **1.10.x**. Use one of these:

- Windows 64-bit: [julia-1.10.12-win64.exe](https://julialang-s3.julialang.org/bin/winnt/x64/1.10/julia-1.10.12-win64.exe).
  If asked, choose **Install for me only** (no administrator rights needed).
- Mac with Apple Silicon (Apple menu > About This Mac shows "Chip Apple M..."):
  [julia-1.10.12-macaarch64.dmg](https://julialang-s3.julialang.org/bin/mac/aarch64/1.10/julia-1.10.12-macaarch64.dmg).
  Open it and drag Julia to Applications.
- Mac with an Intel processor (About This Mac shows "Processor ... Intel"):
  [julia-1.10.12-mac64.dmg](https://julialang-s3.julialang.org/bin/mac/x64/1.10/julia-1.10.12-mac64.dmg).
- Linux, or any later 1.10.x: the [official Julia 1.10 LTS download page](https://julialang.org/downloads/manual-downloads/#long_term_support_release),
  or [`juliaup`](https://github.com/JuliaLang/juliaup) (`juliaup add 1.10`).

A newer Julia that is already installed is fine. The launchers check each Julia they find and use
the 1.10 one. You do not need to change PATH.

You do not need to check: the Play files find the right Julia for you. If you want to check anyway and your terminal
knows `julia`, run `julia --version`. It must begin `julia version 1.10.`. If a Mac terminal cannot find `julia`, try
`/Applications/Julia-1.10.app/Contents/Resources/julia/bin/julia --version` (adjust the app name if needed).

## 3. Start the game

The first time, the launcher also runs the one-time setup (section 4). Keep its window open while you play.

1. **Windows:** double-click `Play-Julia-Time-Windows`. If Windows says it protected your PC, choose
   **More info**, then **Run anyway** (or **Run**).
2. **Mac:** double-click `Play-Julia-Time-Mac.command`. If macOS says it cannot verify the file, click
   **Done**, open **System Settings > Privacy & Security**, click **Open Anyway** next to
   `Play-Julia-Time-Mac.command`, and double-click it again. If asked whether Terminal may access your
   Downloads folder, click **Allow**.
3. **Linux:** open a terminal in the Julia Time folder. Run `chmod +x tools/setup/launch-linux.sh` once.
   Then run `tools/setup/launch-linux.sh` whenever you want to play.

The game opens in your browser at `http://127.0.0.1:8000/course/index.html` (the Case Board). If another
program uses port 8000, the launcher tries 8001 to 8009 and prints the address it chose. This address works
only on your own computer. If Julia Time is already running, starting it again just reopens the game.

## 4. The one-time setup

On the first start, Julia downloads and compiles the packages Julia Time needs. This needs internet. On a fast
connection it usually takes a few minutes; on 2 October 2026 we measured 67 seconds from an empty package store on a
recent Mac with a fast connection. The packages take about 244 MB. A slower connection or computer takes longer.
Do not close the window while it runs. Later starts take seconds.

You do not need this if you double-clicked a Play file. To run the setup by hand, use the commands below. Their settings
limit how many of your computer's processor cores the game uses, so it does not hog a shared computer. In the Julia Time folder:

**Mac or Linux Terminal**

```text
JULIA_NUM_THREADS=4 OPENBLAS_NUM_THREADS=1 julia --startup-file=no --history-file=no --project=. check_setup.jl
```

**Windows Command Prompt** (or double-click `tools/setup/setup-windows.cmd`, which does the same checks and
leaves its window open)

```text
set JULIA_NUM_THREADS=4
set OPENBLAS_NUM_THREADS=1
julia --startup-file=no --history-file=no --project=. check_setup.jl
```

**Windows PowerShell**

```text
$env:JULIA_NUM_THREADS = "4"
$env:OPENBLAS_NUM_THREADS = "1"
julia --startup-file=no --history-file=no --project=. check_setup.jl
```

Success ends with these lines (the number of seconds is your own):

```text
OK: Julia Time is ready (complete setup took <N> seconds).
Next: open the Case Board with the matching command in docs/install.md.
```

The Play files print only the `OK` line and then open the Case Board by themselves. If you typed the setup
command yourself, start the game by replacing `check_setup.jl` with `run.jl` in the same command.

## If something goes wrong

Read the short `Next:` line in the terminal first. Then try the first matching repair:

1. Julia version is not 1.10.x. Install Julia 1.10.x from section 2, open a new terminal, and repeat the setup.
2. `julia` is not found. The Windows double-click files also check the normal installer folder, so use those
   first. For a typed Windows command, close and reopen the terminal after installing Julia. On a Mac, use the
   explicit Julia app command from section 2.
3. Package download, precompile, or sandbox check failed. Check your internet connection and run the setup again.
4. The game does not appear. Double-click the same Play file again; if Julia Time is running, it reopens the game.

On a university-managed computer, installers or double-clicked scripts may be blocked. Ask your IT group to
allow Julia 1.10, or use another computer.

## Stop the game

Go to the black window (Windows) or Terminal window (Mac, Linux) that opened with the game. Press Enter or Ctrl-C there.

## Optional: the speed lab and a different Python

You do not need this to play the mystery. The optional speed lab times six small calculations in Julia, R and
Python on your computer. It needs R and Python installed to time them. A language that is not
installed is shown as not timed, and the lab carries on. If another Python on your computer is the one you want the lab
to use, restart Julia Time with that interpreter's full path. This does not install anything or change your other Python.

**Mac or Linux Terminal**

```text
JULIATIME_PYTHON=/full/path/to/python3 \
  JULIA_NUM_THREADS=4 OPENBLAS_NUM_THREADS=1 \
  julia --startup-file=no --history-file=no --project=. run.jl
```

**Windows Command Prompt**

```text
set JULIATIME_PYTHON=C:\full\path\to\python.exe
set JULIA_NUM_THREADS=4
set OPENBLAS_NUM_THREADS=1
julia --startup-file=no --history-file=no --project=. run.jl
```

Something did not work? Tell us: https://github.com/itchyshin/Julia-Time/issues/new/choose (what you did, what you saw, your system).
