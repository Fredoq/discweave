# Import Filesystem Boundary

Local folder import and local file edit operations stay behind Electron main and preload.

- The renderer can request a native folder picker but cannot enumerate arbitrary paths itself.
- Scanner input must be an absolute path returned by the desktop shell and resolved through the real filesystem path before traversal.
- Traversal ignores hidden files, non-files, symlinks, and excessive nesting.
- SHA-256 hashing, audio metadata reads, cover reads, and tag edits happen in Electron main.
- Local edits are authorized by comparing requested paths with backend-owned item paths before writing.
