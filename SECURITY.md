# Security Policy

Cratebase stores personal collection data, so privacy and collection isolation are core security concerns.

## Reporting a Vulnerability

Please report security vulnerabilities privately through GitHub security advisories when available, or by contacting the project maintainer directly.

Do not open a public issue for vulnerabilities that expose user data, authentication weaknesses, authorization bypasses, import path traversal, or export leakage.

## Scope

Security-sensitive areas include:

- authentication and session handling;
- frontend handling of private collection data;
- API calls that read, write, import, export, search, or mutate collection data;
- file import UI and metadata display;
- CSV, JSON, and future backup export flows.

## Expectations

- Do not expose `collectionId` in normal UI state unless a diagnostic or administrative scenario requires it.
- Do not add user-controlled collection identifiers to catalog routes.
- Treat cross-user collection visibility as a security bug.
- Do not commit secrets, tokens, personal data exports, or real private collection fixtures.
