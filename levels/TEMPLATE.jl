# levels/TEMPLATE.jl — copy me to levels/L<n>_<slug>.jl and edit. (Skeleton only until slice B5/B8
# lands the real `Level`/`Task` structs and a fully worked example level; see docs/build-plan.md.)
#
# A level is ONE idea. Three tasks: :change (edit a working line) · :complete (fill a gap) · :write.
# Every task has a `predict` line ("what will this print?") shown above Run — ungraded.
# `check(value, ctx) -> (pass::Bool, message::String)` must be a pure function of the returned value
# and the task context (dataset, target parameters, seed). Visuals: :bar :rows :deck :gallery :race.
# Bridge lines must be VALID R and VALID Python — a human checks them once.
#
# Level(
#   id        = "L9",
#   title     = "…",
#   cast_line = "Itchy: …",
#   bridge    = (julia = "…", r = "…", python = "…"),
#   tasks     = [
#     Task(kind = :change,   prompt = "…", predict = "…", starter = "…", check = …),
#     Task(kind = :complete, prompt = "…", predict = "…", starter = "…", check = …),
#     Task(kind = :write,    prompt = "…", predict = "…", starter = "",  check = …),
#   ],
#   visual    = :gallery,
#   solution  = ["…", "…", "…"],
# )
