#!/usr/bin/env Rscript

# Correctness-only bootstrap kernel shared with bootstrap.jl and bootstrap.py.
# The fixture stores zero-based indices for Python. R vectors are one-based, so
# `+ 1L` below is the explicit and only conversion before indexing detections.

contract <- "bootstrap-parity-v1"
kernel <- "bootstrap_detection_rate_mean"
input_identity <- "detections-v1/resampling-indices-v1"
benchmark_contract <- "bootstrap-benchmark-v1"
benchmark_workloads <- c(1000L, 10000L)
benchmark_warmups <- 1L
benchmark_repetitions <- 5L

parse_options <- function(arguments) {
  if (length(arguments) == 0L || length(arguments) %% 2L != 0L) {
    stop("options must be flag/value pairs", call. = FALSE)
  }
  option_names <- arguments[seq.int(1L, length(arguments), by = 2L)]
  if (any(!startsWith(option_names, "--")) || anyDuplicated(option_names)) {
    stop("options must be unique --flag/value pairs", call. = FALSE)
  }
  values <- setNames(arguments[seq.int(2L, length(arguments), by = 2L)], option_names)
  has_exact_options <- function(expected) identical(sort(names(values)), sort(expected))
  if (!("--mode" %in% names(values))) {
    if (!has_exact_options(c("--data", "--indices", "--replicates"))) {
      stop("expected --data PATH --indices PATH --replicates N", call. = FALSE)
    }
    replicates <- suppressWarnings(as.integer(values[["--replicates"]]))
    if (is.na(replicates) || replicates <= 0L || !identical(as.character(replicates), values[["--replicates"]])) {
      stop("--replicates must be a positive integer", call. = FALSE)
    }
    return(list(mode = "correctness", data = values[["--data"]], indices = values[["--indices"]], replicates = replicates))
  }
  if (!identical(values[["--mode"]], "benchmark") || !has_exact_options(c("--mode", "--data", "--indices", "--workload"))) {
    stop("benchmark mode expects only --mode benchmark --data PATH --indices PATH --workload 1000|10000", call. = FALSE)
  }
  workload <- suppressWarnings(as.integer(values[["--workload"]]))
  if (is.na(workload) || !identical(as.character(workload), values[["--workload"]]) || !(workload %in% benchmark_workloads)) {
    stop("benchmark workload must be 1000 or 10000", call. = FALSE)
  }
  list(mode = "benchmark", data = values[["--data"]], indices = values[["--indices"]], workload = workload)
}

nonempty_lines <- function(path) {
  if (!file.exists(path)) stop(paste("fixture does not exist:", path), call. = FALSE)
  lines <- readLines(path, warn = FALSE)
  lines <- lines[nzchar(trimws(lines))]
  if (length(lines) == 0L) stop(paste("fixture is empty:", path), call. = FALSE)
  lines
}

parse_integer <- function(token, description) {
  value <- suppressWarnings(as.integer(trimws(token)))
  if (is.na(value)) stop(paste(description, "is not an integer:", token), call. = FALSE)
  value
}

read_detections <- function(path) {
  lines <- nonempty_lines(path)
  if (!identical(trimws(lines[[1L]]), "detection")) stop("detection fixture header must be detection", call. = FALSE)
  if (length(lines) <= 1L) stop("detection fixture has no rows", call. = FALSE)
  detections <- vapply(lines[-1L], parse_integer, integer(1), description = "detection")
  if (any(detections != 0L & detections != 1L)) stop("detections must be binary 0/1 values", call. = FALSE)
  detections
}

read_indices <- function(path, row_width) {
  lines <- nonempty_lines(path)
  header <- strsplit(trimws(lines[[1L]]), ",", fixed = TRUE)[[1L]]
  expected_header <- paste0("draw_", seq_len(row_width))
  if (!identical(header, expected_header)) stop(paste("index fixture header must be", paste(expected_header, collapse = ",")), call. = FALSE)
  if (length(lines) <= 1L) stop("index fixture has no rows", call. = FALSE)
  rows <- lapply(seq.int(2L, length(lines)), function(line_number) {
    row <- vapply(strsplit(trimws(lines[[line_number]]), ",", fixed = TRUE)[[1L]], parse_integer, integer(1), description = paste("index at row", line_number))
    if (length(row) != row_width) stop(paste("index row", line_number, "has the wrong width"), call. = FALSE)
    if (any(row < 0L | row >= row_width)) stop(paste("index row", line_number, "is outside zero-based fixture bounds"), call. = FALSE)
    row
  })
  rows
}

