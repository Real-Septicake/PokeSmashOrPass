/**
 * @typedef {"smash" | "pass"} resultType
 * @typedef {"count" | "percent"} formatType
 * @typedef {import('discord.js').Message<boolean>} DiscordMessage
 * @typedef {"pollCount" | "offset" | "channel"} ServerInfo
 * @typedef {number | string} ServerInfoValue
 * @typedef {"invalidInfo" | "invalidValue"} SetOffense
 * @typedef {string} PokeId
 */

require("dotenv").config()
const mysql = require("mysql2");

/**
 * 
 * @param {string} guildId Id of the guild to populate a row for
 * @param {string} guildName Name of the guild being populated
 */
function populate(guildId, guildName) {
    const con = mysql.createConnection({
        host: process.env.DB_HOST,
        port: process.env.DB_PORT,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        namedPlaceholders: true,
        multipleStatements: true
    });

    con.connect(function(err) {
        if(err) throw err;
        let sql = "SELECT EXISTS(SELECT * FROM serverinfo WHERE guildId = :guild) AS doesExist"
        let values = {"guild": guildId}
        con.query(sql, values, function(err, result) {
            if(err) throw err;
            if(!result[0].doesExist){
                let sql = "INSERT INTO serverinfo (guildId, name) VALUES (:guild, :name)";
                let values = {"guild": guildId, "name": guildName };
                con.query(sql, values, function(err, _) {
                    if(err) throw err;
                    con.end();
                })
            }
        })
    })
}

/**
 * 
 * @param {string} guildId 
 * @param {ServerInfo} info The info to set
 * @param {ServerInfoValue} value If `info` is either `pollCount` or `offset`, `value` is a number, else is is a string
 * @param {(successful: boolean, offense: SetOffense | null, offender: string | number | null) => void} callback 
 */
function setServerInfoValue(guildId, info, value, callback) {
    const con = mysql.createConnection({
        host: process.env.DB_HOST,
        port: process.env.DB_PORT,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        namedPlaceholders: true,
        multipleStatements: true
    });

    con.connect(function(err) {
        if(err) throw err;
        if(info === "offset" || info === "pollCount") {
            if(Number(value) !== value) {
                callback(false, "invalidValue", value);
                return;
            }
            let sql = "UPDATE serverinfo SET " + info + " = :value WHERE guildId = :guild";
            let values = {"guild": guildId, "value": value};
            con.query(sql, values, function(err, _) {
                if(err) throw err;
                callback(true, null, null);
                con.end();
            })
        } else if(info === "channel") {
            if(value.toString() !== value) {
                callback(false, "invalidValue", value)
                return;
            }
            let sql = "UPDATE serverinfo SET channel = :value WHERE guildId = :guild";
            let values = {"guild": guildId, "value": value}
            con.query(sql, values, function(err, _) {
                if(err) throw err;
                callback(true, null, null);
                con.end()
            })
        } else {
            callback(false, "invalidInfo", info);
            con.end();
        }
    })
}

/**
 * @param {string} guildId Id of the guild to get the next count of
 * @param {(name: string) => void} callback Function to call after the query completes
 */
function getServerName(guildId, callback) {
    const con = mysql.createConnection({
        host: process.env.DB_HOST,
        port: process.env.DB_PORT,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        namedPlaceholders: true,
        multipleStatements: true
    });

    con.connect(function(err) {
        if(err) throw err;
        let sql = "SELECT name FROM serverinfo WHERE guildId = :guild";
        let values = {"guild": guildId};
        con.query(sql, values, function(err, result) {
            if(err) throw err;
            callback(result[0]?.name);
            con.end();
        })
    })
}

/**
 * 
 * @param {string} guildId Id of the guild to get the next count of
 * @param {(count: number, offset: number, channel: string) => void} callback Function to call after the query completes
 */
