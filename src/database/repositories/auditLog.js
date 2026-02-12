/**
 * Database repository for audit logs
 */

const { getDatabase } = require('../init');
const logger = require('../../utils/logger');

class AuditLogRepository {
    /**
     * Log an action
     */
    static log(guildId, actionType, actorDiscordId, details = {}) {
        const db = getDatabase();
        const stmt = db.prepare(`
            INSERT INTO audit_logs (
                guild_id, action_type, actor_discord_id, 
                target_discord_id, target_roblox_id,
                old_value, new_value, details
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);
        
        return stmt.run(
            guildId,
            actionType,
            actorDiscordId,
            details.targetDiscordId || null,
            details.targetRobloxId || null,
            details.oldValue || null,
            details.newValue || null,
            JSON.stringify(details.extra || {})
        );
    }

    /**
     * Log promotion action
     */
    static logPromotion(guildId, actorId, targetDiscordId, targetRobloxId, oldRank, newRank) {
        return this.log(guildId, 'PROMOTION', actorId, {
            targetDiscordId,
            targetRobloxId,
            oldValue: oldRank,
            newValue: newRank,
        });
    }

    /**
     * Log demotion action
     */
    static logDemotion(guildId, actorId, targetDiscordId, targetRobloxId, oldRank, newRank) {
        return this.log(guildId, 'DEMOTION', actorId, {
            targetDiscordId,
            targetRobloxId,
            oldValue: oldRank,
            newValue: newRank,
        });
    }

    /**
     * Log verification
     */
    static logVerification(guildId, discordId, robloxId) {
        return this.log(guildId, 'VERIFICATION', discordId, {
            targetDiscordId: discordId,
            targetRobloxId: robloxId,
        });
    }

    /**
     * Log unlink
     */
    static logUnlink(guildId, discordId, robloxId) {
        return this.log(guildId, 'UNLINK', discordId, {
            targetDiscordId: discordId,
            targetRobloxId: robloxId,
        });
    }

    /**
     * Log binding change
     */
    static logBindingChange(guildId, actorId, action, bindingDetails) {
        return this.log(guildId, `BINDING_${action.toUpperCase()}`, actorId, {
            extra: bindingDetails,
        });
    }

    /**
     * Log config change
     */
    static logConfigChange(guildId, actorId, setting, oldValue, newValue) {
        return this.log(guildId, 'CONFIG_CHANGE', actorId, {
            oldValue: String(oldValue),
            newValue: String(newValue),
            extra: { setting },
        });
    }

    /**
     * Get recent logs for a guild
     */
    static getRecent(guildId, limit = 50) {
        const db = getDatabase();
        const stmt = db.prepare(`
            SELECT * FROM audit_logs 
            WHERE guild_id = ? 
            ORDER BY created_at DESC 
            LIMIT ?
        `);
        return stmt.all(guildId, limit);
    }

    /**
     * Get logs by action type
     */
    static getByType(guildId, actionType, limit = 50) {
        const db = getDatabase();
        const stmt = db.prepare(`
            SELECT * FROM audit_logs 
            WHERE guild_id = ? AND action_type = ?
            ORDER BY created_at DESC 
            LIMIT ?
        `);
        return stmt.all(guildId, actionType, limit);
    }

    /**
     * Get logs for a specific user
     */
    static getByUser(guildId, discordId, limit = 50) {
        const db = getDatabase();
        const stmt = db.prepare(`
            SELECT * FROM audit_logs 
            WHERE guild_id = ? AND (actor_discord_id = ? OR target_discord_id = ?)
            ORDER BY created_at DESC 
            LIMIT ?
        `);
        return stmt.all(guildId, discordId, discordId, limit);
    }

    /**
     * Get logs within date range
     */
    static getByDateRange(guildId, startDate, endDate) {
        const db = getDatabase();
        const stmt = db.prepare(`
            SELECT * FROM audit_logs 
            WHERE guild_id = ? AND created_at BETWEEN ? AND ?
            ORDER BY created_at DESC
        `);
        return stmt.all(guildId, startDate, endDate);
    }

    /**
     * Export logs to JSON
     */
    static export(guildId, limit = 1000) {
        const logs = this.getRecent(guildId, limit);
        return logs.map(log => ({
            ...log,
            details: log.details ? JSON.parse(log.details) : {},
        }));
    }

    /**
     * Purge old logs (older than specified days)
     */
    static purgeOld(guildId, days = 90) {
        const db = getDatabase();
        const stmt = db.prepare(`
            DELETE FROM audit_logs 
            WHERE guild_id = ? AND created_at < datetime('now', ?)
        `);
        return stmt.run(guildId, `-${days} days`);
    }
}

module.exports = AuditLogRepository;
