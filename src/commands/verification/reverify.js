/**
 * Reverify Command - Switch to a different Roblox account
 * Unlinks the old account and starts a fresh verification
 */

const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const VerificationService = require('../../services/verificationService');
const LinkedAccountsRepository = require('../../database/repositories/linkedAccounts');
const config = require('../../config');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('reverify')
        .setDescription('Switch your linked Roblox account to a different one')
        .addStringOption(option =>
            option.setName('username')
                .setDescription('Your new Roblox username')
                .setRequired(true)
        ),

    async execute(interaction) {
        await interaction.deferReply({ flags: 64 /* MessageFlags.Ephemeral */ });

        const username = interaction.options.getString('username');

        // Check if user is currently verified
        const existing = LinkedAccountsRepository.getByDiscordId(interaction.user.id);
        const oldUsername = existing?.roblox_username;

        // If verified, unlink first
        if (existing) {
            VerificationService.unlinkAccount(interaction.user.id, interaction.guildId);
        }

        // Start new verification
        const result = await VerificationService.startVerification(
            interaction.user.id,
            username,
            interaction.guildId
        );

        if (!result.success) {
            // If verification failed, re-link old account if we unlinked one
            if (existing) {
                LinkedAccountsRepository.link(existing.discord_id, existing.roblox_id, existing.roblox_username);
            }

            return interaction.editReply({
                content: `❌ ${result.message}`,
            });
        }

        const description = oldUsername
            ? `Switching from **${oldUsername}** to **${result.robloxUser.name}**.\n\n`
            : '';

        const embed = new EmbedBuilder()
            .setColor(config.colors.primary)
            .setTitle('🔄 Reverification Started')
            .setDescription(
                description +
                `Add the following code to your **new** Roblox account's bio:\n\n` +
                `\`\`\`${result.code}\`\`\`\n` +
                `**Steps:**\n` +
                `1. Go to [your Roblox profile](https://www.roblox.com/users/${result.robloxUser.id}/profile)\n` +
                `2. Click "Edit Profile" or the pencil icon\n` +
                `3. Add the code above anywhere in your "About" section\n` +
                `4. Save your profile\n` +
                `5. Click the "I've Added the Code" button below`
            )
            .addFields(
                { name: 'New Account', value: result.robloxUser.name, inline: true },
                { name: 'Expires In', value: `${result.expiresIn} minutes`, inline: true }
            );

        if (oldUsername) {
            embed.addFields({ name: 'Previous Account', value: oldUsername, inline: true });
        }

        embed.setFooter({ text: 'You can remove the code from your bio after verification' });

        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('verify_check')
                    .setLabel("I've Added the Code")
                    .setStyle(ButtonStyle.Success)
                    .setEmoji('✅'),
                new ButtonBuilder()
                    .setLabel('Open Roblox Profile')
                    .setStyle(ButtonStyle.Link)
                    .setURL(`https://www.roblox.com/users/${result.robloxUser.id}/profile`)
            );

        await interaction.editReply({ embeds: [embed], components: [row] });
    },
};
