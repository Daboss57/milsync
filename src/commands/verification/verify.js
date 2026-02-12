/**
 * Verify Command - Start account verification process
 */

const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const VerificationService = require('../../services/verificationService');
const config = require('../../config');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('verify')
        .setDescription('Link your Roblox account to Discord')
        .addStringOption(option =>
            option.setName('username')
                .setDescription('Your Roblox username')
                .setRequired(true)
        ),

    async execute(interaction) {
        await interaction.deferReply({ flags: 64 /* MessageFlags.Ephemeral */ });

        const username = interaction.options.getString('username');
        const result = await VerificationService.startVerification(
            interaction.user.id,
            username,
            interaction.guildId
        );

        if (!result.success) {
            return interaction.editReply({
                content: `❌ ${result.message}`,
            });
        }

        const embed = new EmbedBuilder()
            .setColor(config.colors.primary)
            .setTitle('🔐 Verification Started')
            .setDescription(
                `To verify your account, add the following code to your Roblox bio:\n\n` +
                `\`\`\`${result.code}\`\`\`\n` +
                `**Steps:**\n` +
                `1. Go to [your Roblox profile](https://www.roblox.com/users/${result.robloxUser.id}/profile)\n` +
                `2. Click "Edit Profile" or the pencil icon\n` +
                `3. Add the code above anywhere in your "About" section\n` +
                `4. Save your profile\n` +
                `5. Click the "I've Added the Code" button below`
            )
            .addFields(
                { name: 'Roblox Account', value: result.robloxUser.name, inline: true },
                { name: 'Expires In', value: `${result.expiresIn} minutes`, inline: true }
            )
            .setFooter({ text: 'You can remove the code from your bio after verification' });

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
