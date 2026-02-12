/**
 * Interaction Create Event - Handles slash commands and other interactions
 */

const { Events, Collection, MessageFlags } = require('discord.js');
const logger = require('../utils/logger');
const config = require('../config');

module.exports = {
    name: Events.InteractionCreate,
    async execute(interaction) {
        // Handle slash commands
        if (interaction.isChatInputCommand()) {
            await handleCommand(interaction);
        }
        // Handle button interactions
        else if (interaction.isButton()) {
            await handleButton(interaction);
        }
        // Handle select menus
        else if (interaction.isStringSelectMenu()) {
            await handleSelectMenu(interaction);
        }
        // Handle autocomplete
        else if (interaction.isAutocomplete()) {
            await handleAutocomplete(interaction);
        }
    },
};

async function handleCommand(interaction) {
    const command = interaction.client.commands.get(interaction.commandName);

    if (!command) {
        logger.warn(`Unknown command: ${interaction.commandName}`);
        return;
    }

    // Check cooldowns
    const { cooldowns } = interaction.client;

    if (!cooldowns.has(command.data.name)) {
        cooldowns.set(command.data.name, new Collection());
    }

    const now = Date.now();
    const timestamps = cooldowns.get(command.data.name);
    const cooldownAmount = (command.cooldown ?? config.rateLimits.commandCooldown) * 1000;

    if (timestamps.has(interaction.user.id)) {
        const expirationTime = timestamps.get(interaction.user.id) + cooldownAmount;

        if (now < expirationTime) {
            const expiredTimestamp = Math.round(expirationTime / 1000);
            return interaction.reply({
                content: `⏳ Please wait, you can use \`/${command.data.name}\` again <t:${expiredTimestamp}:R>.`,
                flags: MessageFlags.Ephemeral,
            }).catch(() => { });
        }
    }

    timestamps.set(interaction.user.id, now);
    setTimeout(() => timestamps.delete(interaction.user.id), cooldownAmount);

    // Execute command
    try {
        logger.info(`Command executed: /${interaction.commandName} by ${interaction.user.tag} in ${interaction.guild?.name || 'DM'}`);
        await command.execute(interaction);
    } catch (error) {
        logger.error(`Error executing command ${interaction.commandName}:`, error);

        const errorMessage = {
            content: '❌ An error occurred while executing this command.',
            flags: MessageFlags.Ephemeral,
        };

        try {
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp(errorMessage);
            } else {
                await interaction.reply(errorMessage);
            }
        } catch (replyError) {
            // Interaction expired — nothing we can do
            logger.warn(`Could not send error response for /${interaction.commandName}: ${replyError.message}`);
        }
    }
}

async function handleButton(interaction) {
    const [action, ...params] = interaction.customId.split(':');

    try {
        // Handle verification buttons
        if (action === 'verify_check') {
            const VerificationService = require('../services/verificationService');
            const RoleSyncService = require('../services/roleSyncService');
            const { EmbedBuilder } = require('discord.js');

            await interaction.deferReply({ flags: MessageFlags.Ephemeral });

            const result = await VerificationService.completeVerification(
                interaction.user.id,
                interaction.guildId
            );

            if (result.success) {
                // Sync roles + nickname
                const member = await interaction.guild.members.fetch(interaction.user.id);
                const syncResult = await RoleSyncService.syncMember(member, interaction.guildId);

                const embed = new EmbedBuilder()
                    .setColor(0x57F287)
                    .setTitle('✅ Verification Complete!')
                    .setDescription(`You are now verified as **${result.robloxUser.name}**!`)
                    .addFields(
                        { name: 'Roles Added', value: (syncResult.rolesAdded || 0).toString(), inline: true },
                        { name: 'Roles Removed', value: (syncResult.rolesRemoved || 0).toString(), inline: true },
                    );

                if (syncResult.nicknameApplied) {
                    embed.addFields({ name: 'Nickname Set', value: `\`${syncResult.nicknameApplied}\``, inline: true });
                }

                embed.setFooter({ text: 'Your roles and nickname have been synced automatically' });

                await interaction.editReply({ embeds: [embed] });
            } else {
                await interaction.editReply({ content: `❌ ${result.message}` });
            }
        }
        // Handle application buttons
        else if (action === 'app_approve' || action === 'app_deny') {
            const ApplicationsRepository = require('../database/repositories/applications');
            const applicationId = params[0];

            const application = ApplicationsRepository.getById(applicationId);
            if (!application) {
                return interaction.reply({ content: '❌ Application not found.', flags: MessageFlags.Ephemeral });
            }

            if (application.status !== 'pending') {
                return interaction.reply({ content: '❌ This application has already been processed.', flags: MessageFlags.Ephemeral });
            }

            if (action === 'app_approve') {
                ApplicationsRepository.approve(applicationId, interaction.user.id);
                await interaction.reply({ content: `✅ Application approved by ${interaction.user}.` });
            } else {
                ApplicationsRepository.deny(applicationId, interaction.user.id);
                await interaction.reply({ content: `❌ Application denied by ${interaction.user}.` });
            }
        }
    } catch (error) {
        logger.error(`Error handling button ${interaction.customId}:`, error);
        await interaction.reply({ content: '❌ An error occurred.', flags: MessageFlags.Ephemeral }).catch(() => { });
    }
}

async function handleSelectMenu(interaction) {
    // Handle select menu interactions
    logger.debug(`Select menu interaction: ${interaction.customId}`);
}

async function handleAutocomplete(interaction) {
    const command = interaction.client.commands.get(interaction.commandName);

    if (!command || !command.autocomplete) {
        return;
    }

    try {
        await command.autocomplete(interaction);
    } catch (error) {
        logger.error(`Error handling autocomplete for ${interaction.commandName}:`, error);
    }
}
