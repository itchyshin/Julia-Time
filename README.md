# Julia Time

**Learn Julia by solving a made-up lab mystery. You write real Julia code on your own computer, with R and Python notes beside the code.**

Julia Time is a free game for graduate students and researchers who want to learn Julia. You do
not need to know how to code. It runs on your own computer, in your browser.

[**Download Julia Time**](https://github.com/itchyshin/Julia-Time/releases/latest) ·
[Watch the trailer (1:49)](https://itchyshin.github.io/Julia-Time/trailer-0.5.4.mp4) ·
[See the webpage](https://itchyshin.github.io/Julia-Time/)

![Itchy, Toto, Momo and Eddie around the Missing Fleas notebook](web/assets/lab-cast.png)

In *The Case of the Missing Fleas*, Toto's report says the lab's springtails, tiny relatives of
snow fleas, are dying out. The notebook may say otherwise. You write real Julia to find out. The
screen shows what your code returned and what that means for the case.

In short: download and unzip Julia Time, install Julia 1.10, then double-click to play.
The steps below say what to click on each system.

## Start here

You need a Windows, Mac, or Linux computer (not a Chromebook, tablet, or phone;
a lab computer is fine), plus three things:

1. a **Julia Time ZIP file** from this repository's
   [Releases](https://github.com/itchyshin/Julia-Time/releases);
2. **Julia 1.10.x**, the long-term-support version (not the newest Julia);
3. an **internet connection for the first setup**.

You do not need a GitHub account. On Windows and Mac you do not need to use a terminal.
Julia Time and Julia together need about 1 GB of disk.

### Three steps

1. **Download and extract.** [**Download Julia Time**](https://github.com/itchyshin/Julia-Time/releases/latest).
   On the Releases page click `Julia-Time-<version>.zip` under *Assets*, not "Source code (zip)".
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

   The first start prepares Julia's packages (usually a few minutes on a fast connection),
   then opens the game in your browser. Later starts take seconds. Keep the black window (Windows) or Terminal
   window (Mac, Linux) open while you play, and press Enter in it when you are done.

**If the game does not appear**, double-click the same file again: if Julia Time is
already running, it reopens the game. Still stuck? See
[the installation guide](docs/install.md) or, in the extracted folder, open
`web/course/getting-started.html`. The guide also covers the separate
helpers `tools/setup/setup-windows.cmd` and `tools/setup/launch-macos.command`.

## What happens when you play

The game has six steps. Each step has a short practice lesson, then a chapter where you use the
same move on the real case.

1. Pick rows from a table
2. Count by group
3. Join two tables
4. Plan a fair recheck
5. Simulate chance
6. Test the claim

The whole game is planned to take about 4 hours. You can stop and carry on later, and your
progress is saved in your browser. The first lesson is planned at about 40 minutes.

A run that works shows you what your code really returned and what that means for the case.
R and Python notes sit beside the code, and each lesson has a short table showing each Julia
move beside the same move in R and Python. The case data are simulated, and the screen says so.
There is no account, score or leaderboard.

## Optional extras

Both are on the Case Board, the game's home screen: a "Bonus: your own data" card and a "The
speed lab" entry.

- Your own data. Copy a CSV into the game's `data` folder and read it by typing `CSV.read`. The
  game checks the table (rows, columns, empty cells), then you repeat the same moves on it and
  fit a straight line with `lm`. An optional Poisson `glm` is there for counts. You can download
  your lines as `my-analysis.jl`, a script that reads your file the way the game did. Your file
  stays on your computer. The file can be `.csv` or `.txt`, up to 5 MB, 50,000 rows and 100
  columns. If you have no file, use the practice table `data/starter_ponds.csv`. It is simulated.
- The speed lab. Six small calculations written in Julia, R and Python. The game checks that
  the three give the same answer, then times them on your computer. A language that is not
  installed is shown as not timed. You can also time your own Julia code. R and Python are only
  needed for the speed lab.

## Latest release

Latest: v0.5.4, 3 October 2026 ([release](https://github.com/itchyshin/Julia-Time/releases/tag/v0.5.4);
notes: [docs/release-notes-0.5.4.md](docs/release-notes-0.5.4.md)). On Windows use 0.5.3 or later.

## Tested on

Before v0.5.4 was released, an automated test installed Julia Time from scratch on Windows and
on macOS and played the first move. All seven of those checks passed
([details](https://github.com/itchyshin/Julia-Time/actions/runs/37146987979)). A larger automated
test set did not finish on those machines, so it is not claimed. We did not test Linux this way,
and the checks stop after the first move. Tell us if anything breaks.

## For facilitators and contributors

- **Tutor guides**, one per step: [1](docs/course/tutor-guide-1.md),
  [2](docs/course/tutor-guide-2.md), [3](docs/course/tutor-guide-3.md),
  [4](docs/course/tutor-guide-4.md), [5](docs/course/tutor-guide-5.md),
  [6](docs/course/tutor-guide-6.md), and [Your own data](docs/course/tutor-guide-own.md).
- **Playtest observer sheet** for no-rescue learner sessions:
  [text](docs/playtest-observer-sheet.md) or a printable
  [one-page observer sheet (PDF)](docs/playtest-observer-sheet.pdf). Read the [observer guide (how to run a first session)](docs/playtest-observer-guide.md) first. Do not help the player through a sticking
  point; record where their own next action became unclear.
- **The sandbox** runs player code in a separate Julia process with a five-second budget. A run
  that does not finish is stopped by ending its process, and since 0.5.4 a spare Julia is started
  in the background so the next move is quicker. It is a teaching convenience, not a security
  boundary.
- **Tests**, from the Julia Time folder:
  `julia --project=. -e 'using Pkg; Pkg.test()'` and `node --test test/*.test.cjs`. Set
  `JULIATIME_SKIP_R=1` for the Julia tests if R is not installed.

## Tell us what to improve

Julia Time is new. Tell us what to make better: a lesson, a message, the target range, even the
webpage or the trailer. [Make a request](https://github.com/itchyshin/Julia-Time/issues/new/choose)
or [see what others asked](https://github.com/itchyshin/Julia-Time/issues).

## Cite

Please cite Julia Time as in [CITATION.cff](CITATION.cff). GitHub's "Cite this repository"
button reads that file.

## Licence and credits

Julia Time, including its code, story text, illustrations and simulated data, is released under
the [MIT License](LICENSE). Made by Shinichi Nakagawa's lab, University of Alberta.

Trailer music: "Wholesome" by Kevin MacLeod ([incompetech.com](https://incompetech.com)),
licensed under [Creative Commons: By Attribution 4.0](https://creativecommons.org/licenses/by/4.0/);
edited (shortened and mixed under the voice). Trailer voice: AI-generated (Google Gemini, voice
Achernar). Julia Time is an independent project, not affiliated with the Julia project.
