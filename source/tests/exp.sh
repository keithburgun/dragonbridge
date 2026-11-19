#!/bin/sh
# One A/B experiment: tests/exp.sh '{"base":"hard","w":{"tile":3}}' [games per core=100] [opponent=v2:<base>]
cd "$(dirname "$0")"; base=$(node -e 'console.log(JSON.parse(process.argv[1]).base||"hard")' "$1")
printf '%s  ' "$1"; AIX="$1" ./arena_par.sh x "${3:-v2:$base}" "${2:-100}" 2 "${4:-0}"
