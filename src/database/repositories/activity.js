/**
 * Database repository for member activity tracking
 */

const { getDatabase } = require('../init');
const logger = require('../../utils/logger');

class ActivityRepository {
    /**
     * Record a message from a user (updates last_message_at and last_active_at)
     */
    static recordMessage(guildId, discordId) {
        const db = getDatabase();
        const stmt = db.prepare(`
            INSERT INTO member_activity (guild_id, discord_id, last_message_at, last_active_at)
            VALUES (?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            ON CONFLICT(guild_id, discord_id) DO UPDATE SET
                last_message_at = CURRENT_TIMESTAMP,
                last_active_at = CURRENT_TIMESTAMP
        `);
        return stmt.run(guildId, discordId);
    }

    /**
     * Record voice activity from a user (updates last_voice_at and last_active_at)
     */
    static recordVoice(guildId, discordId) {
        const db = getDatabase();
        const stmt = db.prepare(`
            INSERT INTO member_activity (guild_id, discord_id, last_voice_at, last_active_at)
            VALUES (?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            ON CONFLICT(guild_id, discord_id) DO UPDATE SET
                last_voice_at = CURRENT_TIMESTAMP,
                last_active_at = CURRENT_TIMESTAMP
        `);
        return stmt.run(guildId, discordId);
    }

    /**
     * Get activity record for a specific user
     */
    static getActivity(guildId, discordId) {
        const db = getDatabase();
        const stmt = db.prepare('SELECT * FROM member_activity WHERE guild_id = ? AND discord_id = ?');
        return stmt.get(guildId, discordId);
    }

    /**
     * Get members inactive for N days (verified members with no activity or old activity)
     * Returns members from linked_accounts who have no recent activity
     */
    static getInactive(guildId, days = 14) {
        const db = getDatabase();
        const stmt = db.prepare(`
            SELECT 
                la.discord_id,
                la.roblox_username,
                ma.last_active_at,
                ma.last_message_at,
                ma.last_voice_at
            FROM linked_accounts la
            LEFT JOIN member_activity ma 
                ON ma.discord_id = la.discord_id AND ma.guild_id = ?
            WHERE ma.last_active_at IS NULL 
                OR ma.last_active_at <= datetime('now', '-' || ? || ' days')
            ORDER BY ma.last_active_at ASC
        `);
        return stmt.all(guildId, days);
    }

    /**
     * Get all activity records for a guild, sorted by most recent
     */
    static getAll(guildId, limit = 50) {
        const db = getDatabase();
        const stmt = db.prepare(`
            SELECT * FROM member_activity 
            WHERE guild_id = ? 
            ORDER BY last_active_at DESC 
            LIMIT ?
        `);
        return stmt.all(guildId, limit);
    }
}

module.exports = ActivityRepository;
