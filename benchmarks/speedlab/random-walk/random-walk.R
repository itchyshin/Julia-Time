# Fixed Speed lab example: random-walk. Base R only.
# `check` prints the answer once; `time` does one warm-up then three timed runs.
kernel <- function() {
  x <- 12345
  sumsq <- 0; sumfinal <- 0; maxabs <- 0
  for (w in 1:6000) {
    pos <- 0
    for (s in 1:1000) {
      x <- (x * 16807) %% 2147483647
      if (x <= 1073741823) pos <- pos + 1 else pos <- pos - 1
      if (abs(pos) > maxabs) maxabs <- abs(pos)
    }
    sumsq <- sumsq + pos * pos
    sumfinal <- sumfinal + pos
  }
  c(sumsq / 6000, maxabs, sumfinal / 6000)
}
fmt <- function(v) paste0("[", paste(sprintf("%.17g", v), collapse = ","), "]")
args <- commandArgs(trailingOnly = TRUE)
if (length(args) != 1L || !(args[[1L]] %in% c("check", "time"))) stop("expected check or time")
if (args[[1L]] == "check") {
  cat("{\"answer\":", fmt(kernel()), "}\n", sep = "")
} else {
  invisible(kernel())
  times <- numeric(3); answer <- NULL
  for (k in 1:3) {
    t0 <- proc.time()[["elapsed"]]; answer <- kernel(); times[k] <- proc.time()[["elapsed"]] - t0
  }
  cat("{\"answer\":", fmt(answer), ",\"times\":", fmt(times), ",\"version\":\"", R.version.string, "\"}\n", sep = "")
}
