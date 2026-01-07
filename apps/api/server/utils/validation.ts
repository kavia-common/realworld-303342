type ValidationErrors = Record<string, string[]>;

/**
 * Converts unknown input into a string if possible, otherwise returns null.
 */
const asTrimmedStringOrNull = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
};

// PUBLIC_INTERFACE
export const validateUserRegistrationBody = (body: unknown): {
  ok: true;
  value: {
    email: string;
    username: string;
    password: string;
    image?: string;
    bio?: string;
    demo?: any;
  };
} | {
  ok: false;
  errors: ValidationErrors;
} => {
  /**
   * Validates the request body shape for `POST /api/users`.
   *
   * Behavior goals:
   * - Return predictable `{ errors: { ... } }` structure
   * - Use HTTP 422 (as existing routes do) for validation problems
   * - Keep existing semantics (`can't be blank`) for required fields
   */
  const errors: ValidationErrors = {};

  if (!body || typeof body !== "object") {
    return { ok: false, errors: { body: ["is invalid"] } };
  }

  const maybeUser = (body as any).user;
  if (!maybeUser || typeof maybeUser !== "object") {
    return { ok: false, errors: { user: ["is required"] } };
  }

  const email = asTrimmedStringOrNull(maybeUser.email);
  const username = asTrimmedStringOrNull(maybeUser.username);
  const password = asTrimmedStringOrNull(maybeUser.password);

  // Optional fields: allow undefined/null, but if present must be a string (for image/bio).
  const imageRaw = maybeUser.image;
  const bioRaw = maybeUser.bio;

  const image =
    imageRaw === undefined || imageRaw === null
      ? undefined
      : asTrimmedStringOrNull(imageRaw) ?? "";

  const bio =
    bioRaw === undefined || bioRaw === null
      ? undefined
      : asTrimmedStringOrNull(bioRaw) ?? "";

  const demo = maybeUser.demo;

  if (!email) errors.email = ["can't be blank"];
  // Minimal sanity check: ensure it looks like an email; keep it lightweight.
  if (email && !email.includes("@")) errors.email = ["is invalid"];

  if (!username) errors.username = ["can't be blank"];
  if (!password) errors.password = ["can't be blank"];

  // If optional fields were provided but not valid strings, return a field error.
  if (image !== undefined && image === "") errors.image = ["is invalid"];
  if (bio !== undefined && bio === "") errors.bio = ["is invalid"];

  if (Object.keys(errors).length) {
    return { ok: false, errors };
  }

  // At this point email/username/password are non-null strings.
  return {
    ok: true,
    value: {
      email: email!,
      username: username!,
      password: password!,
      ...(image !== undefined ? { image } : {}),
      ...(bio !== undefined ? { bio } : {}),
      ...(demo !== undefined ? { demo } : {}),
    },
  };
};
