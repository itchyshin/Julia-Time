@testset "test watchdog: a stall is judged against the limit" begin
    @test !TestWatchdog.stalled(0.0, 10.0, 720)
    @test !TestWatchdog.stalled(0.0, 720.0, 720)
    @test TestWatchdog.stalled(0.0, 721.0, 720)
    before = TestWatchdog.LAST[]
    TestWatchdog.progress!("test_watchdog.jl")
    @test TestWatchdog.CURRENT[] == "test_watchdog.jl"
    @test TestWatchdog.LAST[] >= before
end
