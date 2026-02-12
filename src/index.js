/**
 * RPCommand Center - Ultimate Roblox RP Management Suite
 * Main entry point
 */

require('dotenv').config();

const { Client, GatewayIntentBits, Collection, Partials } = require('discord.js');
const { initializeDatabase } = require('./database/init');
const { loadCommands } = require('./handlers/commandHandler');
const { loadEvents } = require('./handlers/eventHandler');
const { startApiServer } = require('./api/server');
const { startScheduledTasks } = require('./services/scheduler');
const logger = require('./utils/logger');
const config = require('./config');

// Create Discord client with required intents
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMessageReactions,
    ],
    partials: [
        Partials.Message,
        Partials.Reaction,
        Partials.User,
    ],
});

// Initialize collections
client.commands = new Collection();
client.cooldowns = new Collection();
client.verificationCodes = new Collection();

async function main() {
    try {
        logger.info('🚀 Starting RPCommand Center...');

        // Initialize database
        logger.info('📦 Initializing database...');
        await initializeDatabase();

        // Load command handlers
        logger.info('⚡ Loading commands...');
        await loadCommands(client);

        // Load event handlers
        logger.info('📡 Loading events...');
        await loadEvents(client);

        // Login to Discord
        logger.info('🔐 Logging into Discord...');
        await client.login(config.discord.token);

        // Start API server for in-game integration
        if (config.features.enableIngameApi) {
            logger.info('🌐 Starting API server...');
            await startApiServer(client);
        }

        // Start scheduled tasks (auto-sync, etc.)
        if (config.features.enableAutoSync) {
            logger.info('⏰ Starting scheduled tasks...');
            startScheduledTasks(client);
        }

        logger.info('✅ RPCommand Center is fully operational!');
    } catch (error) {
        logger.error('Failed to start RPCommand Center:', error);
        process.exit(1);
    }
}

// Handle process signals for graceful shutdown
process.on('SIGINT', () => {
    logger.info('Received SIGINT. Shutting down gracefully...');
    client.destroy();
    process.exit(0);
});

process.on('SIGTERM', () => {
    logger.info('Received SIGTERM. Shutting down gracefully...');
    client.destroy();
    process.exit(0);
});

// Handle unhandled rejections
process.on('unhandledRejection', (error) => {
    logger.error('Unhandled promise rejection:', error);
});

// Start the bot
main();
