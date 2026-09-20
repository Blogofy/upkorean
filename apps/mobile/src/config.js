// Where the server is, and how this build names itself to it.
//
// In a release build that is `expo.extra.apiUrl` from app.json. In development it is almost always the
// same computer that is running Metro — the phone is holding a bundle it downloaded from there a second
// ago — so that address is derived from the bundler's instead of being typed in by hand. "localhost"
// would be the phone itself and reach nothing.
import Constants from "expo-constants";

const extra = Constants.expoConfig?.extra || {};

const PROD_URL = String(extra.apiUrl || "https://upkorean.uz").replace(/\/+$/, "");

// "192.168.1.5:8081" — the machine serving the bundle, and the port Metro is on.
const hostUri = Constants.expoConfig?.hostUri || Constants.expoGoConfig?.debuggerHost || "";
const devHost = hostUri.split(":")[0];

function resolveApiUrl() {
  if (!__DEV__) return PROD_URL;
  // An explicit override wins, for the times the dev build should talk to the live server.
  if (extra.devApiUrl) return String(extra.devApiUrl).replace(/\/+$/, "");
  if (devHost) return `http://${devHost}:${extra.devApiPort || 3000}`;
  return PROD_URL;
}

export const API_URL = resolveApiUrl();

// The server reads this header to decide that the session belongs in the response body as a bearer token
// rather than in a cookie (apps/api/auth.js, isAppClient).
export const CLIENT = `mobile/${Constants.expoConfig?.version || "1.0.0"}`;
