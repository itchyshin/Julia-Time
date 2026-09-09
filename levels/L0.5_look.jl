# L0.5 — Look at this (ungraded, ~2 minutes). No tasks: just two things on screen, glossed once
# each, before L1 asks the player to use them.

register!(Level(
    id = "L0.5",
    title = "Look at this",
    cast_line = "Itchy: Two things before we touch the keyboard. `[3, 1, 4]` is a vector — an ordered list. `:pond` is a Symbol — it names a column, the way `pond` names a variable without being one.",
    bridge = (
        julia = "[3, 1, 4]",
        r = "c(3, 1, 4)",
        python = "[3, 1, 4]",
    ),
    preamble = "[3, 1, 4]   # a vector\n:pond       # a Symbol; it names a column",
    tasks = Task[],
    visual = :none,
    solution = String[],
))
