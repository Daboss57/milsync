/**
 * Blacklist Command - Manage blacklisted users
 */

const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const BlacklistRepository = require('../../database/repositories/blacklist');
const LinkedAccountsRepository = require('../../database/repositories/linkedAccounts');
const AuditLogRepository = require('../../database/repositories/auditLog');
const config = require('../../config');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('blacklist')
        .setDescription('Manage blacklisted users')
        .addSubcommand(subcommand =>
            subcommand
                .setName('add')
                .setDescription('Add a user to the blacklist')
                .addUserOption(option =>
                    option.setName('user')
                        .setDescription('Discord user to blacklist')
                        .setRequired(true)
                )
                .addStringOption(option =>
                    option.setName('reason')
                        .setDescription('Reason for blacklisting')
                        .setRequired(true)
                )
                .addStringOption(option =>
                    option.setName('duration')
                        .setDescription('Duration (e.g., 7d, 30d, permanent)')
                        .setRequired(false)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('remove')
                .setDescription('Remove a user from the blacklist')
                .addUserOption(option =>
                    option.setName('user')
                        .setDescription('Discord user to remove from blacklist')
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('list')
                .setDescription('View all blacklisted users')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('check')
                .setDescription('Check if a user is blacklisted')
                .addUserOption(option =>
                    option.setName('user')
                        .setDescription('Discord user to check')
                        .setRequired(true)
                )
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();

        switch (subcommand) {
            case 'add':
                await handleAdd(interaction);
                break;
            case 'remove':
                await handleRemove(interaction);
                break;
            case 'list':
                await handleList(interaction);
                break;
            case 'check':
                await handleCheck(interaction);
                break;
        }
    },
};

async function handleAdd(interaction) {
    const user = interaction.options.getUser('user');
    const reason = interaction.options.getString('reason');
    const duration = interaction.options.getString('duration');

    // Calculate expiration
    let expiresAt = null;
    if (duration && duration !== 'permanent') {
        const match = duration.match(/^(\d+)([dhwm])$/);
        if (match) {
            const [, amount, unit] = match;
            const multipliers = { d: 86400000, h: 3600000, w: 604800000, m: 2592000000 };
            expiresAt = new Date(Date.now() + parseInt(amount) * multipliers[unit]).toISOString();
        }
    }

    // Get linked Roblox account if exists
    const linked = LinkedAccountsRepository.getByDiscordId(user.id);
    const robloxId = linked?.roblox_id || null;

    BlacklistRepository.add(
        interaction.guildId,
        user.id,
        robloxId,
        reason,
        interaction.user.id,
        expiresAt
    );

    AuditLogRepository.log(interaction.guildId, 'BLACKLIST_ADD', interaction.user.id, {
        targetDiscordId: user.id,
        targetRobloxId: robloxId,
        extra: { reason, expiresAt },
    });

    const embed = new EmbedBuilder()
        .setColor(config.colors.error)
        .setTitle('🚫 User Blacklisted')
        .addFields(
            { name: 'User', value: `${user} (${user.tag})`, inline: true },
            { name: 'Reason', value: reason, inline: true },
            { name: 'Expires', value: expiresAt ? `<t:${Math.floor(new Date(expiresAt).getTime() / 1000)}:R>` : 'Never (Permanent)', inline: true }
        );

    if (robloxId) {
        embed.addFields({ name: 'Roblox ID', value: robloxId, inline: true });
    }

    await interaction.reply({ embeds: [embed] });
}

async function handleRemove(interaction) {
    const user = interaction.options.getUser('user');

    const result = BlacklistRepository.remove(interaction.guildId, user.id);

    if (result.changes === 0) {
        return interaction.reply({
            content: `❌ ${user} is not blacklisted.`,
            flags: 64 /* MessageFlags.Ephemeral */,
        });
    }

    AuditLogRepository.log(interaction.guildId, 'BLACKLIST_REMOVE', interaction.user.id, {
        targetDiscordId: user.id,
    });

    await interaction.reply({
        content: `✅ ${user} has been removed from the blacklist.`,
    });
}

async function handleList(interaction) {
    const blacklist = BlacklistRepository.getAll(interaction.guildId);

    if (blacklist.length === 0) {
        return interaction.reply({
            content: '✅ No users are currently blacklisted.',
            flags: 64 /* MessageFlags.Ephemeral */,
        });
    }

    const embed = new EmbedBuilder()
        .setColor(config.colors.error)
        .setTitle('🚫 Blacklisted Users')
        .setDescription(`${blacklist.length} user(s) blacklisted`);

    const entries = await Promise.all(blacklist.slice(0, 20).map(async (entry) => {
        const user = await interaction.client.users.fetch(entry.discord_id).catch(() => null);
        const expires = entry.expires_at 
            ? `<t:${Math.floor(new Date(entry.expires_at).getTime() / 1000)}:R>` 
            : 'Never';
        return `**${user ? user.tag : entry.discord_id}**\nReason: ${entry.reason}\nExpires: ${expires}`;
    }));

    embed.addFields({ name: 'Users', value: entries.join('\n\n').substring(0, 1024) });

    await interaction.reply({ embeds: [embed], flags: 64 /* MessageFlags.Ephemeral */ });
}

async function handleCheck(interaction) {
    const user = interaction.options.getUser('user');
    const entry = BlacklistRepository.get(interaction.guildId, user.id);

    if (!entry) {
        return interaction.reply({
            content: `✅ ${user} is not blacklisted.`,
            flags: 64 /* MessageFlags.Ephemeral */,
        });
    }

    // Check if expired
    if (entry.expires_at && new Date(entry.expires_at) < new Date()) {
        BlacklistRepository.remove(interaction.guildId, user.id);
        return interaction.reply({
            content: `✅ ${user}'s blacklist has expired and been removed.`,
            flags: 64 /* MessageFlags.Ephemeral */,
        });
    }

    const embed = new EmbedBuilder()
        .setColor(config.colors.error)
        .setTitle('🚫 User is Blacklisted')
        .addFields(
            { name: 'User', value: `${user}`, inline: true },
            { name: 'Reason', value: entry.reason, inline: true },
            { name: 'Since', value: `<t:${Math.floor(new Date(entry.created_at).getTime() / 1000)}:R>`, inline: true },
            { name: 'Expires', value: entry.expires_at ? `<t:${Math.floor(new Date(entry.expires_at).getTime() / 1000)}:R>` : 'Never', inline: true }
        );

    await interaction.reply({ embeds: [embed], flags: 64 /* MessageFlags.Ephemeral */ });
}
