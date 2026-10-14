// A path-scoped rule loads when a matching file is *read*, and a brand-new file has never been read —
// so the one moment a rule is most needed is the one moment nothing loads it. This runs before every
// Write and names the rules whose `paths` cover the target, so the agent reads them first.
//
// It reads the globs from the rules' own frontmatter, so the scope has one home. Exit 0 always: the
// hook informs, it never blocks. Plain loops rather than lodash, because a hook also runs in a
// worktree that has no node_modules.
import { readdirSync, readFileSync } from 'node:fs';
import { join, matchesGlob, relative, resolve } from 'node:path';

const input = JSON.parse(readFileSync(0, 'utf8'));
const root = input.cwd ?? process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
const target = input.tool_input?.file_path;

if (!target) {
    process.exit(0);
}

const rel = relative(root, resolve(root, target));

if (/^\.\./.test(rel)) {
    process.exit(0);
}

const rulesDir = join(root, '.claude', 'rules');
const governing = [];

for (const name of readdirSync(rulesDir, { recursive: true })) {
    if (/\.md$/.test(name) && covers(join(rulesDir, name), rel)) {
        governing.push(`.claude/rules/${name}`);
    }
}

if (governing.length === 0) {
    process.exit(0);
}

process.stdout.write(
    JSON.stringify({
        hookSpecificOutput: {
            hookEventName: 'PreToolUse',
            additionalContext:
                `\`${rel}\` is governed by ${governing.join(', ')}. A rule loads itself when a matching file is read, ` +
                'and this file may be new — read each of those not already in context before writing it.',
        },
    }),
);

function covers(file, path) {
    const head = readFileSync(file, 'utf8').match(/^---\n([\s\S]*?)\n---/);

    if (!head) {
        return false;
    }

    for (const [, glob] of head[1].matchAll(
        /^\s*-\s*['"]?([^'"\n]+?)['"]?\s*$/gm,
    )) {
        if (matchesGlob(path, glob)) {
            return true;
        }
    }

    return false;
}
