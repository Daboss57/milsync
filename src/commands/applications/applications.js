/**
 * Applications Command - View application status
 */

const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const ApplicationsRepository = require('../../database/repositories/applications');
const config = require('../../config');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('applications')
        .setDescription('View applications')
        .addSubcommand(subcommand =>
            subcommand
                .setName('mine')
                .setDescription('View your applications')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('pending')
                .setDescription('View all pending applications (Staff)')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('stats')
                .setDescription('View application statistics (Staff)')
        ),

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();

        if (subcommand === 'mine') {
            await handleMine(interaction);
        } else if (subcommand === 'pending') {
            await handlePending(interaction);
        } else if (subcommand === 'stats') {
            await handleStats(interaction);
        }
    },
};

async function handleMine(interaction) {
    const applications = ApplicationsRepository.getByUser(interaction.guildId, interaction.user.id);

    if (applications.length === 0) {
        return interaction.reply({
            content: '❌ You have no applications.',
            flags: 64 /* MessageFlags.Ephemeral */,
        });
    }

    const embed = new EmbedBuilder()
        .setColor(config.colors.primary)
        .setTitle('📋 Your Applications')
        .setDescription(
            applications.slice(0, 10).map(app => {
                const statusEmoji = app.status === 'pending' ? '⏳' : app.status === 'approved' ? '✅' : '❌';
                const date = new Date(app.created_at).toLocaleDateString();
                return `${statusEmoji} **${app.application_type}** - ${app.status} (${date})`;
            }).join('\n')
        );

    await interaction.reply({ embeds: [embed], flags: 64 /* MessageFlags.Ephemeral */ });
}

async function handlePending(interaction) {
    // Check permissions
    if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
        return interaction.reply({
            content: '❌ You do not have permission to view pending applications.',
            flags: 64 /* MessageFlags.Ephemeral */,
        });
    }

    const applications = ApplicationsRepository.getPending(interaction.guildId);

    if (applications.length === 0) {
        return interaction.reply({
            content: '✅ No pending applications.',
            flags: 64 /* MessageFlags.Ephemeral */,
        });
    }

    const embed = new EmbedBuilder()
        .setColor(config.colors.info)
        .setTitle('📋 Pending Applications')
        .setDescription(`Found ${applications.length} pending application(s).`);

    for (const app of applications.slice(0, 10)) {
        const user = await interaction.client.users.fetch(app.discord_id).catch(() => null);
        embed.addFields({
            name: `#${app.id} - ${app.application_type}`,
            value: `Applicant: ${user ? user.tag : app.discord_id}\nSubmitted: <t:${Math.floor(new Date(app.created_at).getTime() / 1000)}:R>`,
            inline: true,
        });
    }

    await interaction.reply({ embeds: [embed], flags: 64 /* MessageFlags.Ephemeral */ });
}

async function handleStats(interaction) {
    // Check permissions
    if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
        return interaction.reply({
            content: '❌ You do not have permission to view application statistics.',
            flags: 64 /* MessageFlags.Ephemeral */,
        });
    }

    const stats = ApplicationsRepository.getStats(interaction.guildId);
    
    const statusCounts = {
        pending: 0,
        approved: 0,
        denied: 0,
    };

    for (const stat of stats) {
        statusCounts[stat.status] = stat.count;
    }

    const total = Object.values(statusCounts).reduce((a, b) => a + b, 0);

    const embed = new EmbedBuilder()
        .setColor(config.colors.primary)
        .setTitle('📊 Application Statistics')
        .addFields(
            { name: 'Total', value: total.toString(), inline: true },
            { name: '⏳ Pending', value: statusCounts.pending.toString(), inline: true },
            { name: '✅ Approved', value: statusCounts.approved.toString(), inline: true },
            { name: '❌ Denied', value: statusCounts.denied.toString(), inline: true }
        );

    if (total > 0) {
        const approvalRate = Math.round((statusCounts.approved / (statusCounts.approved + statusCounts.denied)) * 100) || 0;
        embed.addFields({ name: 'Approval Rate', value: `${approvalRate}%`, inline: true });
    }

    await interaction.reply({ embeds: [embed], flags: 64 /* MessageFlags.Ephemeral */ });
}
