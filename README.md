# Julia Time

![Itchy, Toto, Momo and Eddie around the Missing Fleas notebook](web/assets/lab-cast.png)

**The Case of the Missing Fleas** is a locally run browser game for learning
Julia. You write real Julia to investigate a simulated springtail mystery; the
screen shows what the code returned and what that result means for the case.

You are in the right place before you download anything. The game runs on your
own computer, so the Julia code in the investigation is real.

## Start here

You need a Windows, Mac, or Linux computer (not a Chromebook, tablet, or phone;
a lab computer is fine), plus three things:

1. a **Julia Time archive** from this repository's
   [Releases](https://github.com/itchyshin/Julia-Time/releases);
2. **Julia 1.10.x**, the long-term-support version (not the newest Julia);
3. an **internet connection for the first setup**.

You do not need a GitHub account or any terminal knowledge.
Do **not** install R, Python, NumPy, or a Julia package called `JuliaTime`; R,
Python, and NumPy are only for an optional comparison after the game.

### Three steps

1. **Download and extract.** [**Download Julia Time**](https://github.com/itchyshin/Julia-Time/releases/latest)
   and click the `Julia-Time-<version>.zip` file under *Assets*.
   - **Windows:** right-click the ZIP, choose **Extract All**, then open the inner
     `Julia-Time-<version>` folder (the one that contains `Play-Julia-Time-Windows`).
     Do not run the game from inside the ZIP.
   - **Mac:** double-click the ZIP (Safari may already have done this), then open the
     `Julia-Time-<version>` folder.
2. **Install Julia 1.10**, keeping the installer's suggested choices:
   - Windows 64-bit: [julia-1.10.12-win64.exe](https://julialang-s3.julialang.org/bin/winnt/x64/1.10/julia-1.10.12-win64.exe).
     If asked, choose **Install for me only** (no administrator rights needed).
   - Mac with Apple Silicon (Apple menu > **About This Mac** shows "Chip Apple M…"):
     [julia-1.10.12-macaarch64.dmg](https://julialang-s3.julialang.org/bin/mac/aarch64/1.10/julia-1.10.12-macaarch64.dmg);
     open it and drag Julia into Applications.
   - Mac with an Intel processor (**About This Mac** shows "Processor … Intel"):
     [julia-1.10.12-mac64.dmg](https://julialang-s3.julialang.org/bin/mac/x64/1.10/julia-1.10.12-mac64.dmg).
   - Linux: the [official Julia 1.10 LTS downloads](https://julialang.org/downloads/manual-downloads/#long_term_support_release).

   A newer Julia already on your computer is fine; Julia Time finds the 1.10 beside it.
3. **Double-click to play.**
   - **Windows:** `Play-Julia-Time-Windows`. If Windows says it protected your PC, choose
     **More info**, then **Run anyway** (or **Run**).
   - **Mac:** `Play-Julia-Time-Mac.command`. The first time, macOS says it cannot verify
     the file: click **Done**, open **System Settings > Privacy & Security**, click
     **Open Anyway**, then double-click it again. If asked about your Downloads folder,
     click **Allow**.
   - **Linux:** run `chmod +x tools/setup/launch-linux.sh` once, then
     `tools/setup/launch-linux.sh` whenever you want to play.

   The first start prepares Julia's packages (several minutes), then opens the game in
   your browser. Later starts take seconds. Keep the black window (Windows) or Terminal
   window (Mac) open while you play, and press Enter in it when you are done.

**If the game does not appear**, double-click the same file again: if Julia Time is
already running, it reopens the game. Still stuck? See
[the installation guide](docs/install.md) or the bundled
[Start Here](web/course/getting-started.html) page. The guide also covers the separate
helpers `tools/setup/setup-windows.cmd` and `tools/setup/launch-macos.command`.

## What happens when you play

The six connected chapters ask you to select records, group trays, connect two
lab sheets, plan a recheck, reason with a simulation, and compare stated
explanations. The code is the investigative move: a successful run returns
actual data, changes the evidence you can see, and explains both what it does
and what it does not establish.

After you launch the local lab, the Case Board is usually at
`http://127.0.0.1:8000/course/index.html`; if another program already uses that
address, the launcher picks the next free one (8001, 8002, …) and prints it. The
address works only on the computer running Julia Time; it is not a public website
or a link for someone else's machine.

The case data are simulated from a seeded generator. Your work is saved only
in your browser; there is no account, score, leaderboard, or remote server.

## For facilitators and contributors

Run the same one-time setup and launcher on your own computer. The local
sandbox runs player code in a separate Julia process with a five-second budget;
it is a teaching convenience, not a security boundary. See
[the playtest observer sheet](docs/playtest-observer-sheet.md) for the
no-rescue learner sessions. A printable [one-page observer sheet (PDF)](docs/playtest-observer-sheet.pdf)
is ready for the person observing; do not help the player through a sticking
point; record where their own next action became unclear.

## Licence

Julia Time, including its code, story text, illustrations, and simulated data,
is released under the [MIT License](LICENSE).
