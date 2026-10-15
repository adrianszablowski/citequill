// The commit convention in .claude/rules/git.md has no exit code of its own, and a trailer naming the assistant
// is the one line of it a model adds by reflex. This runs before every Bash call, looks only at
// `git commit`, and refuses a message that carries a tool trailer or a subject without its type.
import { readFileSync } from 'node:fs';

const input = JSON.parse(readFileSync(0, 'utf8'));
const command = input.tool_input?.command ?? '';

if (!/\bgit\s+(-\S+\s+)*commit\b/.test(command)) {
    process.exit(0);
}

const TRAILER = /^\s*co-authored-by:|generated with|🤖/im;
const SUBJECT = /^(fix|feat|refactor|docs|test|chore|skill): \S/;
const SEE = 'See .claude/rules/git.md.';

if (TRAILER.test(command)) {
    deny(
        `The commit message names the assistant. The message ends with its last paragraph: no Co-Authored-By, no "Generated with", no tool name. ${SEE}`,
    );
}

const subject = subjectOf(command);

if (subject !== null && !SUBJECT.test(subject)) {
    deny(
        `The subject "${subject}" has no type. Write \`type: a sentence that says what is now true\`, with type one of fix, feat, refactor, docs, test, chore, skill. ${SEE}`,
    );
}

if (subject !== null && subject.length >= 72) {
    deny(
        `The subject is ${subject.length} characters; keep it under 72 and move the rest to the body. ${SEE}`,
    );
}

function subjectOf(cmd) {
    const heredoc = cmd.match(/<<-?\s*['"]?\w+['"]?\s*\n([^\n]*)/);

    if (heredoc) {
        return heredoc[1].trim();
    }

    const flag = cmd.match(
        /\s(?:-m|--message)[= ]("((?:[^"\\]|\\.)*)"|'([^']*)'|(\S+))/,
    );

    if (!flag) {
        return null;
    }

    const raw = flag[2] ?? flag[3] ?? flag[4];

    return raw.replace(/(\\n|\n)[\s\S]*$/, '').trim();
}

function deny(reason) {
    process.stdout.write(
        JSON.stringify({
            hookSpecificOutput: {
                hookEventName: 'PreToolUse',
                permissionDecision: 'deny',
                permissionDecisionReason: reason,
            },
        }),
    );

    process.exit(0);
}