function getServerInfo(guildId, callback) {
    const con = mysql.createConnection({
        host: process.env.DB_HOST,
        port: process.env.DB_PORT,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        namedPlaceholders: true,
        multipleStatements: true
    });

    con.connect(function(err) {
        if(err) throw err;
        let sql = "SELECT pollCount AS count, offset, channel FROM serverinfo WHERE guildId = :guild";
        let values = {"guild": guildId};
        con.query(sql, values, function(err, result) {
            if(err) throw err;
            callback(result[0]?.count, result[0]?.offset, result[0]?.channel);
            con.end()
        })
    })
}

/**
 * 
 * @param {DiscordMessage} msg
 * @param {string[]} masterWhitelist 
 * @param {(isThread: boolean, correctChannel: boolean | undefined, whitelistedUser: boolean) => void} callback The function to call after the query completes, 
 *          arguments are `true` if they pass their respective test and `false` otherwise. If `correctChannel` is `undefined`, the server does not have a channel set
 */
function checks(msg, masterWhitelist, callback) {
    const con = mysql.createConnection({
        host: process.env.DB_HOST,
        port: process.env.DB_PORT,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        namedPlaceholders: true,
        multipleStatements: true
    });

    con.connect(function(err) {
        if(err) throw err;
        let sql = "SELECT channel FROM serverinfo WHERE guildId = :guild && channel = :channel;" +
                  "SELECT userId AS user FROM whitelist WHERE guildId = :guild && userId = :user;";
        values = {
            "guild": msg.guildId,
            "channel": msg.channelId,
            "user": msg.author.id
        }
        con.query(sql, values, function(err, result) {
            if(err) throw err;
            callback(!msg.channel.isThread(), result[0][0]?.channel == undefined ? undefined : result[0][0]?.channel === msg.channelId, masterWhitelist.includes(msg.author.id) || Boolean(result[1][0]?.user));
            con.end()
        })
    })
}

/**
 * 
 * @param {string} guildId Id of the guild to get the vote counts for
 * @param {resultType} type Which count to get
 * @param {formatType} format What format the result should be in
 * @param {(type: resultType | undefined, 
 *          format: formatType | undefined, 
 *          value: number | undefined) => void} callback Function to call after the query completes, all arguments are `undefined` if `type` or `format` are invalid
 */
function getServerVoteCounts(guildId, type, format, callback) {
    const con = mysql.createConnection({
        host: process.env.DB_HOST,
        port: process.env.DB_PORT,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        namedPlaceholders: true,
        multipleStatements: true
    });

    con.connect(function(err) {
        if(err) throw err;
        if((type !== "smash" && type !== "pass") || (format !== "count" && format !== "percent")) callback(undefined, undefined, undefined);
        let sql = "SELECT SUM(smashes) AS smash, SUM(passes) AS pass FROM votes WHERE guildId = :guild"
        let values = {"guild": guildId};
        con.query(sql, values, function(err, result) {
            if(err) throw err;
            var smashes = Number(result[0].smash);
            var passes = Number(result[0].pass);
            let value;
            let total = smashes + passes;
            if(total == 0) value = -1;
            else if(format === "count") {
                value = type === "pass" ? passes : smashes;
            } else {
                value = (type === "pass" ? passes : smashes) / total;
            }
            callback(type, format, value);
            con.end();
        })
    })
}

/**
 * 
 * @param {string} guildId Id of the guild to get the vote counts for
 * @param {resultType} type Which count to get
 * @param {formatType} format What format the result should be in
 * @param {(type: resultType | undefined, 
 *          format: formatType | undefined, 
 *          value: number | undefined) => void} callback Function to call after the query completes, all arguments are `undefined` if `type` or `format` are invalid
 */
function getServerPollCounts(guildId, type, format, callback) {
    const con = mysql.createConnection({
        host: process.env.DB_HOST,
        port: process.env.DB_PORT,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        namedPlaceholders: true,
        multipleStatements: true
    });

    con.connect(function(err) {
        if(err) throw err;
        if((type !== "smash" && type !== "pass") || (format !== "count" && format !== "percent")) callback(undefined, undefined, undefined);
        let sql = "SELECT smash, pass FROM serverinfo WHERE guildId = :guild;";
        let values = {"guild": guildId};
        con.query(sql, values, function(err, result) {
            if(err) throw err;
            var smashes = result[0].smash;
            var passes = result[0].pass;
            let value;
            let total = smashes + passes;
            if(total == 0) value = -1;
            else if(format === "count") {
                value = type === "pass" ? passes : smashes;
            } else {
                value = (type === "pass" ? passes : smashes) / total;
            }
            callback(type, format, value);
            con.end()
        })
    })
}

