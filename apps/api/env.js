// Load .env (if present) before any other module reads process.env.
try { process.loadEnvFile(); } catch { /* no .env file — use the real environment */ }
