# Nitro starter

Look at the [nitro quick start](https://nitro.unjs.io/guide#quick-start) to learn more how to get started.

## Health check

A lightweight health endpoint is available under the API namespace:

- `GET /api/health`

Response example:

```json
{
  "status": "ok",
  "uptime": 123.456,
  "timestamp": "2026-01-07T12:34:56.789Z",
  "version": "1.2.3"
}
```

Notes:
- Read-only and side-effect free.
- CORS is enabled for `/api/**` via `apps/api/nitro.config.ts`.

## Input validation (representative flow)

The registration endpoint `POST /api/users` now performs request-body validation using explicit schema-like checks.

If validation fails, it returns:

- HTTP **422** (Unprocessable Entity)
- A predictable RealWorld-style error body:

```json
{
  "errors": {
    "email": ["can't be blank"],
    "password": ["can't be blank"]
  }
}
```

This change is limited to the registration flow; other endpoints preserve existing behavior.

## Maintenance notes (refactor + logging)

- **Refactor (behavior-preserving):** `apps/api/server/auth-event-handler.ts` — `definePrivateEventHandler` was refactored for readability by extracting small helpers (Authorization token parsing and token verification) and using early returns. All auth logic, return shapes, and error behavior are unchanged.
- **Logging (major workflow):** `apps/api/server/routes/api/users/login.post.ts` — added minimal structured logs for the login workflow:
  - `request_start` / `request_end` (with `durationMs`)
  - `login_attempt` (email only; password/body never logged)
  - `login_validation_failed`, `login_failed`, `login_success`
  - `request_error` (status/message only)
  - Logs are emitted via `console.info/warn/error` and will appear in the Nitro dev/preview server console output.
- **Logging (extended):** Registration and key article workflows now include the same basic structured logging style (start/end + duration, key decisions, and redaction):
  - Registration: `apps/api/server/routes/api/users/index.post.ts`
  - Articles: `apps/api/server/routes/api/articles/**` (list, create, feed, get, update, delete, favorite, comments)