/**
 * 
 * @param {string} guildId 
 * @param {resultType} type 
 * @param {formatType} format 
 * @param {PokeId} pokeId 
 * @param {(type: resultType | undefined,
 *          format: formatType | undefined,
 *          pokemon: string | undefined
 *          value: number | undefined) => void} callback Function to call after the query completes, all arguments are `undefined` if `type` or `format` are invalid
 */
function getServerPokemonVoteCounts(guildId, type, format, pokeId, callback) {
    const con = mysql.createConnection({
        host: process.env.DB_HOST,
        port: process.env.DB_PORT,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        namedPlaceholders: true,
        multipleStatements: true
    });

    con.connect(function(err) {
        if(err) throw err;
        if((type !== "smash" && type !== "pass") || (format !== "count" && format !== "percent")) callback(undefined, undefined, undefined, undefined);
        let sql = "SELECT smashes, passes FROM votes WHERE pokeId = :poke && guildId = :guild"
        let values = {"poke": pokeId, "guild": guildId}
        con.query(sql, values, function(err, result) {
            if(err) throw err;
            var smashes = result[0]?.smashes ?? 0;
            var passes = result[0]?.passes ?? 0;
            let value;
            let total = smashes + passes;
            if(total == 0) value = -1;
            else if(format === "count") {
                value = type === "pass" ? passes : smashes;
            } else {
                value = (type === "pass" ? passes : smashes) / total;
            }
            callback(type, format, pokeId, value);
            con.end()
        })
    })
}

/**
 * 
 * @param {string} guildId 
 * @param {resultType} type 
 * @param {formatType} format 
 * @param {PokeId} pokeId 
 * @param {(type: resultType | undefined,
 *          format: formatType | undefined,
 *          pokemon: string | undefined
 *          value: number | undefined) => void} callback Function to call after the query completes, all arguments are `undefined` if `type` or `format` are invalid
 */
function getServerPokemonPollCounts(guildId, type, format, pokeId, callback) {
    const con = mysql.createConnection({
        host: process.env.DB_HOST,
        port: process.env.DB_PORT,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        namedPlaceholders: true,
        multipleStatements: true
    });

    con.connect(function(err) {
        if(err) throw err;
        if((type !== "smash" && type !== "pass") || (format !== "count" && format !== "percent")) callback(undefined, undefined, undefined);
        let sql = "SELECT result FROM votes WHERE guildId = :guild && pokeId = :poke;";
        let values = {"guild": guildId, "poke": pokeId};
        con.query(sql, values, function(err, result) {
            if(err) throw err;
            var result = result[0]?.result ?? -1;
            let value;
            if(result == -1) value = -1;
            else value = ((type === "pass") == (result == 0)) ? 1 : 0;
            callback(type, format, value);
            con.end()
        })
    })
}

/**
 * 
 * @param {resultType} type Which count to get
 * @param {formatType} format What format the result should be in
 * @param {(type: resultType | undefined, 
 *          format: formatType | undefined, 
 *          value: number | undefined) => void} callback Function to call after the query completes, all arguments are `undefined` if `type` or `format` are invalid
 */
function getGlobalVoteCounts(type, format, callback) {
    const con = mysql.createConnection({
        host: process.env.DB_HOST,
        port: process.env.DB_PORT,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        namedPlaceholders: true,
        multipleStatements: true
    });

    con.connect(function(err) {
        if(err) throw err;
        if((type !== "smash" && type !== "pass") || (format !== "count" && format !== "percent")) callback(undefined, undefined, undefined);
        let sql = "SELECT SUM(smashVotes) AS smashes, SUM(passVotes) AS passes FROM pokemoninfo"
        con.query(sql, function(err, result) {
            if(err) throw err;
            var smashes = Number(result[0].smashes);
            var passes = Number(result[0].passes);
            let value;
            let total = smashes + passes;
            if(total == 0) value = -1;
            else if(format === "count") {
                value = type === "pass" ? passes : smashes;
            } else {
                value = (type === "pass" ? passes : smashes) / total;
            }
            callback(type, format, value);
            con.end()
        })
    })
}

