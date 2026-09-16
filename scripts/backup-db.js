// Manual database backup: npm run backup  (the server also backs up on its own, see BACKUP_HOURS in .env.example)
import "../server/env.js";
import { backupDb } from "../server/db.js";

const keep = Number(process.env.BACKUP_KEEP) || 14;
console.log(`Backup saved: ${backupDb(keep)}`);
