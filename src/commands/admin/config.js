/**
 * Config Command - Configure bot settings
 */

const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const GuildConfigRepository = require('../../database/repositories/guildConfig');
const AuditLogRepository = require('../../database/repositories/auditLog');
const config = require('../../config');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('config')
        .setDescription('Configure bot settings for this server')
        .addSubcommand(subcommand =>
            subcommand
                .setName('view')
                .setDescription('View current configuration')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('logchannel')
                .setDescription('Set the audit log channel')
                .addChannelOption(option =>
                    option.setName('channel')
                        .setDescription('Channel for audit logs')
                        .setRequired(true)
                        .addChannelTypes(ChannelType.GuildText)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('verificationchannel')
                .setDescription('Set the verification channel')
                .addChannelOption(option =>
                    option.setName('channel')
                        .setDescription('Channel for verification')
                        .setRequired(true)
                        .addChannelTypes(ChannelType.GuildText)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('applicationschannel')
                .setDescription('Set the applications channel')
                .addChannelOption(option =>
                    option.setName('channel')
                        .setDescription('Channel for applications')
                        .setRequired(true)
                        .addChannelTypes(ChannelType.GuildText)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('autosync')
                .setDescription('Toggle automatic role syncing')
                .addBooleanOption(option =>
                    option.setName('enabled')
                        .setDescription('Enable or disable auto-sync')
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('xp')
                .setDescription('Toggle the XP system')
                .addBooleanOption(option =>
                    option.setName('enabled')
                        .setDescription('Enable or disable XP system')
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('welcome')
                .setDescription('Set the welcome message')
                .addStringOption(option =>
                    option.setName('message')
                        .setDescription('Welcome message ({user}, {server}, {username} placeholders)')
                        .setRequired(true)
                )
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();
        const guildConfig = GuildConfigRepository.getOrCreate(interaction.guildId);

        switch (subcommand) {
            case 'view':
                await handleView(interaction, guildConfig);
                break;
            case 'logchannel':
                await handleSetChannel(interaction, 'log_channel_id', 'Log channel');
                break;
            case 'verificationchannel':
                await handleSetChannel(interaction, 'verification_channel_id', 'Verification channel');
                break;
            case 'applicationschannel':
                await handleSetChannel(interaction, 'applications_channel_id', 'Applications channel');
                break;
            case 'autosync':
                await handleToggle(interaction, 'auto_sync_enabled', 'Auto-sync');
                break;
            case 'xp':
                await handleToggle(interaction, 'xp_enabled', 'XP system');
                break;
            case 'welcome':
                await handleWelcome(interaction);
                break;
        }
    },
};

async function handleView(interaction, guildConfig) {
    const embed = new EmbedBuilder()
        .setColor(config.colors.primary)
        .setTitle('⚙️ Server Configuration')
        .addFields(
            { 
                name: 'Log Channel', 
                value: guildConfig.log_channel_id ? `<#${guildConfig.log_channel_id}>` : 'Not set', 
                inline: true 
            },
            { 
                name: 'Verification Channel', 
                value: guildConfig.verification_channel_id ? `<#${guildConfig.verification_channel_id}>` : 'Not set', 
                inline: true 
            },
            { 
                name: 'Applications Channel', 
                value: guildConfig.applications_channel_id ? `<#${guildConfig.applications_channel_id}>` : 'Not set', 
                inline: true 
            },
            { 
                name: 'Auto-Sync', 
                value: guildConfig.auto_sync_enabled ? '✅ Enabled' : '❌ Disabled', 
                inline: true 
            },
            { 
                name: 'XP System', 
                value: guildConfig.xp_enabled ? '✅ Enabled' : '❌ Disabled', 
                inline: true 
            },
            { 
                name: 'Welcome Message', 
                value: guildConfig.welcome_message || 'Not set', 
                inline: false 
            }
        );

    await interaction.reply({ embeds: [embed], flags: 64 /* MessageFlags.Ephemeral */ });
}

async function handleSetChannel(interaction, field, name) {
    const channel = interaction.options.getChannel('channel');
    const guildConfig = GuildConfigRepository.getOrCreate(interaction.guildId);
    const oldValue = guildConfig[field];

    GuildConfigRepository.update(interaction.guildId, { [field]: channel.id });
    
    AuditLogRepository.logConfigChange(
        interaction.guildId, 
        interaction.user.id, 
        field,
        oldValue || 'None',
        channel.id
    );

    await interaction.reply({
        content: `✅ ${name} set to ${channel}.`,
        flags: 64 /* MessageFlags.Ephemeral */,
    });
}

async function handleToggle(interaction, field, name) {
    const enabled = interaction.options.getBoolean('enabled');
    const guildConfig = GuildConfigRepository.getOrCreate(interaction.guildId);
    const oldValue = guildConfig[field];

    GuildConfigRepository.update(interaction.guildId, { [field]: enabled ? 1 : 0 });
    
    AuditLogRepository.logConfigChange(
        interaction.guildId, 
        interaction.user.id, 
        field,
        oldValue ? 'Enabled' : 'Disabled',
        enabled ? 'Enabled' : 'Disabled'
    );

    await interaction.reply({
        content: `✅ ${name} is now ${enabled ? 'enabled' : 'disabled'}.`,
        flags: 64 /* MessageFlags.Ephemeral */,
    });
}

async function handleWelcome(interaction) {
    const message = interaction.options.getString('message');
    const guildConfig = GuildConfigRepository.getOrCreate(interaction.guildId);
    const oldValue = guildConfig.welcome_message;

    GuildConfigRepository.update(interaction.guildId, { welcome_message: message });
    
    AuditLogRepository.logConfigChange(
        interaction.guildId, 
        interaction.user.id, 
        'welcome_message',
        oldValue || 'None',
        message
    );

    await interaction.reply({
        content: `✅ Welcome message updated.\n\n**Preview:**\n${message.replace('{user}', interaction.user.toString()).replace('{server}', interaction.guild.name).replace('{username}', interaction.user.username)}`,
        flags: 64 /* MessageFlags.Ephemeral */,
    });
}