/**
 * 
 * @param {resultType} type Which count to get
 * @param {formatType} format What format the result should be in
 * @param {(type: resultType | undefined, 
*          format: formatType | undefined, 
*          value: number | undefined) => void} callback Function to call after the query completes, all arguments are `undefined` if `type` or `format` are invalid
*/
function getGlobalPollCounts(type, format, callback) {
    const con = mysql.createConnection({
        host: process.env.DB_HOST,
        port: process.env.DB_PORT,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        namedPlaceholders: true,
        multipleStatements: true
    });

    con.connect(function(err) {
        if(err) throw err;
        if((type !== "smash" && type !== "pass") || (format !== "count" && format !== "percent")) callback(undefined, undefined, undefined);
        let sql = "SELECT SUM(smashCount) AS smashes, SUM(passCount) AS passes FROM pokemoninfo;"
        con.query(sql, function(err, result) {
            if(err) throw err;
            var smashes = Number(result[0].smashes);
            var passes = Number(result[0].passes);
            let value;
            let total = smashes + passes;
            if(total == 0) value = -1;
            else if(format === "count") {
                value = type === "pass" ? passes : smashes;
            } else {
                value = (type === "pass" ? passes : smashes) / total;
            }
            callback(type, format, value);
            con.end()
        })
    })
}

/**
 * 
 * @param {resultType} type Which count to get
 * @param {formatType} format What format the result should be in
 * @param {PokeId} pokeId Id of the pokemon to get the count of
 * @param {(type: resultType | undefined,
 *          format: formatType | undefined,
 *          pokemon: string | undefined
 *          value: number | undefined) => void} callback Function to call after the query completes, all arguments are `undefined` if `type` or `format` are invalid
 */
function getGlobalPokemonVoteCounts(type, format, pokeId, callback) {
    const con = mysql.createConnection({
        host: process.env.DB_HOST,
        port: process.env.DB_PORT,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        namedPlaceholders: true,
        multipleStatements: true
    });

    con.connect(function(err) {
        if(err) throw err;
        if((type !== "smash" && type !== "pass") || (format !== "count" && format !== "percent")) callback(undefined, undefined, undefined, undefined);
        let sql = "SELECT smashVotes AS smashes, passVotes AS passes FROM pokemoninfo WHERE pokeId = :poke"
        let values = {"poke": pokeId}
        con.query(sql, values, function(err, result) {
            if(err) throw err;
            var smashes = result[0]?.smashes ?? 0;
            var passes = result[0]?.passes ?? 0;
            let value;
            let total = smashes + passes;
            if(total == 0) value = -1;
            else if(format === "count") {
                value = type === "pass" ? passes : smashes;
            } else {
                value = (type === "pass" ? passes : smashes) / total;
            }
            callback(type, format, pokeId, value);
            con.end()
        })
    })
}

/**
 * 
 * @param {resultType} type Which count to get
 * @param {formatType} format What format the result should be in
 * @param {PokeId} pokeId Id of the pokemon to get the count of
 * @param {(type: resultType | undefined,
 *          format: formatType | undefined,
 *          pokemon: string | undefined
 *          value: number | undefined) => void} callback Function to call after the query completes, all arguments are `undefined` if `type` or `format` are invalid
 */
