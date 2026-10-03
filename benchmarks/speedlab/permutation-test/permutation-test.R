# Fixed Speed lab example: permutation-test. Base R only.
# `check` prints the answer once; `time` does one warm-up then three timed runs.
kernel <- function() {
  x <- 12345
  vals <- numeric(60)
  for (i in 1:60) {
    x <- (x * 16807) %% 2147483647
    vals[i] <- x / 2147483647 + (if (i > 30) 0.1 else 0)
  }
  s1 <- 0; s2 <- 0
  for (i in 1:30) s1 <- s1 + vals[i]
  for (i in 31:60) s2 <- s2 + vals[i]
  observed <- s2 / 30 - s1 / 30
  count <- 0
  for (p in 1:40000) {
    for (i in 59:1) {
      x <- (x * 16807) %% 2147483647
      j <- x %% (i + 1) + 1
      tmp <- vals[i + 1]; vals[i + 1] <- vals[j]; vals[j] <- tmp
    }
    a <- 0; b <- 0
    for (i in 1:30) a <- a + vals[i]
    for (i in 31:60) b <- b + vals[i]
    if (abs(b / 30 - a / 30) >= abs(observed)) count <- count + 1
  }
  c(observed, count)
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
