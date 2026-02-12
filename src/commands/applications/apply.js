/**
 * Apply Command - Submit an application
 */

const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const ApplicationsRepository = require('../../database/repositories/applications');
const GuildConfigRepository = require('../../database/repositories/guildConfig');
const LinkedAccountsRepository = require('../../database/repositories/linkedAccounts');
const config = require('../../config');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('apply')
        .setDescription('Submit an application for a rank or position')
        .addStringOption(option =>
            option.setName('type')
                .setDescription('Type of application')
                .setRequired(true)
                .addChoices(
                    { name: 'Promotion', value: 'promotion' },
                    { name: 'Transfer', value: 'transfer' },
                    { name: 'Staff Position', value: 'staff' },
                    { name: 'Other', value: 'other' }
                )
        )
        .addStringOption(option =>
            option.setName('position')
                .setDescription('Position/rank you are applying for')
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName('reason')
                .setDescription('Why should you be considered?')
                .setRequired(true)
        ),

    async execute(interaction) {
        await interaction.deferReply({ flags: 64 /* MessageFlags.Ephemeral */ });

        // Check if user is verified
        const linked = LinkedAccountsRepository.getByDiscordId(interaction.user.id);
        if (!linked) {
            return interaction.editReply({
                content: '❌ You must be verified to submit an application. Use `/verify` first.',
            });
        }

        const applicationType = interaction.options.getString('type');
        const position = interaction.options.getString('position');
        const reason = interaction.options.getString('reason');

        // Check for pending application of same type
        if (ApplicationsRepository.hasPending(interaction.guildId, interaction.user.id, applicationType)) {
            return interaction.editReply({
                content: '❌ You already have a pending application of this type.',
            });
        }

        // Create application
        const applicationId = ApplicationsRepository.create(
            interaction.guildId,
            interaction.user.id,
            applicationType,
            null, // target_rank_id
            null, // target_role_id
            reason
        );

        // Get applications channel
        const guildConfig = GuildConfigRepository.getOrCreate(interaction.guildId);
        
        if (!guildConfig.applications_channel_id) {
            return interaction.editReply({
                content: '❌ Applications channel has not been configured. Please contact an administrator.',
            });
        }

        // Send to applications channel
        try {
            const channel = await interaction.guild.channels.fetch(guildConfig.applications_channel_id);
            
            const embed = new EmbedBuilder()
                .setColor(config.colors.info)
                .setTitle(`📋 New ${applicationType.charAt(0).toUpperCase() + applicationType.slice(1)} Application`)
                .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }))
                .addFields(
                    { name: 'Applicant', value: `${interaction.user} (${interaction.user.tag})`, inline: true },
                    { name: 'Roblox Account', value: linked.roblox_username, inline: true },
                    { name: 'Position', value: position, inline: true },
                    { name: 'Reason', value: reason }
                )
                .setFooter({ text: `Application ID: ${applicationId}` })
                .setTimestamp();

            const row = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId(`app_approve:${applicationId}`)
                        .setLabel('Approve')
                        .setStyle(ButtonStyle.Success)
                        .setEmoji('✅'),
                    new ButtonBuilder()
                        .setCustomId(`app_deny:${applicationId}`)
                        .setLabel('Deny')
                        .setStyle(ButtonStyle.Danger)
                        .setEmoji('❌')
                );

            const message = await channel.send({ embeds: [embed], components: [row] });
            
            // Save message ID for reference
            ApplicationsRepository.setMessageId(applicationId, message.id);

            await interaction.editReply({
                content: `✅ Your application has been submitted! Application ID: \`${applicationId}\``,
            });
        } catch (error) {
            return interaction.editReply({
                content: '❌ Failed to submit application. Please try again later.',
            });
        }
    },
};
