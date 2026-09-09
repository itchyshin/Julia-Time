# L5 — The flip. One idea: inference is the gallery run backwards. Concept level: try-first (R2).
# `mystery`/`mystery2`/`mystery3` are fixed samples (own preamble, own seeds) — the player never
# sees the parameters that fired them, only the numbers, via the visual.

_l5_preamble = """
mystery = rand(MersenneTwister(7), Normal(3, 0.5), 200)
mystery2 = rand(MersenneTwister(11), Poisson(6), 200)
mystery3 = rand(MersenneTwister(13), Binomial(20, 0.25), 200)
"""

_check1 = (value, ctx) -> begin
    (value isa Normal) ||
        return (false, "That should be a `Normal(μ, σ)` — try adjusting the numbers.")
    (abs(value.μ - 3) <= 0.3 && abs(value.σ - 0.5) <= 0.2) ||
        return (false, "Not quite — look at where `mystery` is centred, and how spread out it is.")
    return (true, "That's close to the Normal that fired `mystery`.")
end

_check2 = (value, ctx) -> begin
    (value isa Poisson) ||
        return (false, "That should be a `Poisson(λ)` — fill in the blank.")
    abs(value.λ - 6) <= 1 ||
        return (false, "Not quite — look at the typical count in `mystery2`.")
    return (true, "That's close to the Poisson that fired `mystery2`.")
end

_check3 = (value, ctx) -> begin
    (value isa Binomial) ||
        return (false, "That should be a `Binomial(n, p)` — write one.")
    (value.n == 20 && abs(value.p - 0.25) <= 0.08) ||
        return (false, "Not quite — `mystery3`'s values range 0 to 20; look at where most of them land.")
    return (true, "That's close to the Binomial that fired `mystery3`.")
end

register!(Level(
    id = "L5",
    title = "The flip",
    cast_line = "Momo: Now you're showing me the shots and asking for the gun? Itchy: That's inference.",
    bridge = (
        julia = "Normal(3, 0.5)",
        r = "dnorm(x, mean = 3, sd = 0.5)",
        python = "import scipy.stats\nscipy.stats.norm(loc=3, scale=0.5)",
    ),
    preamble = _l5_preamble,
    tasks = [
        Task(
            kind = :change,
            prompt = "`mystery` is 200 numbers from an unknown Normal distribution. Guess first, then change this to name the distribution you think fired it.",
            predict = "Where does `mystery` look centred, roughly?",
            starter = "Normal(0, 1)",
            check = _check1,
        ),
        Task(
            kind = :complete,
            prompt = "`mystery2` is 200 counts from an unknown Poisson distribution. Guess first, then fill in the blank.",
            predict = "What's a typical count in `mystery2`?",
            starter = "Poisson(__)",
            check = _check2,
        ),
        Task(
            kind = :write,
            prompt = "`mystery3` is 200 counts from an unknown Binomial(20, p) distribution. Guess first, then write the distribution.",
            predict = "Out of 20, where do most of `mystery3`'s counts land?",
            starter = "",
            check = _check3,
        ),
    ],
    visual = :gallery,
    solution = [
        "Normal(3, 0.5)",
        "Poisson(6)",
        "Binomial(20, 0.25)",
    ],
))
