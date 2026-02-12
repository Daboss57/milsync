/**
 * Database repository for XP/Points system
 */

const { getDatabase } = require('../init');
const logger = require('../../utils/logger');

class XPRepository {
    /**
     * Get or create user XP record
     */
    static getOrCreate(guildId, discordId) {
        const db = getDatabase();
        
        let record = this.get(guildId, discordId);
        if (!record) {
            const stmt = db.prepare(`
                INSERT INTO user_xp (guild_id, discord_id) VALUES (?, ?)
            `);
            stmt.run(guildId, discordId);
            record = this.get(guildId, discordId);
        }
        
        return record;
    }

    /**
     * Get user XP record
     */
    static get(guildId, discordId) {
        const db = getDatabase();
        const stmt = db.prepare('SELECT * FROM user_xp WHERE guild_id = ? AND discord_id = ?');
        return stmt.get(guildId, discordId);
    }

    /**
     * Add XP to a user
     */
    static addXP(guildId, discordId, amount, reason = 'unknown') {
        const db = getDatabase();
        this.getOrCreate(guildId, discordId);

        const stmt = db.prepare(`
            UPDATE user_xp 
            SET xp = xp + ?, last_xp_gain = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
            WHERE guild_id = ? AND discord_id = ?
        `);
        
        stmt.run(amount, guildId, discordId);
        
        // Check for level up
        const record = this.get(guildId, discordId);
        const newLevel = this.calculateLevel(record.xp);
        
        if (newLevel > record.level) {
            this.setLevel(guildId, discordId, newLevel);
            return { leveledUp: true, newLevel, xp: record.xp + amount };
        }
        
        return { leveledUp: false, xp: record.xp + amount };
    }

    /**
     * Set user XP directly
     */
    static setXP(guildId, discordId, amount) {
        const db = getDatabase();
        this.getOrCreate(guildId, discordId);

        const stmt = db.prepare(`
            UPDATE user_xp 
            SET xp = ?, updated_at = CURRENT_TIMESTAMP
            WHERE guild_id = ? AND discord_id = ?
        `);
        
        return stmt.run(amount, guildId, discordId);
    }

    /**
     * Set user level
     */
    static setLevel(guildId, discordId, level) {
        const db = getDatabase();
        const stmt = db.prepare(`
            UPDATE user_xp 
            SET level = ?, updated_at = CURRENT_TIMESTAMP
            WHERE guild_id = ? AND discord_id = ?
        `);
        return stmt.run(level, guildId, discordId);
    }

    /**
     * Increment message count
     */
    static incrementMessages(guildId, discordId) {
        const db = getDatabase();
        this.getOrCreate(guildId, discordId);

        const stmt = db.prepare(`
            UPDATE user_xp 
            SET total_messages = total_messages + 1, updated_at = CURRENT_TIMESTAMP
            WHERE guild_id = ? AND discord_id = ?
        `);
        return stmt.run(guildId, discordId);
    }

    /**
     * Add voice minutes
     */
    static addVoiceMinutes(guildId, discordId, minutes) {
        const db = getDatabase();
        this.getOrCreate(guildId, discordId);

        const stmt = db.prepare(`
            UPDATE user_xp 
            SET voice_minutes = voice_minutes + ?, updated_at = CURRENT_TIMESTAMP
            WHERE guild_id = ? AND discord_id = ?
        `);
        return stmt.run(minutes, guildId, discordId);
    }

    /**
     * Get leaderboard for a guild
     */
    static getLeaderboard(guildId, limit = 10) {
        const db = getDatabase();
        const stmt = db.prepare(`
            SELECT * FROM user_xp 
            WHERE guild_id = ? 
            ORDER BY xp DESC 
            LIMIT ?
        `);
        return stmt.all(guildId, limit);
    }

    /**
     * Get user rank in guild
     */
    static getRank(guildId, discordId) {
        const db = getDatabase();
        const record = this.get(guildId, discordId);
        if (!record) return null;

        const stmt = db.prepare(`
            SELECT COUNT(*) + 1 as rank FROM user_xp 
            WHERE guild_id = ? AND xp > ?
        `);
        const result = stmt.get(guildId, record.xp);
        return result.rank;
    }

    /**
     * Calculate level from XP (simple formula)
     */
    static calculateLevel(xp) {
        // Level formula: level = floor(sqrt(xp / 100)) + 1
        return Math.floor(Math.sqrt(xp / 100)) + 1;
    }

    /**
     * Calculate XP required for a level
     */
    static xpForLevel(level) {
        return Math.pow(level - 1, 2) * 100;
    }

    /**
     * Reset all XP for a guild
     */
    static resetGuild(guildId) {
        const db = getDatabase();
        const stmt = db.prepare('DELETE FROM user_xp WHERE guild_id = ?');
        return stmt.run(guildId);
    }
}

module.exports = XPRepository;
