// Domain errors for the data-access and persistence layers.
//
// These live below tRPC on purpose: the query/mutation catalogs and the
// view persistence helpers are called from two places — tRPC procedures and
// the agent's tool executor — and only one of those has a notion of tRPC
// error codes. Throwing a domain error lets the tRPC boundary map it to a
// proper code (see mapDomainError in trpc.ts) while the agent path keeps
// getting a plain Error with a message it can hand back to the model.

export type DomainErrorKind = "not_found" | "forbidden" | "invalid" | "conflict";

export class DomainError extends Error {
  readonly kind: DomainErrorKind;

  constructor(kind: DomainErrorKind, message: string) {
    super(message);
    this.name = "DomainError";
    this.kind = kind;
  }
}

// A record that either doesn't exist or isn't the caller's to see. These are
// deliberately the same error: a foreign org's view id must be
// indistinguishable from a nonexistent one, or the 404/403 split becomes an
// oracle for probing which ids exist in other workspaces.
export class NotFoundError extends DomainError {
  constructor(what: string) {
    super("not_found", `${what} not found`);
    this.name = "NotFoundError";
  }
}

// The caller is authenticated and the record exists, but the action isn't
// allowed for them (e.g. a member trying to do something owner-only). Only
// use this where existence is already known to the caller.
export class ForbiddenError extends DomainError {
  constructor(message: string) {
    super("forbidden", message);
    this.name = "ForbiddenError";
  }
}

// The request is well-formed but doesn't make sense against current state —
// seeding a workspace that already has projects, referencing an unknown
// catalog id, and so on.
export class InvalidRequestError extends DomainError {
  constructor(message: string) {
    super("invalid", message);
    this.name = "InvalidRequestError";
  }
}

export class ConflictError extends DomainError {
  constructor(message: string) {
    super("conflict", message);
    this.name = "ConflictError";
  }
}
