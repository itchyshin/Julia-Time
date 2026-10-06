# Julia Time playtest observer sheet: first session in Lesson 1

10 to 15 minutes, no-rescue session. This sheet tests the game, not the player. A first session lands in Lesson 1, a practice notebook called logbook that is made up for training. It is not the case, so record nothing about the case. Tell the player what is recorded (this sheet, no names) and that they can stop at any time. Ask permission before any recording. Guide: docs/playtest-observer-guide.md.

## Before the player arrives

- Date:
- Observer:
- Player id (no names):
- Game version (the ZIP name, Julia-Time-...):
- Julia version (`julia --version`):
- System: `macOS` / `Windows` / `Linux`
- Started from: `launcher` / `terminal`
- Player type: `new coder` / `R or Python user` / `pair`
- Browser and start time:

Setup: game running, browser open on the Case Board, Lesson 1 not started (the button says Start Lesson 1, not Continue).

Say only:

> “Please play the game without help. If you get stuck, say aloud what you expected to happen. I am testing the game, not you, so I will not teach or point things out.”

Do not demonstrate code, name a button, or explain Julia while the player is deciding what to do. On-screen help is not rescue: let the player use Hint, Look closer, the Show R and Show Python notes, error messages and the optional intro, and record each use. If asked for help, say only “What would you try?” and write the question down. If the player is truly stuck, note the time and wait 2 minutes. Then stop the session and record where their own next action became unclear. Stop at 15 minutes or when Lesson 1 finishes.

## Record these moments

| Moment | What to record | Clock time | Player’s words or action |
| --- | --- | --- | --- |
| Start to first Run | Minutes from Start Lesson 1 on the Board to the first Run. Did they watch the optional two-minute intro? | | |
| First line passes | When a green message shows and Next opens. Was the line typed, changed, or already in the editor? | | |
| First error | What the message said and what the player did next. Task 3 shows an error on purpose. | | |
| Hint or Look closer | First use. Look closer starts at task 2. Hints and Show a starter line appear only after a missed Run at a checkpoint (the first is task 8). | | |
| Show R / Show Python | Did they read the notes, switch one off, or ignore them? | | |
| Confusion | Any moment of confusion, in their own words. | | |
| 5-second stop | If a run was stopped (“ran for more than 5 seconds”), what did they do next? | | |

## Checks that can be seen in Lesson 1

Mark **observed**, not inferred.

- [ ] Types or edits a line without help.
- [ ] Reads an error message, aloud or in their own words.
- [ ] Fixes the line after an error and passes.
- [ ] Says in their own words what a result shows.

What the player says they will do next:

## If the player stops or asks for help

- Time and screen or task:
- What they expected:
- What was missing, confusing, or too much:
- Did a visible hint, label, or error message resolve it? `yes` / `no`

## Part 2 (optional, a separate session): Your own data and the speed lab

Use it only with a player who has finished the six steps, about 4 hours of play.

- Copies their CSV into the game’s data folder unaided: `yes` / `no` / `not reached`
- Types the CSV.read line unaided: `yes` / `no` / `not reached`
- What they say about the speed lab:

## Ask only after play

1. What did your last line do?
2. What was the most confusing moment?
3. Would you continue, and why?

## Observer verdict

- **Clear / unclear**: Clear if the player ran a line and fixed an error unaided; unclear if their own next action stalled for more than 2 minutes (write which task):
- One repair to make before the next player:
- Evidence retained (notes or recording location, with consent if recorded):
- Return the sheet to the person who asked you to observe. Project feedback: open an issue at github.com/itchyshin/Julia-Time/issues (no names).
