// Enforces the Stackryze branch naming convention on push.
// Format: <type>/STACKRYZE-<id>-<kebab-summary>  (or no-ticket for spikes)
import { execSync } from 'node:child_process';

const PATTERN =
  /^(feat|fix|hotfix|chore|docs|refactor|perf|test|ci|build|style|revert)\/(STACKRYZE-\d+|no-ticket)-[a-z0-9][a-z0-9._-]*$/;
const PROTECTED = new Set(['main', 'dev', 'HEAD']);

const branch = execSync('git rev-parse --abbrev-ref HEAD').toString().trim();

if (PROTECTED.has(branch)) process.exit(0);

if (!PATTERN.test(branch)) {
  console.error(`\n\u2716 Branch "${branch}" does not follow the naming convention.\n`);
  console.error('  Expected: <type>/STACKRYZE-<id>-<kebab-summary>');
  console.error('  Example:  feat/STACKRYZE-20-repo-bootstrap\n');
  console.error('  Types: feat fix hotfix chore docs refactor perf test ci build style revert\n');
  console.error('  Rename with: git branch -m <new-name>\n');
  process.exit(1);
}
