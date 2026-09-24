# Install Julia Time

Set this up before the lab meeting on **Monday 28 September 2026**. The story
needs Julia. R and Python are not needed to play the mystery. The optional
bootstrap comparison, available after the mystery, separately requires R,
Python, and NumPy; it never blocks the mystery.

Need the visual walkthrough before the technical commands? Open
[Start here](../web/course/getting-started.html) from the supplied folder. It explains what
Julia Time is, what to install, and how to play; the mystery itself still requires the local
launcher below.

## 1. Extract the supplied archive

You will receive a **supplied archive** containing Julia Time. Extract it to a
folder you can find again, then open Terminal (Mac) or Command Prompt /
PowerShell (Windows) in that extracted folder. You do not need a source-code
account or a remote repository.

## 2. Install Julia 1.10.x manually

Julia Time needs Julia **1.10.x**, the long-term-support release, not the newest
Julia. The direct installers are:

- Windows 64-bit: [julia-1.10.12-win64.exe](https://julialang-s3.julialang.org/bin/winnt/x64/1.10/julia-1.10.12-win64.exe)
- Mac with Apple Silicon (Apple menu > About This Mac shows "Chip Apple M…"):
  [julia-1.10.12-macaarch64.dmg](https://julialang-s3.julialang.org/bin/mac/aarch64/1.10/julia-1.10.12-macaarch64.dmg)
- Mac with an Intel processor (About This Mac shows "Processor … Intel"):
  [julia-1.10.12-mac64.dmg](https://julialang-s3.julialang.org/bin/mac/x64/1.10/julia-1.10.12-mac64.dmg)
- Anything else, or a later 1.10.x: the [official Julia 1.10 LTS download page](https://julialang.org/downloads/manual-downloads/#long_term_support_release).

A newer Julia already installed (for example from juliaup or an earlier course) is
fine: the supplied launchers look at each Julia they find and use the 1.10 one.

On Windows, if the installer asks, choose **Install for me only**: that installs into
your own account and needs no administrator rights. If a university-managed computer
still blocks installers or double-clicked scripts, use a lab computer or ask IT to allow
Julia 1.10. Julia Time cannot run on a Chromebook, tablet, or phone.

- **Mac:** choose the Apple Silicon or Intel download for your computer, open
  the `.dmg`, and drag Julia to Applications.
- **Windows:** run the 64-bit installer. If it offers an **Add Julia to PATH**
  option, it is convenient but not required for the supplied double-click
  helpers: they also check the normal Julia 1.10 installation folder. Close and
  reopen a terminal if you choose the PATH option.
- **Linux:** use [`juliaup`](https://github.com/JuliaLang/juliaup) (`juliaup add 1.10`)
  or extract the official 1.10 tarball yourself. The supplied launch helper also
  checks PATH, the juliaup default install, and a plain 1.10 install under
  `~/.local` or `/opt`, so PATH is convenient but not required.

Check the version in the extracted Julia Time folder:

```text
julia --version
```

It must begin `julia version 1.10.`. If a Mac terminal cannot find `julia`,
use the Julia app's executable explicitly (adjust the app name if needed):

```text
/Applications/Julia-1.10.app/Contents/Resources/julia/bin/julia --version
```

## 3. Play: double-click one file (the setup runs itself the first time)

**Windows:** in the extracted folder, double-click `Play-Julia-Time-Windows`. The first
time, it runs the one-time setup below for you (several minutes), then opens the Case
Board. If Windows says it protected your PC, or asks about an unknown publisher, choose
**More info**, then **Run anyway** (or **Run**). To avoid that prompt, you can right-click
the downloaded ZIP before extracting it, choose Properties, tick **Unblock**, and click OK.

**Mac:** double-click `Play-Julia-Time-Mac.command`. The first time, it runs the one-time
setup below for you, then opens the Case Board. If macOS says it cannot verify the file,
click **Done**, open **System Settings > Privacy & Security**, scroll down, click
**Open Anyway** next to `Play-Julia-Time-Mac.command`, and double-click it again. If macOS asks
whether Terminal may access your Downloads folder, click **Allow**.

Keep that window open while you play. The rest of this section and section 4 are the
same steps typed by hand, for anyone who prefers a terminal or needs to recover.

## 3b. The one-time setup, step by step

From the extracted folder, run the command for your terminal. These settings cap Julia at four
threads and BLAS at one thread so the local game does not unexpectedly monopolise a shared laptop.

**Fastest Windows route:** in the extracted folder, double-click
`tools/setup/setup-windows.cmd`. It checks the folder, Julia version and local
setup, then leaves its window open so you can read the result. It does not
install Julia or change Windows settings. The Command Prompt block below does
the same thing if you prefer to see or type each command.

**Fastest Linux route:** in the extracted folder, run `chmod +x
tools/setup/launch-linux.sh` once, then run `tools/setup/launch-linux.sh`. It
checks the folder and Julia version, runs this same one-time setup command for
you if it has not already succeeded, then opens the Case Board. It does not
install Julia or change your system configuration. The terminal block below
does the same setup step if you prefer to see or type each command.

**Mac or Linux Terminal**

```text
JULIA_NUM_THREADS=4 OPENBLAS_NUM_THREADS=1 julia --startup-file=no --history-file=no --project=. check_setup.jl
```

**Windows Command Prompt**

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

This visibly downloads and precompiles packages for this project. Julia may
also keep its normal local download and compile cache outside the extracted
folder. It can take several minutes on the first run; the time depends on your
connection and computer. Do not close the terminal while it runs.

Success ends with:

```text
OK — Julia Time is ready
Next: open the Case Board with the matching command in docs/install.md.
```

The Windows helper `tools/setup/setup-windows.cmd` then adds `SETUP_COMPLETE - Julia Time is ready.`
If you started from `Play-Julia-Time-Windows` or `Play-Julia-Time-Mac.command`, the Case Board opens by
itself after this line; there is nothing more to type.

If it does not say `OK`, read the short `Next:` line first. If it still does
not work, send the final 10 terminal lines to the facilitator.

## If setup is not OK

Follow the first matching numbered repair named by the terminal's `Next:`
line:

1. Julia version is not 1.10.x. Return to the official LTS download page,
   install or select Julia 1.10.x manually, open a new terminal, then repeat
   the setup command.
2. `julia` is not found. Use the supplied Windows double-click helper first: it
   also checks the normal installer location without changing PATH. For a
   manually typed Windows command, close and reopen the terminal after installing
   Julia; on a Mac, use the explicit Julia app command shown above if needed.
3. Package download, precompile, or sandbox check failed. Check your internet
   connection and rerun the setup command. If it fails again, send the final
   10 terminal lines to the facilitator.

## 4. Start the mystery

Run the matching command again:

**Mac or Linux Terminal**

```text
JULIA_NUM_THREADS=4 OPENBLAS_NUM_THREADS=1 julia --startup-file=no --history-file=no --project=. run.jl
```

**Windows Command Prompt**

```text
set JULIA_NUM_THREADS=4
set OPENBLAS_NUM_THREADS=1
julia --startup-file=no --history-file=no --project=. run.jl
```

**Windows PowerShell**

```text
$env:JULIA_NUM_THREADS = "4"
$env:OPENBLAS_NUM_THREADS = "1"
julia --startup-file=no --history-file=no --project=. run.jl
```

The game opens only on this computer at `http://127.0.0.1:8000/course/index.html`.
That is the Case Board, where the Julia readiness check and personal investigation dashboard live.
Keep that terminal open while you play. Press Enter or Ctrl-C there when you are done.

The supplied Mac, Windows, and Linux launch helpers in `tools/setup/` run the
same local command after Julia is installed. They never install software or
change your computer's global Julia choice.

## Optional: make the Speed Lab use a different Python already on your computer

You do **not** need this for the mystery. Use it only when the optional Speed
Lab says NumPy is missing but you already have a different Python installation
that contains NumPy. Restart Julia Time with that interpreter's **full
executable path** selected; this does not install NumPy or change the Python
used anywhere else.

**Mac or Linux Terminal**

```text
JULIATIME_PYTHON=/full/path/to/python3 \
  JULIA_NUM_THREADS=4 OPENBLAS_NUM_THREADS=1 \
  julia --startup-file=no --history-file=no --project=. run.jl
```

For example, the path might be an interpreter in a virtual environment or a
Homebrew installation. Ask a facilitator if you do not know that path. Do not
guess and do not install anything during the mystery. The Speed Lab still
checks matching answers before it offers timing.

**Windows Command Prompt**

```text
set JULIATIME_PYTHON=C:\full\path\to\python.exe
set JULIA_NUM_THREADS=4
set OPENBLAS_NUM_THREADS=1
julia --startup-file=no --history-file=no --project=. run.jl
```
