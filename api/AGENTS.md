# DiscWeave API

The API is the local backend and domain boundary. Root repository rules govern
language, product knowledge, and local versus remote completion.

## Stack and conditional references

Use the configured SDK and target frameworks; the intended baseline is .NET 10 /
C# 14, ASP.NET Core, EF Core, xUnit, and file-backed SQLite integration tests.
Use `api/.editorconfig` for mechanical style. Private instance fields, including
EF backing fields, use `_camelCase`.

Do not use AutoMapper/convention-based mapping, MediatR/in-process mediators,
MassTransit, Moq, or FluentValidation. Use explicit mapping, direct application
calls, and handwritten test doubles. Add Redis, RabbitMQ, background workers,
or queues only for an explicitly needed product scenario.

- For domain, contract, persistence, or integration changes, read the relevant
  sections of [API design decisions](docs/engineering/api-design.md).
- For behavior, test, CI, or coverage changes, read the relevant sections of
  [testing and quality](docs/engineering/testing-quality.md).
- Follow the root OKF routing for product meaning. Model the collection domain,
  rather than current UI screens or a future player.

## Authentication boundary

Existing authenticated account flows remain until the local desktop
owner-session work lands in Roadmap 42; do not change them incidentally.

- Use ASP.NET Core Identity, `DiscWeaveUser : IdentityUser<Guid>`, secure
  HTTP-only same-origin cookies, and roles named exactly `User` and `Admin`.
- Public registration is bootstrap-only while no users exist. A database
  transaction must serialize first-user creation of the admin and their default
  `MusicCollection`; subsequent user creation is admin-only.
- Disabled users cannot log in or retain cookie access. Rotate their security
  stamp and validate cookie principals against `IsDisabled` and
  `DefaultCollectionId`.
- Only `/health` and required auth endpoints are anonymous. Catalog operations
  require authenticated collection access; user management requires `Admin`.
- Collection-member authorization requires a valid non-empty default collection
  claim. Return `404` for inaccessible resources to avoid existence leaks.
- JWT, OAuth, OIDC, broad CORS, or external identity providers require an
  explicit product requirement.

## Collection and data safety

- Each user has one default `MusicCollection`. Shared/public collections,
  collection switching, and ACLs require an explicit product change.
- Use typed `UserId` and `CollectionId`; resolve identity through `ICurrentUser`
  and scope through `ICurrentCollection` from the authenticated default claim.
- Catalog, relation, credit, and ownership entities carry `CollectionId`.
  Filter reads and repositories by it, stamp it on creation, and scope import
  deduplication per collection. Never trust client IDs to establish scope.
- Normal catalog APIs are collection-relative: do not require or expose
  route/query `collectionId`. Cross-collection references for releases, tracks,
  credits, relations, and owned items must fail through database constraints.
- The local desktop baseline creates SQLite schema from the EF model. Generated
  migrations require an explicitly scoped durable upgrade path. Back up
  collection data before upgrades affecting persisted user data or settings.
- Keep API contracts distinct from persistence models. Return structured errors
  without stack traces or internal exception details, and propagate cancellation
  through asynchronous request and infrastructure calls.
