#!/usr/bin/env bash
# Observe real Bash independently from the C model. Run: bash labs/pipeline_probe.sh
set -u
bash -c 'set -e; false | cat; printf "default-survived\n"'
default_rc=$?
bash -c 'set -e -o pipefail; false | cat; printf "UNREACHABLE\n"'
guarded_rc=$?
printf 'default_rc=%s guarded_rc=%s\n' "$default_rc" "$guarded_rc"
test "$default_rc" -eq 0 && test "$guarded_rc" -eq 1
