# Level/Task structs, the level registry, and the context/env/payload plumbing every level file
# and the server (B6) rely on. See docs/design/00-spec.md §4-5 and docs/design/01-architecture.md
# §1/§3 for the shapes this implements.
#
# Assumes CSV, DataFrames, HTTP and JSON are already `using`-imported by the including module
# (JuliaTime.jl), same convention as data.jl.

using Distributions
using Random
using Statistics

"""
    Task(; kind, prompt, predict, starter, check)

One graded (or, for L0.5, ungraded-by-omission) step inside a `Level`.

- `kind::Symbol` — `:change` (edit a working line), `:complete` (fill a blank), or `:write`.
- `prompt::String` — what the player is asked to do.
- `predict::String` — the ungraded "what will this print?" line shown above Run (R9).
- `starter::String` — code pre-filled in the box (`""` for a from-scratch `:write` task).
- `check::Function` — `(value, ctx) -> (pass::Bool, message::String)`. Must be pure and must not
  throw on an unexpected `value` type; return `(false, "readable message")` instead.

Named `Task` deliberately, shadowing `Base.Task` inside this module — the contributor-facing name
from the spec. Shadowing a struct name found in `Base` is legal Julia (verified live) and raises no
warning.
"""
Base.@kwdef struct Task
    kind::Symbol
    prompt::String
    predict::String
    starter::String
    check::Function
end

"""
    Level(; id, title, cast_line, bridge, preamble="", tasks=Task[], visual, solution=String[], seed=20260928)

One screen of the game. `bridge` is the Julia/R/Python line shown side by side (R8). `preamble` is
Julia shown to the player as "given" and evaluated before their code, in the same sandbox module
(e.g. `has_pair` for L3, the `mystery` samples for L5). `tasks` empty means an ungraded screen
(L0.5). `solution` has one entry per task and must pass that task's `check`. `seed` is the sandbox
seed used for this level's runs, so checks are reproducible.
"""
Base.@kwdef struct Level
    id::String
    title::String
    cast_line::String
    bridge::NamedTuple{(:julia, :r, :python), NTuple{3, String}}
    preamble::String = ""
    tasks::Vector{Task} = Task[]
    visual::Symbol
    solution::Vector{String} = String[]
    seed::Int = 20260928
end

const LEVELS = Level[]

"""
    register!(level::Level) -> Level

Push `level` onto `LEVELS` and return it. Each level file ends with `register!(Level(...))`.
"""
register!(level::Level) = (push!(LEVELS, level); level)

"""
    level_by_id(id) -> Level

The registered level with this `id`, or an error naming the unknown id.
"""
function level_by_id(id::AbstractString)
    for l in LEVELS
        l.id == id && return l
    end
    error("Unknown level id: $id")
end

# --- dataset cache -----------------------------------------------------------------------------
# `context` is documented pure "apart from reading the CSV once" — cache it here rather than
# re-reading data/water_fleas.csv on every call.

const _WATER_FLEAS_CACHE = Ref{Union{Nothing, DataFrames.DataFrame}}(nothing)

function _cached_water_fleas()
    if _WATER_FLEAS_CACHE[] === nothing
        _WATER_FLEAS_CACHE[] = water_fleas()
    end
    return _WATER_FLEAS_CACHE[]
end

# --- L3 (Toto's deck): exact probabilities, computed combinatorially, not simulated -------------
# P(a 5-card hand has at least one rank-pair)  = 1 - C(13,5)*4^5 / C(52,5)
# P(a 5-card hand has at least one ace)        = 1 - C(48,5) / C(52,5)
function _l3_context()
    pair_truth = 1 - (binomial(13, 5) * 4^5) / binomial(52, 5)
    ace_truth = 1 - binomial(48, 5) / binomial(52, 5)
    return (pair_truth = pair_truth, ace_truth = ace_truth)
end

# --- L5 (the flip): the fixed mystery samples, matching the level's preamble exactly ------------
function _l5_context()
    mystery = rand(Random.MersenneTwister(7), Normal(3, 0.5), 200)
    mystery2 = rand(Random.MersenneTwister(11), Poisson(6), 200)
    mystery3 = rand(Random.MersenneTwister(13), Binomial(20, 0.25), 200)
    return (mystery = mystery, mystery2 = mystery2, mystery3 = mystery3)
