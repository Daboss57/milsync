/**
 * Common embed templates and utilities
 */

const { EmbedBuilder } = require('discord.js');
const config = require('../config');

/**
 * Create a success embed
 */
function successEmbed(title, description) {
    return new EmbedBuilder()
        .setColor(config.colors.success)
        .setTitle(`✅ ${title}`)
        .setDescription(description);
}

/**
 * Create an error embed
 */
function errorEmbed(title, description) {
    return new EmbedBuilder()
        .setColor(config.colors.error)
        .setTitle(`❌ ${title}`)
        .setDescription(description);
}

/**
 * Create a warning embed
 */
function warningEmbed(title, description) {
    return new EmbedBuilder()
        .setColor(config.colors.warning)
        .setTitle(`⚠️ ${title}`)
        .setDescription(description);
}

/**
 * Create an info embed
 */
function infoEmbed(title, description) {
    return new EmbedBuilder()
        .setColor(config.colors.info)
        .setTitle(`ℹ️ ${title}`)
        .setDescription(description);
}

/**
 * Create a loading embed
 */
function loadingEmbed(message = 'Loading...') {
    return new EmbedBuilder()
        .setColor(config.colors.primary)
        .setDescription(`⏳ ${message}`);
}

module.exports = {
    successEmbed,
    errorEmbed,
    warningEmbed,
    infoEmbed,
    loadingEmbed,
};
