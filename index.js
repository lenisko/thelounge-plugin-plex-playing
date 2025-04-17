"use strict";

const axios = require('axios');
const fs = require("fs");
const path = require('path');

let config = {
    url: "",
    token: "",
    username: "",
};

let configFile = null;
let thelounge = null;

const red = "\x034";
const bold = "\x02";

function saveConfig() {
    fs.writeFile(configFile, JSON.stringify(config), "utf-8", (err) => {
        if (err) thelounge.Logger.error(err);
        thelounge.Logger.info("[Plex Playing] Successfully wrote config to file " + configFile);
    });
}

function loadConfig() {
    fs.readFile(configFile, "utf-8", function (err, data) {
        if (err) thelounge.Logger.error(err);
        try {
            config = JSON.parse(data);
            thelounge.Logger.info("[Plex Playing] Loaded config from " + configFile);
        } catch (error) {
            thelounge.Logger.error("[Plex Playing] Error while loading config: " + error);
            saveConfig();
        }
    });
}

async function getStatus(url, token, username, includeSnapshot) {
    try {
        const cleanedUrl = url.replace(/\/+$/, "");
        const fullUrl = `${cleanedUrl}/state/${username}?fetch_snapshot=${includeSnapshot}`;
        const response = await axios.get(fullUrl, {
            headers: { "x-api-key": token }
        });
        return { status: response.data || null };
    } catch (error) {
        thelounge.Logger.error("Error while fetching Plex status:", error.message);
        return { status: null, error: error.message };
    }
}

const plexConfigCommand = {
    input: function (client, target, command, args) {
        if (args.length !== 3) {
            client.sendMessage(red + "Usage: /plex-config <url> <token> <username>", target.chan);
            return;
        } else {
            config.url = args[0].trim();
            config.token = args[1].trim();
            config.username = args[2].trim();

            saveConfig();
            client.sendMessage("Plex configuration saved!", target.chan);
        }
    },
    allowDisconnected: true
};

const plexCommand = {
    input: async function (client, target, command, args) {
        if (!config.url) {
            client.sendMessage(red + "Usage: /plex-config <url> <token> <username>", target.chan);
            return;
        }

        const { status, error } = await getStatus(config.url, config.token, config.username, args.length > 0);

        if (error) {
            client.sendMessage(red + `Error while fetching Plex status: ${error}`, target.chan);
            return;
        }

        if (!status) {
            client.sendMessage(red + "Nothing is currently playing.", target.chan);
            return;
        }

        const prefix = status.image_url || "playing";
        const msg = `/me ${prefix} ${bold}${status.title}${bold} [ ${status.human_offset} / ${status.human_duration} ]`;
        client.runAsUser(msg, target.chan.id);
    },

    allowDisconnected: true
};

module.exports = {
    onServerStart: api => {
        thelounge = api;
        configFile = path.join(thelounge.Config.getPersistentStorageDir(), "plex-playing.json");

        loadConfig();

        thelounge.Commands.add("plex-config", plexConfigCommand);
        thelounge.Commands.add("plex", plexCommand);
    },
};
