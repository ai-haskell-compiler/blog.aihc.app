"""Prefix each stdin line with seconds since the script started."""
import sys
import time

start = time.monotonic()
for line in sys.stdin:
    sys.stdout.write(f"{time.monotonic() - start:10.4f} {line}")
    sys.stdout.flush()
