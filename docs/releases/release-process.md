# Release Process

DiscWeave desktop releases are published from version tags through GitHub Actions.

1. Confirm the roadmap issue set for the release is merged.
2. Run CI on `main`.
3. Create a SemVer tag such as `v2.0.0`.
4. Let the macOS release workflow build the Apple Silicon DMG, sign, notarize, checksum, and publish release notes.
5. Run the local desktop smoke checklist on the published artifact.

App Store distribution, auto-update, donations, sync, and cloud services are out of scope for the local-first release path.
