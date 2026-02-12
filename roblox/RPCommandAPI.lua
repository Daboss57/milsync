-- Roblox Lua Script for In-Game Integration
-- RPCommand Center HTTP Module
-- Place this in a ModuleScript in ServerScriptService

local HttpService = game:GetService("HttpService")

local RPCommandAPI = {}

-- Configuration
RPCommandAPI.Config = {
    BaseURL = "http://your-server-ip:3000/api", -- Replace with your API server URL
    APIKey = "your-api-key-here", -- Replace with your API key
    Timeout = 10,
}

-- Helper function to make HTTP requests
local function makeRequest(endpoint, method, body)
    local url = RPCommandAPI.Config.BaseURL .. endpoint
    local headers = {
        ["Content-Type"] = "application/json",
        ["x-api-key"] = RPCommandAPI.Config.APIKey,
    }
    
    local success, response = pcall(function()
        if method == "GET" then
            return HttpService:GetAsync(url, false, headers)
        else
            local jsonBody = body and HttpService:JSONEncode(body) or nil
            return HttpService:PostAsync(url, jsonBody or "", Enum.HttpContentType.ApplicationJson, false, headers)
        end
    end)
    
    if success then
        local decoded = HttpService:JSONDecode(response)
        return true, decoded
    else
        warn("[RPCommandAPI] Request failed:", response)
        return false, { error = response }
    end
end

-- Check if a player is verified
function RPCommandAPI:IsVerified(player)
    local userId = player.UserId
    local success, data = makeRequest("/verify/" .. userId, "GET")
    
    if success then
        return data.verified, data.discordId
    end
    
    return false, nil
end

-- Get player's rank in the group
function RPCommandAPI:GetRank(player, groupId)
    local userId = player.UserId
    local endpoint = "/user/" .. userId .. "/rank"
    if groupId then
        endpoint = endpoint .. "?groupId=" .. groupId
    end
    
    local success, data = makeRequest(endpoint, "GET")
    
    if success and not data.error then
        return {
            inGroup = data.inGroup,
            rank = data.rank,
            rankName = data.rankName,
        }
    end
    
    return nil
end

-- Promote a player
function RPCommandAPI:Promote(player, groupId)
    local userId = player.UserId
    local body = {
        robloxId = tostring(userId),
        groupId = groupId,
    }
    
    local success, data = makeRequest("/promote", "POST", body)
    
    if success and data.success then
        return true, {
            oldRank = data.oldRank,
            newRank = data.newRank,
        }
    end
    
    return false, data.error
end

-- Demote a player
function RPCommandAPI:Demote(player, groupId)
    local userId = player.UserId
    local body = {
        robloxId = tostring(userId),
        groupId = groupId,
    }
    
    local success, data = makeRequest("/demote", "POST", body)
    
    if success and data.success then
        return true, {
            oldRank = data.oldRank,
            newRank = data.newRank,
        }
    end
    
    return false, data.error
end

-- Set player to specific rank
function RPCommandAPI:SetRank(player, rank, groupId)
    local userId = player.UserId
    local body = {
        robloxId = tostring(userId),
        rank = rank,
        groupId = groupId,
    }
    
    local success, data = makeRequest("/setrank", "POST", body)
    
    if success and data.success then
        return true, {
            oldRank = data.oldRank,
            newRank = data.newRank,
        }
    end
    
    return false, data.error
end

-- Get user info
function RPCommandAPI:GetUserInfo(player)
    local userId = player.UserId
    local success, data = makeRequest("/user/" .. userId, "GET")
    
    if success and not data.error then
        return {
            verified = data.verified,
            discordId = data.discordId,
            robloxUsername = data.robloxUsername,
        }
    end
    
    return nil
end

return RPCommandAPI

--[[
USAGE EXAMPLE:

local RPCommandAPI = require(game.ServerScriptService.RPCommandAPI)

-- Configure the API
RPCommandAPI.Config.BaseURL = "http://your-server:3000/api"
RPCommandAPI.Config.APIKey = "your-api-key"

-- Check if player is verified when they join
game.Players.PlayerAdded:Connect(function(player)
    local verified, discordId = RPCommandAPI:IsVerified(player)
    if verified then
        print(player.Name .. " is verified with Discord ID: " .. discordId)
    else
        print(player.Name .. " is not verified")
    end
end)

-- Promote command example
local function promotePlayer(adminPlayer, targetPlayer)
    if adminPlayer:GetRankInGroup(YOUR_GROUP_ID) >= 200 then -- Admin rank check
        local success, result = RPCommandAPI:Promote(targetPlayer)
        if success then
            print("Promoted " .. targetPlayer.Name .. " from " .. result.oldRank .. " to " .. result.newRank)
        else
            warn("Failed to promote: " .. tostring(result))
        end
    end
end

]]
