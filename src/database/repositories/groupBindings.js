/**
 * Database repository for group bindings
 * Assigns Discord roles based on Roblox group membership (RoWifi-style)
 */

const { getDatabase } = require('../init');
const logger = require('../../utils/logger');

class GroupBindingsRepository {
    /**
     * Add a group binding with priority and nickname template
     */
    static create(guildId, groupId, discordRoleId, discordRoleName, priority = 0, nicknameTemplate = null) {
        const db = getDatabase();
        const stmt = db.prepare(`
            INSERT INTO group_bindings (guild_id, group_id, discord_role_id, discord_role_name, priority, nickname_template)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(guild_id, group_id, discord_role_id) DO UPDATE SET
                discord_role_name = excluded.discord_role_name,
                priority = excluded.priority,
                nickname_template = excluded.nickname_template
        `);

        const result = stmt.run(guildId, groupId, discordRoleId, discordRoleName, priority, nicknameTemplate);
        logger.info(`Created group binding: Guild ${guildId}, Group ${groupId} -> Role ${discordRoleId} (priority: ${priority})`);
        return result;
    }

    /**
     * Delete a specific group binding or all bindings for a group
     */
    static delete(guildId, groupId, discordRoleId = null) {
        const db = getDatabase();

        if (discordRoleId) {
            const stmt = db.prepare(`
                DELETE FROM group_bindings 
                WHERE guild_id = ? AND group_id = ? AND discord_role_id = ?
            `);
            return stmt.run(guildId, groupId, discordRoleId);
        } else {
            const stmt = db.prepare(`
                DELETE FROM group_bindings 
                WHERE guild_id = ? AND group_id = ?
            `);
            return stmt.run(guildId, groupId);
        }
    }

    /**
     * Delete all group bindings for a guild
     */
    static deleteAllForGuild(guildId) {
        const db = getDatabase();
        const stmt = db.prepare('DELETE FROM group_bindings WHERE guild_id = ?');
        return stmt.run(guildId);
    }

    /**
     * Get all group bindings for a guild, sorted by priority descending
     */
    static getByGuild(guildId) {
        const db = getDatabase();
        const stmt = db.prepare('SELECT * FROM group_bindings WHERE guild_id = ? ORDER BY priority DESC, group_id');
        return stmt.all(guildId);
    }

    /**
     * Get group bindings for a specific group in a guild
     */
    static getByGuildAndGroup(guildId, groupId) {
        const db = getDatabase();
        const stmt = db.prepare(`
            SELECT * FROM group_bindings 
            WHERE guild_id = ? AND group_id = ? 
            ORDER BY priority DESC
        `);
        return stmt.all(guildId, groupId);
    }

    /**
     * Get all Discord roles that are managed by group bindings
     */
    static getAllBoundRoles(guildId) {
        const db = getDatabase();
        const stmt = db.prepare('SELECT DISTINCT discord_role_id FROM group_bindings WHERE guild_id = ?');
        return stmt.all(guildId).map(r => r.discord_role_id);
    }

    /**
     * Get the highest-priority group binding for nickname resolution
     */
    static getHighestPriorityBinding(guildId, groupId) {
        const db = getDatabase();
        const stmt = db.prepare(`
            SELECT * FROM group_bindings 
            WHERE guild_id = ? AND group_id = ?
            ORDER BY priority DESC
            LIMIT 1
        `);
        return stmt.get(guildId, groupId);
    }
}

module.exports = GroupBindingsRepository;
