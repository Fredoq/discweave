# Security Policy

DiscWeave stores local collection data, import metadata, filesystem paths, and export artifacts. Treat all user archive data as private.

## Supported versions

Security fixes are accepted for the active `main` branch until versioned desktop releases are established.

## Reporting a vulnerability

Please report suspected vulnerabilities privately to the repository owner instead of opening a public issue. Include the affected commit or version, impact, reproduction steps, and any relevant logs with private data removed.

## Local data expectations

- Do not commit real collection exports, logs, tokens, signing certificates, or local `.env` files.
- Destructive import, restore, and recovery workflows must require explicit confirmation.
- The desktop renderer must not receive arbitrary filesystem access or the per-launch local backend token.
