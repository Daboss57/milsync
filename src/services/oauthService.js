/**
 * OAuth2 Service - Handles Roblox OAuth2 verification flow
 * Users click a link → authorize on Roblox → get auto-verified
 */

const crypto = require('crypto');
const OAuthStateRepository = require('../database/repositories/oauthState');
const LinkedAccountsRepository = require('../database/repositories/linkedAccounts');
const BlacklistRepository = require('../database/repositories/blacklist');
const AuditLogRepository = require('../database/repositories/auditLog');
const VerificationService = require('./verificationService');
const logger = require('../utils/logger');
const config = require('../config');

class OAuthService {
    /**
     * Generate the Roblox OAuth2 authorization URL
     * @param {string} discordId - Discord user ID
     * @param {string} guildId - Guild ID for context
     * @param {boolean} isReverify - Whether this is a reverify (unlinks old account first)
     * @returns {{ url: string, state: string }}
     */
    static generateAuthUrl(discordId, guildId, isReverify = false) {
        // Generate a cryptographically random state parameter
        const state = crypto.randomBytes(32).toString('hex');

        // Store the state so we can match it on callback
        OAuthStateRepository.create(state, discordId, guildId, isReverify);

        // Build the authorization URL
        const params = new URLSearchParams({
            client_id: config.robloxOAuth.clientId,
            redirect_uri: config.robloxOAuth.redirectUri,
            scope: 'openid profile',
            response_type: 'code',
            state: state,
            prompt: 'consent select_account',
        });

        const url = `${config.robloxOAuth.authorizeUrl}?${params.toString()}`;

        logger.info(`Generated OAuth URL for Discord ${discordId} (reverify: ${isReverify})`);

        return { url, state };
    }

    /**
     * Handle the OAuth2 callback after user authorizes on Roblox
     * @param {string} code - Authorization code from Roblox
     * @param {string} state - State parameter for CSRF validation
     * @returns {Promise<{ success: boolean, ... }>}
     */
    static async handleCallback(code, state) {
        // 1. Validate state
        const pending = OAuthStateRepository.getByState(state);
        if (!pending) {
            return {
                success: false,
                error: 'invalid_state',
                message: 'Invalid or expired verification session. Please try again from Discord.',
            };
        }

        const { discord_id: discordId, guild_id: guildId, is_reverify: isReverify } = pending;

        try {
            // 2. Check blacklist
            if (BlacklistRepository.isBlacklistedDiscord(guildId, discordId)) {
                OAuthStateRepository.delete(state);
                return {
                    success: false,
                    error: 'blacklisted',
                    message: 'You are blacklisted from verification.',
                    discordId,
                };
            }

            // 3. Exchange authorization code for tokens
            const tokenResponse = await fetch(config.robloxOAuth.tokenUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: new URLSearchParams({
                    grant_type: 'authorization_code',
                    code: code,
                    client_id: config.robloxOAuth.clientId,
                    client_secret: config.robloxOAuth.clientSecret,
                    redirect_uri: config.robloxOAuth.redirectUri,
                }),
            });

            if (!tokenResponse.ok) {
                const errorText = await tokenResponse.text();
                logger.error(`OAuth token exchange failed: ${tokenResponse.status} ${errorText}`);
                OAuthStateRepository.delete(state);
                return {
                    success: false,
                    error: 'token_exchange_failed',
                    message: 'Failed to authenticate with Roblox. Please try again.',
                    discordId,
                };
            }

            const tokenData = await tokenResponse.json();

            // 4. Fetch user info using the access token
            const userinfoResponse = await fetch(config.robloxOAuth.userinfoUrl, {
                headers: {
                    'Authorization': `Bearer ${tokenData.access_token}`,
                },
            });

            if (!userinfoResponse.ok) {
                logger.error(`OAuth userinfo fetch failed: ${userinfoResponse.status}`);
                OAuthStateRepository.delete(state);
                return {
                    success: false,
                    error: 'userinfo_failed',
                    message: 'Failed to fetch your Roblox account info. Please try again.',
                    discordId,
                };
            }

            const userinfo = await userinfoResponse.json();

            // sub = Roblox user ID, preferred_username = Roblox username
            const robloxId = userinfo.sub;
            const robloxUsername = userinfo.preferred_username || userinfo.name || `User${robloxId}`;

            logger.info(`OAuth userinfo received: Roblox ${robloxUsername} (${robloxId}) for Discord ${discordId}`);

            // 5. Check if Roblox account is blacklisted
            if (BlacklistRepository.isBlacklistedRoblox(guildId, robloxId)) {
                OAuthStateRepository.delete(state);
                return {
                    success: false,
                    error: 'blacklisted',
                    message: 'This Roblox account is blacklisted.',
                    discordId,
                };
            }

            // 6. Check if Roblox account is already linked to another Discord user
            const existingRoblox = LinkedAccountsRepository.getByRobloxId(robloxId);
            if (existingRoblox && existingRoblox.discord_id !== discordId) {
                OAuthStateRepository.delete(state);
                return {
                    success: false,
                    error: 'roblox_already_linked',
                    message: 'This Roblox account is already linked to another Discord account.',
                    discordId,
                };
            }

            // 7. If reverify, unlink old account first
            if (isReverify) {
                const existing = LinkedAccountsRepository.getByDiscordId(discordId);
                if (existing) {
                    VerificationService.unlinkAccount(discordId, guildId);
                    logger.info(`Reverify: unlinked old account ${existing.roblox_username} for Discord ${discordId}`);
                }
            } else {
                // Check if already verified (not reverify)
                const existing = LinkedAccountsRepository.getByDiscordId(discordId);
                if (existing) {
                    OAuthStateRepository.delete(state);
                    return {
                        success: false,
                        error: 'already_verified',
                        message: `You are already verified as ${existing.roblox_username}. Use /reverify to switch accounts.`,
                        discordId,
                    };
                }
            }

            // 8. Link the accounts (same method as code-in-bio!)
            LinkedAccountsRepository.link(discordId, robloxId, robloxUsername);

            // 9. Log the verification
            AuditLogRepository.logVerification(guildId, discordId, robloxId);

            // 10. Clean up the state
            OAuthStateRepository.delete(state);

            logger.info(`OAuth verification complete: Discord ${discordId} -> Roblox ${robloxUsername} (${robloxId})`);

            return {
                success: true,
                discordId,
                guildId,
                robloxUser: {
                    id: robloxId,
                    name: robloxUsername,
                    displayName: userinfo.nickname || robloxUsername,
                },
            };
        } catch (error) {
            logger.error(`OAuth callback error for Discord ${discordId}: ${error.message}`);
            OAuthStateRepository.delete(state);
            return {
                success: false,
                error: 'internal_error',
                message: 'An unexpected error occurred during verification.',
                discordId,
            };
        }
    }
}

module.exports = OAuthService;
