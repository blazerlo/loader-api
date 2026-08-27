-- script.lua (загрузчик с проверкой HWID и ключа)
local function getHWID()
    -- Попытка получить HWID через различные методы для разных эксплойтов
    if syn and syn.get_hwid then
        return syn.get_hwid()
    elseif gethwid then
        return gethwid()
    elseif identifyexecutor and identifyexecutor() then
        -- Для некоторых эксплойтов, возвращаем ClientId как fallback
        return game:GetService("RbxAnalyticsService"):GetClientId()
    else
        -- Универсальный fallback
        return game:GetService("RbxAnalyticsService"):GetClientId()
    end
end

local hwid = getHWID()
local key = getgenv().Script_Key or ""

if key == "" then
    error("Script_Key is not set!")
end

-- Формируем URL с ключом и HWID
local url = "https://loader-dusky-alpha.vercel.app/api/validate?key=" .. key .. "&hwid=" .. hwid

local success, result = pcall(function()
    return game:HttpGet(url)
end)

if not success then
    error("Failed to load script: " .. tostring(result))
end

-- Проверяем ответ сервера
if result:match("HWID unauthorized") then
    error("HWID unauthorized")
elseif result:match("Invalid or unlinked key") then
    error("Invalid or unlinked key")
elseif result:match("Script code not found") then
    error("Script code not found")
else
    -- Выполняем полученный код (основной скрипт)
    loadstring(result)()
end
