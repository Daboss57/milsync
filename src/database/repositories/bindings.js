/**
 * Database repository for role bindings
 */

const { getDatabase } = require('../init');
const logger = require('../../utils/logger');

class BindingsRepository {
    /**
     * Add a role binding (supports multiple roles per rank)
     */
    static create(guildId, groupId, robloxRankId, robloxRankName, discordRoleId, discordRoleName) {
        const db = getDatabase();
        const stmt = db.prepare(`
            INSERT INTO role_bindings (guild_id, group_id, roblox_rank_id, roblox_rank_name, discord_role_id, discord_role_name)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(guild_id, group_id, roblox_rank_id, discord_role_id) DO UPDATE SET
                roblox_rank_name = excluded.roblox_rank_name,
                discord_role_name = excluded.discord_role_name
        `);
        
        const result = stmt.run(guildId, groupId, robloxRankId, robloxRankName, discordRoleId, discordRoleName);
        logger.info(`Created binding: Guild ${guildId}, Group ${groupId}, Rank ${robloxRankId} -> Role ${discordRoleId}`);
        return result;
    }

    /**
     * Delete a specific role binding
     */
    static delete(guildId, groupId, robloxRankId, discordRoleId = null) {
        const db = getDatabase();
        
        if (discordRoleId) {
            // Delete specific role binding
            const stmt = db.prepare(`
                DELETE FROM role_bindings 
                WHERE guild_id = ? AND group_id = ? AND roblox_rank_id = ? AND discord_role_id = ?
            `);
            return stmt.run(guildId, groupId, robloxRankId, discordRoleId);
        } else {
            // Delete all bindings for this rank
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
     * Get all bindings for a guild
     */
    static getByGuild(guildId) {
        const db = getDatabase();
        const stmt = db.prepare('SELECT * FROM role_bindings WHERE guild_id = ? ORDER BY roblox_rank_id');
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
            ORDER BY roblox_rank_id
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
     * Get Discord role for a specific Roblox rank (legacy - returns first role)
     */
    static getDiscordRole(guildId, groupId, robloxRankId) {
        const roles = this.getDiscordRoles(guildId, groupId, robloxRankId);
        return roles.length > 0 ? roles[0] : null;
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
     * Bulk import bindings
     */
    static bulkImport(guildId, bindings) {
        const db = getDatabase();
        const insert = db.prepare(`
            INSERT INTO role_bindings (guild_id, group_id, roblox_rank_id, roblox_rank_name, discord_role_id, discord_role_name)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(guild_id, group_id, roblox_rank_id) DO UPDATE SET
                discord_role_id = excluded.discord_role_id,
                discord_role_name = excluded.discord_role_name
        `);

        const transaction = db.transaction((items) => {
            for (const binding of items) {
                insert.run(
                    guildId,
                    binding.groupId,
                    binding.robloxRankId,
                    binding.robloxRankName || null,
                    binding.discordRoleId,
                    binding.discordRoleName || null
                );
            }
        });

        transaction(bindings);
        logger.info(`Bulk imported ${bindings.length} bindings for guild ${guildId}`);
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
        }));
    }
}

module.exports = BindingsRepository;
