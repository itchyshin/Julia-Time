# playtest-eyes

A real-browser "eyes" tool for an AI student playing Julia Time. Where the earlier text-only
persona harness (`docs/dev-log/playtest/2026-09-24-persona-harness/jt.cjs`) re-implements each
page's rendering in Node and so never sees layout, button clutter, disabled/pre-filled boxes, or
leftover saved progress, this tool drives an actual headless Chromium page with Playwright and
hands the student a screenshot after every action.

One persona = one background daemon holding one persistent headless Chromium page (1280x900).
Short-lived CLI commands talk to that daemon over a local HTTP port recorded in
`$EYES_HOME/<persona>/daemon.json`, so typed code, clicks, and the page's live WebSocket
connection to the Julia lab survive across separate `node eyes.cjs ...` invocations.

## Setup (one time)

```
cd tools/playtest-eyes
npm install   # already run once; installs playwright@1.60.0 into node_modules/ here only
```

Playwright resolves the already-cached Chromium binary under `~/Library/Caches/ms-playwright` — no
browser download happens.

## Running a Julia Time server

Use a port in **9600-9699 only**. Never touch port 8000.

```
cd <julia-time worktree>
JULIATIME_NO_BROWSER=1 JULIA_NUM_THREADS=4 OPENBLAS_NUM_THREADS=1 julia --project=. -e \
  'using JuliaTime; JuliaTime.run_server(; host="127.0.0.1", port=9612, open_browser=false, stop_input=nothing)'
```

Case Board URL once running: `http://127.0.0.1:9612/course/index.html`.

## Commands

```
export EYES_HOME=/path/to/scratch/eyes-home   # optional; defaults to tools/playtest-eyes/personas

node eyes.cjs start <persona> --port <9600-9699> [--seed old-progress|empty]
node eyes.cjs stop  <persona>

node eyes.cjs goto  <persona> <url-or-path>          # path is resolved against the game's origin
node eyes.cjs click <persona> "<visible text>"       # matches a button/link by accessible name
node eyes.cjs click <persona> "#some-id"             # or click by element id
node eyes.cjs type  <persona> "#code" "<text>"       # or type <persona> "<label text>" "<text>"
node eyes.cjs scroll <persona> down|up
node eyes.cjs look  <persona>                        # no action, just re-observe the page
node eyes.cjs back  <persona>
node eyes.cjs wait  <persona> <seconds>              # capped at 120s
```

`start --seed old-progress` seeds the game origin's `localStorage`, before the very first real page
render, with a stale accepted-move record (including one retired move key,
`C4/select-eligible`, to exercise the app's drop-on-read handling) and an old Chapter 2 draft —
imitating a browser that already played an earlier build. `--seed empty` (the default) starts with
a clean browser profile. Each persona also gets its own **persistent Playwright profile directory**
under `$EYES_HOME/<persona>/profile/`, so its own progress accumulates naturally as it plays.

## Output

After every command the tool prints:

- the current page URL
- a full-page PNG screenshot path, saved to `$EYES_HOME/<persona>/NNN-<command>.png`
- a numbered list of visible interactive elements (buttons, links, textareas, inputs/selects) with
  accessible name, `#id`, and whether it is disabled
- the current value of every visible `<textarea>` (so a pre-filled or stale box is impossible to miss)
- the visible page text, trimmed to about 3000 characters

**The screenshot is the important part.** The student agent should open it with its `Read` tool on
every step — the text dump is a fallback for exact copy, not a substitute for looking.

Every command and a summary of its result is also appended to `$EYES_HOME/<persona>/log.jsonl`.

## Student brief (paste to the orchestrated student agent)

```
You are playing Julia Time as <PERSONA>, a <describe background/skill level> student, in a REAL
browser via the playtest-eyes tool. This is not a code-reading exercise: you are the persona, and
your only knowledge of the game is what the tool shows you.

Setup already done for you: a Julia Time server is running on port <PORT>, and
`node eyes.cjs start <PERSONA> --port <PORT> --seed <old-progress|empty>` has been run in
tools/playtest-eyes/ with EYES_HOME=<path>.

Rules:
- Before every action, and after every action, look at the screenshot path the tool just printed
  using your Read tool. Do not rely on the text dump alone — it can miss layout, clutter, and
  visual state that only the picture shows.
- Only interact through: node eyes.cjs goto|click|type|scroll|look|back|wait <PERSONA> ...
  (run from tools/playtest-eyes/, with the same EYES_HOME).
- Never read this project's source code (web/*.js, src/*) and never open browser devtools or run
  JavaScript yourself. You only know what a real learner would see on screen.
- Play the case in order from the Case Board. Read what's visible, decide what Julia code to try,
  type it into the code editor, click Run, and wait for the reply.
- When something confuses you, annoys you, or looks broken/cluttered/pre-filled in a way a real
  student wouldn't expect, say so explicitly and cite the exact screenshot path that shows it.
- At the end, report: what you did, every point of friction or confusion (with screenshot paths),
  and whether you finished the chapter(s) assigned to you.

Your assignment: <e.g. "Play Chapters 1 through 4">.
```

## Verified end-to-end (2026-09-25)

Server on port 9612, persona `alice` with `--seed old-progress`: Case Board correctly showed "1 of
6 chapters solved" (only `C1/select-records` counted; the seeded retired key
`C4/select-eligible` was dropped, and the seeded Chapter 2 draft was surfaced as "Continue Chapter
2"). Opened Chapter 4, typed `sample(eligible.jar_id, 3; replace=false)` into `#code`, clicked
`#run`, waited, and the page showed "Accepted — evidence saved" plus an "Actual returned result"
table with three distinct jar IDs from the supplied `eligible` list, and a "Next: test a
probability model →" button. Confirmed by opening two of the run's screenshots directly.

## Known limits

- `click`/`type` match by accessible name (button/link text, associated `<label>`, `aria-label`) or
  by `#id` — an element with no name and no id can only be reached by `#id`.
- `wait` is capped at 120 seconds; a very slow Julia reply could still be mid-flight when the next
  command's snapshot is taken — issue another `wait` or `look` if so.
- The persistent profile directory means a persona's own saved progress carries over between
  `stop`/`start` cycles unless you delete `$EYES_HOME/<persona>/profile/`.
- `--seed old-progress` seeds localStorage on first navigation to the game origin via an
  init script guarded by a one-time marker key, so it will not clobber progress the persona makes
  later in the same profile.
