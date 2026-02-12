/**
 * Voice State Update Event - Track voice activity
 */

const { Events } = require('discord.js');
const ActivityRepository = require('../database/repositories/activity');
const logger = require('../utils/logger');

module.exports = {
    name: Events.VoiceStateUpdate,
    async execute(oldState, newState) {
        // User joined a voice channel (wasn't in one before, or switched)
        if (newState.channel && (!oldState.channel || oldState.channelId !== newState.channelId)) {
            const member = newState.member;
            if (!member || member.user.bot) return;

            try {
                ActivityRepository.recordVoice(newState.guild.id, member.id);
            } catch (error) {
                logger.error(`Failed to record voice activity: ${error.message}`);
            }
        }
    },
};
