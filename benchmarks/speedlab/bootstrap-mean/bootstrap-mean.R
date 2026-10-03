# Fixed Speed lab example: bootstrap-mean. Base R only.
# `check` prints the answer once; `time` does one warm-up then three timed runs.
kernel <- function() {
  x <- 12345
  data <- numeric(200)
  for (j in 1:200) {
    x <- (x * 16807) %% 2147483647
    data[j] <- x / 2147483647 * 10
  }
  total <- 0; lo <- Inf; hi <- -Inf
  for (b in 1:30000) {
    s <- 0
    for (k in 1:200) {
      x <- (x * 16807) %% 2147483647
      s <- s + data[x %% 200 + 1]
    }
    m <- s / 200
    total <- total + m
    if (m < lo) lo <- m
    if (m > hi) hi <- m
  }
  c(total / 30000, lo, hi)
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
