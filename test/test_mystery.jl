using DataFrames

@testset "Missing Fleas C1 mystery API" begin
    @testset "case information is a complete, labelled fixture" begin
        reply = JuliaTime.handle_message(Dict("type" => "case_info"))

        @test reply["type"] == "case"
        @test reply["case_id"] == "missing-fleas-v1"
        @test reply["chapter"] == "C1"
        @test reply["case_batch"] == "B09"
        @test reply["columns"] == ["jar_id", "batch_id", "tray_id", "detected"]
        @test length(reply["rows"]) == 12
        @test count(row -> row["batch_id"] == "B09", reply["rows"]) == 6
        @test occursin("Simulated", reply["data_label"])
        @test haskey(reply, "goal")
        @test haskey(reply, "return_spec")
        @test length(reply["hints"]) == 3
        @test reply["hints"][2]["text"] == "Look first with jars[1:3, :], then make rows with jars.batch_id .== ..."
        @test reply["hints"][3]["text"] == "jars[jars.batch_id .== case_batch, :]"
        @test reply["worked_example"]["batch_id"] != reply["case_batch"]
        @test reply["worked_example"]["code"] == "jars[jars.batch_id .== \"B08\", :]"
        @test occursin("Optional worked example", reply["worked_example"]["note"])
        terms = [entry["term"] for entry in reply["glossary"]]
        @test all(term -> term in terms, ["jars[rows, columns]", "jars[1:3, :]", "jars.batch_id", ".==", ":"])
        @test sort(collect(keys(reply["bridge"]))) == ["python", "r"]
    end

    @testset "invalid or blank attempts do not run a worker" begin
        @test isempty(JuliaTime._POOL)
        blank = JuliaTime.handle_message(Dict("type" => "case_run", "request_id" => "blank-1", "code" => "   "))
        @test blank["type"] == "case_result"
        @test blank["request_id"] == "blank-1"
        @test blank["status"] == "error"
        @test blank["pass"] == false
        @test !haskey(blank, "evidence")
        @test isempty(JuliaTime._POOL)

        malformed = JuliaTime.handle_message(Dict("type" => "case_run", "request_id" => 12, "code" => 3))
        @test malformed["type"] == "case_result"
        @test malformed["pass"] == false
        @test !haskey(malformed, "evidence")
    end

    @testset "case checker accepts the exact unordered batch and exposes actual failures" begin
        JuliaTime.warmup!()
        try
            accepted = JuliaTime.handle_message(Dict(
                "type" => "case_run", "request_id" => "good-1",
                "code" => "jars[jars.batch_id .== case_batch, :]",
            ))
            @test accepted["type"] == "case_result"
            @test accepted["request_id"] == "good-1"
            @test accepted["status"] == "ok"
            @test accepted["pass"] == true
            @test accepted["columns"] == ["jar_id", "batch_id", "tray_id", "detected"]
            @test length(accepted["rows"]) == 6
            @test haskey(accepted, "evidence")

            reordered = JuliaTime.handle_message(Dict(
                "type" => "case_run", "request_id" => "unordered-1",
                "code" => "select(reverse(jars[jars.batch_id .== case_batch, :]), :detected, :tray_id, :batch_id, :jar_id)",
            ))
            @test reordered["pass"] == true
            @test reordered["columns"] == ["detected", "tray_id", "batch_id", "jar_id"]

            equivalent_filter = JuliaTime.handle_message(Dict(
                "type" => "case_run", "request_id" => "filter-1",
                "code" => "filter(:batch_id => ==(case_batch), jars)",
            ))
            @test equivalent_filter["pass"] == true

            wrong_filter = JuliaTime.handle_message(Dict(
                "type" => "case_run", "request_id" => "wrong-1",
                "code" => "jars[jars.batch_id .== \"B08\", :]",
            ))
            @test wrong_filter["status"] == "ok"
            @test wrong_filter["pass"] == false
            @test length(wrong_filter["rows"]) == 6
            @test all(row -> row["batch_id"] == "B08", wrong_filter["rows"])
            @test !haskey(wrong_filter, "evidence")

            duplicate = JuliaTime.handle_message(Dict(
                "type" => "case_run", "request_id" => "duplicate-1",
                "code" => "x = jars[jars.batch_id .== case_batch, :]; vcat(x, first(x, 1))",
            ))
            @test duplicate["pass"] == false

            tampered = JuliaTime.handle_message(Dict(
                "type" => "case_run", "request_id" => "tampered-1",
                "code" => "x = jars[jars.batch_id .== case_batch, :]; x.detected[1] = !x.detected[1]; x",
            ))
            @test tampered["pass"] == false

            wrong_type = JuliaTime.handle_message(Dict(
                "type" => "case_run", "request_id" => "type-1",
                "code" => "DataFrame(jar_id = jars.jar_id[1:6], batch_id = fill(case_batch, 6), tray_id = jars.tray_id[1:6], detected = ones(Int, 6))",
            ))
            @test wrong_type["pass"] == false

            missing_value = JuliaTime.handle_message(Dict(
                "type" => "case_run", "request_id" => "missing-1",
                "code" => "x = jars[jars.batch_id .== case_batch, :]; x.detected = Union{Missing,Bool}[missing; x.detected[2:end]]; x",
            ))
            @test missing_value["status"] == "ok"
            @test missing_value["pass"] == false

            nan_value = JuliaTime.handle_message(Dict(
                "type" => "case_run", "request_id" => "nan-1",
                "code" => "x = jars[jars.batch_id .== case_batch, :]; x.detected = Float64.(x.detected); x.detected[1] = NaN; x",
            ))
            @test nan_value["status"] == "ok"
            @test nan_value["pass"] == false

            scalar = JuliaTime.handle_message(Dict(
                "type" => "case_run", "request_id" => "scalar-1", "code" => "42",
            ))
            @test scalar["status"] == "ok"
            @test scalar["pass"] == false
            @test scalar["value_repr"] == "42"

            malformed_table = JuliaTime.handle_message(Dict(
                "type" => "case_run", "request_id" => "symbol-1",
                "code" => "DataFrame(jar_id = [\"J-x\"], batch_id = [case_batch], tray_id = [\"T-x\"], detected = [:not_a_bool])",
            ))
            @test malformed_table["pass"] == false
            @test malformed_table["rows"][1]["detected"]["type"] == "Symbol"
            @test JuliaTime.encode(malformed_table) isa String

            rational_table = JuliaTime.handle_message(Dict(
                "type" => "case_run", "request_id" => "rational-1",
                "code" => "DataFrame(jar_id = [\"J-x\"], batch_id = [case_batch], tray_id = [\"T-x\"], detected = [1 // 2])",
            ))
            @test rational_table["pass"] == false
            @test occursin("Rational", rational_table["rows"][1]["detected"]["type"])
            @test JuliaTime.encode(rational_table) isa String

            poisoned_run = JuliaTime.handle_message(Dict(
                "type" => "case_run", "request_id" => "poison-1",
                "code" => "jars.batch_id .= \"B08\"; jars[jars.batch_id .== case_batch, :]",
            ))
            @test poisoned_run["pass"] == false
            after_poison = JuliaTime.handle_message(Dict(
                "type" => "case_run", "request_id" => "recovery-1",
                "code" => "jars[jars.batch_id .== case_batch, :]",
            ))
            @test after_poison["pass"] == true

            errored = JuliaTime.handle_message(Dict(
                "type" => "case_run", "request_id" => "error-1", "code" => "not_defined_here",
            ))
            @test errored["request_id"] == "error-1"
            @test errored["status"] == "error"
            @test !haskey(errored, "evidence")

            timed_out = JuliaTime.handle_message(Dict(
                "type" => "case_run", "request_id" => "timeout-1", "code" => "while true end",
            ))
            @test timed_out["request_id"] == "timeout-1"
            @test timed_out["status"] == "timeout"
            @test !haskey(timed_out, "evidence")
            recovered_after_timeout = JuliaTime.handle_message(Dict(
                "type" => "case_run", "request_id" => "after-timeout-1",
                "code" => "jars[jars.batch_id .== case_batch, :]",
            ))
            @test recovered_after_timeout["pass"] == true
        finally
            JuliaTime.shutdown!()
        end
    end

    @testset "fixtures never share mutable checker state" begin
        poisoned = JuliaTime.mystery_jars()
        poisoned.batch_id .= "B09"
        fresh = JuliaTime.mystery_jars()
        @test count(==("B09"), fresh.batch_id) == 6
        @test JuliaTime.check_mystery_c1(fresh[fresh.batch_id .== "B09", :])[1]
    end
