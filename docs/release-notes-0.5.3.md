# Julia Time 0.5.3: Windows set-up fixed

0.5.3 is 0.5.2 with one fix. On Windows, the one-time setup of 0.5.2 stopped with "Package JuliaTime not found",
so the game could not start. macOS and Linux were not affected.

The cause: the game starts a second Julia to run your code, and tells it where to find packages. 0.5.2 wrote that
list with the separator macOS and Linux use (`:`). Windows uses `;`, so on Windows the second Julia found nothing.

Everything new in 0.5.2 is here: read your own data by typing `CSV.read`, packages, a straight-line fit with `lm`,
an optional Poisson `glm`, a saved script that reads your file the way the game did, and the speed lab. See
[the 0.5.2 notes](https://github.com/itchyshin/Julia-Time/releases/tag/v0.5.2).

## How to install

Download the ZIP, install Julia 1.10 once, then double-click one launcher file. Steps are in
[the installation guide](https://github.com/itchyshin/Julia-Time/blob/main/docs/install.md). If you have 0.5.1 or
0.5.2, download 0.5.3 and use it instead; your place in the course is kept in your browser.

## Tell us

Did set-up work on your computer? [Tell us here](https://github.com/itchyshin/Julia-Time/issues/new/choose).
