import "server-only";

export const LAYOUTS_BETA_ENABLED = process.env.LAYOUTS_BETA_ENABLED === "true";

export function requireLayoutsBeta() {
  if (!LAYOUTS_BETA_ENABLED) {
    throw new Error("Layouts beta is disabled.");
  }
}
