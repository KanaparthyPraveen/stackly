// Auto-inserts the Plane ticket id into the commit SUBJECT, taken from the branch
// name (e.g. feat/STACKRYZE-20-foo -> "feat(scope): STACKRYZE-20 <subject>").
// Runs on -m/message commits; skips merges/squashes and no-ops when the id is
// already present, the branch has no id, or no subject has been typed yet.
import { readFileSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

const msgFile = process.argv[2];
const source = process.argv[3]; // message | template | merge | squash | commit

if (source === 'merge' || source === 'squash') process.exit(0);

let branch = '';
try {
  branch = execSync('git rev-parse --abbrev-ref HEAD').toString().trim();
} catch {
  process.exit(0);
}

const match = branch.match(/STACKRYZE-\d+|no-ticket/);
if (!match) process.exit(0);
const ref = match[0];

const lines = readFileSync(msgFile, 'utf8').split('\n');
const subjectIdx = lines.findIndex((l) => l.trim() !== '' && !l.startsWith('#'));
if (subjectIdx === -1) process.exit(0); // nothing typed yet — leave it to the author

const subject = lines[subjectIdx];
if (new RegExp(`\\b${ref}\\b`).test(subject)) process.exit(0);

// Insert the ref right after the Conventional-Commits "type(scope): " prefix.
const prefix = subject.match(/^\w+(?:\([^)]*\))?!?:\s+/);
if (!prefix) process.exit(0); // no valid prefix — let commitlint flag it

lines[subjectIdx] =
  subject.slice(0, prefix[0].length) + `${ref} ` + subject.slice(prefix[0].length);
writeFileSync(msgFile, lines.join('\n'));
