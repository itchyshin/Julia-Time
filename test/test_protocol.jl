# Pure-logic protocol tests — no server, no I/O. Always run (not gated).

@testset "protocol" begin
    @testset "parse_message / encode round trip" begin
        msg = JuliaTime.parse_message("""{"type":"run","code":"1+1"}""")
        @test msg["type"] == "run"
        @test msg["code"] == "1+1"
        @test JuliaTime.encode(Dict("type" => "pong")) == """{"type":"pong"}"""
    end

    @testset "parse_message rejects bad input" begin
        @test_throws Exception JuliaTime.parse_message("not json")
        @test_throws Exception JuliaTime.parse_message("""{"code":"1+1"}""")
    end

    @testset "content_type" begin
        @test JuliaTime.content_type("index.html") == "text/html"
        @test JuliaTime.content_type("app.js") == "text/javascript"
        @test JuliaTime.content_type("style.css") == "text/css"
        @test JuliaTime.content_type("data.json") == "application/json"
        @test JuliaTime.content_type("icon.png") == "image/png"
        @test JuliaTime.content_type("icon.svg") == "image/svg+xml"
        @test JuliaTime.content_type("readme") == "application/octet-stream"
    end

    @testset "safe_web_path" begin
        webroot = joinpath(@__DIR__, "..", "web")
        index_path = normpath(joinpath(webroot, "index.html"))

        @test JuliaTime.safe_web_path("/", webroot) == index_path
        @test JuliaTime.safe_web_path("/index.html?x=1", webroot) == index_path
        @test JuliaTime.safe_web_path("/../Project.toml", webroot) === nothing
        @test JuliaTime.safe_web_path("/nope.html", webroot) === nothing
    end

    @testset "_within_root is separator-independent (T1, Windows)" begin
        # `normpath` on Windows joins with backslashes, so a POSIX-only
        # `startswith(full, root * "/")` check always returned `false` there, and
        # `safe_web_path("/", webroot)` served nothing at all on the windows-latest CI runner.
        # Plain strings, no filesystem access, so this exercises the Windows shape on every OS.
        root = raw"C:\x\web"
        @test JuliaTime._within_root(raw"C:\x\web\index.html", root)
        @test JuliaTime._within_root(raw"C:\x\web\course\index.html", root)
        @test JuliaTime._within_root(root, root)                     # root itself
        @test !JuliaTime._within_root(raw"C:\x\web2\index.html", root)   # sibling with shared prefix
        @test !JuliaTime._within_root(raw"C:\x\other\Project.toml", root)  # traversal escape
        @test !JuliaTime._within_root(raw"C:\x\we", root)             # shorter than root

        # Same containment logic holds for POSIX-style paths.
        @test JuliaTime._within_root("/a/web/index.html", "/a/web")
        @test !JuliaTime._within_root("/a/web2/index.html", "/a/web")
        @test !JuliaTime._within_root("/a/other/Project.toml", "/a/web")
    end
end
