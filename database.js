const Database = require('better-sqlite3');
const path = require('path');
const { app } = require('electron');

let db;

/**
 * Initialize the database connection and schema
 */
function initDatabase() {
    if (db) return db;

    const dbPath = path.join(app.getPath('userData'), 'luna.db');
    console.log("Initializing database at:", dbPath);

    try {
        db = new Database(dbPath); // Disable verbose logging for performance
        db.pragma('journal_mode = WAL');

        // Create Memories Table (Base) - Enhanced Schema
        db.prepare(`
            CREATE TABLE IF NOT EXISTS memories (
                id TEXT PRIMARY KEY,
                text TEXT,
                embedding TEXT, -- JSON stringified array
                type TEXT,
                tags TEXT,
                importance INTEGER DEFAULT 1,
                last_recalled INTEGER,
                timestamp INTEGER,
                date TEXT,
                access_count INTEGER DEFAULT 0,
                emotional_context TEXT,
                source TEXT,
                expires_at INTEGER
            )
        `).run();

        // MIGRATION: Check for missing columns (for existing DBs)
        try {
            const columns = db.prepare("PRAGMA table_info(memories)").all();
            
            const migrationMap = {
                'tags': 'TEXT',
                'type': 'TEXT',
                'importance': 'INTEGER DEFAULT 1',
                'last_recalled': 'INTEGER',
                'access_count': 'INTEGER DEFAULT 0',
                'emotional_context': 'TEXT',
                'source': 'TEXT',
                'expires_at': 'INTEGER'
            };

            for (const [colName, colType] of Object.entries(migrationMap)) {
                const hasColumn = columns.some(c => c.name === colName);
                if (!hasColumn) {
                    console.log(`Migrating: Adding column ${colName}...`);
                    db.prepare(`ALTER TABLE memories ADD COLUMN ${colName} ${colType}`).run();
                }
            }
        } catch (e) {
            console.error("Migration failed:", e);
        }

        // Create Indexes for Fast Retrieval
        try {
            db.prepare("CREATE INDEX IF NOT EXISTS idx_memories_type ON memories(type)").run();
            db.prepare("CREATE INDEX IF NOT EXISTS idx_memories_importance ON memories(importance DESC)").run();
            db.prepare("CREATE INDEX IF NOT EXISTS idx_memories_timestamp ON memories(timestamp DESC)").run();
            db.prepare("CREATE INDEX IF NOT EXISTS idx_memories_last_recalled ON memories(last_recalled DESC)").run();
            console.log("Database indexes created/verified.");
        } catch (e) {
            console.error("Index creation failed:", e);
        }

        // Create User Profile Table
        db.prepare(`
            CREATE TABLE IF NOT EXISTS user_profile (
                key TEXT PRIMARY KEY,
                value TEXT,
                confidence REAL DEFAULT 1.0,
                timestamp INTEGER
            )
        `).run();

        // Create Entities Table
        db.prepare(`
            CREATE TABLE IF NOT EXISTS entities (
                id TEXT PRIMARY KEY,
                name TEXT,
                type TEXT,
                relationship TEXT,
                description TEXT,
                last_mentioned INTEGER
            )
        `).run();

        // Create Conversation Logs
        db.prepare(`
            CREATE TABLE IF NOT EXISTS conversation_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                role TEXT,
                content TEXT,
                timestamp INTEGER
            )
        `).run();

        // Create Emotions Table
        db.prepare(`
            CREATE TABLE IF NOT EXISTS emotions (
                key TEXT PRIMARY KEY,
                value TEXT -- JSON stringified value
            )
        `).run();

        console.log("Database initialized.");
    } catch (e) {
        console.error("Failed to initialize database:", e);
        throw e;
    }
    return db;
}

// ... helper functions ...

/**
 * Save memories (Insert or Update)
 */