end

if get(ENV, "JULIATIME_INTEGRATION", "0") == "1"
    using HTTP, JSON

    @testset "Missing Fleas C1 WebSocket protocol" begin
        port = 0
        server = nothing
        for candidate in 9000:9099
            try
                server = JuliaTime.start_server(; host="127.0.0.1", port=candidate, open_browser=false)
                port = candidate
                break
            catch
            end
        end
        port == 0 && error("no free port found in 9000:9099")
        try
            HTTP.WebSockets.open("ws://127.0.0.1:$port/ws") do ws
                HTTP.WebSockets.send(ws, JSON.json(Dict("type" => "case_info")))
                info = JSON.parse(String(HTTP.WebSockets.receive(ws)))
                @test info["type"] == "case"
                @test length(info["rows"]) == 12

                HTTP.WebSockets.send(ws, JSON.json(Dict("type" => "case_run", "request_id" => "wire-scalar", "code" => "42")))
                scalar = JSON.parse(String(HTTP.WebSockets.receive(ws)))
                @test scalar["request_id"] == "wire-scalar"
                @test scalar["value_repr"] == "42"

                HTTP.WebSockets.send(ws, JSON.json(Dict("type" => "case_run", "request_id" => "wire-symbol", "code" => "DataFrame(jar_id = [\"J-x\"], batch_id = [case_batch], tray_id = [\"T-x\"], detected = [:not_a_bool])")))
                malformed = JSON.parse(String(HTTP.WebSockets.receive(ws)))
                @test malformed["pass"] == false
                @test malformed["rows"][1]["detected"]["type"] == "Symbol"

                HTTP.WebSockets.send(ws, JSON.json(Dict("type" => "case_run", "request_id" => "wire-rational", "code" => "DataFrame(jar_id = [\"J-x\"], batch_id = [case_batch], tray_id = [\"T-x\"], detected = [1 // 2])")))
                rational = JSON.parse(String(HTTP.WebSockets.receive(ws)))
                @test rational["pass"] == false
                @test occursin("Rational", rational["rows"][1]["detected"]["type"])

                HTTP.WebSockets.send(ws, JSON.json(Dict("type"=>"case_info", "chapter"=>"C2")))
                c2info=JSON.parse(String(HTTP.WebSockets.receive(ws)))
                @test c2info["chapter"] == "C2"
                @test length(c2info["rows"]) == 6
                for (step,code) in [("group","groupby(jars, :tray_id)"),
                    ("counts","combine(groupby(jars,:tray_id), nrow=>:n, :detected=>sum=>:detected_n)"),
                    ("rates","combine(groupby(jars,:tray_id), nrow=>:n, :detected=>sum=>:detected_n, :detected=>mean=>:rate)")]
                    HTTP.WebSockets.send(ws,JSON.json(Dict("type"=>"case_run","chapter"=>"C2","step"=>step,"request_id"=>"wire-c2-"*step,"code"=>code)))
                    reply=JSON.parse(String(HTTP.WebSockets.receive(ws)))
                    @test reply["chapter"] == "C2"
                    @test reply["step"] == step
                    @test reply["request_id"] == "wire-c2-"*step
                    @test reply["pass"]
                    @test haskey(reply,"evidence") == (step == "rates")
                end
            end
        finally
            JuliaTime.stop_server(server)
            JuliaTime.shutdown!()
        end
    end
end
