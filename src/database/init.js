/**
 * Database initialization and connection management
 * Using sql.js for cross-platform compatibility (pure JS SQLite)
 */

const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs');
const logger = require('../utils/logger');
const config = require('../config');

let db = null;
let SQL = null;

/**
 * Initialize the SQLite database with all required tables
 */
async function initializeDatabase() {
    // Ensure data directory exists
    const dataDir = path.dirname(config.database.path);
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
    }

    // Initialize SQL.js
    SQL = await initSqlJs();

    // Load existing database or create new one
    if (fs.existsSync(config.database.path)) {
        const buffer = fs.readFileSync(config.database.path);
        db = new SQL.Database(buffer);
        logger.info(`Database loaded from ${config.database.path}`);
    } else {
        db = new SQL.Database();
        logger.info(`New database created at ${config.database.path}`);
    }

    // Create tables
    createTables();

    // Save initial state
    saveDatabase();

    logger.info('Database initialized successfully');
    return getDatabase();
}

/**
 * Save the database to file
 */
function saveDatabase() {
    if (!db) return;

    try {
        const data = db.export();
        const buffer = Buffer.from(data);
        fs.writeFileSync(config.database.path, buffer);
    } catch (error) {
        logger.error('Failed to save database:', error);
    }
}

/**
 * Create all database tables
 */
