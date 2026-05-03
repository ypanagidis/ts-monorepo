import { env } from "~/env";

export function getBaseUrl() {
  if (typeof window !== "undefined") {
    return window.location.origin;
  }

  return env.APP_URL;
}
