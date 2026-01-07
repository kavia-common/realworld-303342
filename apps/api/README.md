# Nitro starter

Look at the [nitro quick start](https://nitro.unjs.io/guide#quick-start) to learn more how to get started.

## Maintenance notes (refactor + logging)

- **Refactor (behavior-preserving):** `apps/api/server/auth-event-handler.ts` — `definePrivateEventHandler` was refactored for readability by extracting small helpers (Authorization token parsing and token verification) and using early returns. All auth logic, return shapes, and error behavior are unchanged.
- **Logging (major workflow):** `apps/api/server/routes/api/users/login.post.ts` — added minimal structured logs for the login workflow:
  - `request_start` / `request_end` (with `durationMs`)
  - `login_attempt` (email only; password/body never logged)
  - `login_validation_failed`, `login_failed`, `login_success`
  - `request_error` (status/message only)
  - Logs are emitted via `console.info/warn/error` and will appear in the Nitro dev/preview server console output.
=======
