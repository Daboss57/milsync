/**
 * Database repository for linked accounts
 */

const { getDatabase } = require('../init');
const logger = require('../../utils/logger');

class LinkedAccountsRepository {
    /**
     * Link a Discord account to a Roblox account
     */
    static link(discordId, robloxId, robloxUsername) {
        const db = getDatabase();
        const stmt = db.prepare(`
            INSERT INTO linked_accounts (discord_id, roblox_id, roblox_username)
            VALUES (?, ?, ?)
            ON CONFLICT(discord_id) DO UPDATE SET
                roblox_id = excluded.roblox_id,
                roblox_username = excluded.roblox_username,
                updated_at = CURRENT_TIMESTAMP
        `);
        
        const result = stmt.run(discordId, robloxId, robloxUsername);
        logger.info(`Linked account: Discord ${discordId} -> Roblox ${robloxId}`);
        return result;
    }

    /**
     * Unlink a Discord account
     */
    static unlink(discordId) {
        const db = getDatabase();
        const stmt = db.prepare('DELETE FROM linked_accounts WHERE discord_id = ?');
        const result = stmt.run(discordId);
        logger.info(`Unlinked account: Discord ${discordId}`);
        return result.changes > 0;
    }

    /**
     * Get linked account by Discord ID
     */
    static getByDiscordId(discordId) {
        const db = getDatabase();
        const stmt = db.prepare('SELECT * FROM linked_accounts WHERE discord_id = ?');
        return stmt.get(discordId);
    }

    /**
     * Get linked account by Roblox ID
     */
    static getByRobloxId(robloxId) {
        const db = getDatabase();
        const stmt = db.prepare('SELECT * FROM linked_accounts WHERE roblox_id = ?');
        return stmt.get(robloxId);
    }

    /**
     * Get all linked accounts
     */
    static getAll(limit = 100, offset = 0) {
        const db = getDatabase();
        const stmt = db.prepare('SELECT * FROM linked_accounts LIMIT ? OFFSET ?');
        return stmt.all(limit, offset);
    }

    /**
     * Check if a Discord user is linked
     */
    static isLinked(discordId) {
        return this.getByDiscordId(discordId) !== undefined;
    }

    /**
     * Update Roblox username
     */
    static updateUsername(discordId, robloxUsername) {
        const db = getDatabase();
        const stmt = db.prepare(`
            UPDATE linked_accounts 
            SET roblox_username = ?, updated_at = CURRENT_TIMESTAMP
            WHERE discord_id = ?
        `);
        return stmt.run(robloxUsername, discordId);
    }
}

module.exports = LinkedAccountsRepository;
