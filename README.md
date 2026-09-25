# Julia Time

![Itchy, Toto, Momo and Eddie around the Missing Fleas notebook](web/assets/lab-cast.png)

**The Case of the Missing Fleas** is a locally run browser game for learning
Julia. You write real Julia to investigate a simulated water-flea mystery; the
screen shows what the code returned and what that result means for the case.

You are in the right place before you download anything. This repository is the
public doorway; the game itself runs privately on the learner's own computer so
that the Julia code in the investigation is real.

## Start here — before you download

[**Download Julia Time**](https://github.com/itchyshin/Julia-Time/releases/latest)

Download the ZIP from the release page, then follow the four steps below. You do not need to clone this repository, create a GitHub account, or
understand a terminal before downloading.

You need only three things:

1. a **Julia Time archive** downloaded from this repository's
   [Releases](https://github.com/itchyshin/Julia-Time/releases);
2. **Julia 1.10.x**, the long-term-support version (not the newest Julia), installed once;
3. an **internet connection for the first setup**, while Julia downloads this
   folder's declared packages.

Do **not** install R, Python, NumPy, a Julia package called `JuliaTime`, or a
GitHub account to play the mystery. R, Python, and NumPy belong only to a
separate optional comparison laboratory after the game.

### Download, install, play

1. **Download and extract.** On the release page, click the `Julia-Time-<version>.zip`
   file under *Assets*.
   - **Windows:** right-click the ZIP and choose **Extract All**. Windows makes a folder
     inside a folder: open the inner `Julia-Time-<version>` folder, the one that contains
     `Play-Julia-Time-Windows`. Do not run the game from inside the ZIP.
   - **Mac:** double-click the ZIP (Safari may already have done this), then open the
     `Julia-Time-<version>` folder.
2. **Install Julia 1.10** and keep the installer's suggested choices:
   - Windows 64-bit: [julia-1.10.12-win64.exe](https://julialang-s3.julialang.org/bin/winnt/x64/1.10/julia-1.10.12-win64.exe)
   - Mac with Apple Silicon (Apple menu > **About This Mac** shows "Chip Apple M…"):
     [julia-1.10.12-macaarch64.dmg](https://julialang-s3.julialang.org/bin/mac/aarch64/1.10/julia-1.10.12-macaarch64.dmg);
     open it and drag Julia into Applications.
   - Mac with an Intel processor (**About This Mac** shows "Processor … Intel"):
     [julia-1.10.12-mac64.dmg](https://julialang-s3.julialang.org/bin/mac/x64/1.10/julia-1.10.12-mac64.dmg)
   - Linux, or a later 1.10.x: the
     [official Julia 1.10 LTS downloads](https://julialang.org/downloads/manual-downloads/#long_term_support_release).

   A newer Julia already on your computer is fine: Julia Time finds the 1.10 beside it.
   If the Windows installer asks, choose **Install for me only**; that needs no
   administrator rights. Julia Time cannot run on a Chromebook, tablet, or phone; use a
   Windows, Mac, or Linux computer (a lab computer is fine).
3. **Play: double-click one file** in the extracted folder.
   - **Windows:** double-click `Play-Julia-Time-Windows`. If Windows says it protected
     your PC, or asks about an unknown publisher, choose **More info**, then **Run anyway**
     (or **Run**).
   - **Mac:** double-click `Play-Julia-Time-Mac.command`. If macOS says it cannot verify
     the file, click **Done**, open **System Settings > Privacy & Security**, scroll down,
     click **Open Anyway** next to `Play-Julia-Time-Mac.command`, then double-click it again.
     If asked whether Terminal may access your Downloads folder, click **Allow**.
   - **Linux:** run `chmod +x tools/setup/launch-linux.sh` once, then run
     `tools/setup/launch-linux.sh` whenever you want to play.

   The first time, it prepares this folder's Julia packages (several minutes, needs
   internet), then opens the Case Board in your browser. Later starts take seconds.
4. **Keep the black window (Windows) or Terminal window (Mac) open while you play.** It
   runs the game on **your own computer**. Press Enter in that window when you are done.

The earlier helpers still work: on Windows, `tools/setup/setup-windows.cmd` (one-time
setup) and `tools/setup/launch-windows.cmd`; on a Mac, `tools/setup/launch-macos.command`.
The detailed platform-specific commands and recovery steps are in
[the installation guide](docs/install.md). The bundled visual guide opens from
your downloaded folder as [Start Here](web/course/getting-started.html).

## What happens when you play

The six connected chapters ask you to select records, group trays, connect two
lab sheets, plan a recheck, reason with a simulation, and compare stated
explanations. The code is the investigative move: a successful run returns
actual data, changes the evidence you can see, and explains both what it does
and what it does not establish.

After you launch the local lab, the Case Board is at
`http://127.0.0.1:8000/course/index.html`. That address works only on the
computer running Julia Time; it is not a public website or a link for someone
else's machine.

The case data are simulated from a seeded generator. Your work is saved only
in your browser; there is no account, score, leaderboard, or remote server.

## For facilitators and contributors

Run the same one-time setup and launcher on your own computer. The local
sandbox runs player code in a separate Julia process with a five-second budget;
it is a teaching convenience, not a security boundary. See
[the playtest observer sheet](docs/playtest-observer-sheet.md) for the
no-rescue learner sessions. A printable [one-page observer sheet (PDF)](docs/playtest-observer-sheet.pdf)
is ready for the person observing; do not help the player through a sticking
point—record where their own next action became unclear.

## Licence

Julia Time, including its code, story text, illustrations, and simulated data,
is released under the [MIT License](LICENSE).
