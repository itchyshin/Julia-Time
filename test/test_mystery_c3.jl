using Test
using DataFrames

const C3_CASE_ID = "missing-fleas-v1"
const C3_CHAPTER = "C3"

function c3_info_request(; move_id=nothing, request_id="c3-info", mode=nothing,
                         activity_id=nothing, simulation_id=nothing)
    request = Dict{String, Any}(
        "type" => "case_info",
        "case_id" => C3_CASE_ID,
        "chapter" => C3_CHAPTER,
        "request_id" => request_id,
    )
    move_id === nothing || (request["move_id"] = move_id)
    mode === nothing || (request["mode"] = mode)
    activity_id === nothing || (request["activity_id"] = activity_id)
    simulation_id === nothing || (request["simulation_id"] = simulation_id)
    return request
end

function c3_run_request(move_id, code; request_id="c3-run", mode="challenge",
                        case_id=C3_CASE_ID, chapter=C3_CHAPTER,
                        contract_version=1, activity_id=nothing, simulation_id=nothing)
    return Dict{String, Any}(
        "type" => "case_run",
        "contract_version" => contract_version,
        "case_id" => case_id,
        "chapter" => chapter,
        "move_id" => move_id,
        "mode" => mode,
        "activity_id" => activity_id,
        "simulation_id" => simulation_id,
        "request_id" => request_id,
        "code" => code,
    )
end

function input_by_id(reply, id)
    first(input for input in reply["inputs"] if input["id"] == id)
end

