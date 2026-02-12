/**
 * Command Handler - Loads and registers all slash commands
 */

const { Collection, REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');
const config = require('../config');

/**
 * Load all commands from the commands directory
 */
async function loadCommands(client) {
    const commandsPath = path.join(__dirname, '../commands');
    const commandCategories = fs.readdirSync(commandsPath);

    for (const category of commandCategories) {
        const categoryPath = path.join(commandsPath, category);
        
        // Skip if not a directory
        if (!fs.statSync(categoryPath).isDirectory()) continue;

        const commandFiles = fs.readdirSync(categoryPath).filter(file => file.endsWith('.js'));

        for (const file of commandFiles) {
            const filePath = path.join(categoryPath, file);
            const command = require(filePath);

            if ('data' in command && 'execute' in command) {
                client.commands.set(command.data.name, command);
                logger.debug(`Loaded command: ${command.data.name}`);
            } else {
                logger.warn(`Command at ${filePath} is missing required "data" or "execute" property`);
            }
        }
    }

    logger.info(`Loaded ${client.commands.size} commands`);
}

/**
 * Register slash commands with Discord API
 */
async function registerCommands(client) {
    const commands = [];
    
    for (const command of client.commands.values()) {
        commands.push(command.data.toJSON());
    }

    const rest = new REST().setToken(config.discord.token);

    try {
        logger.info(`Registering ${commands.length} slash commands...`);

        // Register globally (takes up to 1 hour to propagate)
        await rest.put(
            Routes.applicationCommands(config.discord.clientId),
            { body: commands }
        );

        logger.info('Successfully registered slash commands globally');
    } catch (error) {
        logger.error('Failed to register slash commands:', error);
        throw error;
    }
}

/**
 * Register commands to a specific guild (instant, good for testing)
 */
async function registerCommandsToGuild(client, guildId) {
    const commands = [];
    
    for (const command of client.commands.values()) {
        commands.push(command.data.toJSON());
    }

    const rest = new REST().setToken(config.discord.token);

    try {
        logger.info(`Registering ${commands.length} slash commands to guild ${guildId}...`);

        await rest.put(
            Routes.applicationGuildCommands(config.discord.clientId, guildId),
            { body: commands }
        );

        logger.info(`Successfully registered slash commands to guild ${guildId}`);
    } catch (error) {
        logger.error(`Failed to register slash commands to guild ${guildId}:`, error);
        throw error;
    }
}

module.exports = {
    loadCommands,
    registerCommands,
    registerCommandsToGuild,
};
