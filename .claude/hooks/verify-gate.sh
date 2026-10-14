#!/usr/bin/env bash
#
# The loop. Runs the gate when the agent finishes a turn and hands failures straight back to it, so a
# turn cannot end by reporting success on work that does not pass. It knows one command, `pnpm verify`,
# and nothing about what implements it. Exit 0 lets the turn end. Exit 2 blocks it and feeds stderr
# back to the agent.

set -uo pipefail

ATTEMPT_LIMIT=3
# Roughly 1500 tokens. A failure large enough to flood the context degrades everything after it.
FEEDBACK_CHARS=6000

root=$(git rev-parse --show-toplevel 2>/dev/null || echo "${CLAUDE_PROJECT_DIR:-}")
[ -d "$root" ] || exit 0
cd "$root" || exit 0

info=$(node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{const j=JSON.parse(s);console.log([j.session_id||"unknown",j.agent_id||"main"].join("|"))}catch{console.log("unknown|main")}})')
IFS='|' read -r session agent_id <<<"$info"

attempts_file="${TMPDIR:-/tmp}/citequill-gate-$(printf '%s-%s' "$session" "$agent_id" | tr -c 'A-Za-z0-9_-' '_')"

# A turn that wrote no TypeScript has nothing for the gate to measure, and answering a question should
# not cost twenty seconds.
touched=$(git status --porcelain --untracked-files=all | sed 's/^...//;s/^.* -> //' | grep -E '\.(ts|tsx|mjs)$')
if [ -z "$touched" ]; then
    rm -f "$attempts_file"
    exit 0
fi

if [ ! -d "$root/node_modules" ]; then
    printf 'No node_modules in %s, so the gate cannot run there. Run `pnpm install`, then finish the turn again.\n' "$root" >&2
    exit 2
fi

output=$(pnpm verify 2>&1)
status=$?
if [ "$status" -eq 0 ]; then
    rm -f "$attempts_file"
    exit 0
fi

attempts=$(( $(cat "$attempts_file" 2>/dev/null || echo 0) + 1 ))
echo "$attempts" > "$attempts_file"

# Three failures is thrashing, not converging. Further passes only burn context, so the loop stops and
# says so where a human will see it.
if [ "$attempts" -ge "$ATTEMPT_LIMIT" ]; then
    rm -f "$attempts_file"
    printf '{"continue":true,"systemMessage":"pnpm verify failed %d times in a row. The gate is handing this back to you. Run pnpm verify to see it."}\n' "$ATTEMPT_LIMIT"
    exit 0
fi

printf 'pnpm verify failed (attempt %d of %d). Fix everything it reports, then finish the turn.\n\n%s\n' \
    "$attempts" "$ATTEMPT_LIMIT" "$(tail -c "$FEEDBACK_CHARS" <<<"$output")" >&2
exit 2