@testset "Missing Fleas C3 mystery API" begin
    @testset "fresh independent C3 fixtures and active-move metadata" begin
        report = JuliaTime.mystery_c3_report()
        handling_log = JuliaTime.mystery_c3_handling_log()
        @test names(report) == ["tray_id", "reported_detected_n"]
        @test names(handling_log) == ["tray_id", "logged_detected_n", "log_status"]
        @test length(unique(report.tray_id)) == nrow(report)
        @test length(unique(handling_log.tray_id)) == nrow(handling_log)
        @test handling_log.logged_detected_n[findfirst(==("T-C"), handling_log.tray_id)] == 0
        @test handling_log.log_status[findfirst(==("T-C"), handling_log.tray_id)] == "not entered"

        # Mutating a learner-visible construction cannot poison the next constructor or either
        # independently built checker fixture.
        report.reported_detected_n .= 99
        handling_log.logged_detected_n .= 99
        @test JuliaTime.mystery_c3_report().reported_detected_n == [2, 2, 1]
        @test JuliaTime.mystery_c3_handling_log().logged_detected_n == [2, 2, 0]
        expected_join = JuliaTime.mystery_c3_expected_join()
        expected_join.logged_detected_n .= 99
        @test JuliaTime.mystery_c3_expected_join().logged_detected_n == [2, 2, 0]
        expected_discrepancy = JuliaTime.mystery_c3_expected_discrepancy()
        @test nrow(expected_discrepancy) == 1
        @test expected_discrepancy.tray_id == ["T-C"]

        first_info = JuliaTime.handle_message(c3_info_request(request_id="c3-info-first"))
        second_info = JuliaTime.handle_message(c3_info_request(move_id="filter-disagreement",
                                                                 request_id="c3-info-second"))
        @test first_info["type"] == "case"
        @test first_info["contract_version"] == 1
        @test first_info["case_id"] == C3_CASE_ID
        @test first_info["chapter"] == C3_CHAPTER
        @test first_info["move_id"] == "join-report-log"
        @test first_info["request_id"] == "c3-info-first"
        @test first_info["mode"] == "challenge"
        @test first_info["activity_id"] === nothing
        @test first_info["simulation_id"] === nothing
        @test first_info["title"] == "Match the tray records"
        @test first_info["question"] == "Can each report tray be matched to one handling-log row?"
        @test [input["id"] for input in first_info["inputs"]] == ["report", "handling_log"]
        @test !any(input -> input["id"] == "joined", first_info["inputs"])
        @test input_by_id(first_info, "report")["columns"] == ["tray_id", "reported_detected_n"]
        @test input_by_id(first_info, "handling_log")["columns"] ==
              ["tray_id", "logged_detected_n", "log_status"]
        @test occursin("every tray ID occurs once", first_info["key_note"])
        @test first_info["scene"]["image"] == "assets/lab-cast.png"
        @test [move["id"] for move in first_info["moves"]] ==
              ["join-report-log", "filter-disagreement"]
        join_move = first_info["moves"][1]
        disagreement_move = first_info["moves"][2]
        @test join_move["code_shape"] ==
              "leftjoin(left_table, right_table, on=:shared_column)"
        @test only(hint["text"] for hint in join_move["hints"] if hint["stage"] == "shape") ==
              "Use leftjoin(left_table, right_table, on=:shared_column)."
        @test only(hint["text"] for hint in join_move["hints"] if hint["stage"] == "solution") ==
              "leftjoin(report, handling_log, on=:tray_id)"
        @test disagreement_move["code_shape"] ==
              "table[table.left_count .!= table.right_count, :]"
        # B9 (simulated playtest): the shape hint names its placeholders and maps them to the case.
        disagreement_shape = only(hint["text"] for hint in disagreement_move["hints"]
                                  if hint["stage"] == "shape")
        @test startswith(disagreement_shape,
              "Use table[table.left_count .!= table.right_count, :] to keep rows where two columns differ.")
        @test occursin("placeholders", disagreement_shape)
        @test occursin("table is joined", disagreement_shape)
        @test occursin("left_count is reported_detected_n", disagreement_shape)
        @test occursin("right_count is logged_detected_n", disagreement_shape)
        @test !occursin("joined[joined.reported_detected_n .!= joined.logged_detected_n, :]",
                        disagreement_shape)
        @test only(hint["text"] for hint in disagreement_move["hints"] if hint["stage"] == "solution") ==
              "joined[joined.reported_detected_n .!= joined.logged_detected_n, :]"
        @test !haskey(first_info, "extension")

        @test second_info["request_id"] == "c3-info-second"
        @test second_info["move_id"] == "filter-disagreement"
        @test second_info["mode"] == "challenge"
        @test second_info["activity_id"] === nothing
        @test second_info["simulation_id"] === nothing
        @test second_info["title"] == "Find the recording disagreement"
        @test second_info["question"] == "Which joined tray row has different recorded counts?"
        @test [input["id"] for input in second_info["inputs"]] == ["joined"]
        @test !any(input -> input["id"] in ("report", "handling_log"), second_info["inputs"])
        @test input_by_id(second_info, "joined")["columns"] ==
              ["tray_id", "reported_detected_n", "logged_detected_n", "log_status"]

        demo_info = JuliaTime.handle_message(c3_info_request(
            move_id="join-report-log", request_id="c3-info-demo", mode="demonstration",
            activity_id="practice-join-v1",
        ))
        @test demo_info["type"] == "case"
        @test demo_info["mode"] == "demonstration"
        @test demo_info["activity_id"] == "practice-join-v1"
        @test demo_info["simulation_id"] === nothing
        @test [input["id"] for input in demo_info["inputs"]] ==
              ["practice_report", "practice_log"]
        @test all(input -> input["data_label"] ==
                  "Simulated practice data — separate from the Missing Fleas case.",
                  demo_info["inputs"])
        @test !any(input -> input["id"] in ("report", "handling_log", "joined"),
                  demo_info["inputs"])

        # A C3 metadata request may carry JSON null for a C3-unspecified simulation id;
        # a non-null value is a mismatched identity and must not disclose inputs.
        explicit_null_info = JuliaTime.handle_message(merge(
            c3_info_request(request_id="c3-info-null-simulation"),
            Dict{String, Any}("simulation_id" => nothing),
        ))
        @test explicit_null_info["mode"] == "challenge"
        @test explicit_null_info["activity_id"] === nothing
        @test explicit_null_info["simulation_id"] === nothing

        bad_demo_info = JuliaTime.handle_message(c3_info_request(
            move_id="join-report-log", request_id="c3-info-bad-demo", mode="demonstration",
            activity_id="not-practice",
        ))
        @test bad_demo_info["type"] == "error"
        @test !haskey(bad_demo_info, "inputs")

        bad_simulation_info = JuliaTime.handle_message(c3_info_request(
            request_id="c3-info-bad-simulation", simulation_id="invented",
        ))
        @test bad_simulation_info["type"] == "error"
        @test !haskey(bad_simulation_info, "inputs")
    end

    @testset "checker accepts equivalent joins and only the independently derived disagreement" begin
        joined = leftjoin(JuliaTime.mystery_c3_report(), JuliaTime.mystery_c3_handling_log(),
                          on=:tray_id)
        discrepancy = joined[joined.reported_detected_n .!= joined.logged_detected_n, :]
        @test JuliaTime.check_mystery_c3(joined, "join-report-log")[1]
        @test JuliaTime.check_mystery_c3(select(reverse(joined), :log_status, :tray_id,
                                              :logged_detected_n, :reported_detected_n),
                                         "join-report-log")[1]
        @test JuliaTime.check_mystery_c3(discrepancy, "filter-disagreement")[1]
        @test JuliaTime.check_mystery_c3(select(discrepancy, :log_status, :tray_id,
                                              :logged_detected_n, :reported_detected_n),
                                         "filter-disagreement")[1]

        wrong_join = copy(joined)
        wrong_join.logged_detected_n .= 0
        @test !JuliaTime.check_mystery_c3(wrong_join, "join-report-log")[1]
        @test !JuliaTime.check_mystery_c3(vcat(joined, joined[1:1, :]), "join-report-log")[1]
        @test !JuliaTime.check_mystery_c3(joined[1:2, :], "join-report-log")[1]
        unexpected = vcat(joined, DataFrame(tray_id=["T-X"], reported_detected_n=[1],
                                             logged_detected_n=[1], log_status=["entered"]))
        @test !JuliaTime.check_mystery_c3(unexpected, "join-report-log")[1]
        @test !JuliaTime.check_mystery_c3(joined, "filter-disagreement")[1]
        @test !JuliaTime.check_mystery_c3(vcat(discrepancy, discrepancy), "filter-disagreement")[1]
        @test !JuliaTime.check_mystery_c3(select(discrepancy, Not(:log_status)),
                                           "filter-disagreement")[1]
        @test !JuliaTime.check_mystery_c3(discrepancy, "not-a-move")[1]
    end

    # UI-14 (2026-09-24 browser check): the client shows this prose as plain text, so Markdown
    # backticks appeared literally on screen (and in Julia a backtick starts a command literal).
    @testset "C3 learner-facing prose has no literal Markdown backticks" begin
        explanations = [JuliaTime._mystery_c3_explanation("join-report-log", true;
                                                          mode="demonstration")]
        for move_id in JuliaTime.MYSTERY_C3_MOVES, pass in (true, false)
            push!(explanations, JuliaTime._mystery_c3_explanation(move_id, pass))
        end
        for explanation in explanations, text in values(explanation)
            @test !occursin('`', text)
        end
        joined = JuliaTime.mystery_c3_expected_join()
        wrong_row = joined[joined.tray_id .== "T-A", :]
        passed, feedback = JuliaTime.check_mystery_c3(wrong_row, "filter-disagreement")
        @test !passed
        @test occursin(".!=", feedback)
        @test !occursin('`', feedback)
        for move in JuliaTime._mystery_c3_moves(), hint in move["hints"]
            @test !occursin('`', hint["text"])
        end
    end

    # Repair 5 (2026-09-24 browser walk-through): a failed run showed "No C3 case finding ...".
    # The client shows every explanation line, so none names an internal chapter id.
    @testset "C3 learner-facing explanations name no internal chapter id" begin
        explanations = [JuliaTime._mystery_c3_explanation("join-report-log", true;
                                                          mode="demonstration")]
        for move_id in JuliaTime.MYSTERY_C3_MOVES, pass in (true, false)
            push!(explanations, JuliaTime._mystery_c3_explanation(move_id, pass))
        end
        for explanation in explanations, text in values(explanation)
            @test !occursin(r"\bC[1-6]\b", text)
        end
        failed = JuliaTime._mystery_c3_explanation("join-report-log", false)
        @test startswith(failed["case"], "No case finding from this chapter is established")
    end

    # B10 (simulated playtest P03/P27, verified 2026-09-24): the checkers compare values only, so a
    # swapped leftjoin, an innerjoin, a hand-typed table or a row slice is accepted. The accepted
    # explanations must describe the checked result and the taught way, not claim what the
    # learner's own code did.
    @testset "C3 accepted explanations describe the checked result and the taught way" begin
        join_text = JuliaTime._mystery_c3_explanation("join-report-log", true)
        filter_text = JuliaTime._mystery_c3_explanation("filter-disagreement", true)
        practice_text = JuliaTime._mystery_c3_explanation("join-report-log", nothing;
                                                          mode="demonstration")
        @test startswith(join_text["julia"], "The returned table")
        @test startswith(filter_text["julia"], "The returned row")
        @test occursin("leftjoin", join_text["julia"]) && occursin("on=", join_text["julia"])
        @test occursin(".!=", filter_text["julia"])
        claims = r"matched each report row|checked the two count columns|kept the returned record|matched the separate practice rows|now matched safely"
        for text in (join_text["julia"], filter_text["julia"], practice_text["julia"])
            @test occursin("taught way", lowercase(text))
            @test !occursin(claims, text)
            @test !occursin('—', text)
        end
        @test !occursin(claims, join_text["case"])
        @test !occursin('—', join_text["case"])
        # The does-not-establish limit lines stay.
        @test occursin("does not tell us why recorded counts differ", join_text["limit"])
        @test occursin("does not tell us which record is biologically true", filter_text["limit"])
        @test occursin("does not establish", practice_text["limit"])
    end

    @testset "C3 challenge runs protect each active input and echo exact identities" begin
        JuliaTime.warmup!()
        try
            joined = JuliaTime.handle_message(c3_run_request(
                "join-report-log", "leftjoin(report, handling_log, on=:tray_id)";
                request_id="c3-join",
            ))
            @test joined["type"] == "case_result"
            @test joined["contract_version"] == 1
            @test joined["case_id"] == C3_CASE_ID
            @test joined["chapter"] == C3_CHAPTER
            @test joined["move_id"] == "join-report-log"
            @test joined["mode"] == "challenge"
            @test joined["activity_id"] === nothing
            @test joined["simulation_id"] === nothing
            @test joined["request_id"] == "c3-join"
            @test joined["status"] == "ok"
            @test joined["pass"] == true
            @test joined["practice_pass"] === nothing
            @test joined["progress_eligible"] == true
            @test joined["columns"] == ["tray_id", "reported_detected_n", "logged_detected_n", "log_status"]
            @test length(joined["rows"]) == 3
            @test joined["result_data"]["kind"] == "table"
            @test !haskey(joined, "evidence")
            @test occursin("matched", lowercase(joined["explanation"]["case"]))
            @test !occursin("t-c", lowercase(joined["explanation"]["case"]))

            discrepancy = JuliaTime.handle_message(c3_run_request(
                "filter-disagreement",
                "joined[joined.reported_detected_n .!= joined.logged_detected_n, :]";
                request_id="c3-disagreement",
            ))
            @test discrepancy["status"] == "ok"
            @test discrepancy["pass"] == true
            @test discrepancy["progress_eligible"] == true
            @test discrepancy["move_id"] == "filter-disagreement"
            @test discrepancy["request_id"] == "c3-disagreement"
            @test length(discrepancy["rows"]) == 1
            @test discrepancy["rows"][1]["tray_id"] == "T-C"
            @test haskey(discrepancy, "evidence")
            @test occursin("recording disagreement", lowercase(discrepancy["evidence"]["text"]))
            @test occursin("does not tell us", lowercase(discrepancy["explanation"]["limit"]))

            # B10: other routes to the same values are accepted; the explanation must not claim
            # that the taught leftjoin or .!= ran.
            for (move_id, code) in [("join-report-log", "leftjoin(handling_log, report, on=:tray_id)"),
                                    ("filter-disagreement", "joined[3:3, :]")]
                other = JuliaTime.handle_message(c3_run_request(move_id, code;
                    request_id="c3-b10-" * move_id))
                @test other["pass"] == true
                @test occursin("taught way", lowercase(other["explanation"]["julia"]))
                @test !occursin(r"matched each report row|checked the two count columns",
                                other["explanation"]["julia"])
            end

            for (name, move_id, code) in [
                ("report mutation", "join-report-log", "answer = leftjoin(report, handling_log, on=:tray_id); report.reported_detected_n[1] = 99; answer"),
                ("report rebinding", "join-report-log", "report = copy(report); leftjoin(report, handling_log, on=:tray_id)"),
                ("log mutation", "join-report-log", "answer = leftjoin(report, handling_log, on=:tray_id); handling_log.logged_detected_n[1] = 99; answer"),
                ("log rebinding", "join-report-log", "handling_log = copy(handling_log); leftjoin(report, handling_log, on=:tray_id)"),
                ("joined mutation", "filter-disagreement", "answer = joined[joined.reported_detected_n .!= joined.logged_detected_n, :]; joined.logged_detected_n[1] = 99; answer"),
                ("joined rebinding", "filter-disagreement", "joined = copy(joined); joined[joined.reported_detected_n .!= joined.logged_detected_n, :]"),
            ]
                reply = JuliaTime.handle_message(c3_run_request(move_id, code;
                    request_id="c3-" * replace(name, " " => "-")))
                @test reply["status"] == "error"
                @test reply["pass"] == false
                @test reply["progress_eligible"] == false
                @test !haskey(reply, "evidence")
            end

            wrong = JuliaTime.handle_message(c3_run_request("join-report-log", "report";
                request_id="c3-wrong"))
            @test wrong["status"] == "ok"
            @test wrong["pass"] == false
            @test wrong["practice_pass"] === nothing
            @test wrong["progress_eligible"] == false
            @test !haskey(wrong, "evidence")
        finally
            JuliaTime.shutdown!()
        end
    end

    # Repair 3 R7 (simulated re-test, 2026-09-24): the identity guard wraps the learner's code, so a
    # parse error used to point at wrapper lines ("@ none:3") and print the internal wrapper text.
    # A parse error must be Julia's own error for the learner's code alone, verbatim.
    @testset "C3 parse errors report the learner's own code, not the guard wrapper" begin
        JuliaTime.warmup!()
        try
            for (move_id, mode, code, location) in [
                ("filter-disagreement", "challenge", "joined[joined.reported_detected_n <> joined.logged_detected_n, :]", "none:1:36"),
                ("filter-disagreement", "challenge", "row_rule = joined.reported_detected_n .!= joined.logged_detected_n\njoined[row_rule <> 1, :]", "none:2:18"),
                ("filter-disagreement", "challenge", "joined[joined.reported_detected_n .!= joined.logged_detected_n, :", "none:1:66"),
                ("join-report-log", "challenge", "leftjoin(report handling_log, on=:tray_id)", "none:1:17"),
                ("join-report-log", "demonstration", "leftjoin(practice_report practice_log, on=:key)", "none:1:26"),
            ]
                request = c3_run_request(move_id, code; request_id="c3-parse", mode=mode,
                    activity_id=mode == "demonstration" ? "practice-join-v1" : nothing)
                reply = JuliaTime.handle_message(request)
                parsed = Meta.parseall(code; filename="none")
                julia_error = only(arg.args[1] for arg in parsed.args
                                   if arg isa Expr && arg.head in (:error, :incomplete))
                @test reply["status"] == "error"
                @test reply["message"] == "Julia couldn't parse this line. Look for a missing bracket, a missing comma, or a missing end keyword.\n\n" *
                                          sprint(showerror, julia_error)
                @test occursin("# Error @ " * location, reply["message"])
                @test !occursin("__juliatime_", reply["message"])
                @test reply["stdout"] == ""
                @test reply["progress_eligible"] == false
                @test !haskey(reply, "evidence")
                mode == "challenge" && @test reply["pass"] == false
            end

            # R2 and R6: the exact error texts web/chapter3.js keys its leads on.
            for (move_id, code, text) in [
                ("filter-disagreement", "joined = leftjoin(report, handling_log, on=:tray_id)\nrow_rule = joined.reported_detected_n .!= joined.logged_detected_n\njoined[row_rule, :]", "UndefVarError: `report` not defined"),
                ("filter-disagreement", "jars[jars.reported_detected_n .!= jars.logged_detected_n, :]", "UndefVarError: `jars` not defined"),
                ("join-report-log", "leftjoin(left_table, right_table, on=:shared_column)", "UndefVarError: `left_table` not defined"),
                ("join-report-log", "leftjoin(report, handling_log, on=:shared_column)", "column :shared_column not found in the left data frame"),
                # Repair 4: a bare column name, R's $, and move 2's own placeholders.
                ("join-report-log", "leftjoin(report, handling_log, on=tray_id)", "UndefVarError: `tray_id` not defined"),
                ("join-report-log", "leftjoin(report, handling_log, on=report\$tray_id)", "UndefVarError: `\$` not defined"),
                ("filter-disagreement", "joined[reported_detected_n .!= logged_detected_n, :]", "UndefVarError: `reported_detected_n` not defined"),
                ("filter-disagreement", "joined[joined\$reported_detected_n .!= joined\$logged_detected_n, :]", "UndefVarError: `\$` not defined"),
                ("filter-disagreement", "table[table.left_count .!= table.right_count, :]", "UndefVarError: `table` not defined"),
                ("filter-disagreement", "joined[joined.left_count .!= joined.right_count, :]", "column name :left_count not found in the data frame"),
            ]
                reply = JuliaTime.handle_message(c3_run_request(move_id, code; request_id="c3-lead"))
                @test reply["status"] == "error"
                @test occursin(text, reply["message"])
            end
        finally
            JuliaTime.shutdown!()
        end
    end

    # Repair 4 (review of repair 3): the pre-parse runs in the server process with no time limit.
    # When the parser itself throws (Meta.parseall threw StackOverflowError on deeply nested input),
    # or the code is longer than 20000 characters, the helper returns nothing, so the guarded
    # worker run, which is time-limited, handles the code. A stub parser stands in for the throw.
    @testset "the pre-parse falls back to the guarded run when the parser throws or the code is long" begin
        broken = "joined[joined.reported_detected_n <> joined.logged_detected_n, :]"
        @test JuliaTime._mystery_c3_parse_error(broken) isa Meta.ParseError
        @test JuliaTime._mystery_c3_parse_error(broken; parser=(code; kwargs...) -> throw(StackOverflowError())) === nothing
        @test JuliaTime._mystery_c3_parse_error(broken; parser=(code; kwargs...) -> error("parser failed")) === nothing
        called = Ref(false)
        spy = (code; kwargs...) -> (called[] = true; Meta.parseall(code; kwargs...))
        @test JuliaTime._mystery_c3_parse_error(broken * " "^20_000; parser=spy) === nothing
        # Overnight 2026-09-24: 20000 characters of deep nesting still took about 20 s to parse in the
        # server; learner code is a few hundred characters, so the cap is 4000.
        @test JuliaTime._mystery_c3_parse_error(broken * " "^4_000; parser=spy) === nothing
        @test !called[]
        @test JuliaTime._mystery_c3_parse_error(broken * " "^100; parser=spy) isa Meta.ParseError
        @test called[]
    end

    @testset "practice join uses separate protected inputs and never awards case progress" begin
        JuliaTime.warmup!()
        try
            demo = JuliaTime.handle_message(c3_run_request(
                "join-report-log", "leftjoin(practice_report, practice_log, on=:key)";
                request_id="c3-demo-join", mode="demonstration", activity_id="practice-join-v1",
            ))
            @test demo["type"] == "case_result"
            @test demo["status"] == "ok"
            @test demo["mode"] == "demonstration"
            @test demo["activity_id"] == "practice-join-v1"
            @test demo["pass"] === nothing
            @test demo["practice_pass"] == true
            @test demo["progress_eligible"] == false
            @test demo["columns"] == ["key", "reported_detected_n", "logged_detected_n", "log_status"]
            @test [row["key"] for row in demo["rows"]] == ["K-A", "K-B"]
            @test !haskey(demo, "evidence")

            wrong_practice = JuliaTime.handle_message(c3_run_request(
                "join-report-log", "practice_report";
                request_id="c3-demo-wrong-practice", mode="demonstration",
                activity_id="practice-join-v1",
            ))
            @test wrong_practice["status"] == "ok"
            @test wrong_practice["pass"] === nothing
            @test wrong_practice["practice_pass"] == false
            @test wrong_practice["progress_eligible"] == false
            @test !haskey(wrong_practice, "evidence")

            non_string_practice = JuliaTime.handle_message(c3_run_request(
                "join-report-log", 42;
                request_id="c3-demo-non-string", mode="demonstration",
                activity_id="practice-join-v1",
            ))
            @test non_string_practice["status"] == "error"
            @test non_string_practice["pass"] === nothing
            @test non_string_practice["practice_pass"] == false
            @test non_string_practice["progress_eligible"] == false
            @test !haskey(non_string_practice, "evidence")

            # Challenge names do not exist in the separate practice environment.
            hidden_challenge_input = JuliaTime.handle_message(c3_run_request(
                "join-report-log", "leftjoin(report, handling_log, on=:tray_id)";
                request_id="c3-demo-no-challenge-input", mode="demonstration",
                activity_id="practice-join-v1",
            ))
            @test hidden_challenge_input["status"] == "error"
            @test hidden_challenge_input["pass"] === nothing
            @test hidden_challenge_input["practice_pass"] == false
            @test hidden_challenge_input["progress_eligible"] == false
            @test !haskey(hidden_challenge_input, "evidence")

            for (name, code) in [
                ("practice report mutation", "answer = leftjoin(practice_report, practice_log, on=:key); practice_report.reported_detected_n[1] = 99; answer"),
                ("practice report rebinding", "practice_report = copy(practice_report); leftjoin(practice_report, practice_log, on=:key)"),
                ("practice log mutation", "answer = leftjoin(practice_report, practice_log, on=:key); practice_log.logged_detected_n[1] = 99; answer"),
                ("practice log rebinding", "practice_log = copy(practice_log); leftjoin(practice_report, practice_log, on=:key)"),
            ]
                reply = JuliaTime.handle_message(c3_run_request(
                    "join-report-log", code;
                    request_id="c3-demo-" * replace(name, " " => "-"),
                    mode="demonstration", activity_id="practice-join-v1",
                ))
                @test reply["status"] == "error"
                @test reply["pass"] === nothing
                @test reply["practice_pass"] == false
                @test reply["progress_eligible"] == false
                @test !haskey(reply, "evidence")
            end
        finally
            JuliaTime.shutdown!()
        end
    end

    @testset "malformed C3 requests reject without evidence or active inputs" begin
        invalid_info = JuliaTime.handle_message(c3_info_request(move_id="unknown",
                                                                  request_id="c3-info-invalid"))
        @test invalid_info["type"] == "error"
        @test !haskey(invalid_info, "inputs")

        for request in [
            c3_run_request("unknown", "42"; request_id="c3-bad-move"),
            c3_run_request("join-report-log", "42"; request_id="c3-bad-case", case_id="other"),
            c3_run_request("join-report-log", "42"; request_id="c3-bad-mode", mode="extension"),
            c3_run_request("filter-disagreement", "42"; request_id="c3-bad-demo-move",
                           mode="demonstration", activity_id="practice-join-v1"),
            c3_run_request("join-report-log", "42"; request_id="c3-bad-demo-activity",
                           mode="demonstration", activity_id="other-practice"),
            c3_run_request("join-report-log", "42"; request_id="c3-bad-version", contract_version=2),
            c3_run_request("join-report-log", "42"; request_id="c3-bad-activity", activity_id="practice"),
            c3_run_request("join-report-log", "42"; request_id="c3-bad-simulation", simulation_id="made-up"),
        ]
            reply = JuliaTime.handle_message(request)
            @test reply["type"] == "error"
            @test !haskey(reply, "evidence")
            @test !haskey(reply, "inputs")
        end

        # The ordinary dispatcher correctly hands a literal C2 request to the retained C2
        # protocol.  Direct C3 validation still rejects a mislabelled C3 envelope.
        bad_chapter = JuliaTime.mystery_c3_case_run(c3_run_request(
            "join-report-log", "42"; request_id="c3-bad-chapter", chapter="C2"))
        @test bad_chapter["type"] == "error"
        @test !haskey(bad_chapter, "evidence")

        blank = JuliaTime.handle_message(c3_run_request("join-report-log", "   ";
            request_id="c3-blank"))
        @test blank["type"] == "case_result"
        @test blank["status"] == "error"
        @test blank["progress_eligible"] == false
        @test !haskey(blank, "evidence")
    end
