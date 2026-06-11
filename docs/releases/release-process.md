# Release Process

DiscWeave desktop releases are published by GitHub Actions after changes land on
`main`.

## Automation

1. A pull request runs the `CI` workflow.
2. After the pull request is merged, the same `CI` workflow runs on `main`.
3. When `CI` succeeds on `main`, the `macOS release` workflow starts.
4. The release workflow computes the next SemVer version, updates
   `app/package.json`, `app/package-lock.json`, and `api/Directory.Build.props`,
   then runs the release verification set.
5. If verification and DMG packaging succeed, the workflow pushes a
   `chore(release): vX.Y.Z [skip ci]` commit and annotated `vX.Y.Z` tag
   atomically.
6. The workflow creates or updates the GitHub Release, attaches the Apple
   Silicon DMG, and attaches `SHA256SUMS.txt`.

The release commit uses `[skip ci]` because it only records the already verified
version bump. GitHub release notes are generated from merged pull requests and
categorized by `.github/release.yml`.

## Versioning

The default bump mode is automatic:

- before the first SemVer tag exists, `auto` creates a patch release from the
  current repository version;
- `major` for commits with `BREAKING CHANGE` or a Conventional Commits `!`;
- `minor` for `feat:`, `feature:`, `Add ...`, `Implement ...`, or
  `Introduce ...` commits;
- `patch` for other non-release commits.

Manual releases can override this from the `macOS release` workflow dispatch
form with either a bump mode or an exact `X.Y.Z` version.

## Required Secrets

Unsigned local packaging can run without Apple secrets. Signed and notarized
release builds require these repository secrets:

- `MACOS_CERTIFICATE_P12`
- `MACOS_CERTIFICATE_PASSWORD`
- `APPLE_ID`
- `APPLE_APP_SPECIFIC_PASSWORD`
- `APPLE_TEAM_ID`

## Manual Fallbacks

Use `workflow_dispatch` on `macOS release` when the automated run must be
retried after an infrastructure failure. Existing version tags matching
`v*.*.*` can also run the workflow and republish release assets for that tag.

Run the local desktop smoke checklist on the published artifact before treating
the release as fully accepted.

App Store distribution, auto-update, donations, sync, and cloud services are out
of scope for the local-first release path.
