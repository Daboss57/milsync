/**
 * Permission checking utilities
 */

const { PermissionFlagsBits } = require('discord.js');

/**
 * Check if a member has a specific permission
 */
function hasPermission(member, permission) {
    return member.permissions.has(permission);
}

/**
 * Check if a member is an administrator
 */
function isAdmin(member) {
    return member.permissions.has(PermissionFlagsBits.Administrator);
}

/**
 * Check if a member can manage roles
 */
function canManageRoles(member) {
    return member.permissions.has(PermissionFlagsBits.ManageRoles);
}

/**
 * Check if a member can use moderation commands
 */
function isModerator(member) {
    return (
        member.permissions.has(PermissionFlagsBits.ManageMessages) ||
        member.permissions.has(PermissionFlagsBits.KickMembers) ||
        member.permissions.has(PermissionFlagsBits.BanMembers) ||
        member.permissions.has(PermissionFlagsBits.ManageGuild)
    );
}

/**
 * Check if the bot can manage a specific role
 */
function canBotManageRole(guild, roleId) {
    const botMember = guild.members.me;
    const role = guild.roles.cache.get(roleId);
    
    if (!role || !botMember) return false;
    
    return botMember.roles.highest.position > role.position;
}

/**
 * Get the highest role a member can assign
 */
function getHighestManageableRole(member) {
    return member.roles.highest.position - 1;
}

module.exports = {
    hasPermission,
    isAdmin,
    canManageRoles,
    isModerator,
    canBotManageRole,
    getHighestManageableRole,
};
