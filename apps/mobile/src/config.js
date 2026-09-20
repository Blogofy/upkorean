// Where the server is, and how this build names itself to it.
//
// The API URL is read from app.json (`expo.extra.apiUrl`) so a debug build can be pointed elsewhere without
// touching code. On a phone, "localhost" is the phone — to reach a server running on your computer, put
// that computer's address on the network here, e.g. http://192.168.1.5:3000.
import Constants from "expo-constants";

const extra = Constants.expoConfig?.extra || {};

export const API_URL = String(extra.apiUrl || "https://upkorean.uz").replace(/\/+$/, "");

// The server reads this header to decide that the session belongs in the response body as a bearer token
// rather than in a cookie (apps/api/auth.js, isAppClient).
export const CLIENT = `mobile/${Constants.expoConfig?.version || "1.0.0"}`;
