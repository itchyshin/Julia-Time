# L4 — Shooting gallery. One idea: parameters, and sampling noise when n is small. Concept level:
# try-first (R2) — a one-line guess before each worked line.

function _l4_check(task_index::Int, expected_n::Int, description::String)
    return (value, ctx) -> begin
        (value isa AbstractVector && !isempty(value) && all(x -> x isa Real, value)) ||
            return (false, "That should be a vector of numbers — $(description).")
        length(value) == expected_n ||
            return (false, "That's $(length(value)) draws, not $(expected_n).")
        target = ctx.targets[task_index]
        ov = overlap(Float64.(value), target)
        ov >= 0.6 ||
            return (false, "Only about $(round(Int, 100ov))% of your shots land where they should. Check the parameters.")
        return (true, "About $(round(Int, 100ov))% overlap with the target — a good match.")
    end
end

register!(Level(
    id = "L4",
    title = "Shooting gallery",
    cast_line = "Itchy: A histogram is a target. Your code is the gun.",
    bridge = (
        julia = "rand(Normal(0, 1), 100)",
        r = "rnorm(100, 0, 1)",
        python = "import numpy as np\nnp.random.normal(0, 1, 100)",
    ),
    tasks = [
        Task(
            kind = :change,
            prompt = "Guess first, then change this to fire 100 shots from a Normal distribution with mean 5 and standard deviation 2.",
            predict = "Where will most of the 100 shots land?",
            starter = "rand(Normal(0, 1), 100)",
            check = _l4_check(1, 100, "try `rand(Normal(5, 2), 100)`"),
        ),
        Task(
            kind = :complete,
            prompt = "Guess first, then fill in the blank to fire 200 shots from a Binomial(n = 10, p = 0.3).",
            predict = "Roughly where will most of the 200 shots land, out of 0 to 10?",
            starter = "rand(Binomial(__, 0.3), 200)",
            check = _l4_check(2, 200, "try `rand(Binomial(10, 0.3), 200)`"),
        ),
        Task(
            kind = :write,
            prompt = "Guess first, then write 300 draws from a Poisson distribution with mean 4.",
            predict = "Roughly where will most of the 300 shots land?",
            starter = "",
            check = _l4_check(3, 300, "try `rand(Poisson(4), 300)`"),
        ),
    ],
    visual = :gallery,
    solution = [
        "rand(Normal(5, 2), 100)",
        "rand(Binomial(10, 0.3), 200)",
        "rand(Poisson(4), 300)",
    ],
))
