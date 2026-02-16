/**
 * /verify command - Link your Discord account to Roblox
 * Supports two methods:
 *   1. OAuth2 (default) - One-click "Verify with Roblox" button
 *   2. Code-in-bio (fallback) - Provide username, add code to bio
 */

const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const VerificationService = require('../../services/verificationService');
const config = require('../../config');
const logger = require('../../utils/logger');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('verify')
        .setDescription('Link your Discord account to your Roblox account')
        .addStringOption((option) =>
            option
                .setName('username')
                .setDescription('Your Roblox username (leave blank for one-click OAuth verification)')
                .setRequired(false)
        ),

    async execute(interaction) {
        const robloxUsername = interaction.options.getString('username');

        // ── OAuth2 flow (no username provided) ──
        if (!robloxUsername && config.features.enableOAuth) {
            const LinkedAccountsRepository = require('../../database/repositories/linkedAccounts');
            const OAuthService = require('../../services/oauthService');

            // Check if already verified
            const existing = LinkedAccountsRepository.getByDiscordId(interaction.user.id);
            if (existing) {
                return interaction.reply({
                    content: `❌ You are already verified as **${existing.roblox_username}**. Use \`/reverify\` to switch accounts or \`/unlink\` to remove your link.`,
                    ephemeral: true,
                });
            }

            // Generate OAuth URL
            const { url } = OAuthService.generateAuthUrl(
                interaction.user.id,
                interaction.guildId,
                false
            );

            const embed = new EmbedBuilder()
                .setTitle('🔗 Verify Your Roblox Account')
                .setDescription(
                    'Click the button below to verify with Roblox. You\'ll be redirected to Roblox to authorize, then automatically verified!\n\n' +
                    '*Alternatively, use `/verify username:YourName` for manual code-in-bio verification.*'
                )
                .setColor(0x5865F2)
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

        // ── Code-in-bio flow (username provided, or OAuth not enabled) ──
        if (!robloxUsername) {
            return interaction.reply({
                content: '❌ Please provide your Roblox username: `/verify username:YourName`',
                ephemeral: true,
            });
        }

        await interaction.deferReply({ ephemeral: true });

        try {
            const result = await VerificationService.startVerification(
                interaction.user.id,
                robloxUsername,
                interaction.guildId
            );

            if (!result.success) {
                return interaction.editReply({ content: `❌ ${result.message}` });
            }

            const embed = new EmbedBuilder()
                .setTitle('📋 Verification Required')
                .setDescription(
                    `Add this code to your **Roblox bio**:\n\`\`\`${result.code}\`\`\`\n` +
                    `Then click the button below to complete verification.`
                )
                .addFields(
                    { name: 'Roblox Account', value: `${result.robloxUser.displayName} (@${result.robloxUser.name})`, inline: true },
                    { name: 'Expires In', value: `${result.expiresIn} minutes`, inline: true }
                )
                .setColor(0x5865F2)
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
            logger.error('Verify command error:', error);
            await interaction.editReply({ content: '❌ An error occurred while starting verification.' });
        }
    },
};
