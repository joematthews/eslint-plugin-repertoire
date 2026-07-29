# Publishing

How a new version of `eslint-plugin-repertoire` reaches npm.

## TL;DR

Bump the version in the pull request that ships the change. Merging that PR to `main` publishes it.

```sh
npm version minor --no-git-tag-version
```

That edits `package.json` only. Commit it with the rest of your branch, open the PR, merge. There is no tag to create, no GitHub Release to cut, and no `npm publish` to run by hand.

## Choosing the bump

Following semver, and noting that at `0.x` a breaking change is a `minor`, not a `major` -- `major` would mean declaring 1.0.0:

- `patch` -- bug fixes, docs. `0.1.0 -> 0.1.1`
- `minor` -- new features, and breaking changes while at `0.x`. `0.1.0 -> 0.2.0`
- `major` -- reserved for 1.0.0 and beyond.

Always pass `--no-git-tag-version`. Without it `npm version` creates a local tag that the workflow will later try to create again.

## What happens on merge

`.github/workflows/publish.yml` fires on every push to `main` and asks npm whether the version in `package.json` already exists.

- **Already on npm** -- the run stops there. Nothing is published.
- **New version** -- `npm ci`, `npm run check`, `npm publish --access public`, then the commit is tagged `v<version>`, the tag is pushed, and a GitHub Release is created from it.

The Release is a _consequence_ of a successful publish, not the trigger for one. A failed step ends the job, so a tag and a Release can never describe a version npm does not actually have. Its notes are generated from the pull requests merged since the previous release, categorised by the labels configured in `.github/release.yml`; anything unlabelled lands under "Other changes" rather than being dropped.

`prepack` runs `npm run build` as part of `npm publish`, so `dist/` is always rebuilt from the merged source. This matters because `dist/` is gitignored: the tarball's contents exist only because the build ran.

The workflow also runs `npm pkg delete scripts.prepare` immediately before publishing. `prepare` installs git hooks for anyone who clones this repo and does nothing for anyone who installs the package, but npm records it in the registry metadata and warns every consumer that the package "has install scripts". The deletion belongs in the workflow rather than in `prepack`, because npm reads the manifest before the pack lifecycle runs: a hook would clean the tarball while the registry still served the original. The workflow edits the checkout npm is about to read, and that checkout is discarded.

Publishing uses npm **trusted publishing** (OIDC), so there is no `NPM_TOKEN` and provenance is attached automatically. It runs in a protected `release` environment scoped to `main`.

Watch it: `gh run watch`.

## Forgetting to bump

Nothing breaks. The workflow finds the version already on npm and exits without publishing, so `main` simply carries an unreleased change until a later PR bumps it.

CI prints a warning on any PR that touches `src/`, `docs/` or `README.md` without changing the version. It is a reminder, not a gate -- a PR can legitimately land without a release.

## Arming the release pipeline

Trusted publishing is configured per package, at a package-scoped endpoint, so **the package has to exist on npm before it can be attached**. `npm trust` does not get around this: against a name npm has never seen it fails with `404 POST /-/package/<name>/trust`. A new package therefore takes one by-hand publish, once, and never again.

**1. Publish once, by hand.** From a clean `main`, at whatever version it carries:

```sh
npm login
npm publish --access public
```

This version has no provenance -- that needs the OIDC token only CI holds -- which is why it is a throwaway. Publishing `main` at `0.0.0` keeps it obviously a placeholder and avoids editing the version to do it.

**2. Attach the trusted publisher.** Now that the package exists:

```sh
npm trust github eslint-plugin-repertoire \
  --file publish.yml \
  --repo joematthews/eslint-plugin-repertoire \
  --env release \
  --allow-publish
```

Each flag has to match the workflow exactly or npm rejects the run with a 404 that does not say why:

| flag | must match |
| --- | --- |
| `--file` | the workflow filename alone, not a path. npm authorises the workflow that _triggers_ the run, so this is `publish.yml` and nothing may publish from a reusable workflow it calls. |
| `--repo` | `repository.url` in `package.json`. |
| `--env` | the `environment:` key in `publish.yml`, which is `release`. Omitting it here while the workflow sets one is the common cause of a rejected publish. |
| `--allow-publish` | required. Configurations created after 20 May 2026 must name at least one allowed action; older ones defaulted to publish. |

`npm trust` needs an interactive 2FA prompt and cannot be driven by a token, so it is a step at a terminal. Confirm it took with `npm trust list eslint-plugin-repertoire`, which also needs a one-time password.

**3. Arm the workflow.** The `publish` job is gated on a `PUBLISH_ENABLED` repository variable so pushes to `main` skip it rather than fail while the pipeline is half-built. Run this from a checkout of the repository, since `gh` reads the remote from git:

```sh
gh variable set PUBLISH_ENABLED --body true
```

**4. Release the first real version** through a version-bump PR, as every later one goes. Merging it publishes with provenance, tags the commit and cuts the Release.

**5. Retire the placeholder** once a real version is `latest`:

```sh
npm deprecate eslint-plugin-repertoire@0.0.0 "bootstrap release, use 0.1.0 or later"
```

The published record afterwards is one deprecated stub with no provenance, and every version from the first real release onward carrying provenance and a matching GitHub Release.

## What the pipeline relies on

- **The repository is public.** Under trusted publishing npm generates a provenance attestation automatically, and provenance is [not supported from private source repositories](https://docs.npmjs.com/generating-provenance-statements/), so a publish from a private repo fails on that step. Trusted publishing itself works either way -- it is provenance specifically that needs the public repo.
- **A `release` environment**, whose deployment branch policy names `main`. The trigger is a push to a branch, not a tag: a policy left scoped to `v*` tags blocks the deployment.
- **`repository.url` in `package.json` matches the GitHub repository exactly.** npm checks it.
- **Node 22.14 or later and npm 11.5.1 or later** on the runner, which trusted publishing requires. The workflow reads `.nvmrc` and runs `npm install -g npm@latest`.
- **Direct pushes to `main` blocked**, so every release goes through a reviewed PR.

## Do not

- Run `npm publish` yourself.
- Create the `v*` tag by hand -- the workflow does it, and a tag that disagrees with `package.json` is confusing at best.
- Bump the version in a commit straight to `main`, which bypasses the review the model depends on.
