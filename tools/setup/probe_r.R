#!/usr/bin/env Rscript

# Fixed local optional-laboratory probe. It uses base R only and changes
# neither packages nor user settings.
value <- mean(c(1.0, 2.0, 3.0))
if (!is.finite(value) || value != 2.0) {
  stop("R_PROBE_BAD_RESULT: expected numeric 2.0")
}

cat("contract_version=setup-v1\n")
cat("component=r\n")
cat("state=ready\n")
cat("version=", R.version.string, "\n", sep = "")
cat("probe=r-mean-2-v1\n")
cat("value=2.0\n")