end

"""
    context(level::Level) -> NamedTuple

What checkers and payloads need, computed once and pure (apart from reading the water-flea CSV
once, cached). Always carries `df` (the full water-flea dataset) and `seed`; individual levels add
their own exact truths — L3's combinatorial probabilities, L4's per-task target distributions,
L5's fixed mystery samples.
"""
function context(level::Level)
    base = (df = _cached_water_fleas(), seed = level.seed)
    if level.id == "L3"
        return merge(base, _l3_context())
    elseif level.id == "L4"
        return merge(base, (targets = [Normal(5, 2), Binomial(10, 0.3), Poisson(4)],))
    elseif level.id == "L5"
        return merge(base, _l5_context())
    else
        return base
    end
end

"""
    env_for(level::Level) -> NamedTuple

Sandbox bindings for this level's runs: `(df = water_fleas(),)` for the levels that filter or
group the water-flea dataset (L1, L2), `(;)` otherwise — every other level's preamble defines
whatever it needs (`deck`, `mystery`, ...).
"""
function env_for(level::Level)
    level.id in ("L1", "L2") ? (df = _cached_water_fleas(),) : (;)
end

# --- histogram overlap, shared by the L4/L5 checkers and the :gallery payload -------------------

"""
    overlap(sample, target::Distributions.UnivariateDistribution) -> Float64

Histogram overlap between a vector of draws (`sample`) and a target distribution, on a shared
binning: for a continuous `target`, 40 equal bins over its 0.001-0.999 quantile range; for a
discrete `target`, one bin per integer over that same range. `overlap = Σ min(p_sample, p_target)`,
in `[0, 1]`. `1.0` means the sample's histogram exactly matches the target's probability mass on
this binning; `0.0` means no bin has any mass in common.
"""
function overlap(sample::AbstractVector{<:Real}, target::Distributions.UnivariateDistribution)
    isempty(sample) && return 0.0
    n = length(sample)
    lo = quantile(target, 0.001)
    hi = quantile(target, 0.999)
    if target isa Distributions.DiscreteUnivariateDistribution
        klo = Int(floor(lo))
        khi = Int(ceil(hi))
        total = 0.0
        for k in klo:khi
            p_t = pdf(target, k)
            p_s = count(==(k), sample) / n
            total += min(p_s, p_t)
        end
        return total
    else
        nbins = 40
        edges = range(lo, hi; length = nbins + 1)
        total = 0.0
        for i in 1:nbins
            a, b = edges[i], edges[i + 1]
            p_t = cdf(target, b) - cdf(target, a)
            p_s = if i < nbins
                count(x -> a <= x < b, sample) / n
            else
                count(x -> a <= x <= b, sample) / n
            end
            total += min(p_s, p_t)
        end
        return total
    end
end

# --- payload -------------------------------------------------------------------------------

_numberize(v) = v isa AbstractFloat ? Float64(v) : (v isa Integer ? v : Float64(v))

function _payload_bar(value)
    draws = if value isa Real
        Any[_numberize(value)]
    elseif value isa AbstractVector && !isempty(value) && all(x -> x isa Real, value)
        Any[_numberize(value[i]) for i in 1:min(length(value), 500)]
    else
        Any[]
    end
    return Dict{String, Any}("draws" => draws)
end

