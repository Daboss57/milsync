/**
 * Database repository for blacklist management
 */

const { getDatabase } = require('../init');
const logger = require('../../utils/logger');

class BlacklistRepository {
    /**
     * Add user to blacklist
     */
    static add(guildId, discordId, robloxId, reason, bannedBy, expiresAt = null) {
        const db = getDatabase();
        const stmt = db.prepare(`
            INSERT INTO blacklist (guild_id, discord_id, roblox_id, reason, banned_by, expires_at)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(guild_id, discord_id) DO UPDATE SET
                reason = excluded.reason,
                banned_by = excluded.banned_by,
                expires_at = excluded.expires_at
        `);
        
        const result = stmt.run(guildId, discordId, robloxId, reason, bannedBy, expiresAt);
        logger.info(`Blacklisted: Discord ${discordId}, Roblox ${robloxId} in guild ${guildId}`);
        return result;
    }

    /**
     * Remove user from blacklist
     */
    static remove(guildId, discordId = null, robloxId = null) {
        const db = getDatabase();
        
        if (discordId) {
            const stmt = db.prepare('DELETE FROM blacklist WHERE guild_id = ? AND discord_id = ?');
            return stmt.run(guildId, discordId);
        }
        
        if (robloxId) {
            const stmt = db.prepare('DELETE FROM blacklist WHERE guild_id = ? AND roblox_id = ?');
            return stmt.run(guildId, robloxId);
        }
        
        return null;
    }

    /**
     * Check if Discord user is blacklisted
     */
    static isBlacklistedDiscord(guildId, discordId) {
        const db = getDatabase();
        const stmt = db.prepare(`
            SELECT * FROM blacklist 
            WHERE guild_id = ? AND discord_id = ?
            AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
        `);
        return stmt.get(guildId, discordId) !== undefined;
    }

    /**
     * Check if Roblox user is blacklisted
     */
    static isBlacklistedRoblox(guildId, robloxId) {
        const db = getDatabase();
        const stmt = db.prepare(`
            SELECT * FROM blacklist 
            WHERE guild_id = ? AND roblox_id = ?
            AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
        `);
        return stmt.get(guildId, robloxId) !== undefined;
    }

    /**
     * Get blacklist entry
     */
    static get(guildId, discordId) {
        const db = getDatabase();
        const stmt = db.prepare('SELECT * FROM blacklist WHERE guild_id = ? AND discord_id = ?');
        return stmt.get(guildId, discordId);
    }

    /**
     * Get all blacklisted users for a guild
     */
    static getAll(guildId) {
        const db = getDatabase();
        const stmt = db.prepare('SELECT * FROM blacklist WHERE guild_id = ? ORDER BY created_at DESC');
        return stmt.all(guildId);
    }

    /**
     * Purge expired entries
     */
    static purgeExpired() {
        const db = getDatabase();
        const stmt = db.prepare(`
            DELETE FROM blacklist 
            WHERE expires_at IS NOT NULL AND expires_at <= CURRENT_TIMESTAMP
        `);
        return stmt.run();
    }
}

module.exports = BlacklistRepository;
