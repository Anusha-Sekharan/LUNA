const Database = require('better-sqlite3');
const path = require('path');

const userDataPath = path.join(process.env.APPDATA, 'ai-girl');
const dbPath = path.join(userDataPath, 'luna.db');

console.log("Opening Database at:", dbPath);

try {
    const db = new Database(dbPath);

    console.log("Dropping all tables...");
    db.prepare('DROP TABLE IF EXISTS memories').run();
    db.prepare('DROP TABLE IF EXISTS user_profile').run();
    db.prepare('DROP TABLE IF EXISTS entities').run();
    db.prepare('DROP TABLE IF EXISTS conversation_logs').run();
    db.prepare('DROP TABLE IF EXISTS emotions').run();

    console.log("✅ Database Wiped. Starting fresh!");

} catch (e) {
    console.error("Could not wipe DB:", e.message);
}