function _payload_rows(level::Level, task_index::Integer, value, ctx)
    df = ctx.df
    n = DataFrames.nrow(df)
    rows = [Dict{String, Any}(
        "pond" => df.pond[i], "jar" => df.jar[i], "count" => df.count[i], "temp" => df.temp[i],
        "kept" => false,
    ) for i in 1:n]

    pass = false
    try
        pass, _ = level.tasks[task_index].check(value, ctx)
    catch
        pass = false
    end

    summary = nothing
    door = "closed"

    if level.id == "L2"
        if value isa DataFrames.DataFrame
            for row in rows
                row["kept"] = true
            end
            cols = DataFrames.names(value)
            if "pond" in cols
                numeric_cols = [c for c in cols if c != "pond" && eltype(value[!, c]) <: Real]
                if !isempty(numeric_cols)
                    colname = numeric_cols[1]
                    summary = [Dict{String, Any}("pond" => value.pond[i], "value" => Float64(value[i, colname]))
                               for i in 1:DataFrames.nrow(value)]
                end
            end
            door = pass ? "open" : "ajar"
        end
    else
        # L1 (and any other row-filtering level): kept = the row's (pond, jar) survived the
        # player's filter.
        if value isa DataFrames.DataFrame && "pond" in DataFrames.names(value) && "jar" in DataFrames.names(value)
            kept_pairs = Set{Tuple{Any, Any}}((value.pond[i], value.jar[i]) for i in 1:DataFrames.nrow(value))
            for row in rows
                row["kept"] = (row["pond"], row["jar"]) in kept_pairs
            end
        end
        door = pass ? "open" : "closed"
    end

    return Dict{String, Any}("label" => DATA_LABEL, "rows" => rows, "summary" => summary, "door" => door)
end

function _payload_deck(level::Level, task_index::Integer, value, ctx)
    hands = Vector{Vector{Int}}()
    estimate = nothing
    truth = task_index == 3 ? ctx.ace_truth : ctx.pair_truth

    if value isa AbstractVector && !isempty(value) && all(x -> x isa Integer, value)
        push!(hands, Int.(collect(value)))
    elseif value isa Real
        estimate = Float64(value)
        rng = Random.MersenneTwister(level.seed)
        deck = collect(1:52)
        for _ in 1:20
            push!(hands, sample(rng, deck, 5; replace = false))
        end
    end

    return Dict{String, Any}("hands" => hands, "estimate" => estimate, "truth" => Float64(truth))
end

function _distribution_payload(d::Distributions.UnivariateDistribution)
    kind = string(nameof(typeof(d)))
    params = Float64.(collect(Distributions.params(d)))
    return Dict{String, Any}("kind" => kind, "params" => params)
end

function _payload_gallery(level::Level, task_index::Integer, value, ctx)
    if level.id == "L5"
        shots = task_index == 1 ? ctx.mystery : task_index == 2 ? ctx.mystery2 : ctx.mystery3
        if value isa Distributions.UnivariateDistribution
            target = _distribution_payload(value)
            ov = overlap(Float64.(shots), value)
        else
            target = nothing
            ov = 0.0
        end
        return Dict{String, Any}(
            "shots" => Float64.(shots[1:min(length(shots), 500)]),
            "target" => target,
            "overlap" => ov,
        )
    else
        target_dist = ctx.targets[task_index]
        target = _distribution_payload(target_dist)
        if value isa AbstractVector && !isempty(value) && all(x -> x isa Real, value)
            shots = Float64.(value[1:min(length(value), 500)])
            ov = overlap(Float64.(value), target_dist)
        else
            shots = Float64[]
            ov = 0.0
        end
        return Dict{String, Any}("shots" => shots, "target" => target, "overlap" => ov)
    end
end

function _payload_race(value)
    return Dict{String, Any}(
        "julia_ms" => nothing,
        "r_ms" => nothing,
        "python_ms" => nothing,
        "note" => "R and Python timings are not measured yet (slice B9); they will be measured once on a named machine and shipped as labelled constants.",
    )
end

"""
    payload(level::Level, task_index::Integer, value, ctx) -> Dict{String,Any}

The visual's data for this run, per the payload contract in docs/design/01-architecture.md §3
(as amended for B5 — see the B5 build-plan slice). Never throws: any failure is caught and turned
into `Dict("error" => "…")`.
"""
function payload(level::Level, task_index::Integer, value, ctx)
    try
        if level.visual === :bar
            return _payload_bar(value)
        elseif level.visual === :rows
            return _payload_rows(level, task_index, value, ctx)
        elseif level.visual === :deck
            return _payload_deck(level, task_index, value, ctx)
        elseif level.visual === :gallery
            return _payload_gallery(level, task_index, value, ctx)
        elseif level.visual === :race
            return _payload_race(value)
        else
            return Dict{String, Any}()
        end
    catch e
        return Dict{String, Any}("error" => sprint(showerror, e))
    end
end
