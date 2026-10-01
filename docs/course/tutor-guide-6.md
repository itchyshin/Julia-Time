# Tutor guide: Lesson 6, Test the claim

The practice notebook (made up for training) shows springtails in 6 of 8 jars. Which of three guesses (Scarce, Even split, Plentiful) could give that? Students filter a small table with true-or-false rules. There are 19 graded lines and 3 play boxes, about a minute and a half each on average, so plan on 32 minutes (shown on the start card).

## Before class
Julia and the game are ready on every laptop. Tell the room: "A wrong line costs nothing. I will not type for you." Pairs work well: one types, one reads aloud, and they swap after each round of the lesson.

## The lesson in three rounds
Round 1, two rules for one range (6 challenges, about 10 minutes). A guess fits if 6 is inside its range, so each end gets its own rule. There is no Look closer here any more: the old one used .& before Round 2 taught it.

Round 2, both at once (8 challenges, about 12 minutes). The sign .& joins the two rules, so a row is true only when both hold. Two steps use one rule to pick from a single column, `guesses.story[rule]`, which Chapter 6's last task needs.

Round 3, brackets around each rule (5 challenges, about 9 minutes). Julia reads .& before the comparisons, so without brackets a line can work by luck with whole numbers and stop with an error with 0.5. Each rule goes in round brackets, then one line keeps the fitting rows, ending with the last checkpoint.

By the end a student can check a number against both ends of a range, join two rules with .&, and bracket each rule so Julia reads it right. The usual slip is leaving out the dot. In the three fix-the-line screens, students press Run first to see Julia's error, then repair the line. A plain <= or & works on one pair only; to ask every guess at once, write .<= and .&.

## Three likely sticking points
The first is the second rule pointed at the wrong end, guesses.upper .<= seen_count. It returns two rows, so students think they are right. Ask them to read the rule aloud as a sentence: is the top end at least the count? Either side of the sign is fine, so seen_count .<= guesses.upper and guesses.upper .>= seen_count are both right. The course writes the smaller number first so a range reads like a number line.

The second is a misspelled name such as seen_cont. The error can point at the wrong word, so have them match each word they typed to the table's headings. The table's first column is called story; in the game a row of it is a guess.

The third is the small panel under the table. It sometimes shows an earlier line, and students read it as a hint. Tell them to trust the task text. The "Worth remembering" line after a checkpoint is a note to keep, not a score.


## What not to do
Do not type for them, and do not explain before they try. When a line works, ask why. At most lines a line without brackets passes and the game says the lesson's way is brackets; at the last line the note does not show, because the three-named-line route is also valid. Other correct lines pass too (other names, `.>=`, `filter`); ask why they work.

Notes for R and Python users: R and pandas need no dot for `<=` on a column; Julia does. pandas cannot chain `lower <= x <= upper` on a column (it raises an error); Julia can chain with dots, and that passes here too with a "That works too" line. R does not need brackets around each rule in one line (`<=` binds before `&`); pandas does, like Julia. For table verbs the R notes use dplyr (`library(dplyr)` once, then `filter`). The notes and dictionary columns follow the Show R and Show Python switches.

## When to pause the room
After Round 2, stop everyone for a minute. Draw a number line with 6 on it and two guesses' ranges. Ask which ranges hold 6, and why both ends matter. Then go on.

## After class
Ask each pair what their line did. Listen for two questions asked of every row, keeping rows where both were true.

## Recall at the start of round 1 (changed)
Round 1 now opens with a typing task, not a three-choice quiz: the learner types Lesson 5's `events = pretend_counts .>= seen_count` from memory. A
learner who stalls twice can press "Show me the line". Ask them to say aloud what each part does before the new idea starts.
