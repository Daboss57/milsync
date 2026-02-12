/**
 * Role Sync Service - Handles Discord role synchronization with Roblox ranks
 */

const LinkedAccountsRepository = require('../database/repositories/linkedAccounts');
const BindingsRepository = require('../database/repositories/bindings');
const GuildConfigRepository = require('../database/repositories/guildConfig');
const AuditLogRepository = require('../database/repositories/auditLog');
const robloxService = require('./robloxService');
const logger = require('../utils/logger');
const config = require('../config');

class RoleSyncService {
    /**
     * Sync roles for a single Discord member
     */
    static async syncMember(member, guildId, groupId = null) {
        try {
            // Get linked account
            const linked = LinkedAccountsRepository.getByDiscordId(member.id);
            if (!linked) {
                return {
                    success: false,
                    error: 'not_verified',
                    message: 'User is not verified',
                };
            }

            // Get bindings for this guild
            const bindings = groupId 
                ? BindingsRepository.getByGuildAndGroup(guildId, groupId)
                : BindingsRepository.getByGuild(guildId);

            if (bindings.length === 0) {
                return {
                    success: false,
                    error: 'no_bindings',
                    message: 'No role bindings configured',
                };
            }

            // Group bindings by group ID
            const bindingsByGroup = {};
            for (const binding of bindings) {
                if (!bindingsByGroup[binding.group_id]) {
                    bindingsByGroup[binding.group_id] = [];
                }
                bindingsByGroup[binding.group_id].push(binding);
            }

            const rolesToAdd = [];
            const rolesToRemove = [];
            const allBoundRoles = bindings.map(b => b.discord_role_id);

            // Process each group
            for (const [grpId, grpBindings] of Object.entries(bindingsByGroup)) {
                // Get user's rank in this group
                const rankInfo = await robloxService.getUserGroupRank(linked.roblox_id, grpId);
                
                for (const binding of grpBindings) {
                    const shouldHaveRole = rankInfo?.inGroup && rankInfo.rank === binding.roblox_rank_id;
                    const hasRole = member.roles.cache.has(binding.discord_role_id);

                    if (shouldHaveRole && !hasRole) {
                        rolesToAdd.push(binding.discord_role_id);
                    } else if (!shouldHaveRole && hasRole) {
                        rolesToRemove.push(binding.discord_role_id);
                    }
                }
            }

            // Apply role changes
            let addedCount = 0;
            let removedCount = 0;

            for (const roleId of rolesToAdd) {
                try {
                    await member.roles.add(roleId);
                    addedCount++;
                } catch (err) {
                    logger.warn(`Failed to add role ${roleId} to ${member.id}: ${err.message}`);
                }
            }

            for (const roleId of rolesToRemove) {
                try {
                    await member.roles.remove(roleId);
                    removedCount++;
                } catch (err) {
                    logger.warn(`Failed to remove role ${roleId} from ${member.id}: ${err.message}`);
                }
            }

            logger.info(`Synced roles for ${member.user.tag}: +${addedCount}, -${removedCount}`);

            return {
                success: true,
                rolesAdded: addedCount,
                rolesRemoved: removedCount,
                robloxUsername: linked.roblox_username,
            };
        } catch (error) {
            logger.error(`Failed to sync member ${member.id}: ${error.message}`);
            return {
                success: false,
                error: 'sync_failed',
                message: error.message,
            };
        }
    }

    /**
     * Sync all members in a guild
     */
    static async syncGuild(guild, progressCallback = null) {
        const results = {
            total: 0,
            synced: 0,
            skipped: 0,
            failed: 0,
            errors: [],
        };

        try {
            // Fetch all members
            const members = await guild.members.fetch();
            results.total = members.size;

            let processed = 0;
            for (const [memberId, member] of members) {
                if (member.user.bot) {
                    results.skipped++;
                    continue;
                }

                const result = await this.syncMember(member, guild.id);
                
                if (result.success) {
                    results.synced++;
                } else if (result.error === 'not_verified') {
                    results.skipped++;
                } else {
                    results.failed++;
                    results.errors.push({ memberId, error: result.message });
                }

                processed++;
                if (progressCallback && processed % 10 === 0) {
                    progressCallback(processed, results.total);
                }
            }

            logger.info(`Guild sync complete: ${results.synced} synced, ${results.skipped} skipped, ${results.failed} failed`);
        } catch (error) {
            logger.error(`Guild sync failed: ${error.message}`);
            results.errors.push({ error: error.message });
        }

        return results;
    }

    /**
     * Get roles that should be assigned based on Roblox rank
     */
    static async getRolesForUser(discordId, guildId) {
        const linked = LinkedAccountsRepository.getByDiscordId(discordId);
        if (!linked) {
            return { success: false, error: 'not_verified' };
        }

        const bindings = BindingsRepository.getByGuild(guildId);
        if (bindings.length === 0) {
            return { success: false, error: 'no_bindings' };
        }

        const roles = [];
        const bindingsByGroup = {};
        
        for (const binding of bindings) {
            if (!bindingsByGroup[binding.group_id]) {
                bindingsByGroup[binding.group_id] = [];
            }
            bindingsByGroup[binding.group_id].push(binding);
        }

        for (const [groupId, grpBindings] of Object.entries(bindingsByGroup)) {
            const rankInfo = await robloxService.getUserGroupRank(linked.roblox_id, groupId);
            
            if (rankInfo?.inGroup) {
                const matchingBinding = grpBindings.find(b => b.roblox_rank_id === rankInfo.rank);
                if (matchingBinding) {
                    roles.push({
                        roleId: matchingBinding.discord_role_id,
                        roleName: matchingBinding.discord_role_name,
                        groupId,
                        rank: rankInfo.rank,
                        rankName: rankInfo.roleName,
                    });
                }
            }
        }

        return {
            success: true,
            roles,
            robloxId: linked.roblox_id,
            robloxUsername: linked.roblox_username,
        };
    }

    /**
     * Update Discord nickname to match Roblox username
     */
    static async syncNickname(member, format = '{roblox}') {
        try {
            const linked = LinkedAccountsRepository.getByDiscordId(member.id);
            if (!linked) {
                return { success: false, error: 'not_verified' };
            }

            const robloxUser = await robloxService.getUserById(linked.roblox_id);
            if (!robloxUser) {
                return { success: false, error: 'roblox_error' };
            }

            let nickname = format
                .replace('{roblox}', robloxUser.name)
                .replace('{display}', robloxUser.displayName)
                .replace('{discord}', member.user.username);

            // Truncate to Discord's 32 character limit
            nickname = nickname.substring(0, 32);

            await member.setNickname(nickname);
            
            return { success: true, nickname };
        } catch (error) {
            logger.error(`Failed to sync nickname for ${member.id}: ${error.message}`);
            return { success: false, error: error.message };
        }
    }
}

module.exports = RoleSyncService;
