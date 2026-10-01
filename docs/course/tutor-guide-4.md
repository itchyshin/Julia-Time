# Tutor guide: Lesson 4, Recheck fairly

Itchy, the lab head, wants a slow look at three of Eddie's five open jars. The jars are made up for practice; the screen says so. Students let the computer pick three at random, so every jar has the same chance. There are 14 graded lines at about 1.75 minutes each, so the lesson takes about 25 minutes (shown on the start card).

## Before class
- Each pair needs a laptop with Lesson 4 open. Check that the first screen loads.
- One-minute intro: "A lab head wants a slow look at three of five jars. You will let the computer pick by luck. One person types, one reads aloud. Swap after each round of the lesson."
- Work in pairs. The reader checks brackets and commas.

## The lesson in three rounds
1. Two inputs (about 9 min). A function can take two inputs with a comma between: first takes the list, then how many.
2. A named input (about 9 min). sample picks at random. After a semicolon (a comma works too), replace=false stops a jar being picked twice.
3. A fair pick (about 7 min). Each Run can give a different pick, so no one answer is right. Students check the right list, the right number, and no jar twice.

## Likely sticking points
Some pairs type the table name where the jar ids belong, open_jars instead of open_jars.jar_id. It can run and look right, so they think it worked; the reply says a whole table is not a list. The game now says a whole table is not a list and asks for one column. If a pair is still stuck, ask: "What are you picking from, the whole table or one column?"

Others put a comma before replace=false. (The game says a comma there is fine but the course writes a semicolon.) That works in Julia, and the game accepts it. This course writes a semicolon so a named input stands out; the Look closer on the second line of Round 2 says so, and the game adds "That works too" with the semicolon way after a pass. Do not call the comma wrong. If they type False or True with a capital, the game now says Julia writes true and false in small letters; ask them to read that line aloud.

Experienced students may pick with shuffle, or with randperm, instead of sample. That also passes, with a "That works too" note. Let them; ask what stops a jar coming twice.

The third is forgetting replace=false. A jar shows twice only on some runs, so a lucky pair sees nothing wrong. Ask: "Run it again. Can a jar be in the lab twice?" Julia's sample repeats unless you stop it, and R users expect the reverse. Python users know both: random.sample never repeats, np.random.choice does. Round 2 now says first that Julia puts each pick back, like a numbered ticket in a bag, so the first guess can be reasoned. The first sample screen has a short note for R and one for Python, shown after the run. The checkpoint in Round 2 runs each line 8 more times, so a pair may see a good result on screen and still be told a jar came twice on a later run. Tell them that is the game running it again, not a mistake in what they saw.

## What not to do
- Do not type for them, even one character.
- Do not explain first. Let the message teach.
- Do not tell them the answer line. Point at the screen.

## When to pause the room
After Round 2, stop everyone for 60 seconds. Ask: "Two pairs, run your line again. Same jars or different?" Name it: random means nobody chose.

## After class
Ask each pair: "What did your line do?" Listen for sample, the list, the number and replace=false in their own words. They should be able to pick at random, give two inputs then a named input, and check a random pick.

## Recall at the start of round 1 (changed)
Round 1 now opens with a typing task, not a three-choice quiz: the learner types Lesson 3's `merged = leftjoin(book_table, key_table, on=:shelf_id)` from memory. A
learner who stalls twice can press "Show me the line". Ask them to say aloud what each part does before the new idea starts.
