# Launcher port choice (`launch`): a busy port 8000 must not end the session. Pure decisions run
# always, with the server, the "is this Julia Time?" probe and the browser opener injected.

@testset "launch: the probe knows the Board's real title" begin
    # A renamed Board title once made a second double-click start a second server (30 Sep 2026).
    board = read(joinpath(@__DIR__, "..", "web", "course", "index.html"), String)
    @test any(t -> occursin(t, board), JuliaTime.JULIA_TIME_BOARD_TITLES)
end

@testset "launch: port choice" begin
    busy = ErrorException("IOError: listen: address already in use (EADDRINUSE)")

    @testset "free first port: serve there" begin
        served = Int[]
        result = JuliaTime.launch(; ports=8000:8002, is_julia_time=(h, p) -> false,
                                  run=(; host, port) -> push!(served, port), browser_opener=identity)
        @test result == (:served, 8000)
        @test served == [8000]
    end

    @testset "another program on 8000: move to the next port" begin
        tried = Int[]
        run = (; host, port) -> (push!(tried, port); port == 8000 && throw(busy); nothing)
        result = JuliaTime.launch(; ports=8000:8002, is_julia_time=(h, p) -> false,
                                  run=run, browser_opener=identity)
        @test result == (:served, 8001)
        @test tried == [8000, 8001]
    end

    @testset "Julia Time already on 8000: reopen it, start nothing" begin
        opened = String[]
        started = Ref(false)
        result = withenv("JULIATIME_NO_BROWSER" => nothing) do
            JuliaTime.launch(; ports=8000:8002, is_julia_time=(h, p) -> p == 8000,
                             run=(; host, port) -> (started[] = true),
                             browser_opener=url -> push!(opened, url))
        end
        @test result == (:reopened, 8000)
        @test !started[]
        @test opened == ["http://127.0.0.1:8000/course/index.html"]
    end

    @testset "every port busy: a named error, not a raw exception" begin
        err = try
            JuliaTime.launch(; ports=8000:8001, is_julia_time=(h, p) -> false,
                             run=(; host, port) -> throw(busy), browser_opener=identity)
            nothing
        catch e
            e
        end
        @test err isa JuliaTime.AllPortsBusy
        @test err.ports == 8000:8001
    end

    @testset "a different start error is not mistaken for a busy port" begin
        @test_throws ArgumentError JuliaTime.launch(; ports=8000:8002, is_julia_time=(h, p) -> false,
            run=(; host, port) -> throw(ArgumentError("boom")), browser_opener=identity)
    end

    @testset "busy-port detection covers the macOS/Linux and Windows wordings" begin
        @test JuliaTime._is_address_in_use(busy)
        @test JuliaTime._is_address_in_use(ErrorException("Address already in use"))
        @test JuliaTime._is_address_in_use(ErrorException("listen: EADDRINUSE"))
        @test !JuliaTime._is_address_in_use(ArgumentError("boom"))
    end
end

if get(ENV, "JULIATIME_INTEGRATION", "0") == "1"
    using HTTP
    @testset "launch: real ports" begin
        # Another local web server (a Jupyter, Python or app backend) holding a port is not Julia Time.
        other = HTTP.serve!(_ -> HTTP.Response(200, "<title>Some other app</title>"), "127.0.0.1", 9451)
        try
            @test !JuliaTime._serves_julia_time("127.0.0.1", 9451)
        finally
            close(other)
        end
        # A nothing-listening port is not Julia Time either (and answers fast).
        @test (@elapsed @test !JuliaTime._serves_julia_time("127.0.0.1", 9452)) < 5

        # A real Julia Time server is recognised, so a second double-click reopens it.
        server = JuliaTime.start_server(; host="127.0.0.1", port=9453, warmup_fn=() -> nothing)
        try
            @test JuliaTime._serves_julia_time("127.0.0.1", 9453)
        finally
            JuliaTime.stop_server(server; force=true)
        end
    end
end
