require("dotenv").config();

const utils = require("./util.js");
const sql = require("./sql.js")
const flags = require("./flags.js")

const prefix = "!poke"
const sep = " "

const noThread = "\u200b"

const homeServer = process.env.HOME_SERVER;
const testingChannel = process.env.TESTING_CHANNEL;
const replyChannel = process.env.REPLY_CHANNEL;

let sprites = {}; // pokemon sprites

const lb = "\n\t\\- "
/**
 * @type {{[s: string]: {exec: (msg: Discord.Message<boolean>, args: string[]) => void, help?: (msg: Discord.Message<boolean>) => string}}}
 */
const commands = {
    "help": {
        exec: (msg, _) => {
            let message = "";
            message += "> *These commands can only be used by whitelisted users, Do not the bot.\n";
            message += "> __Underlined arguments are used by default__\n\n"
            Object.values(commands).forEach(value => {
                if(value.help) {
                    var val = value.help(msg);
                    if(val !== "") message += val + "\n\n";
                }
            })
            msg.channel.send(message);
        },
        help: (_) => `\`${prefix}help\`: display this message`
    },
    "next": {
        exec: (msg, _) => {
            sql.checks(msg, whitelist, (thread, channel, user) => {
                if(channel === undefined) { msg.channel.send("Channel has not been set, tell septi to fix it"); return; }
                if(!thread) { msg.channel.send("Cannot use command in threads."); return; }
                if(!channel) { msg.channel.send("Use of this command is limited to " +
                    msg.guild.channels.cache.get(serverInfo[msg.guildId]['channel']).toString()); return; }
                if(!user) { msg.channel.send("\\*racks shotgun* Do not the bot."); return; }
                sql.getNextCount(msg.guildId, utils.countMax, function(num, offset) {
                    getPokemon(num, offset, msg.channel)
                    sql.incrementOffset(msg.guildId, utils.countMax, function(offset, max) {
                        if(offset == max) msg.channel.send("Final pokemon reached! Use `!pokereset` to restart")
                    })
                })
            })
        },
        help: (_) => `\`${prefix}next\`\\*: sends the next polls`
    },
    "count": {
        exec: (msg, args) => {
            sql.checks(msg, whitelist, (_thread, _channel, user) => {
                if(args.length === 0) sql.getServerInfo(msg.guildId, (count, _offset, _channel) => { msg.channel.send(`Current poll count is \`${count}\``) });
                else {
                    if(!user) { msg.channel.send("\\*racks shotgun* Do not the bot."); return; }
                    let num = Number(args[0])
                    if(num !== num) { msg.channel.send(`Invalid count: \`${args[0]}\``); return; }
                    if(num < 1 || num > 10) { msg.channel.send(`\`[count]\` must be within the range 1-10`); return; }
                    sql.setServerInfoValue(msg.guildId, "pollCount", num, (success, _offense, _offender) => {
                        if(success) {
                            msg.channel.send(`Poll count set to \`${num}\``)
                        }
                    })
                }
            })
        },
        help: (_) => `\`!pokecount [count]\`: sets the number of polls to \`[count]\` or displays the current count${lb}` +
                     `\`[count]\`: The number to set the number of polls to, in a range from 1 to 10 (can only be used by whitelisted users)`
    },
    "smash": {
        exec: (msg, args) => {
            /**
             * @type {"total" | string}
             */
            let pokemon;
            if(args[0] === undefined || args[0] === "" || args[0].toLowerCase() === "total") {
                pokemon = "total";
            } else {
                pokemon = Number(args[0]) || utils.nameMap[args[0].toLowerCase()];
                if(pokemon === undefined) {
                    msg.channel.send(`Unrecognized pokemon: \`${args[0]}\``)
                    return;
                }
            }
            pokemon = pokemon.toString();

            /**
             * @type {"server" | "global" | "leaderboard"}
             */
            let focus;
            if(args[1] === undefined || args[1] === "" || args[1].toLowerCase() === "server") {
                focus = "server";
            } else if(args[1].toLowerCase() === "global") {
                focus = "global"
            } else if(args[1].toLowerCase() === "leaderboard"){
                focus = "leaderboard"
            } else {
                msg.channel.send(`Unrecognized argument \`${args[1]}\` for parameter \`[focus]\``)
                return;
            }

            /**
             * @type {"count" | "percent"}
             */
            let format;
            if(args[2] === undefined || args[2] === "" || args[2].toLowerCase() === "count") {
                format = "count";
            } else if(args[2].toLowerCase() === "percent") {
                format = "percent"
            } else {
                msg.channel.send(`Unrecognized argument \`${args[2]}\` for parameter \`[format]\``)
                return;
            }

            /**
             * @type {"votes" | "polls"}
             */
            let info;
            if(args[3] === undefined || args[3] === "" || args[3].toLowerCase() === "polls") {
                info = "polls"
            } else if(args[3].toLowerCase() === "votes") {
                info = "votes"
            } else {
                msg.channel.send(`Unrecognized argument \`${args[3]}\` for parameter \`[info]\``)
                return;
            }

            if(pokemon === "total") {
                switch(focus) {
                    case "global":
                        switch(format) {
                            case "percent":
                                switch(info) {
                                    case "polls":
                                        sql.getGlobalPollCounts("smash", "percent", (_type, _format, value) => {
                                            if(value == -1) {
                                                msg.channel.send("No server has completed a poll");
                                            } else {
                                                msg.channel.send(`Smash has won \`${(value * 100).toFixed(2)}\`% of the time`)
                                            }
                                        })
                                        return;
                                    case "votes":
                                        sql.getGlobalVoteCounts("smash", "percent", (_type, _format, value) => {
                                            if(value == -1) {
                                                msg.channel.send("No server has completed a poll");
                                            } else {
                                                msg.channel.send(`\`${(value * 100).toFixed(2)}\`% of the total votes are for smash`);
                                            }
                                        })
                                        return;
                                }
                            case "count":
                                switch(info) {
                                    case "polls":
                                        sql.getGlobalPollCounts("smash", "count", (_type, _format, value) => {
                                            if(value == -1) {
                                                msg.channel.send("No server has completed a poll");
                                            } else {
                                                msg.channel.send(`Smash has won \`${value}\` time(s)`)
                                            }
                                        })
                                        return;
                                    case "votes":
                                        sql.getGlobalVoteCounts("smash", "count", (_type, _format, value) => {
                                            if(value == -1) {
                                                msg.channel.send("No server has completed a poll");
                                            } else {
                                                msg.channel.send(`There are \`${value}\` total votes for smash`)
                                            }
                                        })
                                        return;
                                }
                        }
                    case "server":
                        switch(format) {
                            case "percent":
                                switch(info) {
                                    case "polls":
                                        sql.getServerPollCounts(msg.guildId, "smash", "percent", (_type, _format, value) => {
                                            if(value == -1) {
                                                msg.channel.send("No polls completed in this server");
                                            } else {
                                                msg.channel.send(`Smash has won \`${(value * 100).toFixed(2)}\`% of the time`)
                                            }
                                        })
                                        return;
            
                                    case "votes":
                                        sql.getServerVoteCounts(msg.guildId, "smash", "percent", (_type, _format, value) => {
                                            if(value == -1) {
                                                msg.channel.send("No polls completed in this server");
                                            } else {
                                                msg.channel.send(`\`${(value * 100).toFixed(2)}\`% of the votes are for smash`);
                                            }
                                        })
                                        return;
                                }
                            case "count":
                                switch(info) {
                                    case "polls":
                                        sql.getServerPollCounts(msg.guildId, "smash", "count", (_type, _format, value) => {
                                            if(value == -1) {
                                                msg.channel.send("No polls completed in this server");
                                            } else {
                                                msg.channel.send(`Smashed \`${value}\` pokemon`);
                                            }
                                        })
                                        return;
            
                                    case "votes":
                                        sql.getServerVoteCounts(msg.guildId, "smash", "count", (_type, _format, value) => {
                                            if(value == -1) {
                                                msg.channel.send("No polls completed in this server");
                                            } else {
                                                msg.channel.send(`There are \`${value}\` total votes for smash`)
                                            }
                                        })
                                        return;
                                }
                        }
                    case "leaderboard":
                        switch(format) {
                            case "percent":
                                switch(info) {
                                    case "polls":
                                        sql.getLeaderboardPollCounts("smash", "percent", (_type, _format, values) => {
                                            if(values.length == 0) {
                                                msg.channel.send("No server has completed a poll");
                                                return;
                                            }
                                            let message = "";
                                            for(let i = 0; i < values.length; i++) {
                                                message += `${i + 1}. \`${toTitleCase(utils.idMap[values[i].pokemon])}\`: \`${(values[i].smash * 100).toFixed(2)}\`% smashes and \`${(values[i].pass * 100).toFixed(2)}\`% passes\n`
                                            }
                                            msg.channel.send(message);
                                        })
                                        return;
            
                                    case "votes":
                                        sql.getLeaderboardVoteCounts("smash", "percent", (_type, _format, values) => {
                                            if(values.length == 0) {
                                                msg.channel.send("No server has completed a poll");
                                                return;
                                            }
                                            let message = "";
                                            for(let i = 0; i < values.length; i++) {
                                                message += `${i + 1}. \`${toTitleCase(utils.idMap[values[i].pokemon])}\`: \`${(values[i].smash * 100).toFixed(2)}\`% smash votes and \`${(values[i].pass * 100).toFixed(2)}\`% pass votes\n`
                                            }
                                            msg.channel.send(message);
                                        })
                                        return;
                                }
                            case "count":
                                switch(info) {
                                    case "polls":
                                        sql.getLeaderboardPollCounts("smash", "count", (_type, _format, values) => {
                                            if(values.length == 0) {
                                                msg.channel.send("No server has completed a poll");
                                                return;
                                            }
                                            let message = "";
                                            for(let i = 0; i < values.length; i++) {
                                                message += `${i + 1}. \`${toTitleCase(utils.idMap[values[i].pokemon])}\`: \`${values[i].smash}\` smashes and \`${values[i].pass}\` passes\n`
                                            }
                                            msg.channel.send(message);
                                        })
                                        return;
            
                                    case "votes":
                                        sql.getLeaderboardVoteCounts("smash", "count", (_type, _format, values) => {
                                            if(values.length == 0) {
                                                msg.channel.send("No server has completed a poll");
                                                return;
                                            }
                                            let message = "";
                                            for(let i = 0; i < values.length; i++) {
                                                message += `${i + 1}. \`${toTitleCase(utils.idMap[values[i].pokemon])}\`: \`${values[i].smash}\` smash votes and \`${values[i].pass}\` pass votes\n`
                                            }
                                            msg.channel.send(message);
                                        })
                                        return;
                                }
                        }
                }
            } else {
                switch(focus) {
                    case "global":
                        switch(format) {
                            case "percent":
                                switch(info) {
                                    case "polls":
                                        sql.getGlobalPokemonPollCounts("smash", "percent", pokemon, (_type, _format, _pokemon, value) => {
                                            if(value == -1) {
                                                msg.channel.send("No server has completed a poll");
                                                return;
                                            } else {
                                                msg.channel.send(`\`${(value * 100).toFixed(2)}\`% of servers have voted to smash \`${toTitleCase(utils.idMap[pokemon])}\``)
                                                return;
                                            }
                                        })
                                        return;
            
                                    case "votes":
                                        sql.getGlobalPokemonVoteCounts("smash", "percent", pokemon, (_type, _format, _pokemon, value) => {
                                            if(value == -1) {
                                                msg.channel.send("No server has completed a poll");
                                                return;
                                            } else {
                                                msg.channel.send(`\`${(value * 100).toFixed(2)}\`% of the total votes for \`${toTitleCase(utils.idMap[pokemon])}\` are for smash`);
                                                return;
                                            }
                                        })
                                        return;
                                }
                            case "count":
                                switch(info) {
                                    case "polls":
                                        sql.getGlobalPokemonPollCounts("smash", "count", pokemon, (_type, _format, _pokemon, value) => {
                                            if(value == -1) {
                                                msg.channel.send(`No server has completed a poll for \`${toTitleCase(utils.idMap[pokemon])}\``);
                                                return;
                                            } else {
                                                msg.channel.send(`\`${value}\` server(s) have voted to smash \`${toTitleCase(utils.idMap[pokemon])}\``)
                                                return;
                                            }
                                        })
                                        return;
            
                                    case "votes":
                                        sql.getGlobalPokemonVoteCounts("smash", "count", pokemon, (_type, _format, pokemon, value) => {
                                            if(value == -1) {
                                                msg.channel.send(`No server has completed a poll for \`${toTitleCase(utils.idMap[pokemon])}\``);
                                                return;
                                            } else {
                                                msg.channel.send(`\`${value}\` of the total votes for \`${toTitleCase(utils.idMap[pokemon])}\` are for smash`);
                                                return;
                                            }
                                        })
                                        return;
                                }
                        }
                    case "server":
                        switch(format) {
                            case "percent":
                                switch(info) {
                                    case "polls":
                                        sql.getServerPokemonPollCounts(msg.guildId, "smash", "percent", pokemon, (_type, _format, _pokemon, value) => {
                                            if(value == -1) {
                                                msg.channel.send(`This server has not completed a poll for \`${toTitleCase(utils.idMap[pokemon])}\``);
                                                return;
                                            } else {
                                                msg.channel.send(`This server has voted to smash \`${toTitleCase(utils.idMap[pokemon])}\` \`${(value * 100).toFixed(2)}\`% of the time`)
                                                return;
                                            }
                                        })
                                        return;
                                    case "votes":
                                        sql.getServerPokemonVoteCounts(msg.guildId, "smash", "percent", pokemon, (_type, _format, _pokemon, value) => {
                                            if(value == -1) {
                                                msg.channel.send(`This server has not completed a poll for \`${toTitleCase(utils.idMap[pokemon])}\``);
                                                return;
                                            } else {
                                                msg.channel.send(`This server has voted to smash \`${toTitleCase(utils.idMap[pokemon])}\` \`${(value * 100).toFixed(2)}\`% of the time`);
                                                return;
                                            }
                                        })
                                        return;
                                }
                            case "count":
                                switch(info) {
                                    case "polls":
                                        sql.getServerPokemonPollCounts(msg.guildId, "smash", "count", pokemon, (_type, _format, _pokemon, value) => {
                                            if(value == -1) {
                                                msg.channel.send(`This server has not completed a poll for \`${toTitleCase(utils.idMap[pokemon])}\``);
                                                return;
                                            } else {
                                                msg.channel.send(`This server has voted to smash \`${toTitleCase(utils.idMap[pokemon])}\` \`${value}\` times(s)`)
                                                return;
                                            }
                                        })
                                        return;
                                       
                                    case "votes":
                                        sql.getServerPokemonVoteCounts(msg.guildId, "smash", "count", pokemon, (_type, _format, _pokemon, value) => {
                                            if(value == -1) {
                                                msg.channel.send(`This server has not completed a poll for \`${toTitleCase(utils.idMap[pokemon])}\``);
                                                return;
                                            } else {
                                                msg.channel.send(`This server has voted to smash \`${toTitleCase(utils.idMap[pokemon])}\` \`${value}\` time(s)`);
                                                return;
                                            }
                                        })
                                        return;
                                }
                        }
                    case "leaderboard":
                        switch(format) {
                            case "percent":
                                switch(info) {
                                    case "polls":
                                        sql.getLeaderboardPokemonPollCounts("smash", "percent", pokemon, (_type, _format, value) => {
                                            if(value.place == -1) {
                                                msg.channel.send(`No polls completed for \`${toTitleCase(utils.idMap[value.pokemon])}\``)
                                            }
                                            msg.channel.send(`\`${toTitleCase(utils.idMap[value.pokemon])}\` is in placement \`${value.place}\` with \`${(value.smash * 100).toFixed(2)}\`% smashes and \`${(value.pass * 100).toFixed(2)}\`% passes`)
                                        })
                                        return;
            
                                    case "votes":
                                        sql.getLeaderboardPokemonVoteCounts("smash", "percent", pokemon, (_type, _format, value) => {
                                            if(value.place == -1) {
                                                msg.channel.send(`No polls completed for \`${toTitleCase(utils.idMap[value.pokemon])}\``)
                                            }
                                            msg.channel.send(`\`${toTitleCase(utils.idMap[value.pokemon])}\` is in placement \`${value.place}\` with \`${(value.smash * 100).toFixed(2)}\`% smash votes and \`${(value.pass * 100).toFixed(2)}\`% pass votes`)
                                        })
                                        return;
                                }
                            case "count":
                                switch(info) {
                                    case "polls":
                                        sql.getLeaderboardPokemonPollCounts("smash", "count", pokemon, (_type, _format, value) => {
                                            if(value.place == -1) {
                                                msg.channel.send(`No polls completed for \`${toTitleCase(utils.idMap[value.pokemon])}\``)
                                            }
                                            msg.channel.send(`\`${toTitleCase(utils.idMap[value.pokemon])}\` is in placement \`${value.place}\` with \`${value.smash}\` smashes and \`${value.pass}\` passes`)
                                        })
                                        return;
            
                                    case "votes":
                                        sql.getLeaderboardPokemonVoteCounts("smash", "count", pokemon, (_type, _format, value) => {
                                            if(value.place == -1) {
                                                msg.channel.send(`No polls completed for \`${toTitleCase(utils.idMap[value.pokemon])}\``)
                                            }
                                            msg.channel.send(`\`${toTitleCase(utils.idMap[value.pokemon])}\` is in placement \`${value.place}\` with \`${value.smash}\` smash votes and \`${value.pass}\` pass votes`)
                                        })
                                        return;
                                }
                        }
                }
            }
        },
        help: (_) => `\`${prefix}smash${sep}[pokemon]${sep}[focus]${sep}[format]${sep}[info]\`: display how many times "Smash" has won based on the arguments passed${lb}` + 
                     `\`[pokemon]\` = {pokemon id or name} (stats for that pokemon) | __"total"__ (aggregate stats of every pokemon)${lb}` +
                     `\`[focus]\` = __"server"__ (stats for the server) | "global" (stats for every server) | "leaderboard" (list pokemon placement or top 10 depending on \`[pokemon]\`)${lb}` +
                     `\`[format]\` = __"count"__ (exact count for stats) | "percent" (percentage stats)${lb}` +
                     `\`[info]\` = "votes" (number of votes from the polls) | __"polls"__ (number of polls)`
    },
    "pass": {
        exec: (msg, args) => {
            let pokemon;
            if(args[0] === undefined || args[0] === "" || args[0].toLowerCase() === "total") {
                pokemon = "total";
            } else {
                pokemon = Number(args[0]) || utils.nameMap[args[0].toLowerCase()];
                if(pokemon === undefined) {
                    msg.channel.send(`Unrecognized pokemon: ${args[0]}`)
                    return;
                }
            }

            let focus;
            if(args[1] === undefined || args[1] === "" || args[1].toLowerCase() === "server") {
                focus = "server";
            } else if(args[1].toLowerCase() === "global") {
                focus = "global"
            } else if(args[1].toLowerCase() === "leaderboard"){
                focus = "leaderboard"
            } else {
                msg.channel.send(`Unrecognized arguments \`${args[1]}\` for parameter \`[focus]\``)
                return;
            }

            let format;
            if(args[2] === undefined || args[2] === "" || args[2].toLowerCase() === "count") {
                format = "count";
            } else if(args[2].toLowerCase() === "percent") {
                format = "percent"
            } else {
                msg.channel.send(`Unrecognized arguments \`${args[2]}\` for parameter \`[format]\``)
                return;
            }

            /**
             * @type {"votes" | "polls"}
             */
            let info;
            if(args[3] === undefined || args[3] === "" || args[3].toLowerCase() === "polls") {
                info = "polls"
            } else if(args[3].toLowerCase() === "votes") {
                info = "votes"
            } else {
                msg.channel.send(`Unrecognized argument \`${args[3]}\` for parameter \`[info]\``)
                return;
            }

            if(pokemon === "total") {
                switch(focus) {
                    case "global":
                        switch(format) {
                            case "percent":
                                switch(info) {
                                    case "polls":
                                        sql.getGlobalPollCounts("pass", "percent", (_type, _format, value) => {
                                            if(value == -1) {
                                                msg.channel.send("No server has completed a poll");
                                            } else {
                                                msg.channel.send(`Pass has won \`${(value * 100).toFixed(2)}\`% of the time`)
                                            }
                                        })
                                        return;
                                    case "votes":
                                        sql.getGlobalVoteCounts("pass", "percent", (_type, _format, value) => {
                                            if(value == -1) {
                                                msg.channel.send("No server has completed a poll");
                                            } else {
                                                msg.channel.send(`\`${(value * 100).toFixed(2)}\`% of the total votes are for pass`);
                                            }
                                        })
                                        return;
                                }
                            case "count":
                                switch(info) {
                                    case "polls":
                                        sql.getGlobalPollCounts("pass", "count", (_type, _format, value) => {
                                            if(value == -1) {
                                                msg.channel.send("No server has completed a poll");
                                            } else {
                                                msg.channel.send(`Pass has won \`${value}\` time(s)`)
                                            }
                                        })
                                        return;
                                    case "votes":
                                        sql.getGlobalVoteCounts("pass", "count", (_type, _format, value) => {
                                            if(value == -1) {
                                                msg.channel.send("No server has completed a poll");
                                            } else {
                                                msg.channel.send(`There are \`${value}\` total votes for pass`)
                                            }
                                        })
                                        return;
                                }
                        }
                    case "server":
                        switch(format) {
                            case "percent":
                                switch(info) {
                                    case "polls":
                                        sql.getServerPollCounts(msg.guildId, "pass", "percent", (_type, _format, value) => {
                                            if(value == -1) {
                                                msg.channel.send("No polls completed in this server");
                                            } else {
                                                msg.channel.send(`Pass has won \`${(value * 100).toFixed(2)}\`% of the time`)
                                            }
                                        })
                                        return;
            
                                    case "votes":
                                        sql.getServerVoteCounts(msg.guildId, "pass", "percent", (_type, _format, value) => {
                                            if(value == -1) {
                                                msg.channel.send("No polls completed in this server");
                                            } else {
                                                msg.channel.send(`\`${(value * 100).toFixed(2)}\`% of the votes are for pass`);
                                            }
                                        })
                                        return;
                                }
                            case "count":
                                switch(info) {
                                    case "polls":
                                        sql.getServerPollCounts(msg.guildId, "pass", "count", (_type, _format, value) => {
                                            if(value == -1) {
                                                msg.channel.send("No polls completed in this server");
                                            } else {
                                                msg.channel.send(`Passed \`${value}\` pokemon`);
                                            }
                                        })
                                        return;
            
                                    case "votes":
                                        sql.getServerVoteCounts(msg.guildId, "pass", "count", (_type, _format, value) => {
                                            if(value == -1) {
                                                msg.channel.send("No polls completed in this server");
                                            } else {
                                                msg.channel.send(`There are \`${value}\` total votes for pass`)
                                            }
                                        })
                                        return;
                                }
                        }
                    case "leaderboard":
                        switch(format) {
                            case "percent":
                                switch(info) {
                                    case "polls":
                                        sql.getLeaderboardPollCounts("pass", "percent", (_type, _format, values) => {
                                            if(values.length == 0) {
                                                msg.channel.send("No server has completed a poll");
                                                return;
                                            }
                                            let message = "";
                                            for(let i = 0; i < values.length; i++) {
                                                message += `${i + 1}. \`${toTitleCase(utils.idMap[values[i].pokemon])}\`: \`${(values[i].smash * 100).toFixed(2)}\`% smashes and \`${(values[i].pass * 100).toFixed(2)}\`% passes\n`
                                            }
                                            msg.channel.send(message);
                                        })
                                        return;
            
                                    case "votes":
                                        sql.getLeaderboardVoteCounts("pass", "percent", (_type, _format, values) => {
                                            if(values.length == 0) {
                                                msg.channel.send("No server has completed a poll");
                                                return;
                                            }
                                            let message = "";
                                            for(let i = 0; i < values.length; i++) {
                                                message += `${i + 1}. \`${toTitleCase(utils.idMap[values[i].pokemon])}\`: \`${(values[i].smash * 100).toFixed(2)}\`% smash votes and \`${(values[i].pass * 100).toFixed(2)}\`% pass votes\n`
                                            }
                                            msg.channel.send(message);
                                        })
                                        return;
                                }
                            case "count":
                                switch(info) {
                                    case "polls":
                                        sql.getLeaderboardPollCounts("pass", "count", (_type, _format, values) => {
                                            if(values.length == 0) {
                                                msg.channel.send("No server has completed a poll");
                                                return;
                                            }
                                            let message = "";
                                            for(let i = 0; i < values.length; i++) {
                                                message += `${i + 1}. \`${toTitleCase(utils.idMap[values[i].pokemon])}\`: \`${values[i].smash}\` smashes and \`${values[i].pass}\` passes\n`
                                            }
                                            msg.channel.send(message);
                                        })
                                        return;
            
                                    case "votes":
                                        sql.getLeaderboardVoteCounts("pass", "count", (_type, _format, values) => {
                                            if(values.length == 0) {
                                                msg.channel.send("No server has completed a poll");
                                                return;
                                            }
                                            let message = "";
                                            for(let i = 0; i < values.length; i++) {
                                                message += `${i + 1}. \`${toTitleCase(utils.idMap[values[i].pokemon])}\`: \`${values[i].smash}\` smash votes and \`${values[i].pass}\` pass votes\n`
                                            }
                                            msg.channel.send(message);
                                        })
                                        return;
                                }
                        }
                }
            } else {
                switch(focus) {
                    case "global":
                        switch(format) {
                            case "percent":
                                switch(info) {
                                    case "polls":
                                        sql.getGlobalPokemonPollCounts("pass", "percent", pokemon, (_type, _format, _pokemon, value) => {
                                            if(value == -1) {
                                                msg.channel.send("No server has completed a poll");
                                                return;
                                            } else {
                                                msg.channel.send(`\`${(value * 100).toFixed(2)}\`% of servers have voted to pass \`${toTitleCase(utils.idMap[pokemon])}\``)
                                                return;
                                            }
                                        })
                                        return;
            
                                    case "votes":
                                        sql.getGlobalPokemonVoteCounts("pass", "percent", pokemon, (_type, _format, _pokemon, value) => {
                                            if(value == -1) {
                                                msg.channel.send("No server has completed a poll");
                                                return;
                                            } else {
                                                msg.channel.send(`\`${(value * 100).toFixed(2)}\`% of the total votes for \`${toTitleCase(utils.idMap[pokemon])}\` are for pass`);
                                                return;
                                            }
                                        })
                                        return;
                                }
                            case "count":
                                switch(info) {
                                    case "polls":
                                        sql.getGlobalPokemonPollCounts("pass", "count", pokemon, (_type, _format, _pokemon, value) => {
                                            if(value == -1) {
                                                msg.channel.send(`No server has completed a poll for \`${toTitleCase(utils.idMap[pokemon])}\``);
                                                return;
                                            } else {
                                                msg.channel.send(`\`${value}\` server(s) have voted to pass \`${toTitleCase(utils.idMap[pokemon])}\``)
                                                return;
                                            }
                                        })
                                        return;
            
                                    case "votes":
                                        sql.getGlobalPokemonVoteCounts("pass", "count", pokemon, (_type, _format, pokemon, value) => {
                                            if(value == -1) {
                                                msg.channel.send(`No server has completed a poll for \`${toTitleCase(utils.idMap[pokemon])}\``);
                                                return;
                                            } else {
                                                msg.channel.send(`\`${value}\` of the total votes for \`${toTitleCase(utils.idMap[pokemon])}\` are for pass`);
                                                return;
                                            }
                                        })
                                        return;
                                }
                        }
                    case "server":
                        switch(format) {
                            case "percent":
                                switch(info) {
                                    case "polls":
                                        sql.getServerPokemonPollCounts(msg.guildId, "pass", "percent", pokemon, (_type, _format, _pokemon, value) => {
                                            if(value == -1) {
                                                msg.channel.send(`This server has not completed a poll for \`${toTitleCase(utils.idMap[pokemon])}\``);
                                                return;
                                            } else {
                                                msg.channel.send(`This server has voted to pass \`${toTitleCase(utils.idMap[pokemon])}\` \`${(value * 100).toFixed(2)}\`% of the time`)
                                                return;
                                            }
                                        })
                                        return;
                                    case "votes":
                                        sql.getServerPokemonVoteCounts(msg.guildId, "pass", "percent", pokemon, (_type, _format, _pokemon, value) => {
                                            if(value == -1) {
                                                msg.channel.send(`This server has not completed a poll for \`${toTitleCase(utils.idMap[pokemon])}\``);
                                                return;
                                            } else {
                                                msg.channel.send(`This server has voted to pass \`${toTitleCase(utils.idMap[pokemon])}\` \`${(value * 100).toFixed(2)}\`% of the time`);
                                                return;
                                            }
                                        })
                                        return;
                                }
                            case "count":
                                switch(info) {
                                    case "polls":
                                        sql.getServerPokemonPollCounts(msg.guildId, "pass", "count", pokemon, (_type, _format, _pokemon, value) => {
                                            if(value == -1) {
                                                msg.channel.send(`This server has not completed a poll for \`${toTitleCase(utils.idMap[pokemon])}\``);
                                                return;
                                            } else {
                                                msg.channel.send(`This server has voted to pass \`${toTitleCase(utils.idMap[pokemon])}\` \`${value}\` times(s)`)
                                                return;
                                            }
                                        })
                                        return;
                                       
                                    case "votes":
                                        sql.getServerPokemonVoteCounts(msg.guildId, "pass", "count", pokemon, (_type, _format, _pokemon, value) => {
                                            if(value == -1) {
                                                msg.channel.send(`This server has not completed a poll for \`${toTitleCase(utils.idMap[pokemon])}\``);
                                                return;
                                            } else {
                                                msg.channel.send(`This server has voted to pass \`${toTitleCase(utils.idMap[pokemon])}\` \`${value}\` time(s)`);
                                                return;
                                            }
                                        })
                                        return;
                                }
                        }
                    case "leaderboard":
                        switch(format) {
                            case "percent":
                                switch(info) {
                                    case "polls":
                                        sql.getLeaderboardPokemonPollCounts("pass", "percent", pokemon, (_type, _format, value) => {
                                            if(value.place == -1) {
                                                msg.channel.send(`No polls completed for \`${toTitleCase(utils.idMap[value.pokemon])}\``)
                                            }
                                            msg.channel.send(`\`${toTitleCase(utils.idMap[value.pokemon])} is in placement \`${value.place}\` with \`${value.smash}\`% smashes and \`${value.pass}\`% passes`)
                                        })
                                        return;
            
                                    case "votes":
                                        sql.getLeaderboardPokemonVoteCounts("pass", "percent", pokemon, (_type, _format, value) => {
                                            if(value.place == -1) {
                                                msg.channel.send(`No polls completed for \`${toTitleCase(utils.idMap[value.pokemon])}\``)
                                            }
                                            msg.channel.send(`\`${toTitleCase(utils.idMap[value.pokemon])} is in placement \`${value.place}\` with \`${value.smash}\`% smash votes and \`${value.pass}\`% pass votes`)
                                        })
                                        return;
                                }
                            case "count":
                                switch(info) {
                                    case "polls":
                                        sql.getLeaderboardPokemonPollCounts("pass", "percent", pokemon, (_type, _format, value) => {
                                            if(value.place == -1) {
                                                msg.channel.send(`No polls completed for \`${toTitleCase(utils.idMap[value.pokemon])}\``)
                                            }
                                            msg.channel.send(`\`${toTitleCase(utils.idMap[value.pokemon])} is in placement \`${value.place}\` with \`${value.smash}\` smashes and \`${value.pass}\` passes`)
                                        })
                                        return;
            
                                    case "votes":
                                        sql.getLeaderboardPokemonVoteCounts("pass", "percent", pokemon, (_type, _format, value) => {
                                            if(value.place == -1) {
                                                msg.channel.send(`No polls completed for \`${toTitleCase(utils.idMap[value.pokemon])}\``)
                                            }
                                            msg.channel.send(`\`${toTitleCase(utils.idMap[value.pokemon])} is in placement \`${value.place}\` with \`${value.smash}\` smash votes and \`${value.pass}\` pass votes`)
                                        })
                                        return;
                                }
                        }
                }
            }
        },
        help: (_) => {
            return `\`${prefix}pass${sep}[pokemon]${sep}[focus]${sep}[format]${sep}[info]\`: display how many times "Pass" has won based on the arguments passed${lb}` + 
                     `\`[pokemon]\` = {pokemon id or name} (stats for that pokemon) | __"total"__ (aggregate stats of every pokemon)${lb}` +
                     `\`[focus]\` = __"server"__ (stats for the server) | "global" (stats for every server) | "leaderboard" (list pokemon placement or top 10 depending on \`[pokemon]\`)${lb}` +
                     `\`[format]\` = __"count"__ (exact count for stats) | "percent" (percentage stats)${lb}` +
                     `\`[info]\` = "votes" (number of votes from the polls) | __"polls"__ (number of polls)`
        }
    },
    "reset": {
        exec: (msg, _) => {
            sql.checks(msg, whitelist, (_thread, _channel, user) => {
                if(!user) { msg.channel.send("\\*racks shotgun* Do not the bot."); return; }
                sql.setServerInfoValue(msg.guildId, "offset", 0, (success, _offense, _offender) => {
                    if(success) {
                        msg.channel.send("Reset successful!");
                    }
                });
            })
        },
        help: (_) => `\`${prefix}reset\`\\*: reset the current pokemon back to 0`
    },
    "pop": {
        exec: (msg, _) => {
            sql.checks(msg, whitelist, (_thread, _channel, user) => {
                if(!user) { msg.channel.send("\\*racks shotgun* Do not the bot."); return; }
                sql.populate(msg.guildId, msg.guild.name);
            })
        },
        help: (_) => `\`${prefix}pop\`\\*: populates the info for this server, only really necessary after an update${lb}(called implicitly before the first command if no data is found for the server)`
    },
    "gen": {
        exec: (msg, _) => {
            if(msg.channel.id === testingChannel) {
                msg.channel.send("Generating...");
                utils.genMaps().then(() => msg.channel.send("Maps generated"));
            }
        },
        help: (msg) => {
            if(msg.channelId === testingChannel)
                return `\`${prefix}gen\`: generates the name and id maps`
            else return "";
        }
    },
    "replace": {
        exec: (msg, _) => {
            if(msg.channelId === testingChannel) {
                sql.updateAllPlaces();
            }
        }
    },
    "message": {
        exec: (msg, args) => {
            if(msg.channelId === testingChannel) {
                sql.getServerInfo(args[0], (count, _offset, channel) => {
                    if(count === undefined) {
                        msg.channel.send("Server `" + args[0] + "` does not exist in the database")
                        return;
                    }
                    if(channel === undefined) {
                        msg.channel.send("Server `" + args[0] + "` does not have a channel set, fix that")
                        return;
                    }
                    client.guilds.cache.get(args[0]).channels.cache.get(channel).send(args.slice(1).join(sep)).then(_ => msg.channel.send("message sent"));
                })
            }
        }
    },
    "reply": {
        exec: (msg, args) => {
            sql.checks(msg, whitelist, (_thread, _channel, user) => {
                if(!user) { msg.channel.send("\\*racks shotgun* Do not the bot."); return; }
                sql.getServerName(msg.guildId, (name) => {
                    client.guilds.cache.get(homeServer).channels.cache.get(replyChannel).send(`\`${msg.author.username}\` from server \`${name}\` sent: ${args.join(" ")}`);
                })
            })
        },
        help: (_) => `\`${prefix}reply\`\\*: sends a message back to the home server, don't abuse this please :(`
    },
    "test": {
        exec: (msg, _) => {
            if(msg.channelId === testingChannel) {
                debugAddPoll("rhyhorn", "1050929736538402917", 1, 4);
                debugAddPoll("chansey", "1050929736538402917", 2, 4);
                debugAddPoll("tangela", "1050929736538402917", 4, 2);
                debugAddPoll("kangaskhan", "1050929736538402917", 4, 2)
                debugAddPoll("horsea", "1050929736538402917", 2, 4);
                debugAddPoll("seadra", "1050929736538402917", 3, 3);
                debugAddPoll("goldeen", "1050929736538402917", 0, 6);
                debugAddPoll("seaking", "1050929736538402917", 1, 5);
                debugAddPoll("staryu", "1050929736538402917", 2, 4);
            }
        }
    }
}

