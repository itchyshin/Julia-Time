# Tutor guide: Lesson 5, Plain chance (28 minutes)

## Before class
Open Lesson 5 on each laptop. Pair people up: one types, one reads aloud, and they swap after each round of the lesson.

Tell the room: "This is practice data, made up for training. Julia deals cards by luck, over and over. We count how often luck alone gives 6 or more springtails cards out of eight. Wrong guesses cost nothing."

A springtails card is `true` and an empty card is `false`. The screen draws no cards; the words are the code. One word to keep straight: a "deal" is one go of the card game (eight cards, then a count). A "round" is a block of the lesson.

On the screens with a guess, a guess is optional and Run always works, with or without one. Any guess is fine.

By the end, students can make Julia deal random cards and count the springtails cards, compare all 1,000 counts at once with a dot, and find how often luck alone matches a result, as a share.

## The lesson in three rounds
There are 18 graded lines and 3 play boxes, a little over a minute each on average: about 28 minutes (shown on the start card).

Round 1, one batch by chance (5 lines, about 9 minutes). Students deal cards with rand(Bool, 8), count the springtails cards with sum, then write that line from memory.

Round 2, many deals at once (8 lines, about 12 minutes). The round starts with one small step, `[7 for _ in 1:3]`: do it 3 times, keep every result in a list, and the `_` is a name we never use. Then they make counts from a deal: `[sum(rand(Bool, 10)) for _ in 1:3]`, and change the 3 to 1000 (Toto's own list used eight cards, so his counts run from 0 to 8). Then they see Toto's 1,000 counts kept as pretend_counts, and use .>= to ask every deal if it reached the practice notebook's 6.

Round 3, a share of the deals (5 lines, about 7 minutes). They divide the yeses by the number of deals, then write the two-line answer from memory. It comes out at exactly 0.161 (161 of 1,000). Any name works for line 1 (`events`, `hits`, `big`); the prompt only suggests `events`. The first practice list is called `cards`. Other correct lines also pass: `mean(events)`, `count(events) / length(events)`, or a one-line version. If a line is right but not the lesson's way, the game passes it and adds "That works too" with the lesson's way. Let them keep their line.

## Notes for R and Python users
R users: `sample(c(TRUE, FALSE), 8, replace = TRUE)` is `rand(Bool, 8)`, and `>=` works on a whole list in R but needs the dot in Julia. Python users: `np.random.choice([True, False], 8)`, and numpy arrays compare without a dot while plain Python lists do not compare at all. Julia's 1:1000 includes 1000; Python's range(1000) stops at 999. Two switches in the bar, Show R and Show Python, both on to begin with, control the notes and the dictionary columns. Stay with one numpy idiom: `np.random.choice([True, False], n)`.

## Three likely sticking points
The first is small typing slips: a missing comma in rand(Bool 4), a missing closing bracket, True with a capital T, or pressing Run with the blank ___ untouched. Send them to the game's sentence first, then the punctuation.

The second is the dot. Students write >= on the whole list, or use .> when "at least" needs .>=. Ask what tells Julia to check every deal, and whether 6 counts. Nearly everyone makes this mistake, so let it happen.

The third is a number where a name belongs, such as 6 for seen_count or 1000 for length(pretend_counts). It gives the right answer today, so the game accepts it and says "That works too". It breaks with 2,000 deals, so ask if the line would still work then.

## What not to do
Do not type for them or point at where the fix goes. Let them run it first, then ask what they see. The "Worth remembering" line after a checkpoint is a note to keep, not a score.

Do not tell them what the real notebook will show. This lesson is practice; the chapter has its own numbers.

## When to pause the room
After Round 2, stop everyone for 60 seconds. Ask: "The computer made these 1,000 deals. What would it mean if 6 or more came up in about 1 deal in 10?" Take two answers, and do not say whether luck explains the jars.

## After class
Ask each pair: "What did your line do?" Accept plain words such as "it asked every deal if it was at least 6."
