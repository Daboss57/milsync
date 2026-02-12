/**
 * Guild Member Add Event - Handle new member joins
 */

const { Events } = require('discord.js');
const logger = require('../utils/logger');
const RoleSyncService = require('../services/roleSyncService');
const LinkedAccountsRepository = require('../database/repositories/linkedAccounts');
const GuildConfigRepository = require('../database/repositories/guildConfig');

module.exports = {
    name: Events.GuildMemberAdd,
    async execute(member) {
        logger.info(`New member joined: ${member.user.tag} in ${member.guild.name}`);

        // Check if user is already verified
        const linked = LinkedAccountsRepository.getByDiscordId(member.id);
        
        if (linked) {
            // Auto-sync roles for verified users
            try {
                const result = await RoleSyncService.syncMember(member, member.guild.id);
                if (result.success) {
                    logger.info(`Auto-synced returning member ${member.user.tag}`);
                }
            } catch (error) {
                logger.error(`Failed to auto-sync returning member: ${error.message}`);
            }
        }

        // Send welcome message if configured
        const guildConfig = GuildConfigRepository.get(member.guild.id);
        if (guildConfig?.welcome_message && guildConfig?.verification_channel_id) {
            try {
                const channel = await member.guild.channels.fetch(guildConfig.verification_channel_id);
                if (channel) {
                    const message = guildConfig.welcome_message
                        .replace('{user}', member.toString())
                        .replace('{server}', member.guild.name)
                        .replace('{username}', member.user.username);
                    
                    await channel.send(message);
                }
            } catch (error) {
                logger.error(`Failed to send welcome message: ${error.message}`);
            }
        }
    },
};
