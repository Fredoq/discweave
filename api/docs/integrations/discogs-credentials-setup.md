# Discogs Credentials Setup

This document records the configuration contract for optional Discogs
autocomplete credentials.

Discogs access is optional and disabled by default. DiscWeave must keep
ordinary catalog, search, import, export, and restore workflows working when the
Discogs provider is disabled or when no Discogs credential is configured.

## Local Setup

Use a Discogs account controlled by the local user or project maintainer. In
Discogs account settings, open the `Developers` area to register the
application or create an API token. Discogs documents this entry point in the
account settings page as the place where applications can be registered and API
tokens can be created.

Use a durable application identity:

- application name: `DiscWeave`;
- user agent: `DiscWeave/0.1 (+https://github.com/Fredoq/discweave)`;
- website URL: the DiscWeave repository URL unless a future integration task
  defines another public project URL.

Do not use a name that implies Discogs partnership, sponsorship, endorsement, or
ownership. The app name and user agent must remain stable product identifiers,
not release-channel names.

## Configuration Keys

The API reads non-secret Discogs provider settings from the backend
configuration section named `Discogs`.

```sh
Discogs__Enabled=false
Discogs__BaseUrl=https://api.discogs.com
Discogs__UserAgent="DiscWeave/0.1 (+https://github.com/Fredoq/discweave)"
Discogs__TimeoutSeconds=10
```

`Discogs__Enabled` controls whether external metadata endpoints may call
Discogs. The default is `false`.

`Discogs__BaseUrl` defaults to the official Discogs API root.

`Discogs__UserAgent` must identify DiscWeave to Discogs and must not include
secret values.

`Discogs__TimeoutSeconds` is the outbound provider timeout. The default is
`10`.

The Discogs access token is not a backend configuration key in desktop mode.
Users save and remove their own token through Settings -> Integrations. The API
stores it in the local integration settings file under Application Support,
outside collection data. The token must not be committed to Git, exposed to the
app renderer, logged, exported, restored, or included in desktop packages.

## Local Configuration

Set non-secret defaults through ordinary environment configuration:

```sh
Discogs__Enabled=false
Discogs__BaseUrl=https://api.discogs.com
Discogs__UserAgent="DiscWeave/0.1 (+https://github.com/Fredoq/discweave)"
Discogs__TimeoutSeconds=10
```

When Discogs autocomplete is ready to be enabled locally, set
`Discogs__Enabled=true` in that environment and save the personal access token
through Settings -> Integrations.

Do not place the token in:

- repository files;
- web build environment variables;
- desktop build environment variables;
- issue comments, PR descriptions, logs, screenshots, or support messages.

The app must call only DiscWeave API endpoints. It must never call Discogs
directly from the renderer and must never receive the Discogs token.

## Local Development

Local development should run with Discogs disabled unless a developer is
explicitly working on the provider integration:

```sh
Discogs__Enabled=false
```

For provider work, enable the provider locally:

```sh
dotnet user-secrets set "Discogs:Enabled" "true" --project src/DiscWeave.Api/DiscWeave.Api.csproj
```

The local token should be entered through Settings -> Integrations and should
belong to the developer or to an operator-approved test account. Do not reuse
production credentials locally.

Automated tests must use fake HTTP or fake provider implementations. Normal CI
must not require Internet access or real Discogs credentials.

## Optional Manual Smoke Check

The real-API smoke check is optional and must stay outside normal CI. Use it
only after provider code exists and only from an environment where the token is
saved through Settings -> Integrations.

The smoke check should verify:

- provider disabled mode does not call Discogs;
- provider enabled mode sends the configured user agent;
- a simple request to `https://api.discogs.com` succeeds;
- rate-limit and provider-error responses are reported without leaking the
  token;
- unrelated DiscWeave catalog workflows still work if Discogs is unavailable.

Do not paste real tokens into shell history, logs, or issue comments.

## Required Copy

Every public-facing use of Discogs API content must include this notice in
product or usage documentation:

> This application uses Discogs' API but is not affiliated with, sponsored or endorsed by Discogs. 'Discogs' is a trademark of Zink Media, LLC.

Every visible Discogs candidate must include attribution next to the data:

> Data provided by Discogs.

The attribution must link to the relevant `discogs.com` source page for the
candidate data.

## References

- [API Terms of Use](https://support.discogs.com/hc/en-us/articles/360009334593-API-Terms-of-Use)
- [Application Name and Description Policy](https://support.discogs.com/hc/en-us/articles/360009207054-Application-Name-and-Description-Policy)
- [Account settings / Developers token reference](https://support.discogs.com/hc/en-us/articles/360007423833-How-Do-I-Change-My-Account-Settings)
- [Discogs API root](https://api.discogs.com/)
