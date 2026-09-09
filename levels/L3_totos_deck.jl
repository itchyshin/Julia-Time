# L3 — Toto's deck. One idea: probability as long-run frequency. Concept level: try-first (R2) —
# tasks open with a one-line guess before the worked line, rather than a fully worked example.

_l3_preamble = """
deck = 1:52
rank(card) = (card - 1) % 13 + 1
has_pair(hand) = length(unique(rank.(hand))) < length(hand)
"""

_check1 = (value, ctx) -> begin
    (value isa AbstractVector) ||
        return (false, "That should be a vector of 7 cards — try `sample(deck, 7; replace=false)`.")
    v = collect(value)
    (length(v) == 7 && all(x -> x isa Integer, v)) ||
        return (false, "That's not 7 whole-number card ids. Change the `5` to a `7`.")
    (all(x -> 1 <= x <= 52, v) && length(unique(v)) == 7) ||
        return (false, "Card ids should be 7 distinct numbers between 1 and 52.")
    return (true, "Seven distinct cards, no repeats — a real hand.")
end

_check2 = (value, ctx) -> begin
    (value isa Real) ||
        return (false, "That should be a single number — the estimated probability. Try filling in `10_000`.")
    isapprox(value, ctx.pair_truth; atol = 0.03) ||
        return (false, "That estimate ($(round(value; digits = 3))) is too far from the long-run answer. Try more hands (e.g. `1:10_000`).")
    return (true, "Close to the true probability of a pair in a 5-card hand ($(round(ctx.pair_truth; digits = 4))).")
end

_check3 = (value, ctx) -> begin
    (value isa Real) ||
        return (false, "That should be a single number — the estimated probability of at least one ace.")
    isapprox(value, ctx.ace_truth; atol = 0.03) ||
        return (false, "That estimate is too far from the true answer. Simulate more hands, and check you're testing for rank 1 (ace).")
    return (true, "Close to the true probability of at least one ace in a 5-card hand ($(round(ctx.ace_truth; digits = 4))).")
end

register!(Level(
    id = "L3",
    title = "Toto's deck",
    cast_line = "Toto: Cards! Finally something fun. Itchy: Fun and the answer to \"how likely?\" — simulate enough hands and the long-run frequency tells you.",
    bridge = (
        julia = "mean(has_pair(sample(deck, 5; replace=false)) for _ in 1:10_000)",
        r = "mean(replicate(10000, any(duplicated(sample(1:52, 5) %% 13))))",
        python = "import random\nsum(len(set((c - 1) % 13 for c in random.sample(range(1, 53), 5))) < 5 for _ in range(10000)) / 10000",
    ),
    preamble = _l3_preamble,
    tasks = [
        Task(
            kind = :change,
            prompt = "Given: `deck`, and `has_pair(hand)` (true if two cards share a rank). This deals a 5-card hand. Guess first, then change it to deal 7 cards instead.",
            predict = "Is a 7-card hand more or less likely to contain a pair than a 5-card hand?",
            starter = "hand = sample(deck, 5; replace=false)",
            check = _check1,
        ),
        Task(
            kind = :complete,
            prompt = "Guess first: out of 100 five-card hands, roughly how many do you think have a pair? Then fill in the blank to simulate 10,000 hands and check.",
            predict = "Your guess: about how many hands in 100 have a pair?",
            starter = "mean(has_pair(sample(deck, 5; replace=false)) for _ in 1:__)",
            check = _check2,
        ),
        Task(
            kind = :write,
            prompt = "Guess first, then write a simulation estimating the probability that a 5-card hand contains at least one ace (rank 1).",
            predict = "Your guess: about how many hands in 100 have an ace?",
            starter = "",
            check = _check3,
        ),
    ],
    visual = :deck,
    solution = [
        "hand = sample(deck, 7; replace=false)",
        "mean(has_pair(sample(deck, 5; replace=false)) for _ in 1:10_000)",
        "mean(any(c -> rank(c) == 1, sample(deck, 5; replace=false)) for _ in 1:10_000)",
    ],
))
