# L1 — Falling rows. One idea: a predicate on rows. Worked-example-first (R2, syntax level):
# task 1 starts from a spelled-out, working `filter` call and only asks for a change. Toto's typo
# (R7) lands as a fourth task, after the player has had one clean pass.

function _l1_filter_check(expected_pond::String, expected_n::Int)
    return (value, ctx) -> begin
        (value isa DataFrames.DataFrame) ||
            return (false, "That should return a DataFrame — try `filter(:pond => ==(\"$(expected_pond)\"), df)`.")
        ("pond" in DataFrames.names(value)) ||
            return (false, "The result lost the `pond` column — start from the given line and only change the pond name.")
        if !all(==(expected_pond), value.pond)
            got = join(unique(value.pond), ", ")
            return (false, "Those rows are from the $(got) pond, not the $(expected_pond) pond — change the pond name.")
        elseif DataFrames.nrow(value) != expected_n
            return (false, "That keeps $(DataFrames.nrow(value)) rows, not all $(expected_n) from the $(expected_pond) pond.")
        end
        return (true, "$(expected_n) rows, every one from the $(expected_pond) pond.")
    end
end

_check1 = _l1_filter_check("south", 12)

_check2 = (value, ctx) -> begin
    (value isa DataFrames.DataFrame) ||
        return (false, "That should return a DataFrame — try `filter(:count => c -> c > 20, df)`.")
    ("pond" in DataFrames.names(value) && "jar" in DataFrames.names(value)) ||
        return (false, "The result lost a column `filter` should keep — start from `df` and only change the predicate.")
    truth = filter(:count => c -> c > 20, ctx.df)
    got = Set(zip(value.pond, value.jar))
    want = Set(zip(truth.pond, truth.jar))
    got == want ||
        return (false, "That's not quite the jars with more than 20 fleas — check the comparison (`>`) in the predicate.")
    return (true, "$(DataFrames.nrow(value)) jars had more than 20 fleas.")
end

_check3 = (value, ctx) -> begin
    (value isa DataFrames.DataFrame) ||
        return (false, "That should return a DataFrame — filter `df` on both `pond` and `temp`.")
    ("pond" in DataFrames.names(value) && "jar" in DataFrames.names(value)) ||
        return (false, "The result lost a column `filter` should keep.")
    truth = filter(row -> row.pond == "north" && row.temp > 18, ctx.df)
    got = Set(zip(value.pond, value.jar))
    want = Set(zip(truth.pond, truth.jar))
    got == want ||
        return (false, "That's not the north-pond jars warmer than 18 degrees. Check both conditions.")
    return (true, "$(DataFrames.nrow(value)) north-pond jars above 18 degrees.")
end

_check4 = _l1_filter_check("east", 12)

register!(Level(
    id = "L1",
    title = "Falling rows",
    cast_line = "Toto: Rows keep falling out of the pond! Momo: They're not falling, they're being filtered.",
    bridge = (
        julia = "filter(:pond => ==(\"north\"), df)",
        r = "df[df\$pond == \"north\", ]",
        python = "df[df[\"pond\"] == \"north\"]",
    ),
    tasks = [
        Task(
            kind = :change,
            prompt = "This keeps every row from the north pond: `:pond` names the column, `==(\"north\")` means \"is equal to north\" (short for `x -> x == \"north\"`). Change it to keep the south pond instead.",
            predict = "Roughly how many rows will be kept — more, fewer, or the same as north?",
            starter = "filter(:pond => ==(\"north\"), df)",
            check = _check1,
        ),
        Task(
            kind = :complete,
            prompt = "Fill in the blank so this keeps the jars with more than 20 fleas.",
            predict = "Roughly how many of the 48 jars do you expect to pass?",
            starter = "filter(:count => c -> c __ 20, df)",
            check = _check2,
        ),
        Task(
            kind = :write,
            prompt = "Write a filter that keeps only the north-pond jars warmer than 18 degrees.",
            predict = "Will this be more or fewer rows than the last task?",
            starter = "",
            check = _check3,
        ),
        Task(
            kind = :change,
            prompt = "Toto typed this and Julia answered `column name \"pnod\" not found in the data frame` — a column that doesn't exist. Fix the spelling so it keeps the east pond.",
            predict = "What do you think the error means before you fix it?",
            starter = "filter(:pnod => ==(\"east\"), df)",
            check = _check4,
        ),
    ],
    visual = :rows,
    solution = [
        "filter(:pond => ==(\"south\"), df)",
        "filter(:count => c -> c > 20, df)",
        "filter(row -> row.pond == \"north\" && row.temp > 18, df)",
        "filter(:pond => ==(\"east\"), df)",
    ],
))
