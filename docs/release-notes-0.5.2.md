# Julia Time 0.5.2: your own data, packages, models and a speed lab

A student asked to try Julia Time on their own data. Now you can. Julia Time 0.5.2 adds an optional bonus stage,
Your own data, on the Case Board after the six steps. It also adds a speed lab.

## What it does

- Read a file by typing: Copy your CSV into the game's `data` folder, then read it with
  `data = CSV.read("data/yourfile.csv", DataFrame)`. The game reads it the way your line says. A Choose button is
  kept as a fallback. Your file stays on your computer and is forgotten when you close the game.
- Where is Julia looking? A first step shows the folder Julia reads from and the files in `data`.
- Packages. A step explains install once per computer, then `using` each time. Try `using Plots` and read the
  real message. The game has CSV, DataFrames, GLM and Statistics.
- A table check tells you how many rows and columns you have, what each column holds, and how many cells are
  empty. If a number column was read as text because of `NA`, it names the column and the fix, such as
  `missingstring="NA"`. It also notes comma decimals in a semicolon file.
- The same moves on your table: look at it, pick a column, pick rows by a rule, count, deal with empty cells,
  and compare two groups. The game fills in your own column names. Nothing is marked.
- Fit a line. `lm` fits a straight line. The step shows how to read the slope row and its p-value.
- Optional: fit counts. A Poisson `glm`, for a column of counts. Both models use GLM.jl.
- Say it. Write one sentence about what you found.
- Save my lines as a script. Download `my-analysis.jl`. It now reads your file with the same line you typed, or
  the exact line that matches the Choose button, so the saved script reads the file exactly as the game did.

The practice table (`starter_ponds.csv`) is SIMULATED: made by the game, not real counts. It has two empty cells on
purpose, so you meet missing values somewhere safe.

Limits: a .csv or .txt file, up to 5 MB, 50,000 rows and 100 columns.

## The speed lab

Six examples where Julia is fast, each written in Julia, R and Python. The game checks that the three give the same
answer, then times them on your computer. A language that is not installed is shown as not timed. You can also time
your own Julia code: it runs twice, and the lab shows the first run (which includes compiling) apart from the second.

## What is not in 0.5.2

Mixed models (MixedModels.jl) and DRM stay out of the game.

## How to install

As before: download the ZIP, install Julia 1.10 once, then double-click one launcher file. Steps are in
[the installation guide](https://github.com/itchyshin/Julia-Time/blob/main/docs/install.md). The first setup
downloads a few more packages than 0.5.1. If you already have 0.5.1, download 0.5.2 and use it instead; your place
in the course is kept in your browser.

## Tell us

Did your own file load? Did a message point you the wrong way?
[Tell us here](https://github.com/itchyshin/Julia-Time/issues/new/choose).
