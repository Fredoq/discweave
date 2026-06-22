# Import Regression Fixture Matrix

This matrix maps the local import regression fixture scope to synthetic tests and
manual acceptance coverage. Fixtures use made-up paths, artists, releases, and
hashes; no private music-library data or audio bytes are committed.

## Automated coverage

| Scenario                               | API coverage                                                                                                                       | Electron scanner coverage                                                                           | UI coverage                                                                                           |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Normal release folder                  | `DesktopImportRegressionFixtureTests.Regression_fixture_imports_normal_compilation_and_multi_disc_release_folders`                 | `scanner.test.cjs` synthetic messy fixture and full scan cases                                      | `App.imports-regression-fixtures.test.tsx` scan save/review                                           |
| Names-only cloud folder                | `DesktopImportRegressionFixtureTests.Regression_fixture_covers_names_only_missing_hashes_skipped_drafts_and_moved_duplicate_files` | `scans filenames only without reading audio or cover bytes`; names-only manifest safety             | `App.imports-desktop.test.tsx` names-only scan                                                        |
| Missing hash fallback                  | `DesktopImportRegressionFixtureTests` names-only missing-hash assertions                                                           | names-only scanner returns null hash without reading bytes                                          | `App.imports-desktop.test.tsx` posts null names-only hash                                             |
| Duplicate hash                         | `DesktopImportRegressionFixtureTests` moved duplicate assertion; `DesktopImportPartialDuplicateAmbiguityTests`                     | N/A — duplicate matching is API/catalog behavior                                                    | `App.imports-exports.test.tsx` duplicate match display                                                |
| Same hash at different paths           | `DesktopImportRegressionFixtureTests` and `DesktopImportMoveHintTests`                                                             | Manifest tests verify path-keyed local entries                                                      | `App.imports-desktop.test.tsx` move hint display                                                      |
| Moved or renamed file                  | `DesktopImportMoveHintTests`; `DesktopImportRegressionFixtureTests`                                                                | manifest/rescan tests cover local path changes                                                      | `App.imports-desktop.test.tsx` move hint display                                                      |
| Skipped tracks/drafts                  | `DesktopImportRegressionFixtureTests` skip assertion; existing skip endpoint tests                                                 | N/A                                                                                                 | Draft skip UI covered in import workspace tests                                                       |
| Root-level loose files                 | `DesktopImportRegressionFixtureTests`; `DesktopImportLooseFileCandidateTests`                                                      | scanner emits root file metadata only                                                               | `App.imports-regression-fixtures.test.tsx`; `App.imports-loose-files.test.tsx` loose file panel       |
| Mixed album tags                       | `DesktopImportRegressionFixtureTests`; `DesktopImportLooseFileCandidateTests`                                                      | scanner emits tags/metadata for grouping                                                            | `App.imports-regression-fixtures.test.tsx`; `App.imports-loose-files.test.tsx` mixed loose candidates |
| No album tags                          | `DesktopImportRegressionFixtureTests` untagged folder draft assertion                                                              | scanner metadata-null names-only/full paths                                                         | Import review draft display tests                                                                     |
| Compilation                            | `DesktopImportRegressionFixtureTests` compilation assertion                                                                        | scanner emits metadata; grouping is API-owned                                                       | `App.imports-regression-fixtures.test.tsx` import draft review                                        |
| Multi-disc folders                     | `DesktopImportRegressionFixtureTests` `CD 1`/`CD 2` assertions                                                                     | scanner preserves relative paths                                                                    | `App.imports-regression-fixtures.test.tsx` import draft review; release entry disc/side tests         |
| Unsupported files                      | API diagnostics persistence via desktop scan diagnostics tests                                                                     | `scanner.test.cjs` unsupported extension diagnostics                                                | `App.imports-diagnostics.test.tsx` diagnostic display                                                 |
| Hidden files                           | API diagnostics persistence via desktop scan diagnostics tests                                                                     | `scanner.test.cjs` hidden path diagnostics                                                          | `App.imports-diagnostics.test.tsx` diagnostic display                                                 |
| Symlinks                               | API diagnostics persistence via desktop scan diagnostics tests                                                                     | `scanner.test.cjs` symlink ignored diagnostics                                                      | Diagnostic display coverage                                                                           |
| Deep nesting                           | API accepts scanner depth diagnostics                                                                                              | `scanner.test.cjs` depth-limit diagnostics                                                          | Diagnostic display coverage                                                                           |
| Unreadable files/directories           | API accepts scanner unreadable diagnostics                                                                                         | `scanner.test.cjs` directory unreadable and hash failure diagnostics                                | Diagnostic display coverage                                                                           |
| Oversized covers                       | API cover warning persistence via scan diagnostics                                                                                 | `scanner.test.cjs` cover-too-large diagnostics                                                      | Diagnostic display coverage                                                                           |
| Create release draft from loose files  | `DesktopImportLooseFileDraftTests`                                                                                                 | N/A                                                                                                 | `App.imports-loose-files.test.tsx` create draft flow                                                  |
| Attach loose files to existing release | `DesktopImportLooseFileAttachTests`                                                                                                | N/A                                                                                                 | `App.imports-loose-files.test.tsx` attach/relink flow                                                 |
| No audio bytes uploaded/stored         | `DesktopImportRegressionFixtureTests`; loose-file API tests                                                                        | `scanner.test.cjs` synthetic messy fixture, names-only byte-safety, and manifest no-byte assertions | `App.imports-desktop.test.tsx` request body no-audio assertions                                       |
| Collection isolation                   | `ImportCollectionIsolationEndpointTests`; loose-file isolation tests                                                               | N/A                                                                                                 | API client asserts no collection ids in responses                                                     |

## Acceptance checklist

Use synthetic files or a disposable folder. Do not use a private real music
library for release smoke tests.

1. Create a disposable `Messy Import Fixture` folder with:
   - one normal release folder with a cover;
   - one `Various Artists` compilation with `CD 1` and `CD 2` subfolders;
   - one cloud-style folder to scan in names-only mode;
   - one root-level audio file;
   - one folder where two audio files have different album tags;
   - one unsupported text file, one hidden file, and one symlink.
2. In the macOS desktop app, run a full scan of the disposable folder.
3. Confirm the review page shows release drafts for normal/compilation folders,
   loose candidates for root/mixed-tag files, and diagnostics for unsupported or
   ignored filesystem entries.
4. Confirm the outgoing scan payload and API responses contain paths, metadata,
   hashes, cover artifacts where expected, and no audio bytes.
5. Confirm at least one normal draft, then rescan after renaming/moving one file;
   verify the moved/renamed hint appears.
6. Use one loose-file action:
   - either create a release draft from a pending loose candidate; or
   - attach a loose candidate to an existing release track and confirm the local
     file link appears.
7. Export JSON after the import and verify catalog/import state is present while
   audio bytes are absent.
