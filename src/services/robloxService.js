/**
 * Roblox API Service - Handles all Roblox Open Cloud API interactions
 */

const logger = require('../utils/logger');
const config = require('../config');

class RobloxService {
    constructor() {
        this.baseUrl = config.roblox.openCloudBaseUrl;
        this.usersUrl = config.roblox.usersApiUrl;
        this.groupsUrl = config.roblox.groupsApiUrl;
        this.apiKey = config.roblox.apiKey;
    }

    /**
     * Make authenticated request to Roblox Open Cloud API
     */
    async openCloudRequest(endpoint, method = 'GET', body = null) {
        const url = `${this.baseUrl}${endpoint}`;
        const options = {
            method,
            headers: {
                'x-api-key': this.apiKey,
                'Content-Type': 'application/json',
            },
        };

        if (body) {
            options.body = JSON.stringify(body);
        }

        try {
            const response = await fetch(url, options);

            if (!response.ok) {
                const error = await response.text();
                throw new Error(`Roblox API error ${response.status}: ${error}`);
            }

            return await response.json();
        } catch (error) {
            logger.error(`Roblox Open Cloud API error: ${error.message}`);
            throw error;
        }
    }

    /**
     * Make request to Roblox public API
     */
    async publicRequest(baseUrl, endpoint, method = 'GET') {
        const url = `${baseUrl}${endpoint}`;

        try {
            const response = await fetch(url, { method });

            if (!response.ok) {
                const error = await response.text();
                throw new Error(`Roblox API error ${response.status}: ${error}`);
            }

            return await response.json();
        } catch (error) {
            logger.error(`Roblox public API error: ${error.message}`);
            throw error;
        }
    }