function getGlobalPokemonPollCounts(type, format, pokeId, callback) {
    const con = mysql.createConnection({
        host: process.env.DB_HOST,
        port: process.env.DB_PORT,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        namedPlaceholders: true,
        multipleStatements: true
    });

    con.connect(function(err) {
        if(err) throw err;
        if((type !== "smash" && type !== "pass") || (format !== "count" && format !== "percent")) callback(undefined, undefined, undefined);
        let sql = "SELECT SUM(smashCount) AS smashes, SUM(passCount) AS passes FROM pokemoninfo WHERE pokeId = :poke;"
        let values = {"poke": pokeId}
        con.query(sql, values, function(err, result) {
            if(err) throw err;
            var smashes = Number(result[0].smashes);
            var passes = Number(result[0].passes);
            let value;
            let total = smashes + passes;
            if(total == 0) value = -1;
            else if(format === "count") {
                value = type === "pass" ? passes : smashes;
            } else {
                value = (type === "pass" ? passes : smashes) / total;
            }
            callback(type, format, pokeId, value);
            con.end()
        })
    })
}

/**
 * 
 * @param {resultType} type 
 * @param {formatType} format 
 * @param {(type: resultType | undefined,
 *          format: formatType | undefined,
 *          values: {pokemon: PokeId, 
 *                   place: number, 
 *                   smash: number, 
 *                   pass: number}[] | undefined) => void} callback 
 */
function getLeaderboardVoteCounts(type, format, callback) {
    const con = mysql.createConnection({
        host: process.env.DB_HOST,
        port: process.env.DB_PORT,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        namedPlaceholders: true,
        multipleStatements: true
    });

    con.connect(function(err) {
        if(err) throw err;
        if((type !== "smash" && type !== "pass") || (format !== "count" && format !== "percent")) callback(undefined, undefined, undefined);
        let sql = "SELECT * FROM pokemoninfo ORDER BY place " + (type === "pass" ? "DESC" : "ASC") + " LIMIT 10;"
        con.query(sql, function(err, result) {
            if(err) throw err;
            let values = result.map((value) => {
                let id = value.pokeId;
                let place = value.place;
                let smash;
                let pass;
                if(format == "count") {
                    smash = value.smashVotes;
                    pass = value.passVotes;
                } else {
                    smash = value.smashVotes / (value.smashVotes + value.passVotes);
                    pass = value.passVotes / (value.smashVotes + value.passVotes);
                }

                return {
                    pokemon: id,
                    "place": place,
                    "smash": smash,
                    "pass": pass
                }
            })
            callback(type, format, values);
            con.end()
        })
    })
}

/**
 * 
 * @param {resultType} type 
 * @param {formatType} format 
 * @param {(type: resultType | undefined,
 *          format: formatType | undefined,
 *          values: {pokemon: PokeId, 
 *                   place: number, 
 *                   smash: number, 
 *                   pass: number}[] | undefined) => void} callback 
 */
function getLeaderboardPollCounts(type, format, callback) {
    const con = mysql.createConnection({
        host: process.env.DB_HOST,
        port: process.env.DB_PORT,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        namedPlaceholders: true,
        multipleStatements: true
    });

   con.connect(function(err) {
       if(err) throw err;
       if((type !== "smash" && type !== "pass") || (format !== "count" && format !== "percent")) callback(undefined, undefined, undefined);
       let sql = "SELECT * FROM pokemoninfo ORDER BY place " + (type === "pass" ? "DESC" : "ASC") + " LIMIT 10;"
       con.query(sql, function(err, result) {
           if(err) throw err;
           let values = result.map((value) => {
               let id = value.pokeId;
               let place = value.place;
               let smash;
               let pass;
               if(format == "count") {
                   smash = value.smashCount;
                   pass = value.passCount;
               } else {
                   smash = value.smashCount / (value.smashCount + value.passCount);
                   pass = value.passCount / (value.smashCount + value.passCount);
               }

               return {
                   pokemon: id,
                   "place": place,
                   "smash": smash,
                   "pass": pass
               }
           })
           callback(type, format, values);
           con.end()
       })
   })
}

/**
 * 
 * @param {resultType} type 
 * @param {formatType} format 
 * @param {(type: resultType | undefined,
 *          format: formatType | undefined,
 *          value: {pokemon: PokeId, 
 *                  place: number, 
 *                  smash: number, 
 *                  pass: number} | undefined) => void} callback The property `place` in `value` is -1 if the pokemon has no poll completions
 */
