# API testing and quality gates

Read the relevant sections when changing behavior, tests, CI, or quality configuration.

## Testing

- Use file-backed SQLite for persistence integration tests. Add external database containers only if a future task introduces a concrete external infrastructure dependency.
- Prefer behavior-focused tests over implementation-detail tests.
- Every test must assert at least once.
- Test names must be full English sentences describing the expected behavior.
- Tests must be deterministic and independent.
- Avoid hidden shared state between test cases.
- Prefer explicit setup in the test body unless a fixture makes the test clearer.
- Prefer fakes and stubs over mocks.
- Tests must not depend on Internet access unless the test explicitly targets network integration.
- Tests that wait for async work must use bounded timeouts.
- Tests should create temporary files in temporary directories, not inside the repository.
- Integration tests must cleanly dispose temporary files and external resources.
- Do not assert on full human-readable error messages when a stronger contract exists, such as status code, error code, or structured payload.
- Auth tests must cover bootstrap registration, second registration rejection, login, logout, `me`, disabled-user cookie revocation, and admin-only user management.
- Collection isolation tests must cover that user A cannot list, get, update, or delete user B's data.
- Persistence tests must cover per-collection uniqueness and cross-collection foreign key failures for release-track, credit, relation, and owned-item references.

## CI and Code Quality

- SonarCloud quality gates must be satisfied by tests and focused code changes, not by broad exclusions.
- Sonar coverage exclusions must stay narrow. Only application bootstrap (`Program.cs`) is acceptable by default.
- Sonar duplication exclusions must stay narrow and justified by generated output or explicitly approved maintenance cost.
- Do not exclude DTOs, route builders, mappers, HTTP helpers, Identity glue, domain models, or persistence configurations from coverage unless the project owner explicitly approves that trade-off.
- Run Sonar analysis on a runner where the full `dotnet test` suite can execute.
- Sonar workflows must fail if `dotnet test` fails. Shell scripts should use fail-fast behavior such as `set -euo pipefail`.
- If Sonar reports unexpectedly low coverage while tests appear green, inspect the workflow logs for failed tests inside the Sonar job before adding exclusions.

Run the affected tests and required repository checks; broaden only for a concrete risk or failure. Existing test coverage requirements do not require rerunning every listed scenario after an unrelated edit.
