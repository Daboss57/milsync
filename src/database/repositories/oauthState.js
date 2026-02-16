/**
 * Database repository for OAuth2 pending states
 */

const { getDatabase } = require('../init');
const logger = require('../../utils/logger');

class OAuthStateRepository {
    /**
     * Create a new OAuth state entry
     */
    static create(state, discordId, guildId, isReverify = false) {
        const db = getDatabase();
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 min expiry

        const stmt = db.prepare(`
            INSERT INTO oauth_states (state, discord_id, guild_id, is_reverify, expires_at)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(discord_id) DO UPDATE SET
                state = excluded.state,
                guild_id = excluded.guild_id,
                is_reverify = excluded.is_reverify,
                expires_at = excluded.expires_at,
                created_at = CURRENT_TIMESTAMP
        `);

        stmt.run(state, discordId, guildId, isReverify ? 1 : 0, expiresAt.toISOString());
        logger.debug(`Created OAuth state for Discord ${discordId}`);
        return { state, discordId, guildId, isReverify, expiresAt };
    }

    /**
     * Get a pending OAuth state
     */
    static getByState(state) {
        const db = getDatabase();
        const stmt = db.prepare(`
            SELECT * FROM oauth_states 
            WHERE state = ? AND expires_at > CURRENT_TIMESTAMP
        `);
        return stmt.get(state);
    }

    /**
     * Delete a state entry (after successful use)
     */
    static delete(state) {
        const db = getDatabase();
        const stmt = db.prepare('DELETE FROM oauth_states WHERE state = ?');
        return stmt.run(state).changes > 0;
    }

    /**
     * Clean up expired states
     */
    static cleanupExpired() {
        const db = getDatabase();
        const stmt = db.prepare('DELETE FROM oauth_states WHERE expires_at <= CURRENT_TIMESTAMP');
        const result = stmt.run();
        if (result.changes > 0) {
            logger.info(`Cleaned up ${result.changes} expired OAuth states`);
        }
        return result.changes;
    }
}

module.exports = OAuthStateRepository;
