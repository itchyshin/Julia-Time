# Tutor guide: Step 3, Lesson 3, Compare records

Students work on a made-up practice check: five shelves, the practice notebook, and a computer copy of its counts. They compare two columns of a table, pick from a third column with the answers, and join two tables. There are 16 graded tasks at about 1.5 minutes each, so about 30 minutes with the Try anything tasks (the start screen says so). The practice data give nothing away about the case.

## Before class
Check that Lesson 3 loads on each pair's laptop. Give a one-minute intro: "Someone typed a number wrong. You will find where, with short lines of Julia. You cannot break anything." One types, one reads aloud, and they swap each round.

## The three rounds
Round 1, columns in the same order (about 9 minutes). Every line is written `desk.keyed[4]`, table first, then a dot, then the column, as in Lessons 1 and 2. The 4th item of every column is the same shelf. A question such as `desk.logged .== 2` gives one true or false for each shelf, and those answers can pick items from a column lined up with it.

Round 2, the opposite question (about 9 minutes). The sign `.!=` asks "is it different?" for every shelf at once. The checkpoint picks a note from a third column, `form_desk.entry`.

Round 3, two tables, one shared column (about 11 minutes). `leftjoin` puts two tables side by side and matches their rows on a shared column, `on=:shelf_id`. The lesson says `on=` is a named input (its name, `=`, then the value); Lesson 4 says more. The rows may come back in any order, and no line depends on it. The checkpoint joins, then keeps only the rows where two columns differ.

## What students can do at the end
They can compare two columns item by item. They can use true and false answers to pick from another column. They can join two tables on a shared column and keep the rows that differ.

## Students who know R or Python
The screen shows notes beside the worked lines, for R and for Python (two switches, both on at the start). R users get `desk$logged == 2` (no dot needed in R) and `left_join(book_table, key_table, by = "shelf_id")` (after `library(dplyr)`; Julia says `on=`, not `by=`). Python users get `desk.logged == 2` (numpy and pandas already compare every item, so Julia's dot does the same job as broadcasting in numpy), `desk.keyed.iloc[3]` (Julia counts from 1) and `pd.merge(..., how="left")`. Say once that `on=:shelf_id` has a colon where R and Python use a string.

## Where students stick
In Round 1, students write `desk.logged == 2` with no dot and get one answer. The message says to add the dot. Ask: "How many answers do you want?"

In Round 2, `.=!` is typed for `.!=`. Have them read their symbol aloud, one character at a time. A `!=` with no dot gets its own message: ask what the dot did in Round 1. The last two checkpoint questions ask for a list of one item, so `only(...)` gives the item itself. It passes, with a "That works too" note.

In Round 3, students forget the colon in `on=:shelf_id`, write `by=` as in R, or name a column only one table has. The game names each of these. Point them at the two table headings on the left: which column do both have? At the checkpoint, they may join in the other order. That gives the same row with the columns swapped, and the lesson asks for `book_table` first. If they filter with `!=` and no dot, the message asks for a rule for each row.

## The common mistake
The end screen names this one: leaving the dot off `!=` or `==`, which gives one answer for the whole list, not one for each shelf. Say it once, when it happens. A related slip is a single `=` to ask "is it the same?". One `=` only saves an answer. Two, `==`, ask the question.

## When a correct line passes with a note
Other correct lines pass: `filter(r -> r.logged != r.keyed, merged)`, `desk.keyed .!= desk.logged` written the other way round, bare names such as `keyed` (they work here, but only because this lesson loads them; on the student's own data a column needs its table), or a name of their own for the joined table. When the way differs from the lesson's, the screen says "That works too" and names the lesson's way. Praise the line. Do not ask them to retype it.

## What not to do
Do not type for them, even one character. Do not explain before they try. Do not point at the answer. Ask what the red or yellow message says.

## When to pause the room
After Round 2, stop everyone for 60 seconds. Ask: "The notebook says 2 and the computer says 22. What does the note say for that shelf?" Take two replies.

## After class
Ask each pair: "What did your line do?" Accept plain words like "it joined the two tables and kept the row that was different".

## Recall at the start of round 1 (changed)
Round 1 now opens with a typing task, not a three-choice quiz: the learner types Lesson 2's `counts.rate = counts.detected_n ./ counts.n` from memory. A
learner who stalls twice can press "Show me the line". Ask them to say aloud what each part does before the new idea starts.
