# Julia Time 0.5.4: the move after a stopped run is quicker

0.5.4 is 0.5.3 with one change to how the game gets ready after you stop a run that never finishes.

When a run is stopped, the game throws away the second Julia that ran it and starts a new one. Starting a new one
takes several seconds, because it loads its packages and does a few small trial fits first. Before, your next move
waited for all of that. Now, as soon as a run is stopped, the game starts one spare Julia in the background, so the
next move usually finds a ready one. If the spare is not ready yet, or fails, your move starts its own, exactly as
in 0.5.3. Stopping Julia is still done by ending the process, never by interrupting it.

What we measured, on the maintainer's Mac (M1 Ultra) while other work was running on it, so treat the numbers as
rough (measured under heavy load, load average about 50 to 65): in one run each, the move right after two stopped
runs took 7.25 s in 0.5.3, and 0.07 s in 0.5.4 once the spare was ready. A fresh Julia took 2.1 to 2.2 s to start and 7.1 to 7.3 s once its
trial fits had run. We have not timed this on Windows or on a 2-core laptop. If you re-run a line within a few
seconds of a stop, the spare may still be starting, and your move then starts its own Julia while the spare
finishes; on a small laptop that one move may be slower than in 0.5.3. We have not measured this case.

Everything in 0.5.3 is here, including the Windows set-up fix.

## How to install

Download the ZIP, install Julia 1.10 once, then double-click one launcher file. Steps are in
[the installation guide](https://github.com/itchyshin/Julia-Time/blob/main/docs/install.md). If you have an earlier
version, download 0.5.4 and use it instead; your place in the course is kept in your browser.

## Tell us

Did anything feel slow? [Tell us here](https://github.com/itchyshin/Julia-Time/issues/new/choose).