function getLeaderboardPokemonVoteCounts(type, format, pokeId, callback) {
    const con = mysql.createConnection({
        host: process.env.DB_HOST,
        port: process.env.DB_PORT,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        namedPlaceholders: true,
        multipleStatements: true
    });

    con.connect(function(err) {
        if(err) throw err;
        if((type !== "smash" && type !== "pass") || (format !== "count" && format !== "percent")) callback(undefined, undefined, undefined);
        let sql = "SELECT * FROM pokemoninfo WHERE pokeId = :poke";
        let values = {"poke": pokeId};
        con.query(sql, values, function(err, result) {
            if(err) throw err;
            let id = pokeId;
            let place = result[0]?.place;
            let smash;
            let pass;
            if(format == "count") {
                smash = result[0]?.smashVotes;
                pass = result[0]?.passVotes;
            } else {
                smash = result[0]?.smashVotes / (result[0]?.smashVotes + result[0]?.passVotes);
                pass = result[0]?.passVotes / (result[0]?.smashVotes + result[0]?.passVotes);
            }
            let value = {
                "pokemon": id,
                "place": place ?? -1,
                "smash": smash || 0,
                "pass": pass || 0
            }
            callback(type, format, value);
            con.end()
        })
    })
}

/**
 * 
 * @param {resultType} type 
 * @param {formatType} format 
 * @param {(type: resultType | undefined,
*          format: formatType | undefined,
*          value: {pokemon: PokeId, 
*                  place: number, 
*                  smash: number, 
*                  pass: number} | undefined) => void} callback The property `place` in `value` is -1 if the pokemon has no poll completions
*/
function getLeaderboardPokemonPollCounts(type, format, pokeId, callback) {
    const con = mysql.createConnection({
        host: process.env.DB_HOST,
        port: process.env.DB_PORT,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        namedPlaceholders: true,
        multipleStatements: true
    });

    con.connect(function(err) {
        if(err) throw err;
        if((type !== "smash" && type !== "pass") || (format !== "count" && format !== "percent")) callback(undefined, undefined, undefined);
        let sql = "SELECT * FROM pokemoninfo WHERE pokeId = :poke";
        let values = {"poke": pokeId};
        con.query(sql, values, function(err, result) {
            if(err) throw err;
            let id = pokeId;
            let place = result[0]?.place;
            let smash;
            let pass;
            if(format == "count") {
                smash = result[0]?.smashCount;
                pass = result[0]?.passCount;
            } else {
                smash = result[0]?.smashCount / (result[0]?.smashCount + result[0]?.passCount);
                pass = result[0]?.passCount / (result[0]?.smashCount + result[0]?.passCount);
            }
            let value = {
                "pokemon": id,
                "place": place ?? -1,
                "smash": smash || 0,
                "pass": pass || 0
            }
            callback(type, format, value);
            con.end();
        })
    })
}

/**
 * 
 * @param {string} guildId Id of the guild to get the next count of
 * @param {number} maxCount Max value of `offset`
 * @param {(count: number, offset: number) => void} callback Function to call after the query completes
 */
function getNextCount(guildId, maxCount, callback) {
    const con = mysql.createConnection({
        host: process.env.DB_HOST,
        port: process.env.DB_PORT,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        namedPlaceholders: true,
        multipleStatements: true
    });

    con.connect(function(err) {
        if(err) throw err;
        let sql = "SELECT pollCount AS count, offset FROM serverinfo WHERE guildId = :guild";
        let values = {"guild": guildId};
        con.query(sql, values, function(err, result) {
            if(err) throw err;
            let num = Math.min(maxCount - result[0].offset, result[0].count);
            callback(num, result[0].offset);
            con.end();
        })
    })
}

/**
 * 
 * @param {string} guildId Id of the guild to increment the count of
 * @param {number} maxCount Max value of `offset`
 * @param {(newOffset: number, maxCount: number) => void} callback Function to call after the query completes
 */
