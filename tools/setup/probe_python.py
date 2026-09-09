#!/usr/bin/env python3
"""Fixed local optional-laboratory probe; it never installs packages."""

import sys

import numpy as np

value = float(np.mean(np.array([1.0, 2.0, 3.0])))
if not np.isfinite(value) or value != 2.0:
    raise RuntimeError("PYTHON_PROBE_BAD_RESULT: expected numeric 2.0")

print("contract_version=setup-v1")
print("component=python")
print("state=ready")
print(f"version=Python {sys.version.split()[0]}; NumPy {np.__version__}")
print("probe=python-numpy-mean-2-v1")
print("value=2.0")
