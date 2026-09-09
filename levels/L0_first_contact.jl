# L0 — First contact. The three-minute first win (R3): one call, one number. Worked example, not
# from scratch — the starter is already `rand()`; the player runs it.

register!(Level(
    id = "L0",
    title = "First contact",
    cast_line = "Itchy: Right, Julia time. One call. One number. Press Run and see what comes back.",
    bridge = (
        julia = "rand()",
        r = "runif(1)",
        python = "import random\nrandom.random()",
    ),
    tasks = [
        Task(
            kind = :change,
            prompt = "`rand()` asks Julia for one random number between 0 and 1. Run it as it is.",
            predict = "What number do you think will come back?",
            starter = "rand()",
            check = (value, ctx) -> begin
                (value isa Real && !(value isa Bool) && 0.0 <= value < 1.0) ||
                    return (false, "That should be a single number between 0 and 1 — try `rand()`.")
                return (true, "A number between 0 and 1, straight out of the box. That's a call returning a value.")
            end,
        ),
    ],
    visual = :bar,
    solution = ["rand()"],
))
