export const AUTH_BYPASS_ENABLED =
  process.env.AUTH_BYPASS_ENABLED === "true" ||
  (process.env.NODE_ENV !== "production" && process.env.AUTH_BYPASS_ENABLED !== "false");

export const CLIENT_AUTH_BYPASS_ENABLED =
  process.env.NEXT_PUBLIC_AUTH_BYPASS_ENABLED === "true" ||
  (process.env.NODE_ENV !== "production" && process.env.NEXT_PUBLIC_AUTH_BYPASS_ENABLED !== "false");
