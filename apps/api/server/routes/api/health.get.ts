export default defineEventHandler(async () => {
  /**
   * Lightweight health-check endpoint.
   *
   * - Read-only and side-effect free
   * - Safe to expose publicly (no secrets/config returned)
   * - CORS is handled via Nitro routeRules for /api/** (see nitro.config.ts)
   */
  const uptimeSeconds = process.uptime();
  const timestamp = new Date().toISOString();

  // Prefer common places where version might exist; fall back to null if unavailable.
  const version =
    process.env.npm_package_version ??
    process.env.APP_VERSION ??
    null;

  return {
    status: "ok",
    uptime: uptimeSeconds,
    timestamp,
    version,
  };
});
