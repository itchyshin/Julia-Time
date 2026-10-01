# Tutor guide: Step 1, Lesson 1, Find the jars

The lesson uses a practice notebook, made up for training. It is not the case, so nothing in it answers the case. The real notebook comes next, in Chapter 1 (the other half of Step 1).

## Before class
Students need the game open on their laptop. Test one laptop first. Give a one-minute intro: "You will check a lab report by typing tiny lines of code. Nobody is graded, and wrong lines are normal." Pairs: one types, one reads the screen aloud, and they swap each round. Plan about 40 minutes (the start screen says so).

## The lesson in three rounds
Each round has one idea, and each ends with a checkpoint line the student writes without help. There are 25 graded tasks, at about 1.5 minutes each. On the screen a "task" is one small step; a line of code is what the student types.

Round 1, names and functions (about 12 minutes). A name holds something. A function does a job on what is in its round brackets. Students count the springtail jars in logbook, the practice notebook. The small table practice_jars is the warm-up table, the same in every lesson. A curious student may open "Look closer" on the length step: a function can take two inputs, as in max(4, 7).

Round 2, rows by position (about 12 minutes). Square brackets pick one item, a range of items, or some rows, by place. The B05 jars are rows 7 to 12.

Round 3, pick rows with a rule (about 14 minutes). Round 3 starts with a single == on one jar (is jar 7 batch B05? true). Then a dot before == asks the question of every jar; Julia prints true as 1 and false as 0 in that list, and the screen says so before Run. A rule before the comma keeps the matching rows. A rule can also go inside a column's brackets, and sum then counts the true answers: the same line Chapter 1 asks for later. The last task finds the six B05 jars.

## Students who know R or Python
The screen has two switches, Show R and Show Python, both on at the start, and shows a note beside the worked lines. R users get code: `logbook$batch_id`, `logbook[1:3, ]`, and `filter(logbook, tray_id == "T-F")`. Python users get pandas and numpy lines: they count from 0 and Julia counts from 1, `iloc[0:3]` stops before 3 while Julia's `1:3` includes 3, and numpy already compares every item, so Julia needs the dot in `.==` where numpy needs none. A Python user who types `logbook.jar_id[0]` gets an error that says Julia counts from 1. Ask: "Where does the first item sit here?" Students who know neither language can turn both switches off, or ignore the notes.

## Three likely sticking points
Students write R habits. Several typed logbook$detected. The game says Julia does not use $. Add: "Look at the example above the editor."

Students type a column name alone, such as sum(detected). Julia does not know it, because a column belongs to its table. The game says so; ask: "Whose column is detected?"

Students misspell a column name, such as tray for tray_id or detcted. The error lists the real names. A typo such as `x` gets "Julia does not know the word x" and the names that do exist; it never says they misspelled a word they did not type. Ask them to read that list aloud, not to guess again.

Students put a comma inside the brackets of a list, like logbook.jar_id[7,12], where a plain list takes one position. Ask: "Does this have rows and columns, or only one row of items?" The game's message here once blamed the range, so read Julia's words together.

Students type a stray space or comma: a space inside .== (". =="), or a comma between the row numbers (3,4). The game now names these. Ask: "Is .== one sign or two?" and "How do we write rows 3 to 4 as a range?"

## When a correct line gets a "That works too" note
Some students count with `count(logbook.detected)`, use `nrow(logbook)`, or write `logbook.jar_id[end]`. The game accepts them and adds one sentence saying which way this lesson teaches. Praise the idea first ("that gives 12 too"), then let them run the taught line once so they know it for the next step. Only the round 3 last line asks for a `.==` rule on the batch, because that is the idea of the round: a `filter(...)` line gets a note that this step practises the dot rule, and you can show it after the lesson. Row numbers typed in place of a rule at that line are asked to try again, because the step is about the rule.

## What not to do
Do not type for them, even one character. Let them run it and look before you explain. Do not say "use the hint" as a first reply. Ask what they see.

## When to pause the room
After round 2, before the dot rule, take 60 seconds. Write [true, false, true] on the board and ask: "To ask 'is it B05?' about all 12 jars, do I ask once or twelve times?" Take two answers, then go on.

## After class
The students can now run a function on a list or a column, pick items by position and rows by a rule, and read an error and fix the line. The common mistake is leaving out the dot before ==. A plain == gives one answer, so it cannot pick rows. Ask each pair: "What did your line do?" Accept plain words. "It counted the jars that had springtails" is a good answer.
