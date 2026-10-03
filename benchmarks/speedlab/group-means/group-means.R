# Fixed Speed lab example: group-means. Base R only.
# `check` prints the answer once; `time` does one warm-up then three timed runs.
kernel <- function() {
  x <- 12345
  sums <- numeric(5000); counts <- numeric(5000)
  for (r in 1:3000000) {
    x <- (x * 16807) %% 2147483647
    g <- x %% 5000 + 1
    x <- (x * 16807) %% 2147483647
    sums[g] <- sums[g] + x / 2147483647
    counts[g] <- counts[g] + 1
  }
  total <- 0; lo <- Inf; hi <- -Inf
  for (g in 1:5000) {
    m <- sums[g] / counts[g]
    total <- total + m
    if (m < lo) lo <- m
    if (m > hi) hi <- m
  }
  c(total / 5000, lo, hi)
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
