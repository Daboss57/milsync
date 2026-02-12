/**
 * Verification Service - Handles Roblox account verification flow
 */

const { v4: uuidv4 } = require('uuid');
const { getDatabase } = require('../database/init');
const LinkedAccountsRepository = require('../database/repositories/linkedAccounts');
const AuditLogRepository = require('../database/repositories/auditLog');
const BlacklistRepository = require('../database/repositories/blacklist');
const robloxService = require('./robloxService');
const logger = require('../utils/logger');
const config = require('../config');

class VerificationService {
    /**
     * Generate a verification code for a user
     */
    static generateCode() {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        let code = '';
        for (let i = 0; i < config.verification.codeLength; i++) {
            code += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return code;
    }

    /**
     * Start verification process for a user
     */
    static async startVerification(discordId, robloxUsername, guildId) {
        // Check if already verified
        const existing = LinkedAccountsRepository.getByDiscordId(discordId);
        if (existing) {
            return {
                success: false,
                error: 'already_verified',
                message: `You are already verified as ${existing.roblox_username}. Use /unlink first to change accounts.`,
            };
        }

        // Check blacklist
        if (BlacklistRepository.isBlacklistedDiscord(guildId, discordId)) {
            return {
                success: false,
                error: 'blacklisted',
                message: 'You are blacklisted from verification.',
            };
        }

        // Get Roblox user info
        const robloxUser = await robloxService.getUserByUsername(robloxUsername);
        if (!robloxUser) {
            return {
                success: false,
                error: 'user_not_found',
                message: `Could not find Roblox user "${robloxUsername}". Please check the spelling.`,
            };
        }

        // Check if Roblox account is blacklisted
        if (BlacklistRepository.isBlacklistedRoblox(guildId, robloxUser.id.toString())) {
            return {
                success: false,
                error: 'blacklisted',
                message: 'This Roblox account is blacklisted.',
            };
        }

        // Check if Roblox account is already linked to another Discord account
        const existingRoblox = LinkedAccountsRepository.getByRobloxId(robloxUser.id.toString());
        if (existingRoblox && existingRoblox.discord_id !== discordId) {
            return {
                success: false,
                error: 'roblox_already_linked',
                message: 'This Roblox account is already linked to another Discord account.',
            };
        }

        // Generate verification code
        const code = this.generateCode();
        const expiresAt = new Date(Date.now() + config.verification.timeoutMinutes * 60 * 1000);

        // Store pending verification
        const db = getDatabase();
        const stmt = db.prepare(`
            INSERT INTO pending_verifications (discord_id, verification_code, roblox_username, expires_at)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(discord_id) DO UPDATE SET
                verification_code = excluded.verification_code,
                roblox_username = excluded.roblox_username,
                expires_at = excluded.expires_at,
                created_at = CURRENT_TIMESTAMP
        `);
        stmt.run(discordId, code, robloxUser.name, expiresAt.toISOString());

        logger.info(`Started verification for Discord ${discordId} -> Roblox ${robloxUser.name}`);

        return {
            success: true,
            code,
            robloxUser: {
                id: robloxUser.id,
                name: robloxUser.name,
                displayName: robloxUser.displayName,
            },
            expiresAt,
            expiresIn: config.verification.timeoutMinutes,
        };
    }

    /**
     * Complete verification by checking if code is in bio
     */
    static async completeVerification(discordId, guildId) {
        // Get pending verification
        const db = getDatabase();
        const stmt = db.prepare(`
            SELECT * FROM pending_verifications 
            WHERE discord_id = ? AND expires_at > CURRENT_TIMESTAMP
        `);
        const pending = stmt.get(discordId);

        if (!pending) {
            return {
                success: false,
                error: 'no_pending',
                message: 'No pending verification found or it has expired. Please start over with /verify.',
            };
        }

        // Get Roblox user ID
        const robloxUser = await robloxService.getUserByUsername(pending.roblox_username);
        if (!robloxUser) {
            return {
                success: false,
                error: 'user_not_found',
                message: 'Could not find the Roblox account. Please try again.',
            };
        }

        // Verify code in bio
        const verifyResult = await robloxService.verifyUserBio(robloxUser.id, pending.verification_code);
        
        if (!verifyResult.success) {
            return {
                success: false,
                error: 'code_not_found',
                message: `Could not find the verification code in your Roblox bio. Make sure to add "${pending.verification_code}" to your bio and try again.`,
                code: pending.verification_code,
            };
        }

        // Link accounts
        LinkedAccountsRepository.link(discordId, robloxUser.id.toString(), verifyResult.username);

        // Log verification
        AuditLogRepository.logVerification(guildId, discordId, robloxUser.id.toString());

        // Clean up pending verification
        const deleteStmt = db.prepare('DELETE FROM pending_verifications WHERE discord_id = ?');
        deleteStmt.run(discordId);

        logger.info(`Completed verification: Discord ${discordId} -> Roblox ${robloxUser.id}`);

        return {
            success: true,
            robloxUser: {
                id: robloxUser.id,
                name: verifyResult.username,
                displayName: verifyResult.displayName,
            },
        };
    }

    /**
     * Get pending verification for a user
     */
    static getPending(discordId) {
        const db = getDatabase();
        const stmt = db.prepare(`
            SELECT * FROM pending_verifications 
            WHERE discord_id = ? AND expires_at > CURRENT_TIMESTAMP
        `);
        return stmt.get(discordId);
    }

    /**
     * Cancel pending verification
     */
    static cancelVerification(discordId) {
        const db = getDatabase();
        const stmt = db.prepare('DELETE FROM pending_verifications WHERE discord_id = ?');
        return stmt.run(discordId).changes > 0;
    }

    /**
     * Unlink a user's account
     */
    static unlinkAccount(discordId, guildId) {
        const existing = LinkedAccountsRepository.getByDiscordId(discordId);
        if (!existing) {
            return {
                success: false,
                error: 'not_verified',
                message: 'You are not currently verified.',
            };
        }

        LinkedAccountsRepository.unlink(discordId);
        AuditLogRepository.logUnlink(guildId, discordId, existing.roblox_id);

        logger.info(`Unlinked account: Discord ${discordId}`);

        return {
            success: true,
            robloxUsername: existing.roblox_username,
        };
    }

    /**
     * Get verification status for a user
     */
    static getVerificationStatus(discordId) {
        const linked = LinkedAccountsRepository.getByDiscordId(discordId);
        const pending = this.getPending(discordId);

        if (linked) {
            return {
                status: 'verified',
                robloxId: linked.roblox_id,
                robloxUsername: linked.roblox_username,
                verifiedAt: linked.verified_at,
            };
        }

        if (pending) {
            return {
                status: 'pending',
                robloxUsername: pending.roblox_username,
                code: pending.verification_code,
                expiresAt: pending.expires_at,
            };
        }

        return { status: 'unverified' };
    }

    /**
     * Clean up expired pending verifications
     */
    static cleanupExpired() {
        const db = getDatabase();
        const stmt = db.prepare('DELETE FROM pending_verifications WHERE expires_at <= CURRENT_TIMESTAMP');
        const result = stmt.run();
        if (result.changes > 0) {
            logger.info(`Cleaned up ${result.changes} expired pending verifications`);
        }
        return result.changes;
    }
}

module.exports = VerificationService;