const whitelist = [
    "734183824950427690", // Lyra
    "687780591818899515", // Me
    "400477735811809284", // Jade
];

const Discord = require("discord.js");

const client = new Discord.Client({intents: [
    Discord.GatewayIntentBits.Guilds,
    Discord.GatewayIntentBits.MessageContent,
    Discord.GatewayIntentBits.GuildMessages,
    Discord.GatewayIntentBits.DirectMessages,
    Discord.GatewayIntentBits.GuildMessagePolls,
]});

client.once(Discord.Events.ClientReady, async readyClient => {
    console.log(`${readyClient.user.username}`);
    readyClient.user.setPresence({
        status: "online",
        activities: [{
            name: `these weirdos | ${prefix}help`,
            type: Discord.ActivityType.Watching
        }]
    })
})

client.on(Discord.Events.MessageUpdate, async (_, newMessage) => {
    if(newMessage.author.id === client.user.id && newMessage.poll){
        console.log(newMessage.poll.question.text + " poll updated")
        let smash = newMessage.poll.answers.at(0).voteCount;
        let pass = newMessage.poll.answers.at(1).voteCount;
        sql.setVote(newMessage.guildId, `${utils.nameMap[newMessage.poll.question.text.toLowerCase()]}`, smash, pass);
    }
})

