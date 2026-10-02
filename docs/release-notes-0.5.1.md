# Julia Time 0.5.1: clearer help for a few slips

A small update to [Julia Time 0.5](https://github.com/itchyshin/Julia-Time/releases/tag/v0.5.0). The game,
the lessons and your saved place are unchanged. If 0.5.0 already works for you, you can keep playing it.

## What changed

- **Help that names the slip, for seven more slips.** Before, these got a general message or one that pointed the
  wrong way. Now:
  - `1..3` for a range: "A range uses a colon: write 1:3, not 1..3."
  - Two dots before a column, `logbook..jar_id`: "Use one dot between a table and its column."
  - `=>` typed for `>=`: "The sign is written >= (greater sign first), not => which makes a pair."
  - `~=` or `<>` for not equal: "Not equal is written != (with a dot for a whole list: .!=)."
  - A different table where the task needs `practice_jars` (Lesson 4): the message names the table you typed,
    instead of telling you not to type ids you never typed.
- **The ending stamp shows at once,** so it is there even if you take a screenshot straight away.
- **Smaller fixes.** The webpage puzzle shows the whole line on a laptop screen and keeps its answer until you
  try a spot. The "Start here" page now links to the right part of the README.

## Tested on

macOS, Windows and Linux. A fresh Windows and macOS machine downloaded the 0.5.0 ZIP, installed Julia 1.10 and
started the game, including a folder name with spaces and "&" in it. On Linux (Ubuntu 24.04) the ZIP set itself up
and opened the Case Board. If anything breaks on your computer, please
[tell us](https://github.com/itchyshin/Julia-Time/issues/new/choose).

## How to install

As before: download the ZIP, install Julia 1.10 once, then double-click one launcher file. Steps are in
[the installation guide](https://github.com/itchyshin/Julia-Time/blob/main/docs/install.md).
