# L6 — Many draws. This legacy regression level illustrates repeated random draws.  It is not a
# cross-language speed comparison: only its Julia elapsed time is available, and the optional
# benchmark laboratory owns any later Julia/R/Python comparison.

function _l6_check(target::Float64, tol::Float64)
    return (value, ctx) -> begin
        (value isa Real) || return (false, "That should be a single number — the mean.")
        isapprox(value, target; atol = tol) ||
            return (false, "That's not close enough to $(target). Check you're using 10^8 draws.")
        return (true, "Close to $(target) — the law of large numbers at work, on 10^8 draws.")
    end
end

register!(Level(
    id = "L6",
    title = "Many draws",
    cast_line = "Eddie: Repeating a random draw can make a noisy estimate steadier. Itchy: First see the result; compare tools only after a fair check.",
    bridge = (
        julia = "mean(rand(10^8))",
        r = "mean(runif(1e8))",
        python = "import numpy as np\nnp.random.rand(10**8).mean()",
    ),
    tasks = [
        Task(
            kind = :change,
            prompt = "This takes the mean of a million uniform draws. Change it to 10^8 draws.",
            predict = "Will the mean of 10^8 draws be closer to 0.5 than the mean of 10^6 was?",
            starter = "mean(rand(10^6))",
            check = _l6_check(0.5, 0.001),
        ),
        Task(
            kind = :complete,
            prompt = "Fill in the blank so this sums 10^8 uniform draws and divides by 10^8.",
            predict = "Should this give the same answer as `mean(rand(10^8))`?",
            starter = "sum(rand(__)) / 10^8",
            check = _l6_check(0.5, 0.001),
        ),
        Task(
            kind = :write,
            prompt = "Write the mean of 10^8 draws from a standard Normal distribution.",
            predict = "Where should this mean land, roughly?",
            starter = "",
            check = _l6_check(0.0, 0.001),
        ),
    ],
    visual = :race,
    solution = [
        "mean(rand(10^8))",
        "sum(rand(10^8)) / 10^8",
        "mean(rand(Normal(0, 1), 10^8))",
    ],
))