function incrementOffset(guildId, maxCount, callback) {
    const con = mysql.createConnection({
        host: process.env.DB_HOST,
        port: process.env.DB_PORT,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        namedPlaceholders: true,
        multipleStatements: true
    });

    con.connect(function(err) {
        if(err) throw err;
        let sql = "UPDATE serverinfo SET offset = IF(offset + pollCount >= :max, :max, offset + pollCount) WHERE guildId = :guild;" +
                  "SELECT offset FROM serverinfo WHERE guildId = :guild;"
        let values = {"guild": guildId, "max": maxCount};
        con.query(sql, values, function(err, result) {
            if(err) throw err;
            callback(result[1][0].offset, maxCount);
            con.end();
        })
    })
}

/**
 * 
 * @param {string} guildId Id of the guild this vote is from
 * @param {string} pokeId Id of the pokemon the vote was for
 * @param {number} smashes Number of votes for "Smash"
 * @param {number} passes Number of votes for "Pass"
 */
function setVote(guildId, pokeId, smashes, passes) {
    const con = mysql.createConnection({
        host: process.env.DB_HOST,
        port: process.env.DB_PORT,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        namedPlaceholders: true,
        multipleStatements: true
    });

    con.connect(function(err) {
        if(err) throw err;
        let sql = "SELECT EXISTS(SELECT guildId, pokeId FROM votes WHERE guildId = :guild && pokeId = :poke) AS doesExist"
        let values = {
            guild: guildId,
            poke: pokeId,
            "smashes": smashes,
            "passes": passes
        }
        con.query(sql, values, function(err, result) {
            if(err) throw err;
            if(result[0].doesExist) {
                con.query("SELECT result, smashes as prevSmashes, passes as prevPasses FROM votes WHERE guildId = :guild && pokeId = :poke; " + 
                          "SELECT COUNT(place) AS last FROM pokemoninfo; " +
                          "UPDATE votes SET smashes = :smashes, passes = :passes, result = IF(:passes >= :smashes, 0, 1) WHERE guildId = :guild && pokeId = :poke;", 
                          values, function(err, result) {
                    if(err) throw err;
                    let sql = "SELECT place FROM pokemoninfo WHERE pokeId = :poke; ";
                    let values = {
                        "guild": guildId,
                        "poke": pokeId,
                        "prevSmash": result[0][0].prevSmashes,
                        "prevPass": result[0][0].prevPasses,
                        "smashes": smashes,
                        "passes": passes
                    }
                    let prevResult = result[0][0].result
                    if(prevResult) {
                        sql += "UPDATE pokemoninfo SET smashVotes = smashVotes - :prevSmash, passVotes = passVotes - :prevPass, smashCount = smashCount - 1 WHERE pokeId = :poke; " +
                               "UPDATE serverinfo SET smash = smash - 1 WHERE guildId = :guild; ";
                    } else {
                        sql += "UPDATE pokemoninfo SET smashVotes = smashVotes - :prevSmash, passVotes = passVotes - :prevPass, passCount = passCount - 1 WHERE pokeId = :poke; " +
                               "UPDATE serverinfo SET pass = pass - 1 WHERE guildId = :guild; ";
                    }
                    sql += "UPDATE pokemoninfo SET smashVotes = smashVotes + :smashes, passVotes = passVotes + :passes, " +
                           "smashCount = smashCount + IF(:smashes > :passes, 1, 0), " +
                           "passCount = passCount + IF(:passes >= :smashes, 1, 0) " +
                           "WHERE pokeId = :poke; UPDATE serverinfo SET " +
                           "smash = smash + IF(:smashes > :passes, 1, 0), " +
                           "pass = pass + IF(:passes >= :smashes, 1, 0) " +
                           "WHERE guildId = :guild;";
                    con.query(sql, values, function(err, _) {
                        if(err) throw err;
                        updateAllPlaces();
                        con.end();
                    })
                })
            } else {
                con.query("INSERT INTO votes (guildId, pokeId, smashes, passes, result) VALUES (:guild, :poke, :smashes, :passes, IF(:passes >= :smashes, 0, 1));", values, function(err, _) {
                    if(err) throw err;
                    let sql = "SELECT EXISTS(SELECT * FROM pokemoninfo WHERE pokeId = :poke) AS entryExists; SELECT COUNT(place) AS lastPlace FROM pokemoninfo";
                    con.query(sql, {"poke": pokeId}, function(err, result) {
                        if(err) throw err;
                        if(result[0][0].entryExists) {
                            let sql = "SELECT place FROM pokemoninfo WHERE pokeId = :poke; " +
                                      "UPDATE pokemoninfo SET smashVotes = smashVotes + :smashes, passVotes = passVotes + :passes, " +
                                      "smashCount = smashCount + IF(:smashes > :passes, 1, 0), " +
                                      "passCount = passCount + IF(:passes >= :smashes, 1, 0) " +
                                      "WHERE pokeId = :poke; UPDATE serverinfo SET " +
                                      "smash = smash + IF(:smashes > :passes, 1, 0), " +
                                      "pass = pass + IF(:passes >= :smashes, 1, 0) " +
                                      "WHERE guildId = :guild";
                            let values = {
                                "guild": guildId,
                                "poke": pokeId,
                                "smashes": smashes,
                                "passes": passes
                            }
                            con.query(sql, values, function(err, _) {
                                if(err) throw err;
                                updateAllPlaces();
                                con.end()
                            })
                        } else {
                            let sql = "INSERT INTO pokemoninfo (pokeId, smashCount, passCount, smashVotes, passVotes, place) VALUES " +
                                      "(:poke, :smashes, :passes, :smashVotes, :passVotes, :place); " +
                                      "UPDATE serverinfo SET smash = smash + :smashes, pass = pass + :passes " +
                                      "WHERE guildId = :guild"
                            let values = {
                                "guild": guildId,
                                "poke": pokeId, 
                                "smashes": smashes > passes ? 1 : 0, 
                                "passes": passes >= smashes ? 1 : 0, 
                                "smashVotes": smashes, 
                                "passVotes": passes, 
                                "place": (result[1][0].lastPlace || 0) + 1
                            };
                            con.query(sql, values, function(err, _) {
                                if(err) throw err;
                                updateAllPlaces();
                                con.end();
                            })
                        }
                    })
                })
            }
        })
    })
}

