const Database = require('better-sqlite3');
const path = require('path');
const { app } = require('electron');

// Mock app.getPath for standalone script usage
// We need to find the actual path. Usually %APPDATA%\ai-girl
const userDataPath = path.join(process.env.APPDATA, 'ai-girl');
const dbPath = path.join(userDataPath, 'luna.db');

console.log("Opening Database at:", dbPath);

try {
    const db = new Database(dbPath, { readonly: true });

    console.log("\n=== USER PROFILE ===");
    const profile = db.prepare('SELECT * FROM user_profile').all();
    console.table(profile);

    console.log("\n=== ENTITIES ===");
    const entities = db.prepare('SELECT name, type, relationship FROM entities').all();
    console.table(entities);

    console.log("\n=== MEMORIES (Top 10) ===");
    const memories = db.prepare('SELECT type, substr(text, 1, 50) as text, importance FROM memories ORDER BY timestamp DSC LIMIT 10').all();
    console.table(memories);

} catch (e) {
    console.error("Could not open DB:", e.message);
}
