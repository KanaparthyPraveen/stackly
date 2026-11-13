# Contributing to Stackly

Thanks for contributing. This repo follows the **Stackryze git workflow**. Read this
once — the rules below are enforced by git hooks (husky) and CI, so a change that
ignores them will fail before it can merge.

Related Plane project: **STACKRYZE** (work items look like `STACKRYZE-20`).

---

## 1. Branch model

Two long-lived, protected branches:

| Branch | Purpose                       | Deploys to | Direct pushes        |
| ------ | ----------------------------- | ---------- | -------------------- |
| `main` | Production, always releasable | production | ❌ blocked (PR only) |
| `dev`  | Integration of finished work  | staging    | ❌ blocked (PR only) |

All work happens on short-lived branches cut **from `dev`** (hotfixes from `main`).

### Branch naming

```
<type>/STACKRYZE-<id>-<kebab-summary>
```

- **type** — one of: `feat` `fix` `hotfix` `chore` `docs` `refactor` `perf` `test` `ci` `build` `style` `revert`
- **STACKRYZE-\<id\>** — the Plane work item (use `no-ticket` only for throwaway spikes)
- **summary** — short, lowercase, kebab-case

Examples:

```
feat/STACKRYZE-20-repo-bootstrap
fix/STACKRYZE-41-login-redirect-loop
chore/STACKRYZE-58-bump-next-16
hotfix/STACKRYZE-77-payment-webhook-500
```

A `pre-push` hook rejects branch names that don't match this pattern.

---

## 2. Commits — Conventional Commits

Every commit message must follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): STACKRYZE-<id> <subject>

<body — what & why, wrapped at 100 cols>

BREAKING CHANGE: <describe the break, if any>
```

- **type** — same list as branches (`feat`, `fix`, `docs`, …)
- **scope** — optional, kebab-case area (`auth`, `profile`, `links`, `ci`)
- **STACKRYZE-<id>** — the Plane ticket, first token of the subject; auto-inserted
  from the branch name on `git commit -m` and enforced by commitlint
- **subject** — imperative mood, lowercase, no trailing period, ≤ 100 chars
- Breaking changes: add a `!` after the type/scope **and** a `BREAKING CHANGE:` footer

Examples:

```
feat(profile): STACKRYZE-20 add drag-and-drop component reordering
fix(links): STACKRYZE-41 stop expiring links from 404-ing before their TTL
refactor(auth)!: STACKRYZE-58 replace session cookies with stackryze-auth tokens

BREAKING CHANGE: existing sessions are invalidated on deploy.
```

A `commit-msg` hook runs **commitlint** and blocks non-conforming messages.
Use `git commit` with the shared template (`git config commit.template .gitmessage`)
to get the skeleton for free.

---

## 3. Pull requests

- **Target `dev`** for everything except production hotfixes (which target `main`).
- **PR title** must be Conventional-Commits style **and** reference the Plane ID:

  ```
  <type>(<scope>): <summary> [STACKRYZE-<id>]
  ```

  e.g. `feat(profile): drag-and-drop reordering [STACKRYZE-20]`. This is validated
  by the **PR Title** CI check. The brackets matter — see Plane linking below.

- Fill in the PR template (what/why, screenshots, testing, checklist).
- Keep PRs small and focused — one work item per PR where possible.
- Every PR must be green: **lint + typecheck/test + build** and **1 approving review**.
- Resolve conversations and keep the branch **up to date with `dev`** before merge.

### Plane linking

The `[STACKRYZE-<id>]` in the PR title (or description) is how Plane links the PR
to the work item and drives its state through the connected GitHub integration:

- `[STACKRYZE-20]` (**brackets**) — links **and** automates state (draft → in
  review → merged move the work item automatically).
- `STACKRYZE-20` (no brackets) — link only, no state change.

Commits also carry the id: the `prepare-commit-msg` hook inserts `STACKRYZE-<id>`
(from the branch name) into the commit subject, so history stays traceable and
commitlint enforces it.

### Merging

- **Squash merge only** — keeps `dev`/`main` history linear and readable.
- The squash commit title = the (Conventional-Commits) PR title.
- **Branches are kept** after merge (auto-delete is off) — prune your local copies
  when done with `git fetch -p`.

---

## 4. Releases

1. Open a release PR `dev → main` titled `release: vX.Y.Z`.
2. Merge (squash) once CI is green.
3. Tag `main`: `git tag vX.Y.Z && git push origin vX.Y.Z`.

Versioning follows [SemVer](https://semver.org/): `feat` → minor, `fix` → patch,
`BREAKING CHANGE` → major.

---

## 5. Local setup

```bash
pnpm install      # also installs husky hooks via the "prepare" script
pnpm run build    # must pass on a clean clone
```

Node version is pinned in `.nvmrc`. Use `pnpm` (not npm/yarn) — the lockfile is
`pnpm-lock.yaml`.

### The hooks you now have

| Hook                 | Runs               | Blocks on                                          |
| -------------------- | ------------------ | -------------------------------------------------- |
| `prepare-commit-msg` | ticket-ref stamper | — (auto-inserts `STACKRYZE-<id>` into the subject) |
| `pre-commit`         | `lint-staged`      | lint/format errors in staged files                 |
| `commit-msg`         | `commitlint`       | non–Conventional-Commit messages                   |
| `pre-push`           | branch-name check  | invalid branch names                               |

To bypass in a genuine emergency: `--no-verify` (discouraged; CI still enforces).
