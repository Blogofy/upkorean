// Where the server is, and how this build names itself to it.
//
// In a release build that is `expo.extra.apiUrl` from app.json. In development it is almost always the
// same computer that is running Metro — the phone is holding a bundle it downloaded from there a second
// ago — so that address is derived from the bundler's instead of being typed in by hand. "localhost"
// would be the phone itself and reach nothing.
import Constants from "expo-constants";
import { NativeModules } from "react-native";

const extra = Constants.expoConfig?.extra || {};

const PROD_URL = String(extra.apiUrl || "https://upkorean.uz").replace(/\/+$/, "");

// "192.168.1.5:8081" — the machine serving the bundle, and the port Metro is on. Expo reports it two
// ways depending on how the app was started; when it reports neither, the bundle's own URL still names
// the host it was downloaded from, which is the same answer by a different road.
function bundlerHost() {
  const hostUri = Constants.expoConfig?.hostUri || Constants.expoGoConfig?.debuggerHost || "";
  if (hostUri) return hostUri.split("/")[0].split(":")[0];
  const scriptUrl = NativeModules?.SourceCode?.scriptURL || "";
  const match = /^[a-z]+:\/\/([^/:]+)/i.exec(scriptUrl);
  return match ? match[1] : "";
}

// Only an address on this network can be the computer next to you. Under `expo start --tunnel` the
// bundler host is a public ngrok domain, and port 3000 on it belongs to nobody — guessing there would
// fail in a way that reads like the app is broken, so a tunnel falls through to the production URL and
// `extra.devApiUrl` is the way to point it somewhere else.
const ON_THIS_NETWORK = /^(?:localhost$|127\.|10\.|192\.168\.|172\.(?:1[6-9]|2\d|3[01])\.)/;

const devHost = bundlerHost();

function resolveApiUrl() {
  if (!__DEV__) return PROD_URL;
  // An explicit override wins, for a tunnel or for pointing a dev build at the live server.
  if (extra.devApiUrl) return String(extra.devApiUrl).replace(/\/+$/, "");
  if (devHost && ON_THIS_NETWORK.test(devHost)) return `http://${devHost}:${extra.devApiPort || 3000}`;
  return PROD_URL;
}

export const API_URL = resolveApiUrl();

// The server reads this header to decide that the session belongs in the response body as a bearer token
// rather than in a cookie (apps/api/auth.js, isAppClient).
export const CLIENT = `mobile/${Constants.expoConfig?.version || "1.0.0"}`;
