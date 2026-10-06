# Observer guide: running a first Julia Time session

This guide goes with the one-page [observer sheet](playtest-observer-sheet.pdf) (also as [text](playtest-observer-sheet.md)). Read it once before your first session. It takes about five minutes, plus about ten to play Lesson 1 yourself.

You are testing the game, not the player. A player who gets stuck has found something to fix in the game. That is a useful result, not a failure.

## 1. Play Lesson 1 yourself first

Spend about ten minutes on the first eight tasks. Then you will know the words the sheet uses:

- **The Board** is the start page. Its main button says Start Lesson 1. Next to it is a link to an optional two-minute intro.
- **Lesson 1** is a practice lesson with a made-up notebook called **logbook**, a table of 12 jars. It is not the case, so nothing in it answers the case.
- **Task** numbers count inside a round. The top bar says, for example, "Task 2 of 8". Round 1 has eight tasks.
- **Task 3** is a Fix task. Julia shows an error on purpose, and the player reads it and fixes the line.
- **Look closer** is a small optional link. The first one is on task 2.
- **Show R and Show Python** are two switches at the top, both on at the start. Their notes ("In R", "In Python") appear under the worked line after Run.
- **Task 8** is the first checkpoint, an empty editor. After one missed Run it offers Hint 1, then Hint 2. After a second miss it offers Show a starter line.
- **The 5-second stop**: a run longer than 5 seconds is stopped, and the game says "Your code ran for more than 5 seconds, so Julia stopped it."

## 2. Give the player a clean start

The game saves progress in the browser, on the player's own computer, for the address of the game (for example 127.0.0.1 and its port). If the browser was used before, Lesson 1 may already be started, and the session will not show a first experience.

Check before every session: open the Board. If the button says **Start Lesson 1**, the start is clean. If it says **Continue: Lesson 1**, it is not.

What I tested, on a local game at port 9741, driven by Playwright (new browser contexts stand in for private windows):

| What I did | Board button afterwards |
| --- | --- |
| Opened the Board in a new browser context (it behaves like a private window), started Lesson 1, passed two tasks, then reopened the Board and Lesson 1 | Continue: Lesson 1, and Lesson 1 said "You stopped at Round 1, task 3." |
| Opened a second tab in the same browser context | Continue: Lesson 1 (progress is shared by the tabs) |
| Opened a different new browser context (a new private window) | Start Lesson 1 (clean) |
| Cleared the saved data for the game's address, then reopened | Start Lesson 1 (clean) |
| Started Lesson 1 under 127.0.0.1, then opened the same game as localhost | no saved progress (a different address has its own progress); 127.0.0.1 still showed it |

So a clean start is any of these: a new private window, a new browser profile, or clearing the site data for the game's address. A private window is the easiest. Closing it normally removes the saved progress (I did not test this in a real browser). I did not test every browser's menus; use your browser's own settings to clear site data for the game's address only.

## 3. When the player asks for help

You may say only three things:

- "What would you try?"
- "What do you expect it to do?"
- "I am not able to help during the session; we can talk after."

Write the question down in the "Player's words or action" column. Do not answer it, even with a nod or a pointing finger.

If the player is truly stuck, note the clock time and wait 2 minutes. Then stop the session. Record on the sheet which screen or task it was, what they expected, and where their own next action became unclear. Then you can talk.

## 4. What counts as rescue

Rescue (do not do these):

- Typing for the player, even one character.
- Naming a button, or saying "look at the example above the editor".
- Explaining Julia, a word on the screen, or an error message.
- Saying a line is right or wrong before the game says so.
- Pointing at the screen, or letting your face show the answer.

Not rescue (let the player use these, and record each use):

- The game's own Hint 1, Hint 2 and Show a starter line.
- Look closer.
- The Show R and Show Python notes.
- Error messages and the game's feedback after Run.
- Reset, and the optional two-minute intro on the Board.
- On Lesson 1's start screen there is an option "I know R or Python: try this lesson's checkpoints". If the player picks it, note that on the sheet.

The tutor guides in `docs/course/` are for teaching a class. Do not use them to teach during an observation.

## 5. Ending the session, and Part 2

Stop at 15 minutes or when Lesson 1 finishes, whichever comes first. Then ask the three questions on the sheet and write down the player's own words.

Part 2 of the sheet (Your own data, and the speed lab) is a separate session. Both are meant for after the six steps, which is about 4 hours of play, and the player needs a CSV file of their own for the first. Do not try to reach them in a 15-minute session.

## 6. After the session

Fill in the verdict on the sheet: clear if the player ran a line and fixed an error unaided, unclear if their own next action stalled for more than 2 minutes (write which task).

Return the finished sheet to the person who asked you to observe. For project feedback, open an issue at <https://github.com/itchyshin/Julia-Time/issues>. Leave out names and personal details.
