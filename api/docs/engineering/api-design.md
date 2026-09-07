# API design and persistence decisions

Read the sections relevant to domain, contract, persistence, or integration changes.

## API contracts

Keep endpoints resource-oriented and predictable, with stable request/response
contracts and deterministic, machine-readable validation errors. Prefer
pagination for collection reads and explicit filters over ambiguous query inputs.

## Architecture

Use Clean Architecture, DDD, and Vertical Slice principles pragmatically.

The default direction of dependencies:

- Domain depends on nothing application-specific or infrastructure-specific.
- Application depends on Domain.
- Infrastructure depends on Application and Domain.
- API composition root depends on all layers and wires them together.

Vertical slices should group request handling, contracts, validation, and application behavior for a feature. Keep shared abstractions small and real.

DDD rules:

- Domain entities own business invariants.
- Value objects should be immutable.
- Aggregates should expose behavior, not public mutable state.
- Domain services are acceptable only when behavior does not naturally belong to an entity or value object.
- Persistence concerns must not leak into domain behavior.
- Do not make EF Core entities the only domain model unless the design remains clean, explicit, and testable.

## Domain Priorities

Use the domain concepts documented under `../../../okf/domain/` as the source of
truth for product meaning.

API-specific domain guardrails:

- Relation, import, export, and search behavior must remain first-class API
  concerns.
- Credits and relations must support role-based search without adding one-off
  columns for each role.
- Statuses such as owned, wanted, sold, and needs digitization must be explicit
  data, not inferred from file presence.

## Persistence

- Use EF Core intentionally; do not hide query composition or persistence behavior behind broad abstractions.
- Treat `DbContext` as the concrete unit of work and `DbSet` as the concrete repository implementation.
- EF Core `DbContext` types may remain unsealed when the repository/unit-of-work implementation needs cast-based generic interface dispatch.
- Command-side repository interfaces may exist only as thin EF-aware contracts: `TryFindAsync`, `Add`, and `Delete`.
- Do not create standalone generic repository implementation classes. The EF Core `DbContext` must implement supported repository interfaces directly, usually through explicit members in partial files grouped by aggregate root.
- Repository lookup must use public domain identifiers such as `ArtistId`, `ReleaseId`, and `TrackId`. It must not use infrastructure-only shadow surrogate keys.
- Use `IUnitOfWork.SaveChangesAsync` to commit command changes. Do not add a custom unit-of-work implementation separate from EF Core.
- Use named query interfaces for reusable read models and reports. Define query contracts in Application and implement them in Infrastructure with EF Core LINQ projections.
- Do not introduce a generic specification pipeline. Reusable queries should be methods with descriptive names.
- Prefer specific query/application services over broad generic query abstractions.
- Model constraints in the database when they represent real invariants.
- The `AspNetUsers.DefaultCollectionId -> collections.collection_id` relationship is modeled in EF and should clear the default collection with `SetNull` if needed.
- Keep collection ownership invariants explicit without weakening typed IDs or forcing invalid EF runtime relationships between domain value objects and Identity keys.
- Avoid lazy loading by default.
- Avoid N+1 queries; use projections and explicit includes where appropriate.
- Use optimistic concurrency where user-owned mutable data needs conflict protection.

## Mapping

- Mapping must be explicit and readable.
- Avoid reflection-based or convention-based mapping.
- Keep mapping close to the feature or boundary where it is used.
- Do not introduce shared mapping layers before duplication is real and harmful.

## Validation

- Prefer validation where the invariant belongs:
  - value objects for domain invariants;
  - endpoint/request validation for input shape;
  - application services for workflow rules;
  - database constraints for persisted uniqueness and referential integrity.
- Validation messages committed to the repository must be in English.

## Messaging and Caching

When Redis is introduced:

- cache only data with clear invalidation rules;
- use short, explicit key formats;
- avoid caching domain objects directly if contracts are more stable;
- tests must cover cache miss and cache invalidation behavior.

When RabbitMQ is introduced:

- define message contracts explicitly;
- design idempotent consumers;
- include retry and dead-letter behavior intentionally;
- use the RabbitMQ client directly or a small local abstraction.

## C# Design Rules

- Classes and records should be `sealed` by default.
- Put exactly one top-level type in each `.cs` file. This applies to classes, records, structs, interfaces, and enums. Name the file after that type.
- Prefer immutability for value objects and contracts.
- Use `Guid.CreateVersion7()` for newly generated GUID values, including typed IDs. Do not use `Guid.NewGuid()` for domain identifiers.
- Use `class` for objects with identity, lifecycle, or behavior-heavy invariants.
- Use `record` or `record struct` only when value semantics are intentional.
- Do not use primary constructors for classes or records unless the repository explicitly adopts them later.
- Keep public APIs small.
- Avoid public mutable setters outside persistence models and serialization contracts.
- Domain models must not expose nullable public properties, nullable parameters, optional parameters with `null` defaults, or `null` sentinel values.
- Represent optional domain data with explicit value objects such as `OptionalValue<T>`, and represent alternatives with distinct subtypes instead of paired nullable identifiers.
- C# `enum` is allowed for simple closed domain choices with no variant-specific state or behavior.
- Use object models for domain choices when variants need behavior, state, invariants, or richer identity.
- Domain choices must not be represented by public string codes or descriptions, and must not expose open factories such as `FromCode` or `FromDescription`.
- Avoid static methods for business logic.
- Prefer composition over inheritance.
- Avoid reflection for domain behavior.
- Avoid type introspection and casts in domain logic.
- Methods should not return `null`; use exceptions, empty collections, `OptionalValue<T>`, or explicit result objects.
- Do not pass `null` as a valid argument.
- Error and log messages should be single English sentences and should not end with a period.

## Comments and Documentation

Use brief English XML documentation when it clarifies a public contract.
Keep non-obvious intent and trade-offs documented; do not narrate syntax.

Use Mermaid for domain diagrams. When domain entities, value objects, typed IDs,
capability interfaces, or relationships change, update
[the domain model](../arch/domain-model.md) with the change.
