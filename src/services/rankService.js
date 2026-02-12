/**
 * Rank Management Service - Handles Roblox group rank changes
 */

const LinkedAccountsRepository = require('../database/repositories/linkedAccounts');
const AuditLogRepository = require('../database/repositories/auditLog');
const robloxService = require('./robloxService');
const RoleSyncService = require('./roleSyncService');
const logger = require('../utils/logger');
const config = require('../config');

class RankService {
    /**
     * Promote a user in a Roblox group
     */
    static async promote(guildId, targetDiscordId, actorDiscordId, groupId = null) {
        try {
            // Get linked account
            const linked = LinkedAccountsRepository.getByDiscordId(targetDiscordId);
            if (!linked) {
                return {
                    success: false,
                    error: 'not_verified',
                    message: 'Target user is not verified.',
                };
            }

            // Use default group if not specified
            const targetGroupId = groupId || config.roblox.defaultGroupId;
            if (!targetGroupId) {
                return {
                    success: false,
                    error: 'no_group',
                    message: 'No group specified and no default group configured.',
                };
            }

            // Perform promotion
            const result = await robloxService.promoteUser(targetGroupId, linked.roblox_id);

            if (result.success) {
                // Log the action
                AuditLogRepository.logPromotion(
                    guildId,
                    actorDiscordId,
                    targetDiscordId,
                    linked.roblox_id,
                    result.oldRank,
                    result.newRank
                );

                logger.info(`Promoted ${linked.roblox_username} from ${result.oldRank} to ${result.newRank}`);

                return {
                    success: true,
                    robloxUsername: linked.roblox_username,
                    oldRank: result.oldRank,
                    newRank: result.newRank,
                };
            }

            return result;
        } catch (error) {
            logger.error(`Promotion failed: ${error.message}`);
            return {
                success: false,
                error: 'promotion_failed',
                message: error.message,
            };
        }
    }

    /**
     * Demote a user in a Roblox group
     */
    static async demote(guildId, targetDiscordId, actorDiscordId, groupId = null) {
        try {
            // Get linked account
            const linked = LinkedAccountsRepository.getByDiscordId(targetDiscordId);
            if (!linked) {
                return {
                    success: false,
                    error: 'not_verified',
                    message: 'Target user is not verified.',
                };
            }

            // Use default group if not specified
            const targetGroupId = groupId || config.roblox.defaultGroupId;
            if (!targetGroupId) {
                return {
                    success: false,
                    error: 'no_group',
                    message: 'No group specified and no default group configured.',
                };
            }

            // Perform demotion
            const result = await robloxService.demoteUser(targetGroupId, linked.roblox_id);

            if (result.success) {
                // Log the action
                AuditLogRepository.logDemotion(
                    guildId,
                    actorDiscordId,
                    targetDiscordId,
                    linked.roblox_id,
                    result.oldRank,
                    result.newRank
                );

                logger.info(`Demoted ${linked.roblox_username} from ${result.oldRank} to ${result.newRank}`);

                return {
                    success: true,
                    robloxUsername: linked.roblox_username,
                    oldRank: result.oldRank,
                    newRank: result.newRank,
                };
            }

            return result;
        } catch (error) {
            logger.error(`Demotion failed: ${error.message}`);
            return {
                success: false,
                error: 'demotion_failed',
                message: error.message,
            };
        }
    }

    /**
     * Set a user to a specific rank
     */
    static async setRank(guildId, targetDiscordId, actorDiscordId, rank, groupId = null) {
        try {
            // Get linked account
            const linked = LinkedAccountsRepository.getByDiscordId(targetDiscordId);
            if (!linked) {
                return {
                    success: false,
                    error: 'not_verified',
                    message: 'Target user is not verified.',
                };
            }

            // Use default group if not specified
            const targetGroupId = groupId || config.roblox.defaultGroupId;
            if (!targetGroupId) {
                return {
                    success: false,
                    error: 'no_group',
                    message: 'No group specified and no default group configured.',
                };
            }

            // Determine if rank is a number or name
            let result;
            if (typeof rank === 'number' || /^\d+$/.test(rank)) {
                result = await robloxService.setUserToRank(targetGroupId, linked.roblox_id, parseInt(rank));
            } else {
                result = await robloxService.setUserToRankByName(targetGroupId, linked.roblox_id, rank);
            }

            if (result.success) {
                // Log the action
                const actionType = result.newRankId > (result.oldRankId || 0) ? 'PROMOTION' : 'DEMOTION';
                AuditLogRepository.log(guildId, `SETRANK_${actionType}`, actorDiscordId, {
                    targetDiscordId,
                    targetRobloxId: linked.roblox_id,
                    oldValue: result.oldRank,
                    newValue: result.newRank,
                });

                logger.info(`Set ${linked.roblox_username} to ${result.newRank}`);

                return {
                    success: true,
                    robloxUsername: linked.roblox_username,
                    oldRank: result.oldRank,
                    newRank: result.newRank,
                };
            }

            return result;
        } catch (error) {
            logger.error(`Set rank failed: ${error.message}`);
            return {
                success: false,
                error: 'setrank_failed',
                message: error.message,
            };
        }
    }

    /**
     * Get user's current rank info
     */
    static async getRankInfo(targetDiscordId, groupId = null) {
        try {
            const linked = LinkedAccountsRepository.getByDiscordId(targetDiscordId);
            if (!linked) {
                return {
                    success: false,
                    error: 'not_verified',
                    message: 'User is not verified.',
                };
            }

            const targetGroupId = groupId || config.roblox.defaultGroupId;
            if (!targetGroupId) {
                return {
                    success: false,
                    error: 'no_group',
                    message: 'No group specified.',
                };
            }

            const rankInfo = await robloxService.getUserGroupRank(linked.roblox_id, targetGroupId);

            if (!rankInfo) {
                return {
                    success: false,
                    error: 'api_error',
                    message: 'Failed to fetch rank information.',
                };
            }

            return {
                success: true,
                robloxUsername: linked.roblox_username,
                robloxId: linked.roblox_id,
                inGroup: rankInfo.inGroup,
                rank: rankInfo.rank,
                rankName: rankInfo.roleName,
            };
        } catch (error) {
            logger.error(`Get rank info failed: ${error.message}`);
            return {
                success: false,
                error: 'fetch_failed',
                message: error.message,
            };
        }
    }

    /**
     * Promote and sync Discord roles
     */
    static async promoteAndSync(guildId, targetDiscordId, actorDiscordId, member, groupId = null) {
        const promoteResult = await this.promote(guildId, targetDiscordId, actorDiscordId, groupId);
        
        if (promoteResult.success && member) {
            const syncResult = await RoleSyncService.syncMember(member, guildId, groupId);
            return {
                ...promoteResult,
                rolesSynced: syncResult.success,
            };
        }

        return promoteResult;
    }

    /**
     * Demote and sync Discord roles
     */
    static async demoteAndSync(guildId, targetDiscordId, actorDiscordId, member, groupId = null) {
        const demoteResult = await this.demote(guildId, targetDiscordId, actorDiscordId, groupId);
        
        if (demoteResult.success && member) {
            const syncResult = await RoleSyncService.syncMember(member, guildId, groupId);
            return {
                ...demoteResult,
                rolesSynced: syncResult.success,
            };
        }

        return demoteResult;
    }
}

module.exports = RankService;
