/**
 * Setup script - Interactive setup helper
 */

const readline = require('readline');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
});

function question(prompt) {
    return new Promise((resolve) => {
        rl.question(prompt, resolve);
    });
}

async function main() {
    console.log('\n🚀 RPCommand Center Setup Wizard\n');
    console.log('This wizard will help you configure your bot.\n');

    const config = {};

    // Discord Bot Token
    console.log('📌 Step 1: Discord Bot Configuration');
    console.log('Create a bot at https://discord.com/developers/applications\n');
    
    config.DISCORD_TOKEN = await question('Enter your Discord Bot Token: ');
    config.DISCORD_CLIENT_ID = await question('Enter your Discord Client ID: ');

    // Roblox Configuration
    console.log('\n📌 Step 2: Roblox Configuration');
    console.log('Get your API key from https://create.roblox.com/credentials\n');
    
    config.ROBLOX_API_KEY = await question('Enter your Roblox Open Cloud API Key: ');
    config.ROBLOX_GROUP_ID = await question('Enter your Roblox Group ID: ');

    // Database
    console.log('\n📌 Step 3: Database Configuration');
    const dbPath = await question('Database path (press Enter for default ./data/rpcommand.db): ');
    config.DATABASE_PATH = dbPath || './data/rpcommand.db';

    // API Server
    console.log('\n📌 Step 4: API Server Configuration');
    const apiPort = await question('API server port (press Enter for default 3000): ');
    config.API_PORT = apiPort || '3000';
    config.API_SECRET_KEY = crypto.randomBytes(32).toString('hex');
    console.log(`Generated API secret key: ${config.API_SECRET_KEY}`);

    // Features
    console.log('\n📌 Step 5: Feature Configuration');
    const enableXP = await question('Enable XP system? (y/n): ');
    const enableApps = await question('Enable applications system? (y/n): ');
    const enableAPI = await question('Enable in-game API? (y/n): ');
    const enableSync = await question('Enable auto role sync? (y/n): ');

    config.ENABLE_XP_SYSTEM = enableXP.toLowerCase() === 'y' ? 'true' : 'false';
    config.ENABLE_APPLICATIONS = enableApps.toLowerCase() === 'y' ? 'true' : 'false';
    config.ENABLE_INGAME_API = enableAPI.toLowerCase() === 'y' ? 'true' : 'false';
    config.ENABLE_AUTO_SYNC = enableSync.toLowerCase() === 'y' ? 'true' : 'false';

    // Defaults
    config.LOG_LEVEL = 'info';
    config.COMMAND_COOLDOWN_SECONDS = '5';
    config.SYNC_COOLDOWN_SECONDS = '300';
    config.VERIFICATION_TIMEOUT_MINUTES = '10';

    // Generate .env file
    const envContent = Object.entries(config)
        .map(([key, value]) => `${key}=${value}`)
        .join('\n');

    const envPath = path.join(__dirname, '..', '.env');
    fs.writeFileSync(envPath, envContent);

    console.log('\n✅ Configuration saved to .env file!\n');
    console.log('Next steps:');
    console.log('1. Run: npm install');
    console.log('2. Run: npm start');
    console.log('\nMake sure to invite your bot to your Discord server with the following permissions:');
    console.log('- Manage Roles');
    console.log('- Send Messages');
    console.log('- Use Slash Commands');
    console.log('- Read Message History');
    console.log('- Add Reactions');
    console.log('\nBot invite URL:');
    console.log(`https://discord.com/api/oauth2/authorize?client_id=${config.DISCORD_CLIENT_ID}&permissions=268437504&scope=bot%20applications.commands`);

    rl.close();
}

main().catch(console.error);