function createTables() {
    // Linked accounts table
    db.run(`
        CREATE TABLE IF NOT EXISTS linked_accounts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            discord_id TEXT UNIQUE NOT NULL,
            roblox_id TEXT NOT NULL,
            roblox_username TEXT,
            verified_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // Guild configurations table
    db.run(`
        CREATE TABLE IF NOT EXISTS guild_configs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            guild_id TEXT UNIQUE NOT NULL,
            log_channel_id TEXT,
            verification_channel_id TEXT,
            applications_channel_id TEXT,
            welcome_message TEXT,
            auto_sync_enabled INTEGER DEFAULT 1,
            xp_enabled INTEGER DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // Role bindings table (supports multiple Discord roles per rank)
    db.run(`
        CREATE TABLE IF NOT EXISTS role_bindings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            guild_id TEXT NOT NULL,
            group_id TEXT NOT NULL,
            roblox_rank_id INTEGER NOT NULL,
            roblox_rank_name TEXT,
            discord_role_id TEXT NOT NULL,
            discord_role_name TEXT,
            priority INTEGER DEFAULT 0,
            nickname_template TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(guild_id, group_id, roblox_rank_id, discord_role_id)
        )
    `);

    // Add new columns to existing tables (safe - no-ops if columns exist)
    try { db.run(`ALTER TABLE role_bindings ADD COLUMN priority INTEGER DEFAULT 0`); } catch (e) { /* already exists */ }
    try { db.run(`ALTER TABLE role_bindings ADD COLUMN nickname_template TEXT`); } catch (e) { /* already exists */ }

    // Group bindings table (assign roles based on group membership)
    db.run(`
        CREATE TABLE IF NOT EXISTS group_bindings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            guild_id TEXT NOT NULL,
            group_id TEXT NOT NULL,
            discord_role_id TEXT NOT NULL,
            discord_role_name TEXT,
            priority INTEGER DEFAULT 0,
            nickname_template TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(guild_id, group_id, discord_role_id)
        )
    `);

    // Groups configuration table
    db.run(`
        CREATE TABLE IF NOT EXISTS guild_groups (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            guild_id TEXT NOT NULL,
            group_id TEXT NOT NULL,
            group_name TEXT,
            is_primary INTEGER DEFAULT 0,
            api_key TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(guild_id, group_id)
        )
    `);

    // XP/Points table
    db.run(`
        CREATE TABLE IF NOT EXISTS user_xp (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            guild_id TEXT NOT NULL,
            discord_id TEXT NOT NULL,
            xp INTEGER DEFAULT 0,
            level INTEGER DEFAULT 1,
            total_messages INTEGER DEFAULT 0,
            voice_minutes INTEGER DEFAULT 0,
            last_xp_gain DATETIME,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(guild_id, discord_id)
        )
    `);

    // XP thresholds for auto-promotion
    db.run(`
        CREATE TABLE IF NOT EXISTS xp_thresholds (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            guild_id TEXT NOT NULL,
            group_id TEXT NOT NULL,
            xp_required INTEGER NOT NULL,
            roblox_rank_id INTEGER NOT NULL,
            discord_role_id TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(guild_id, group_id, xp_required)
        )
    `);

    // Applications table
    db.run(`
        CREATE TABLE IF NOT EXISTS applications (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            guild_id TEXT NOT NULL,
            discord_id TEXT NOT NULL,
            application_type TEXT NOT NULL,
            target_rank_id INTEGER,
            target_role_id TEXT,
            reason TEXT,
            status TEXT DEFAULT 'pending',
            reviewed_by TEXT,
            reviewed_at DATETIME,
            message_id TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // Audit log table
    db.run(`
        CREATE TABLE IF NOT EXISTS audit_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            guild_id TEXT NOT NULL,
            action_type TEXT NOT NULL,
            actor_discord_id TEXT,
            target_discord_id TEXT,
            target_roblox_id TEXT,
            old_value TEXT,
            new_value TEXT,
            details TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // Blacklist table
    db.run(`
        CREATE TABLE IF NOT EXISTS blacklist (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            guild_id TEXT NOT NULL,
            discord_id TEXT,
            roblox_id TEXT,
            reason TEXT,
            banned_by TEXT,
            expires_at DATETIME,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(guild_id, discord_id),
            UNIQUE(guild_id, roblox_id)
        )
    `);

    // Pending verifications table
    db.run(`
        CREATE TABLE IF NOT EXISTS pending_verifications (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            discord_id TEXT UNIQUE NOT NULL,
            verification_code TEXT NOT NULL,
            roblox_username TEXT,
            expires_at DATETIME NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // API keys for in-game integration
    db.run(`
        CREATE TABLE IF NOT EXISTS api_keys (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            guild_id TEXT NOT NULL,
            key_hash TEXT UNIQUE NOT NULL,
            name TEXT,
            permissions TEXT,
            last_used DATETIME,
            created_by TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // Member activity tracking table
    db.run(`
        CREATE TABLE IF NOT EXISTS member_activity (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            guild_id TEXT NOT NULL,
            discord_id TEXT NOT NULL,
            last_message_at DATETIME,
            last_voice_at DATETIME,
            last_active_at DATETIME,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(guild_id, discord_id)
        )
    `);

    // Create indexes for performance
    db.run(`CREATE INDEX IF NOT EXISTS idx_linked_discord ON linked_accounts(discord_id)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_linked_roblox ON linked_accounts(roblox_id)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_bindings_guild ON role_bindings(guild_id)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_group_bindings_guild ON group_bindings(guild_id)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_xp_guild ON user_xp(guild_id)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_audit_guild ON audit_logs(guild_id)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_activity_guild ON member_activity(guild_id)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_activity_last ON member_activity(last_active_at)`);

    logger.info('Database tables created successfully');
}

/**
 * Wrapper class to provide better-sqlite3 compatible API
 */
class DatabaseWrapper {
    constructor(sqlDb, saveFn) {
        this._db = sqlDb;
        this._save = saveFn;
    }

    /**
     * Prepare a statement for execution
     */
    prepare(sql) {
        const db = this._db;
        const save = this._save;

        return {
            run(...params) {
                try {
                    db.run(sql, params);
                    save();
                    return { changes: db.getRowsModified(), lastInsertRowid: getLastInsertRowId(db) };
                } catch (error) {
                    throw error;
                }
            },
            get(...params) {
                try {
                    const stmt = db.prepare(sql);
                    stmt.bind(params);
                    if (stmt.step()) {
                        const row = stmt.getAsObject();
                        stmt.free();
                        return row;
                    }
                    stmt.free();
                    return undefined;
                } catch (error) {
                    throw error;
                }
            },
            all(...params) {
                try {
                    const results = [];
                    const stmt = db.prepare(sql);
                    stmt.bind(params);
                    while (stmt.step()) {
                        results.push(stmt.getAsObject());
                    }
                    stmt.free();
                    return results;
                } catch (error) {
                    throw error;
                }
            }
        };
    }

    /**
     * Execute raw SQL
     */
    exec(sql) {
        this._db.run(sql);
        this._save();
    }

    /**
     * Close the database
     */
    close() {
        this._save();
        this._db.close();
    }
}

/**
 * Helper to get last insert row ID
 */
function getLastInsertRowId(db) {
    const stmt = db.prepare('SELECT last_insert_rowid() as id');
    stmt.step();
    const result = stmt.getAsObject();
    stmt.free();
    return result.id;
}

/**
 * Get the database instance (wrapped for compatibility)
 */
function getDatabase() {
    if (!db) {
        throw new Error('Database not initialized. Call initializeDatabase() first.');
    }
    return new DatabaseWrapper(db, saveDatabase);
}

/**
 * Close the database connection
 */
function closeDatabase() {
    if (db) {
        saveDatabase();
        db.close();
        db = null;
        logger.info('Database connection closed');
    }
}

// Auto-save periodically
setInterval(() => {
    if (db) {
        saveDatabase();
    }
}, 30000); // Save every 30 seconds

module.exports = {
    initializeDatabase,
    getDatabase,
    closeDatabase,
    saveDatabase,
};
