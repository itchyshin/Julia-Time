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

Download the ZIP from the release page, extract it, then return to these three
steps. You do not need to clone this repository, create a GitHub account, or
understand a terminal before downloading.

You need only three things:

1. a **Julia Time archive** downloaded from this repository's
   [Releases](https://github.com/itchyshin/Julia-Time/releases);
2. **Julia 1.10.x**, installed once from the
   [official Julia download page](https://julialang.org/downloads/manual-downloads/#long-term-support-release);
3. an **internet connection for the first setup**, while Julia downloads this
   folder's declared packages.

Do **not** install R, Python, NumPy, a Julia package called `JuliaTime`, or a
GitHub account to play the mystery. R, Python, and NumPy belong only to a
separate optional comparison laboratory after the game.

### Download, install, play

1. Download and extract the Julia Time archive. Keep the extracted `Julia-Time` folder
   together; do not run the game from inside the ZIP.
2. Install Julia 1.10.x.
3. **Windows:** double-click `tools/setup/setup-windows.cmd` once. When it
   says `SETUP_COMPLETE`, double-click `tools/setup/launch-windows.cmd` every
   time you want to play.
4. **Mac:** open Terminal in the extracted folder, run
   `julia --project=. check_setup.jl` once, then double-click
   `tools/setup/launch-macos.command` whenever you want to play.
5. **Linux:** run `chmod +x tools/setup/launch-linux.sh` once, then run
   `tools/setup/launch-linux.sh` whenever you want to play; it runs the
   one-time setup for you the first time.
6. Keep the launcher terminal open. It opens the Case Board in your browser on
   **your own computer**.

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
no-rescue learner sessions. A printable [one-page observer sheet (PDF)](output/pdf/playtest-observer-sheet.pdf)
is ready for the person observing; do not help the player through a sticking
point—record where their own next action became unclear.

## Licence

Julia Time, including its code, story text, illustrations, and simulated data,
is released under the [MIT License](LICENSE).
