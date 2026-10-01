# Tutor guide: Step 2, Lesson 2, Count by tray

Students name the jars of one practice batch, count the jars with springtails on one tray, then count every tray at once with `groupby` and `combine`, and add a rate column. About 35 minutes (the start screen says so). The data are made up for training; nothing on screen answers the case.

## Before class
Each pair has one laptop with the game open on Lesson 2. Check it runs first. Room intro, 1 minute: "Today you count jars tray by tray on practice data, then let the computer count every tray at once. The game tells you when a line is close." One student types and one reads aloud. They swap every round.

## The lesson in four rounds
Round 1, "Name a tray, then count it", takes about 10 minutes (six graded tasks). Its first line is Lesson 1's line with a name added: `batch5 = ledger[ledger.batch_id .== "B05", :]`. `ledger` is the practice notebook of 15 jars (a new one, not Lesson 1's, so its B05 has nine jars). The game keeps `batch5`, the 9 jars of batch B05, ready for every later line. A name a student makes with `=` lasts for one Run only in this editor, which starts each Run fresh, so the name and its use go in the same Run. On a laptop, Julia keeps a name until you close it; say so out loud, so students do not leave thinking Julia forgets. `sum` and `length` count a named tray.

Round 2, "Count in one line", takes about 8 minutes (five graded tasks). A rule with `.==` cuts the column down to one tray inside the square brackets, so `sum` needs no name.

Round 3, "Count by group", takes about 10 minutes (eight graded tasks). This is the new teaching, in single pieces. First `groupby` alone: it splits a table into one group per tray, and Julia prints the first and the last group. Then `combine` with `nrow => :n` (the colon names a column; it is not the colon in `[rows, :]`). Then the pair `:detected => sum => :detected_n` alone, and both pairs together. The checkpoint asks for counts only: `n` and `detected_n` for each tray of `batch5`.

Round 4, "Add a rate column", takes about 7 minutes (four graded tasks). The rate is `detected_n ./ n`, a new column made with `counts.rate =`. The dot in `./` works item by item, like the dot in `.==`. The checkpoint rebuilds the counts table and adds the rate, from memory.

Lesson 2 is the one lesson with four ideas (Shinichi's decision). Budget about 1.5 minutes per graded task; the "Try anything" tasks are free.

By the end a student can give a result a name with `=`, count the jars with springtails on one tray in a single line, and count every tray at once.

## Likely sticking points
Students who know R or Python see a note beside the worked lines (two switches, Show R and Show Python, both on at the start). R users get dplyr code (`group_by`, `summarise`, `mutate`); Python users get pandas (`groupby(...).agg(...)`, `counts["rate"] = ...`). Julia differs in three ways worth saying aloud: a name lasts for one Run, not a whole session; a column is named with a colon, `:tray_id`, where pandas uses a string (the colon in `:tray_id` is not the colon in `[rows, :]`); pandas `.count()` counts non-missing values, so use `.sum()` for true; and division needs `./` where R and pandas divide item by item without a dot.

Students who know R type an arrow, `tray <- batch5[...]`. Say: "Look at what joins the name to the answer. Julia has one mark for that job."

The commonest slip in rounds 1 and 2 is a rule written with `==` and no dot, or with a single `=`. Say: "You are asking a question of every jar. Which mark asks?"

Some students write `sum(batch5.detected)`, get 5, and move on happy. Ask: "Whose jars did that count? Which tray?" A student who starts from `ledger` instead of `batch5` counts two batches. Ask: "Which batch is this step about?"

In rounds 3 and 4, the commonest slip is a missing colon: `nrow => n`, or `groupby(batch5, tray_id)`. The game says a column name needs a colon in front. Say: "Which of these words are columns? Columns get a colon here."

The second commonest is `/` where `./` is needed (round 4 has a blank for exactly this sign). Say: "We divide tray by tray. Which mark did we use for item by item?"

A student who ends the round 4 checkpoint on the `counts.rate = ...` line gets no table back. Ask: "What is the last line showing you?" The answer is the name, `counts`.

Experts may reach the same table another way (`transform`, `mean`). The game accepts any line that gives the right table, and adds "That works too" with the way the lesson teaches. It refuses a typed answer and a table not built with `groupby`.

Students who mix tables (a `practice_jars` rule on `batch5`) see: "The rule and the column must come from the same table." Ask: "Which table does each half of your line come from?"

## What not to do
Do not type for them, even one character. Point at the screen instead. Let them run the line and read the game's hint first. Do not explain `=>` beyond "what to count, then its new name"; the labels on the first round 3 line do that work.

## When to pause the room
After Round 2, stop everyone for 60 seconds. Ask: "You have counted one tray with one line. How many lines for nine trays?" Then say: "Round 3 counts all of them in one line."

## After class
Ask each pair one question: "What did your last line do?" Accept any plain answer that names the trays and says what was counted. Leave one question open: a table is only as good as the numbers typed into it. Lesson 3 checks a typed copy against the notebook.

## Recall at the start of round 1 (changed)
Round 1 now opens with a typing task, not a three-choice quiz: the learner types Lesson 1's `ledger[ledger.batch_id .== "B05", :]` from memory. A
learner who stalls twice can press "Show me the line". Ask them to say aloud what each part does before the new idea starts.
