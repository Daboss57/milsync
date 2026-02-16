/**
 * /reverify command - Switch your linked Roblox account
 * Supports two methods:
 *   1. OAuth2 (default) - One-click re-verification
 *   2. Code-in-bio (fallback) - Provide new username
 */

const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const VerificationService = require('../../services/verificationService');
const config = require('../../config');
const logger = require('../../utils/logger');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('reverify')
        .setDescription('Switch your linked Roblox account')
        .addStringOption((option) =>
            option
                .setName('username')
                .setDescription('Your new Roblox username (leave blank for one-click OAuth)')
                .setRequired(false)
        ),

    async execute(interaction) {
        const robloxUsername = interaction.options.getString('username');

        // ── OAuth2 flow (no username provided) ──
        if (!robloxUsername && config.features.enableOAuth) {
            const LinkedAccountsRepository = require('../../database/repositories/linkedAccounts');
            const OAuthService = require('../../services/oauthService');

            const existing = LinkedAccountsRepository.getByDiscordId(interaction.user.id);

            const { url } = OAuthService.generateAuthUrl(
                interaction.user.id,
                interaction.guildId,
                true // isReverify = true → unlinks old account on callback
            );

            const description = existing
                ? `You are currently verified as **${existing.roblox_username}**.\n\nClick the button below to switch to a different Roblox account. Your old link will be removed automatically.\n\n*Alternatively, use \`/reverify username:NewName\` for manual code-in-bio verification.*`
                : 'Click the button below to verify with a Roblox account.\n\n*Alternatively, use `/reverify username:YourName` for manual verification.*';

            const embed = new EmbedBuilder()
                .setTitle('🔄 Re-verify Roblox Account')
                .setDescription(description)
                .setColor(config.embeds.colors.warning)
                .setFooter({ text: 'Link expires in 10 minutes' });

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setLabel('Verify with Roblox')
                    .setStyle(ButtonStyle.Link)
                    .setURL(url)
                    .setEmoji('🎮')
            );

            return interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
        }

        // ── Code-in-bio flow ──
        if (!robloxUsername) {
            return interaction.reply({
                content: '❌ Please provide your new Roblox username: `/reverify username:NewName`',
                ephemeral: true,
            });
        }

        await interaction.deferReply({ ephemeral: true });

        try {
            // Unlink old account
            const unlinkResult = VerificationService.unlinkAccount(interaction.user.id, interaction.guildId);
            if (unlinkResult.wasLinked) {
                logger.info(`Reverify: unlinked ${unlinkResult.previousAccount} for ${interaction.user.id}`);
            }

            // Start new verification
            const result = await VerificationService.startVerification(
                interaction.user.id,
                robloxUsername,
                interaction.guildId
            );

            if (!result.success) {
                return interaction.editReply({ content: `❌ ${result.message}` });
            }

            const embed = new EmbedBuilder()
                .setTitle('🔄 Re-verification')
                .setDescription(
                    `Add this code to your **Roblox bio**:\n\`\`\`${result.code}\`\`\`\n` +
                    `Then click the button below to complete verification.`
                )
                .addFields(
                    { name: 'New Account', value: `${result.robloxUser.displayName} (@${result.robloxUser.name})`, inline: true },
                    { name: 'Expires In', value: `${result.expiresIn} minutes`, inline: true }
                )
                .setColor(config.embeds.colors.warning)
                .setFooter({ text: 'You can remove the code from your bio after verification' });

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('verify_check')
                    .setLabel('I\'ve Added the Code')
                    .setStyle(ButtonStyle.Success)
                    .setEmoji('✅')
            );

            await interaction.editReply({ embeds: [embed], components: [row] });
        } catch (error) {
            logger.error('Reverify command error:', error);
            await interaction.editReply({ content: '❌ An error occurred during re-verification.' });
        }
    },
};
