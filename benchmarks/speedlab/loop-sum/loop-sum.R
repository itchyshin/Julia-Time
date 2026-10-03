# Fixed Speed lab example: loop-sum. Base R only.
# `check` prints the answer once; `time` does one warm-up then three timed runs.
kernel <- function() {
  s <- 0
  for (i in 1:20000000) s <- s + sqrt(i)
  c(s)
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
