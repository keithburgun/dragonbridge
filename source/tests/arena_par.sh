#!/bin/sh
# Runs tests/arena.js on several cores and adds up the result:  tests/arena_par.sh expert v2:expert 50 4   (50 games x 4 cores)
cd "$(dirname "$0")"; A=$1; B=$2; N=${3:-50}; J=${4:-4}; BASE=${5:-0}; i=0; tmp=$(mktemp -d)
while [ $i -lt $J ]; do RAW=1 node arena.js "$A" "$B" "$N" 2 $((BASE + i * N)) > "$tmp/$i" & i=$((i + 1)); done; wait
cat "$tmp"/* | node -e 'let a=0,b=0,d=0;require("fs").readFileSync(0,"utf8").trim().split("\n").forEach(l=>{const j=JSON.parse(l);a+=j.w[0];b+=j.w[1];d+=j.draws});const n=a+b,p=a/n;console.log(process.argv[1]+" "+a+" – "+b+" "+process.argv[2]+(d?" ("+d+" drawn)":"")+" · "+(100*p).toFixed(1)+"% ± "+(196*Math.sqrt(p*(1-p)/n)).toFixed(1))' "$A" "$B"; rm -rf "$tmp"
