# Tutor guide: Your own data (optional bonus stage)

This stage comes after the six steps. A student runs the same few moves on a table from their own research and ends with one sentence about what they found. The point is transfer: the moves work on data the game did not write. Plan about 30 minutes; with the new steps, allow a little more. Nothing is marked.

## What the stage is
The student copies a CSV from their laptop into the game's `data` folder, then reads it by typing one line. The game holds it as `data` in the code box. Students with no file use the starter table, `starter_ponds.csv`, which is already in that folder. It is a made-up table of 60 ponds, labelled SIMULATED on screen. The Choose file button is kept as a fallback if typing the read fails.

There are twelve short steps:
1. Where is Julia looking? `pwd()` and `readdir("data")`. Is the file there?
2. Packages: install once per computer, load every time. Run `using CSV, DataFrames, GLM`, then try `using Plots` and read the real message. Plots is not in the game.
3. Read the table: `data = CSV.read("data/starter_ponds.csv", DataFrame)`. For their own file, they change the name.
4. Look at what loaded: `size(data)` and `first(data, 5)`.
5. Pick one column.
6. Pick rows by a rule, such as one site.
7. Count the rows that pass a rule, and what share that is.
8. Meet missing values, and handle them.
9. Compare two groups.
10. Fit a line: `lm(@formula(y ~ x), data)`. Read the slope row and its p-value.
11. Optional: fit counts with a Poisson `glm`. Only for a column of counts.
12. Say it: one sentence, free text, kept on the end screen.

The first three steps run without a table. A step passes when the code runs. There is no single right answer. Names in curly brackets in a starting line are filled in by the game with the student's own column names.

The saved script reads the file with the same line the student typed (or the exact line that matches the Choose button). Run on their own computer, it reads the file exactly as the game did. In their own Julia the file must sit in the folder that `pwd()` shows, or they give the full path.

## The file never leaves the laptop
The file never leaves the student's laptop. The game running on that same computer reads it, which keeps it in memory only and forgets it when the game closes. Nothing is written to disk or sent anywhere. Say this out loud before class, because some students hold data that is not theirs to share. If a student is unsure whether their data may be used, they use the starter table.

## A file will not load
Read the message on screen together first. Then check these, in order.

Not a CSV. A spreadsheet saved as .xlsx will not load. In Excel or Sheets choose Save as, then CSV. Open the CSV in a plain text editor: you should see commas between values.

File not in `data/`. The most common slip. The reply shows the real `pwd()` and the files in `data/`. The student copies the file there and checks the name and the `.csv` ending.

Too big. The game accepts files up to 5 MB and 50,000 rows. For a bigger file, keep a slice: the first few thousand rows, or one site. Ask the student which columns their question needs and save only those.

Spaces in column names. A name like `water temp` is allowed, but it is awkward to type. The game fills in the name for the starter lines. In a model formula the game uses `Term(Symbol("water temp"))`. The simplest fix is to rename the column in the file, for example `water_temp`.

Numbers read as text. If a number column shows as text, there is usually a stray word in it, such as `n/a`, `<5` or `3,5` with a decimal comma. Look at the column in step 5. The table check names the column and the fix: add `missingstring="NA"` to the read line, for example `CSV.read("data/f.csv", DataFrame; missingstring="NA")`. For a decimal comma in a semicolon file, add `delim=';', decimal=','`.

Missing values. Empty cells are normal. They show as `missing`, and a sum or mean of a column that has one gives `missing`. This is the lesson of step 8, so do not remove them for the student: let them see it first, then use `dropmissing` or `skipmissing`.

## Other slips
Using a package the game does not have. `using Plots` gives a "package not found" message. That is on purpose, so students see what the message looks like. The game has CSV, DataFrames, GLM and Statistics. On their own computer they install the missing one once with `using Pkg; Pkg.add("Plots")`.

`Pkg.add` does nothing here. The game does not run `Pkg.add`, `Pkg.rm`, `Pkg.update` or `Pkg.instantiate`, because it has already installed its packages. It says so. Tell them to run it once at the `julia>` prompt on their own computer.

A model on a text column. `lm` needs a number column for the outcome. Ask which column holds the numbers.

## What not to do
Do not type for them, even one character. Do not pick their research question. Ask: "Which column answers your question?" and let them choose.

## Students who know R or Python
Each step has a note with the R (dplyr) and Python (pandas) line. Both languages skip gaps in some functions by default or by a flag; Julia asks you to say so with `skipmissing`. This is the difference that bites most here.

## After class
The students can now read a file, look at it, pick columns and rows, count, handle missing values compare two groups and fit a line. Ask each pair for their sentence from step 7. A good one names the two groups, gives two numbers, and says what to check next, for example "Shaded ponds were cooler on average than open ponds; I would check whether the sites differ."
