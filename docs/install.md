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

Julia Time needs Julia **1.10.x**. Download the current long-term-support
release from the [official Julia 1.10 LTS download page](https://julialang.org/downloads/manual-downloads/#long-term-support-release).

- **Mac:** choose the Apple Silicon or Intel download for your computer, open
  the `.dmg`, and drag Julia to Applications.
- **Windows:** run the 64-bit installer. If it offers an **Add Julia to PATH**
  option, it is convenient but not required for the supplied double-click
  helpers: they also check the normal Julia 1.10 installation folder. Close and
  reopen a terminal if you choose the PATH option.

Check the version in the extracted Julia Time folder:

```text
julia --version
```

It must begin `julia version 1.10.`. If a Mac terminal cannot find `julia`,
use the Julia app's executable explicitly (adjust the app name if needed):

```text
/Applications/Julia-1.10.app/Contents/Resources/julia/bin/julia --version
```

## 3. Run the one-time setup

From the extracted folder, run the command for your terminal. These settings cap Julia at four
threads and BLAS at one thread so the local game does not unexpectedly monopolise a shared laptop.

**Fastest Windows route:** in the extracted folder, double-click
`tools/setup/setup-windows.cmd`. It checks the folder, Julia version and local
setup, then leaves its window open so you can read the result. It does not
install Julia or change Windows settings. The Command Prompt block below does
the same thing if you prefer to see or type each command.

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

The supplied Mac and Windows launch helpers in `tools/setup/` run the same
local command after Julia is installed. They never install software or change
your computer's global Julia choice.
