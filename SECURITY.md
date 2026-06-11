# Security Policy

DiscWeave stores local collection data, import metadata, filesystem paths, and export artifacts. Treat all user archive data as private.

## Supported versions

Security fixes are accepted for the active `main` branch until versioned desktop releases are established.

## Reporting a vulnerability

Please report suspected vulnerabilities through GitHub Security Advisories:

https://github.com/Fredoq/discweave/security/advisories/new

Do not open a public issue for a suspected vulnerability. Include the affected commit or version, impact, reproduction steps, and any relevant logs with private data removed. Keep details confidential until a fix or disclosure plan is agreed.

## Local data expectations

- Do not commit real collection exports, logs, tokens, signing certificates, or local `.env` files.
- Destructive import, restore, and recovery workflows must require explicit confirmation.
- The desktop renderer must not receive arbitrary filesystem access or the per-launch local backend token.