function saveMemories(memories) {
    if (!db) initDatabase();
    const data = Array.isArray(memories) ? memories : [memories];

    const insert = db.prepare(`
        INSERT OR REPLACE INTO memories (id, text, embedding, type, tags, importance, last_recalled, timestamp, date)
        VALUES (@id, @text, @embedding, @type, @tags, @importance, @last_recalled, @timestamp, @date)
    `);

    const insertMany = db.transaction((items) => {
        for (const mem of items) {
            insert.run({
                id: mem.id,
                text: mem.text,
                embedding: JSON.stringify(mem.embedding),
                type: mem.type || 'fact',
                tags: JSON.stringify(mem.tags || []),
                importance: mem.importance || 1,
                last_recalled: mem.last_recalled || Date.now(),
                timestamp: mem.timestamp,
                date: mem.date
            });
        }
    });

    try {
        insertMany(data);
        return true;
    } catch (e) {
        console.error("Failed to save memories:", e);
        throw e;
    }
}

function loadMemories() {
    if (!db) initDatabase();
    try {
        const rows = db.prepare('SELECT * FROM memories').all();
        return rows.map(row => ({
            ...row,
            embedding: JSON.parse(row.embedding),
            tags: row.tags ? JSON.parse(row.tags) : []
        }));
    } catch (e) {
        console.error("Failed to load memories:", e);
        return [];
    }
}

/**
 * User Profile Operations
 */
function saveUserProfile(items) {
    if (!db) initDatabase();
    const data = Array.isArray(items) ? items : [items];
    const insert = db.prepare(`
        INSERT OR REPLACE INTO user_profile (key, value, confidence, timestamp)
        VALUES (@key, @value, @confidence, @timestamp)
    `);

    const insertMany = db.transaction((list) => {
        for (const item of list) insert.run(item);
    });

    try {
        insertMany(data);
        return true;
    } catch (e) {
        console.error("Failed to save profile:", e);
        return false;
    }
}

function loadUserProfile() {
    if (!db) initDatabase();
    try {
        return db.prepare('SELECT * FROM user_profile').all();
    } catch (e) {
        console.error("Failed to load profile:", e);
        return [];
    }
}

/**
 * Entity Operations
 */
function saveEntity(entity) {
    if (!db) initDatabase();
    try {
        const stmt = db.prepare(`
            INSERT OR REPLACE INTO entities (id, name, type, relationship, description, last_mentioned)
            VALUES (@id, @name, @type, @relationship, @description, @last_mentioned)
        `);
        stmt.run(entity);
        return true;
    } catch (e) {
        console.error("Failed to save entity:", e);
        return false;
    }
}

function loadEntities() {
    if (!db) initDatabase();
    try {
        return db.prepare('SELECT * FROM entities').all();
    } catch (e) {
        console.error("Failed to load entities:", e);
        return [];
    }
}

/**
 * Log Conversation
 */
function logConversation(role, content) {
    if (!db) initDatabase();
    try {
        db.prepare('INSERT INTO conversation_logs (role, content, timestamp) VALUES (?, ?, ?)')
            .run(role, content, Date.now());
        return true;
    } catch (e) {
        console.error("Failed to log conversation:", e);
        return false;
    }
}

function saveEmotions(state) {
    if (!db) initDatabase();
    try {
        const stmt = db.prepare(`
            INSERT OR REPLACE INTO emotions (key, value)
            VALUES ('current_state', ?)
        `);
        stmt.run(JSON.stringify(state));
        return true;
    } catch (e) {
        console.error("Failed to save emotions:", e);
        return false;
    }
}

function loadEmotions() {
    if (!db) initDatabase();
    try {
        const row = db.prepare("SELECT value FROM emotions WHERE key = 'current_state'").get();
        return row ? JSON.parse(row.value) : null;
    } catch (e) {
        console.error("Failed to load emotions:", e);
        return null;
    }
}

function clearAllData() {
    if (!db) initDatabase();
    try {
        db.transaction(() => {
            db.prepare('DELETE FROM memories').run();
            db.prepare('DELETE FROM user_profile').run();
            db.prepare('DELETE FROM entities').run();
            db.prepare('DELETE FROM conversation_logs').run();
            db.prepare('DELETE FROM emotions').run();
        })();
        console.log("Database cleared.");
        return true;
    } catch (e) {
        console.error("Failed to clear DB:", e);
        return false;
    }
}

module.exports = {
    initDatabase,
    saveMemories,
    loadMemories,
    saveUserProfile,
    loadUserProfile,
    saveEntity,
    loadEntities,
    logConversation,
    saveEmotions,
    loadEmotions,
    clearAllData
};
