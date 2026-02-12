/**
 * Database repository for role bindings
 * Supports priority-based bindings and nickname templates (RoWifi-style)
 */

const { getDatabase } = require('../init');
const logger = require('../../utils/logger');

class BindingsRepository {
    /**
     * Add a role binding with priority and nickname template
     */
    static create(guildId, groupId, robloxRankId, robloxRankName, discordRoleId, discordRoleName, priority = 0, nicknameTemplate = null) {
        const db = getDatabase();
        const stmt = db.prepare(`
            INSERT INTO role_bindings (guild_id, group_id, roblox_rank_id, roblox_rank_name, discord_role_id, discord_role_name, priority, nickname_template)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(guild_id, group_id, roblox_rank_id, discord_role_id) DO UPDATE SET
                roblox_rank_name = excluded.roblox_rank_name,
                discord_role_name = excluded.discord_role_name,
                priority = excluded.priority,
                nickname_template = excluded.nickname_template
        `);

        const result = stmt.run(guildId, groupId, robloxRankId, robloxRankName, discordRoleId, discordRoleName, priority, nicknameTemplate);
        logger.info(`Created binding: Guild ${guildId}, Group ${groupId}, Rank ${robloxRankId} -> Role ${discordRoleId} (priority: ${priority})`);
        return result;
    }

    /**
     * Delete a specific role binding
     */
    static delete(guildId, groupId, robloxRankId, discordRoleId = null) {
        const db = getDatabase();

        if (discordRoleId) {
            const stmt = db.prepare(`
                DELETE FROM role_bindings 
                WHERE guild_id = ? AND group_id = ? AND roblox_rank_id = ? AND discord_role_id = ?
            `);
            return stmt.run(guildId, groupId, robloxRankId, discordRoleId);
        } else {
            const stmt = db.prepare(`
                DELETE FROM role_bindings 
                WHERE guild_id = ? AND group_id = ? AND roblox_rank_id = ?
            `);
            return stmt.run(guildId, groupId, robloxRankId);
        }
    }

    /**
     * Delete all bindings for a guild
     */
    static deleteAllForGuild(guildId) {
        const db = getDatabase();
        const stmt = db.prepare('DELETE FROM role_bindings WHERE guild_id = ?');
        return stmt.run(guildId);
    }

    /**
     * Get all bindings for a guild, sorted by priority descending
     */
    static getByGuild(guildId) {
        const db = getDatabase();
        const stmt = db.prepare('SELECT * FROM role_bindings WHERE guild_id = ? ORDER BY priority DESC, roblox_rank_id');
        return stmt.all(guildId);
    }

    /**
     * Get bindings for a specific group in a guild
     */
    static getByGuildAndGroup(guildId, groupId) {
        const db = getDatabase();
        const stmt = db.prepare(`
            SELECT * FROM role_bindings 
            WHERE guild_id = ? AND group_id = ? 
            ORDER BY priority DESC, roblox_rank_id
        `);
        return stmt.all(guildId, groupId);
    }

    /**
     * Get Discord roles for a specific Roblox rank (returns array for multi-role support)
     */
    static getDiscordRoles(guildId, groupId, robloxRankId) {
        const db = getDatabase();
        const stmt = db.prepare(`
            SELECT discord_role_id FROM role_bindings 
            WHERE guild_id = ? AND group_id = ? AND roblox_rank_id = ?
        `);
        return stmt.all(guildId, groupId, robloxRankId).map(r => r.discord_role_id);
    }

    /**
     * Get the highest-priority binding that matches a user's rank (for nickname template)
     */
    static getHighestPriorityBinding(guildId, groupId, robloxRankId) {
        const db = getDatabase();
        const stmt = db.prepare(`
            SELECT * FROM role_bindings 
            WHERE guild_id = ? AND group_id = ? AND roblox_rank_id = ?
            ORDER BY priority DESC
            LIMIT 1
        `);
        return stmt.get(guildId, groupId, robloxRankId);
    }

    /**
     * Get the highest-priority binding across all groups for a guild (for nickname resolution)
     */
    static getHighestPriorityBindingForGuild(guildId, matchingBindings) {
        if (!matchingBindings || matchingBindings.length === 0) return null;
        return matchingBindings.sort((a, b) => (b.priority || 0) - (a.priority || 0))[0];
    }

    /**
     * Get all Discord roles that should be assigned for bindings
     */
    static getAllBoundRoles(guildId) {
        const db = getDatabase();
        const stmt = db.prepare('SELECT DISTINCT discord_role_id FROM role_bindings WHERE guild_id = ?');
        return stmt.all(guildId).map(r => r.discord_role_id);
    }

    /**
     * Export bindings to JSON format
     */
    static export(guildId) {
        const bindings = this.getByGuild(guildId);
        return bindings.map(b => ({
            groupId: b.group_id,
            robloxRankId: b.roblox_rank_id,
            robloxRankName: b.roblox_rank_name,
            discordRoleId: b.discord_role_id,
            discordRoleName: b.discord_role_name,
            priority: b.priority || 0,
            nicknameTemplate: b.nickname_template,
        }));
    }
}

module.exports = BindingsRepository;
