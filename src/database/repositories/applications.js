/**
 * Database repository for applications
 */

const { getDatabase } = require('../init');
const logger = require('../../utils/logger');

class ApplicationsRepository {
    /**
     * Create a new application
     */
    static create(guildId, discordId, applicationType, targetRankId, targetRoleId, reason) {
        const db = getDatabase();
        const stmt = db.prepare(`
            INSERT INTO applications (
                guild_id, discord_id, application_type,
                target_rank_id, target_role_id, reason
            ) VALUES (?, ?, ?, ?, ?, ?)
        `);
        
        const result = stmt.run(guildId, discordId, applicationType, targetRankId, targetRoleId, reason);
        logger.info(`Application created: ${result.lastInsertRowid} by ${discordId}`);
        return result.lastInsertRowid;
    }

    /**
     * Get application by ID
     */
    static getById(id) {
        const db = getDatabase();
        const stmt = db.prepare('SELECT * FROM applications WHERE id = ?');
        return stmt.get(id);
    }

    /**
     * Get pending applications for a guild
     */
    static getPending(guildId) {
        const db = getDatabase();
        const stmt = db.prepare(`
            SELECT * FROM applications 
            WHERE guild_id = ? AND status = 'pending'
            ORDER BY created_at ASC
        `);
        return stmt.all(guildId);
    }

    /**
     * Get applications by user
     */
    static getByUser(guildId, discordId) {
        const db = getDatabase();
        const stmt = db.prepare(`
            SELECT * FROM applications 
            WHERE guild_id = ? AND discord_id = ?
            ORDER BY created_at DESC
        `);
        return stmt.all(guildId, discordId);
    }

    /**
     * Check if user has pending application
     */
    static hasPending(guildId, discordId, applicationType) {
        const db = getDatabase();
        const stmt = db.prepare(`
            SELECT COUNT(*) as count FROM applications 
            WHERE guild_id = ? AND discord_id = ? AND application_type = ? AND status = 'pending'
        `);
        const result = stmt.get(guildId, discordId, applicationType);
        return result.count > 0;
    }

    /**
     * Approve an application
     */
    static approve(id, reviewerId) {
        const db = getDatabase();
        const stmt = db.prepare(`
            UPDATE applications 
            SET status = 'approved', reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `);
        return stmt.run(reviewerId, id);
    }

    /**
     * Deny an application
     */
    static deny(id, reviewerId) {
        const db = getDatabase();
        const stmt = db.prepare(`
            UPDATE applications 
            SET status = 'denied', reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `);
        return stmt.run(reviewerId, id);
    }

    /**
     * Set message ID for application
     */
    static setMessageId(id, messageId) {
        const db = getDatabase();
        const stmt = db.prepare('UPDATE applications SET message_id = ? WHERE id = ?');
        return stmt.run(messageId, id);
    }

    /**
     * Get application by message ID
     */
    static getByMessageId(messageId) {
        const db = getDatabase();
        const stmt = db.prepare('SELECT * FROM applications WHERE message_id = ?');
        return stmt.get(messageId);
    }

    /**
     * Get application statistics
     */
    static getStats(guildId) {
        const db = getDatabase();
        const stmt = db.prepare(`
            SELECT 
                status,
                COUNT(*) as count
            FROM applications 
            WHERE guild_id = ?
            GROUP BY status
        `);
        return stmt.all(guildId);
    }
}

module.exports = ApplicationsRepository;
