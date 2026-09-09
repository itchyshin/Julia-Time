# L2 — Which pond? One idea: split-apply-combine. Worked-example-first (R2, syntax level).

function _l2_group_check(agg_col::Symbol, agg_fn::Function, description::String)
    return (value, ctx) -> begin
        (value isa DataFrames.DataFrame) ||
            return (false, "That should return a DataFrame — try `combine(groupby(df, :pond), :$(agg_col) => $(agg_fn))`.")
        ("pond" in DataFrames.names(value)) ||
            return (false, "Keep the `:pond` grouping — only change what you're combining.")
        DataFrames.nrow(value) == 4 ||
            return (false, "There should be one row per pond (4 rows); got $(DataFrames.nrow(value)).")
        truth = combine(DataFrames.groupby(ctx.df, :pond), agg_col => agg_fn => :truth)
        truth_map = Dict(zip(truth.pond, truth.truth))
        numeric_cols = [c for c in DataFrames.names(value) if c != "pond" && eltype(value[!, c]) <: Real]
        isempty(numeric_cols) &&
            return (false, "There's no numeric column besides `pond` — $(description).")
        for col in numeric_cols
            all(i -> isapprox(value[i, col], truth_map[value.pond[i]]; atol = 1e-6), 1:DataFrames.nrow(value)) &&
                return (true, "One row per pond, correctly $(description).")
        end
        return (false, "That's not quite right — check which column you're combining and how.")
    end
end

register!(Level(
    id = "L2",
    title = "Which pond?",
    cast_line = "Momo: Four ponds, one question — which one's crawling with fleas? Itchy: Group, then combine.",
    bridge = (
        julia = "combine(groupby(df, :pond), :count => mean)",
        r = "aggregate(count ~ pond, data = df, FUN = mean)",
        python = "df.groupby(\"pond\")[\"count\"].mean()",
    ),
    tasks = [
        Task(
            kind = :change,
            prompt = "This groups by pond and averages the flea count. Change it to average the water temperature instead.",
            predict = "Which pond do you think will come out warmest?",
            starter = "combine(groupby(df, :pond), :count => mean)",
            check = _l2_group_check(:temp, mean, "averaging the water temperature"),
        ),
        Task(
            kind = :complete,
            prompt = "Fill in the blank so this groups by pond and finds the largest count seen in each.",
            predict = "Which pond do you expect to have the single biggest jar count?",
            starter = "combine(groupby(df, __), :count => maximum)",
            check = _l2_group_check(:count, maximum, "finding the largest count per pond"),
        ),
        Task(
            kind = :write,
            prompt = "Write the split-apply-combine that gives the mean flea count per pond.",
            predict = "Which pond has the most fleas, on average?",
            starter = "",
            check = _l2_group_check(:count, mean, "averaging the flea count"),
        ),
    ],
    visual = :rows,
    solution = [
        "combine(groupby(df, :pond), :temp => mean)",
        "combine(groupby(df, :pond), :count => maximum)",
        "combine(groupby(df, :pond), :count => mean)",
    ],
))
