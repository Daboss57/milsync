/**
 * XP Service - Handles experience points and leveling
 */

const XPRepository = require('../database/repositories/xp');
const GuildConfigRepository = require('../database/repositories/guildConfig');
const logger = require('../utils/logger');
const config = require('../config');

class XPService {
    // Cooldown tracking (in-memory)
    static messageCooldowns = new Map();

    /**
     * Award XP for a message
     */
    static async awardMessageXP(guildId, discordId) {
        // Check if XP is enabled
        const guildConfig = GuildConfigRepository.getOrCreate(guildId);
        if (!guildConfig.xp_enabled) {
            return null;
        }

        // Check cooldown (1 message per minute counts)
        const cooldownKey = `${guildId}:${discordId}`;
        const now = Date.now();
        const lastMessage = this.messageCooldowns.get(cooldownKey) || 0;
        
        if (now - lastMessage < 60000) { // 1 minute cooldown
            return null;
        }

        this.messageCooldowns.set(cooldownKey, now);

        // Award XP
        const result = XPRepository.addXP(guildId, discordId, config.xp.messageXp, 'message');
        XPRepository.incrementMessages(guildId, discordId);

        return result;
    }

    /**
     * Award XP for voice activity
     */
    static awardVoiceXP(guildId, discordId, minutes) {
        const guildConfig = GuildConfigRepository.getOrCreate(guildId);
        if (!guildConfig.xp_enabled) {
            return null;
        }

        const xpAmount = minutes * config.xp.voiceXpPerMinute;
        XPRepository.addVoiceMinutes(guildId, discordId, minutes);
        return XPRepository.addXP(guildId, discordId, xpAmount, 'voice');
    }

    /**
     * Award XP for event attendance
     */
    static awardEventXP(guildId, discordId, eventName = 'event') {
        const guildConfig = GuildConfigRepository.getOrCreate(guildId);
        if (!guildConfig.xp_enabled) {
            return null;
        }

        return XPRepository.addXP(guildId, discordId, config.xp.eventAttendanceXp, eventName);
    }

    /**
     * Award custom XP amount
     */
    static awardCustomXP(guildId, discordId, amount, reason = 'custom') {
        return XPRepository.addXP(guildId, discordId, amount, reason);
    }

    /**
     * Set user's XP directly
     */
    static setXP(guildId, discordId, amount) {
        XPRepository.setXP(guildId, discordId, amount);
        const newLevel = XPRepository.calculateLevel(amount);
        XPRepository.setLevel(guildId, discordId, newLevel);
        return { xp: amount, level: newLevel };
    }

    /**
     * Remove XP from a user
     */
    static removeXP(guildId, discordId, amount) {
        const record = XPRepository.get(guildId, discordId);
        if (!record) return null;

        const newXP = Math.max(0, record.xp - amount);
        return this.setXP(guildId, discordId, newXP);
    }

    /**
     * Get user's XP info
     */
    static getUserXP(guildId, discordId) {
        const record = XPRepository.getOrCreate(guildId, discordId);
        const rank = XPRepository.getRank(guildId, discordId);
        const currentLevel = record.level;
        const currentLevelXP = XPRepository.xpForLevel(currentLevel);
        const nextLevelXP = XPRepository.xpForLevel(currentLevel + 1);
        const progress = record.xp - currentLevelXP;
        const needed = nextLevelXP - currentLevelXP;

        return {
            xp: record.xp,
            level: currentLevel,
            rank,
            progress,
            needed,
            progressPercent: Math.floor((progress / needed) * 100),
            totalMessages: record.total_messages,
            voiceMinutes: record.voice_minutes,
        };
    }

    /**
     * Get leaderboard
     */
    static getLeaderboard(guildId, limit = 10) {
        const entries = XPRepository.getLeaderboard(guildId, limit);
        return entries.map((entry, index) => ({
            rank: index + 1,
            discordId: entry.discord_id,
            xp: entry.xp,
            level: entry.level,
            messages: entry.total_messages,
            voiceMinutes: entry.voice_minutes,
        }));
    }

    /**
     * Check and get promotions based on XP thresholds
     */
    static async checkXPPromotions(guildId, discordId) {
        const { getDatabase } = require('../database/init');
        const db = getDatabase();

        const record = XPRepository.get(guildId, discordId);
        if (!record) return [];

        // Get thresholds that user has reached
        const stmt = db.prepare(`
            SELECT * FROM xp_thresholds 
            WHERE guild_id = ? AND xp_required <= ?
            ORDER BY xp_required DESC
        `);
        const thresholds = stmt.all(guildId, record.xp);

        return thresholds;
    }

    /**
     * Clean up old cooldowns (call periodically)
     */
    static cleanupCooldowns() {
        const now = Date.now();
        const expireTime = 5 * 60 * 1000; // 5 minutes

        for (const [key, timestamp] of this.messageCooldowns) {
            if (now - timestamp > expireTime) {
                this.messageCooldowns.delete(key);
            }
        }
    }

    /**
     * Reset all XP for a guild
     */
    static resetGuild(guildId) {
        return XPRepository.resetGuild(guildId);
    }
}

module.exports = XPService;
