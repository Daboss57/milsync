/**
 * Discord Ready Event
 */

const { Events, ActivityType } = require('discord.js');
const { registerCommands } = require('../handlers/commandHandler');
const logger = require('../utils/logger');

module.exports = {
    name: Events.ClientReady,
    once: true,
    async execute(client) {
        logger.info(`Logged in as ${client.user.tag}`);
        logger.info(`Serving ${client.guilds.cache.size} guilds`);

        // Set bot status
        client.user.setPresence({
            activities: [{
                name: '/help | RPCommand Center',
                type: ActivityType.Watching,
            }],
            status: 'online',
        });

        // Register slash commands
        try {
            await registerCommands(client);
        } catch (error) {
            logger.error('Failed to register commands on ready:', error);
        }
    },
};