client.on(Discord.Events.MessageCreate, async msg => {
    if(msg.author.username == client.user.username) {
        if(msg.poll && !msg.poll.question.text.startsWith(noThread)) {
            await msg.startThread({ name: `${msg.poll.question.text}` }).then(thread => thread.send(sprites[`${thread.name}`]))
        }
        return;
    }
    if(msg.author.bot) return; // Ignore bots
    if(msg.content.startsWith(prefix)) {
        let str = msg.content.substring(prefix.length)
        let args = str.split(sep)
        let command = commands[args[0]]?.exec;
        if(command == undefined) {
            await msg.channel.send(`Unrecognized command: \`${args[0]}\``);
            return
        } else {
            sql.getServerName(msg.guildId, (name) => {
                if(!name) commands["pop"].exec(msg, []);
                command(msg, args.slice(1));
            })
        }
    }
});

client.login(process.env.TOKEN);

function toTitleCase(str) {
    return str.replace(
        /\w\S*/g,
        text => text.charAt(0).toUpperCase() + text.substring(1).toLowerCase()
    );
}

function getPokemon(count, offset, channel) {
    if(count === 0) return;
    fetch(`https://pokeapi.co/api/v2/pokemon/?limit=${count}&offset=${offset}`)
    .then(response => response.json())
    .then(data => {
        let results = data.results;
        let promisesArray = results.map(async result => {
            const response = await fetch(result.url);
            return await response.json();
        })
        return Promise.all(promisesArray);
    }).then(data => {
        data.forEach(value => {
            channel.send({ poll: {
                    question: {
                        text: `${toTitleCase(value.name)}`
                    },
                    answers: [
                        {
                            text: "Smash"
                        },
                        {
                            text: "Pass"
                        }
                    ]
                }
            })
            if(!sprites[`${toTitleCase(value.name)}`]) sprites[`${toTitleCase(value.name)}`] = value.sprites.front_default;
        });
        return null;
    });
}

function debugAddPoll(pokemonName, serverId, smash, pass) {
    sql.setVote(serverId, utils.nameMap[pokemonName.toLowerCase()], smash, pass);
}