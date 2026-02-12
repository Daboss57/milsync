/**
 * Message Create Event - Handle XP awarding and activity tracking
 */

const { Events } = require('discord.js');
const XPService = require('../services/xpService');
const ActivityRepository = require('../database/repositories/activity');
const config = require('../config');
const logger = require('../utils/logger');

module.exports = {
    name: Events.MessageCreate,
    async execute(message) {
        // Ignore bots and DMs
        if (message.author.bot || !message.guild) return;

        // Record activity
        try {
            ActivityRepository.recordMessage(message.guild.id, message.author.id);
        } catch (error) {
            logger.error(`Failed to record message activity: ${error.message}`);
        }

        // Award XP for messages if enabled
        if (config.features.enableXpSystem) {
            const result = await XPService.awardMessageXP(message.guild.id, message.author.id);

            // Optionally notify on level up
            if (result?.leveledUp) {
                // You could send a level-up message here
                // await message.channel.send(`🎉 ${message.author} reached level ${result.newLevel}!`);
            }
        }
    },
};
