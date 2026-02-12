/**
 * Database repository for guild configurations
 */

const { getDatabase } = require('../init');
const logger = require('../../utils/logger');

class GuildConfigRepository {
    /**
     * Get or create guild configuration
     */
    static getOrCreate(guildId) {
        const db = getDatabase();
        
        let config = this.get(guildId);
        if (!config) {
            const stmt = db.prepare('INSERT INTO guild_configs (guild_id) VALUES (?)');
            stmt.run(guildId);
            config = this.get(guildId);
            logger.info(`Created config for guild ${guildId}`);
        }
        
        return config;
    }

    /**
     * Get guild configuration
     */
    static get(guildId) {
        const db = getDatabase();
        const stmt = db.prepare('SELECT * FROM guild_configs WHERE guild_id = ?');
        return stmt.get(guildId);
    }

    /**
     * Update guild configuration
     */
    static update(guildId, updates) {
        const db = getDatabase();
        const validFields = [
            'log_channel_id',
            'verification_channel_id',
            'applications_channel_id',
            'welcome_message',
            'auto_sync_enabled',
            'xp_enabled',
        ];

        const fields = Object.keys(updates).filter(k => validFields.includes(k));
        if (fields.length === 0) return null;

        const setClause = fields.map(f => `${f} = ?`).join(', ');
        const values = fields.map(f => updates[f]);
        values.push(guildId);

        const stmt = db.prepare(`
            UPDATE guild_configs 
            SET ${setClause}, updated_at = CURRENT_TIMESTAMP
            WHERE guild_id = ?
        `);
        
        return stmt.run(...values);
    }

    /**
     * Set log channel
     */
    static setLogChannel(guildId, channelId) {
        return this.update(guildId, { log_channel_id: channelId });
    }

    /**
     * Set verification channel
     */
    static setVerificationChannel(guildId, channelId) {
        return this.update(guildId, { verification_channel_id: channelId });
    }

    /**
     * Set applications channel
     */
    static setApplicationsChannel(guildId, channelId) {
        return this.update(guildId, { applications_channel_id: channelId });
    }

    /**
     * Toggle auto-sync
     */
    static setAutoSync(guildId, enabled) {
        return this.update(guildId, { auto_sync_enabled: enabled ? 1 : 0 });
    }

    /**
     * Toggle XP system
     */
    static setXpEnabled(guildId, enabled) {
        return this.update(guildId, { xp_enabled: enabled ? 1 : 0 });
    }

    /**
     * Delete guild configuration
     */
    static delete(guildId) {
        const db = getDatabase();
        const stmt = db.prepare('DELETE FROM guild_configs WHERE guild_id = ?');
        return stmt.run(guildId);
    }
}

module.exports = GuildConfigRepository;