number_json <- function(value) sprintf("%.17g", value)
sha256_hex <- function(path) unname(tools::sha256sum(path))

emit <- function(detections, indices, replicates, data_path, indices_path) {
  if (replicates > length(indices)) stop("--replicates exceeds available index rows", call. = FALSE)
  selected <- indices[seq_len(replicates)]
  # This conversion is intentional: fixture index 0 is R element 1.
  rates <- vapply(selected, function(row) mean(detections[row + 1L]), numeric(1))
  bootstrap_mean <- mean(rates)
  output <- paste0(
    "{\"contract\":\"", contract,
    "\",\"kernel\":\"", kernel,
    "\",\"language\":\"r-base\",",
    "\"version\":\"", R.version.string,
    "\",\"input_identity\":\"", input_identity,
    "\",\"data_sha256\":\"", sha256_hex(data_path),
    "\",\"indices_sha256\":\"", sha256_hex(indices_path),
    "\",\"fixture_index_base\":0",
    ",\"replicate_count\":", replicates,
    ",\"replicate_rates\":[", paste(vapply(rates, number_json, character(1)), collapse = ","), "]",
    ",\"bootstrap_mean\":", number_json(bootstrap_mean),
    "}"
  )
  cat(output, "\n", sep = "")
}

bootstrap_workload_checksum <- function(detections, indices, workload) {
  total <- 0
  for (draw in seq_len(workload)) {
    row <- indices[[((draw - 1L) %% length(indices)) + 1L]]
    total <- total + sum(detections[row + 1L]) / length(row)
  }
  total
}

emit_benchmark <- function(detections, indices, workload, data_path, indices_path) {
  # Fixture loading and this one warm-up happen before every timed region.
  bootstrap_workload_checksum(detections, indices, workload)
  times_seconds <- numeric(benchmark_repetitions)
  checksums <- numeric(benchmark_repetitions)
  for (round in seq_len(benchmark_repetitions)) {
    started <- proc.time()[["elapsed"]]
    checksums[[round]] <- bootstrap_workload_checksum(detections, indices, workload)
    times_seconds[[round]] <- proc.time()[["elapsed"]] - started
  }
  if (any(!is.finite(checksums))) stop("benchmark kernel returned a non-finite checksum", call. = FALSE)
  output <- paste0(
    "{\"contract\":\"", benchmark_contract,
    "\",\"report_type\":\"bootstrap_benchmark\",",
    "\"language\":\"r-base\",",
    "\"version\":\"", R.version.string,
    "\",\"input_identity\":\"", input_identity,
    "\",\"data_sha256\":\"", sha256_hex(data_path),
    "\",\"indices_sha256\":\"", sha256_hex(indices_path),
    "\",\"fixture_index_base\":0",
    ",\"thread_claim\":\"single-threaded kernel\"",
    ",\"workload\":", workload,
    ",\"warmup_repetitions\":", benchmark_warmups,
    ",\"timed_repetitions\":", benchmark_repetitions,
    ",\"times_seconds\":[", paste(vapply(times_seconds, number_json, character(1)), collapse = ","), "]",
    ",\"median_seconds\":", number_json(median(times_seconds)),
    ",\"min_seconds\":", number_json(min(times_seconds)),
    ",\"max_seconds\":", number_json(max(times_seconds)),
    "}"
  )
  cat(output, "\n", sep = "")
}

options <- parse_options(commandArgs(trailingOnly = TRUE))
detections <- read_detections(options$data)
indices <- read_indices(options$indices, length(detections))
if (identical(options$mode, "correctness")) {
  emit(detections, indices, options$replicates, options$data, options$indices)
} else {
  emit_benchmark(detections, indices, options$workload, options$data, options$indices)
}
