/**
 * Role Sync Service - Handles Discord role synchronization with Roblox ranks
 * Supports priority-based bindings and nickname templates (RoWifi-style)
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
     * Sync roles and nickname for a single Discord member
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

            const allowedRoles = new Set();
            const managedRoles = new Set();
            const matchedBindings = [];

            // 1. Identify all roles the user SHOULD have (allowedRoles)
            //    and all roles that are managed by the bot (managedRoles)
            for (const [grpId, grpBindings] of Object.entries(bindingsByGroup)) {
                const rankInfo = await robloxService.getUserGroupRank(linked.roblox_id, grpId);

                for (const binding of grpBindings) {
                    managedRoles.add(binding.discord_role_id);

                    if (rankInfo?.inGroup && Number(rankInfo.rank) === Number(binding.roblox_rank_id)) {
                        allowedRoles.add(binding.discord_role_id);
                        matchedBindings.push({ ...binding, rankInfo });
                    }
                }
            }

            // 2. Calculate diff
            const rolesToAdd = [];
            const rolesToRemove = [];

            // Add: Role is allowed AND user doesn't have it
            for (const roleId of allowedRoles) {
                if (!member.roles.cache.has(roleId)) {
                    rolesToAdd.push(roleId);
                }
            }

            // Remove: Role is managed AND user has it AND it's NOT allowed
            for (const roleId of managedRoles) {
                if (member.roles.cache.has(roleId) && !allowedRoles.has(roleId)) {
                    rolesToRemove.push(roleId);
                }
            }

            // 3. Apply changes in batch (much faster)
            let addedCount = 0;
            let removedCount = 0;

            if (rolesToAdd.length > 0) {
                try {
                    await member.roles.add(rolesToAdd);
                    addedCount = rolesToAdd.length;
                    logger.info(`Added ${addedCount} roles to ${member.user.tag}`);
                } catch (err) {
                    logger.warn(`Failed to batch add roles to ${member.user.tag}: ${err.message}`);
                    // Fallback to individual
                    for (const roleId of rolesToAdd) {
                        try {
                            await member.roles.add(roleId);
                            addedCount++;
                        } catch (e) {
                            logger.warn(`Failed to add role ${roleId}: ${e.message}`);
                        }
                    }
                }
            }

            if (rolesToRemove.length > 0) {
                try {
                    await member.roles.remove(rolesToRemove);
                    removedCount = rolesToRemove.length;
                    logger.info(`Removed ${removedCount} roles from ${member.user.tag}`);
                } catch (err) {
                    logger.warn(`Failed to batch remove roles from ${member.user.tag}: ${err.message}`);
                    // Fallback to individual
                    for (const roleId of rolesToRemove) {
                        try {
                            await member.roles.remove(roleId);
                            removedCount++;
                        } catch (e) {
                            logger.warn(`Failed to remove role ${roleId}: ${e.message}`);
                        }
                    }
                }
            }

            // Apply nickname from highest-priority binding that has a template
            let nicknameApplied = null;
            if (matchedBindings.length > 0) {
                // Sort by priority descending and find the first one with a template
                const sortedBindings = matchedBindings.sort((a, b) => (b.priority || 0) - (a.priority || 0));
                const templateBinding = sortedBindings.find(b => b.nickname_template);

                if (templateBinding) {
                    try {
                        const robloxUser = await robloxService.getUserById(linked.roblox_id);
                        const nickname = this.resolveTemplate(
                            templateBinding.nickname_template,
                            {
                                robloxUsername: robloxUser?.name || linked.roblox_username,
                                displayName: robloxUser?.displayName || linked.roblox_username,
                                discordName: member.user.username,
                                rankName: templateBinding.roblox_rank_name || '',
                            }
                        );

                        await member.setNickname(nickname);
                        nicknameApplied = nickname;
                        logger.info(`Set nickname for ${member.user.tag}: ${nickname}`);
                    } catch (err) {
                        logger.warn(`Failed to set nickname for ${member.id}: ${err.message}`);
                    }
                }
            }

            logger.info(`Synced roles for ${member.user.tag}: +${addedCount}, -${removedCount}${nicknameApplied ? `, nick: ${nicknameApplied}` : ''}`);

            return {
                success: true,
                rolesAdded: addedCount,
                rolesRemoved: removedCount,
                robloxUsername: linked.roblox_username,
                nicknameApplied,
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
     * Resolve a nickname template with user data
     * Supported vars: {roblox-username}, {display-name}, {discord-name}, {rank-name}
     */
    static resolveTemplate(template, data) {
        let nickname = template
            .replace(/\{roblox-username\}/gi, data.robloxUsername || '')
            .replace(/\{display-name\}/gi, data.displayName || '')
            .replace(/\{discord-name\}/gi, data.discordName || '')
            .replace(/\{rank-name\}/gi, data.rankName || '')
            // Legacy format support
            .replace(/\{roblox\}/gi, data.robloxUsername || '')
            .replace(/\{display\}/gi, data.displayName || '')
            .replace(/\{discord\}/gi, data.discordName || '');

        // Truncate to Discord's 32 character limit
        return nickname.substring(0, 32);
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
                const matchingBindings = grpBindings.filter(b => Number(b.roblox_rank_id) === Number(rankInfo.rank));
                for (const matchingBinding of matchingBindings) {
                    roles.push({
                        roleId: matchingBinding.discord_role_id,
                        roleName: matchingBinding.discord_role_name,
                        groupId,
                        rank: rankInfo.rank,
                        rankName: rankInfo.roleName,
                        priority: matchingBinding.priority || 0,
                        template: matchingBinding.nickname_template,
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
     * Update Discord nickname to match Roblox username (standalone)
     */
    static async syncNickname(member, format = '{roblox-username}') {
        try {
            const linked = LinkedAccountsRepository.getByDiscordId(member.id);
            if (!linked) {
                return { success: false, error: 'not_verified' };
            }

            const robloxUser = await robloxService.getUserById(linked.roblox_id);
            if (!robloxUser) {
                return { success: false, error: 'roblox_error' };
            }

            const nickname = this.resolveTemplate(format, {
                robloxUsername: robloxUser.name,
                displayName: robloxUser.displayName,
                discordName: member.user.username,
                rankName: '',
            });

            await member.setNickname(nickname);

            return { success: true, nickname };
        } catch (error) {
            logger.error(`Failed to sync nickname for ${member.id}: ${error.message}`);
            return { success: false, error: error.message };
        }
    }
}

module.exports = RoleSyncService;