function percent(smash, pass) {
    if(pass === 0 && smash === 0) return -1;
    else return (smash / (pass + smash))
}

function updateAllPlaces() {
    const con = mysql.createConnection({
        host: process.env.DB_HOST,
        port: process.env.DB_PORT,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        namedPlaceholders: true,
        multipleStatements: true
    });

    con.connect(function(err) {
        if(err) throw err;
        con.query("SELECT * FROM pokemoninfo", function(err, result) {
            if(err) throw err;
            result.sort((a, b) => {
                if(percent(b.smashCount, b.passCount) == percent(a.smashCount, a.passCount)) return percent(b.smashVotes, b.passVotes) - percent(a.smashVotes, b.smashVotes);
                return percent(b.smashCount, b.passCount) - percent(a.smashCount, a.passCount)
            }).forEach((value, index) => {
                con.query("UPDATE pokemoninfo SET place=:place WHERE pokeId=:poke", {"place": index + 1, "poke": value.pokeId}, function(err) {
                    if(err) throw err;
                    if(index == result.length - 1) con.end();
                })
            })
        })
    })
}

module.exports = { 
    populate, setServerInfoValue, getServerInfo, getServerName, checks, getNextCount, incrementOffset, setVote, updateAllPlaces,
    getServerVoteCounts, getServerPollCounts, getServerPokemonVoteCounts, getServerPokemonPollCounts,
    getGlobalVoteCounts, getGlobalPollCounts, getGlobalPokemonVoteCounts, getGlobalPokemonPollCounts,
    getLeaderboardVoteCounts, getLeaderboardPollCounts, getLeaderboardPokemonVoteCounts, getLeaderboardPokemonPollCounts 
}