end

if get(ENV, "JULIATIME_INTEGRATION", "0") == "1"
    using HTTP, JSON

    @testset "Missing Fleas C3 loopback WebSocket routing and reconnect refetch" begin
        port = 0
        server = nothing
        for candidate in 9100:9199
            try
                server = JuliaTime.start_server(; host="127.0.0.1", port=candidate, open_browser=false)
                port = candidate
                break
            catch
            end
        end
        port == 0 && error("no free port found in 9100:9199")
        try
            HTTP.WebSockets.open("ws://127.0.0.1:$port/ws") do ws
                HTTP.WebSockets.send(ws, JSON.json(c3_info_request(request_id="wire-c3-info-one")))
                first_info = _receive_reply(ws)
                @test first_info["request_id"] == "wire-c3-info-one"
                @test first_info["move_id"] == "join-report-log"
                @test [input["id"] for input in first_info["inputs"]] == ["report", "handling_log"]

                HTTP.WebSockets.send(ws, JSON.json(c3_run_request(
                    "join-report-log", "leftjoin(report, handling_log, on=:tray_id)";
                    request_id="wire-c3-join")))
                joined = _receive_reply(ws)
                @test joined["request_id"] == "wire-c3-join"
                @test joined["move_id"] == "join-report-log"
                @test joined["pass"] == true
            end

            # A new socket refetches independently.  Its reply must retain the new request and
            # active-move identity rather than being confused with the closed socket's move 1.
            HTTP.WebSockets.open("ws://127.0.0.1:$port/ws") do ws
                HTTP.WebSockets.send(ws, JSON.json(c3_info_request(move_id="filter-disagreement",
                                                                      request_id="wire-c3-info-two")))
                second_info = _receive_reply(ws)
                @test second_info["request_id"] == "wire-c3-info-two"
                @test second_info["move_id"] == "filter-disagreement"
                @test [input["id"] for input in second_info["inputs"]] == ["joined"]

                HTTP.WebSockets.send(ws, JSON.json(c3_run_request(
                    "filter-disagreement",
                    "joined[joined.reported_detected_n .!= joined.logged_detected_n, :]";
                    request_id="wire-c3-filter")))
                discrepancy = _receive_reply(ws)
                @test discrepancy["request_id"] == "wire-c3-filter"
                @test discrepancy["move_id"] == "filter-disagreement"
                @test discrepancy["pass"] == true
            end
        finally
            JuliaTime.stop_server(server)
            JuliaTime.shutdown!()
        end
    end
end