    /**
     * Get user info by username
     */
    async getUserByUsername(username) {
        try {
            const response = await fetch(`${this.usersUrl}/v1/usernames/users`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    usernames: [username],
                    excludeBannedUsers: true,
                }),
            });

            const data = await response.json();
            return data.data?.[0] || null;
        } catch (error) {
            logger.error(`Failed to get user by username: ${error.message}`);
            return null;
        }
    }

    /**
     * Get user info by ID
     */
    async getUserById(userId) {
        try {
            const response = await fetch(`${this.usersUrl}/v1/users/${userId}`);
            if (!response.ok) return null;
            return await response.json();
        } catch (error) {
            logger.error(`Failed to get user by ID: ${error.message}`);
            return null;
        }
    }

    /**
     * Get user's profile (includes description/bio)
     */
    async getUserProfile(userId) {
        try {
            const response = await fetch(`${this.usersUrl}/v1/users/${userId}`);
            if (!response.ok) return null;
            return await response.json();
        } catch (error) {
            logger.error(`Failed to get user profile: ${error.message}`);
            return null;
        }
    }

    /**
     * Get user's group membership and rank via Open Cloud API
     */
    async getUserGroupRank(userId, groupId) {
        try {
            // Use Open Cloud API to get membership filtered by user
            const endpoint = `/cloud/v2/groups/${groupId}/memberships?filter=user == 'users/${userId}'&maxPageSize=1`;
            const data = await this.openCloudRequest(endpoint);

            const membership = data.groupMemberships?.[0];
            if (!membership) {
                return { inGroup: false, rank: 0, role: null };
            }

            // The role field is like "groups/123/roles/456"
            const rolePath = membership.role || '';
            const roleId = rolePath.split('/').pop();

            // Now get the role details to get rank number and name
            const roles = await this.getGroupRoles(groupId);
            const matchedRole = roles.find(r => r.id === roleId);

            return {
                inGroup: true,
                rank: matchedRole?.rank ?? 0,
                roleId: roleId,
                roleName: matchedRole?.displayName || matchedRole?.id || 'Unknown',
            };
        } catch (error) {
            logger.error(`Failed to get user group rank: ${error.message}`);
            // Fallback to legacy API
            return this.getUserGroupRankLegacy(userId, groupId);
        }
    }

    /**
     * Fallback: Get user's group membership via legacy API
     */
    async getUserGroupRankLegacy(userId, groupId) {
        try {
            const response = await fetch(
                `${this.groupsUrl}/v1/users/${userId}/groups/roles`
            );

            if (!response.ok) return null;

            const data = await response.json();
            const membership = data.data?.find(g => g.group.id === parseInt(groupId));

            if (!membership) {
                return { inGroup: false, rank: 0, role: null };
            }

            return {
                inGroup: true,
                rank: membership.role.rank,
                roleId: membership.role.id.toString(),
                roleName: membership.role.name,
            };
        } catch (error) {
            logger.error(`Failed to get user group rank (legacy): ${error.message}`);
            return null;
        }
    }

    /**
     * Get all ranks/roles in a group via Open Cloud API
     */
    async getGroupRoles(groupId) {
        try {
            const endpoint = `/cloud/v2/groups/${groupId}/roles?maxPageSize=20`;
            const data = await this.openCloudRequest(endpoint);

            // Open Cloud returns { groupRoles: [...], nextPageToken }
            const roles = (data.groupRoles || []).map(role => {
                // role.path is like "groups/123/roles/456"
                const id = role.path?.split('/').pop() || role.id;
                return {
                    id: id,
                    name: role.displayName || id,
                    displayName: role.displayName,
                    rank: role.rank ?? 0,
                };
            });

            return roles;
        } catch (error) {
            logger.error(`Failed to get group roles: ${error.message}`);
            // Fallback to legacy API
            return this.getGroupRolesLegacy(groupId);
        }
    }

    /**
     * Fallback: Get group roles via legacy API
     */
    async getGroupRolesLegacy(groupId) {
        try {
            const response = await fetch(`${this.groupsUrl}/v1/groups/${groupId}/roles`);
            if (!response.ok) return [];

            const data = await response.json();
            return (data.roles || []).map(r => ({
                ...r,
                id: r.id.toString(),
            }));
        } catch (error) {
            logger.error(`Failed to get group roles (legacy): ${error.message}`);
            return [];
        }
    }

    /**
     * Get group info
     */
    async getGroupInfo(groupId) {
        try {
            const response = await fetch(`${this.groupsUrl}/v1/groups/${groupId}`);
            if (!response.ok) return null;
            return await response.json();
        } catch (error) {
            logger.error(`Failed to get group info: ${error.message}`);
            return null;
        }
    }

    /**
     * Set user rank in group (Open Cloud API)
     */
    async setUserRank(groupId, userId, roleId) {
        try {
            const endpoint = `/cloud/v2/groups/${groupId}/memberships/${userId}`;

            const result = await this.openCloudRequest(endpoint, 'PATCH', {
                role: `groups/${groupId}/roles/${roleId}`,
            });

            logger.info(`Set rank for user ${userId} to role ${roleId} in group ${groupId}`);
            return { success: true, data: result };
        } catch (error) {
            logger.error(`Failed to set user rank: ${error.message}`);
            return { success: false, error: error.message };
        }
    }

    /**
     * Promote user to next rank
     */
    async promoteUser(groupId, userId) {
        try {
            // Get current rank
            const currentRank = await this.getUserGroupRank(userId, groupId);
            if (!currentRank || !currentRank.inGroup) {
                return { success: false, error: 'User not in group' };
            }

            // Get all roles
            const roles = await this.getGroupRoles(groupId);
            const sortedRoles = roles.sort((a, b) => a.rank - b.rank);

            // Find next rank
            const currentIndex = sortedRoles.findIndex(r => r.rank === currentRank.rank);
            if (currentIndex === -1 || currentIndex === sortedRoles.length - 1) {
                return { success: false, error: 'Cannot promote further' };
            }

            const nextRole = sortedRoles[currentIndex + 1];
            const result = await this.setUserRank(groupId, userId, nextRole.id);

            if (result.success) {
                return {
                    success: true,
                    oldRank: currentRank.roleName,
                    newRank: nextRole.name,
                    newRankId: nextRole.rank,
                };
            }

            return result;
        } catch (error) {
            logger.error(`Failed to promote user: ${error.message}`);
            return { success: false, error: error.message };
        }
    }

    /**
     * Demote user to previous rank
     */
    async demoteUser(groupId, userId) {
        try {
            // Get current rank
            const currentRank = await this.getUserGroupRank(userId, groupId);
            if (!currentRank || !currentRank.inGroup) {
                return { success: false, error: 'User not in group' };
            }

            // Get all roles
            const roles = await this.getGroupRoles(groupId);
            const sortedRoles = roles.sort((a, b) => a.rank - b.rank);

            // Find previous rank
            const currentIndex = sortedRoles.findIndex(r => r.rank === currentRank.rank);
            if (currentIndex <= 1) { // Can't demote to Guest (rank 0)
                return { success: false, error: 'Cannot demote further' };
            }

            const prevRole = sortedRoles[currentIndex - 1];
            const result = await this.setUserRank(groupId, userId, prevRole.id);

            if (result.success) {
                return {
                    success: true,
                    oldRank: currentRank.roleName,
                    newRank: prevRole.name,
                    newRankId: prevRole.rank,
                };
            }

            return result;
        } catch (error) {
            logger.error(`Failed to demote user: ${error.message}`);
            return { success: false, error: error.message };
        }
    }

    /**
     * Set user to specific rank by rank number
     */
    async setUserToRank(groupId, userId, targetRank) {
        try {
            // Get all roles
            const roles = await this.getGroupRoles(groupId);
            const targetRole = roles.find(r => r.rank === targetRank);

            if (!targetRole) {
                return { success: false, error: 'Rank not found' };
            }

            // Get current rank for logging
            const currentRank = await this.getUserGroupRank(userId, groupId);

            const result = await this.setUserRank(groupId, userId, targetRole.id);

            if (result.success) {
                return {
                    success: true,
                    oldRank: currentRank?.roleName || 'Unknown',
                    newRank: targetRole.name,
                    newRankId: targetRole.rank,
                };
            }

            return result;
        } catch (error) {
            logger.error(`Failed to set user rank: ${error.message}`);
            return { success: false, error: error.message };
        }
    }

    /**
     * Set user to specific rank by role name
     */
    async setUserToRankByName(groupId, userId, rankName) {
        try {
            // Get all roles
            const roles = await this.getGroupRoles(groupId);
            const targetRole = roles.find(
                r => r.name.toLowerCase() === rankName.toLowerCase()
            );

            if (!targetRole) {
                return { success: false, error: 'Rank not found' };
            }

            return this.setUserToRank(groupId, userId, targetRole.rank);
        } catch (error) {
            logger.error(`Failed to set user rank by name: ${error.message}`);
            return { success: false, error: error.message };
        }
    }

    /**
     * Verify user by checking if code exists in their bio
     */
    async verifyUserBio(userId, expectedCode) {
        try {
            const profile = await this.getUserProfile(userId);
            if (!profile) {
                return { success: false, error: 'Could not fetch profile' };
            }

            const bio = profile.description || '';
            if (bio.includes(expectedCode)) {
                return {
                    success: true,
                    username: profile.name,
                    displayName: profile.displayName,
                };
            }

            return { success: false, error: 'Verification code not found in bio' };
        } catch (error) {
            logger.error(`Failed to verify user bio: ${error.message}`);
            return { success: false, error: error.message };
        }
    }
}

// Export singleton instance
module.exports = new RobloxService();
