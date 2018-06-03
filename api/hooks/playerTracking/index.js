const sevenDays = require('machinepack-7daystodiewebapi');

/**
 * playerTracking hook
 *
 * @description :: A hook definition.  Extends Sails by adding shadow routes, implicit actions, and/or initialization logic.
 * @docs        :: https://sailsjs.com/docs/concepts/extending-sails/hooks
 */

module.exports = function definePlayerTrackingHook(sails) {

  return {

    /**
     * Runs when a Sails app loads/lifts.
     *
     * @param {Function} done
     */
    initialize: function (done) {

      sails.log.info('Initializing custom hook (`playerTracking`)');
      return done();

    },

    start(serverId) {

      let loggingObject = sails.hooks.sdtdlogs.getLoggingObject(serverId);

      if (_.isUndefined(loggingObject)) {
        sails.log.warn(`Tried to start logging for a server without a loggingObject`, { server: serverId });
        return
      }

      loggingObject.on('memUpdate', async (memUpdate) => {
        let server = await SdtdServer.findOne(memUpdate.server).populate('config');

        try {
          await basicTracking(server, loggingObject);
        } catch (error) {
          sails.log.error(error)
        }

        if (server.config[0].locationTracking || server.config[0].inventoryTracking) {
          // If inventory OR location tracking is enabled, we prepare the tracking info beforehand to improve performance
          let playerList = await getPlayerList(server);

          let initialValues = new Array();
          let playerRecords = new Array();

          for (const onlinePlayer of playerList) {
            let playerRecord = await Player.findOne({ server: server.id, steamId: onlinePlayer.steamid });
            if (playerRecord) {
              playerRecords.push(playerRecord)
              initialValues.push({ server: server.id, player: playerRecord.id })
            }
          }

          let createdRecords = await TrackingInfo.createEach(initialValues).fetch();


          if (server.config[0].locationTracking) {

            try {
              await locationTracking(server, loggingObject, playerList, createdRecords, playerRecords);
            } catch (error) {
              sails.log.error(error)
            }
          }
        }
      })

    },

  };


  async function basicTracking(server, loggingObject) {
    let stats = await sails.helpers.sdtd.loadPlayerStats(server.id);

    for (const playerStats of stats) {
      if (playerStats.steamId) {
        sails.log.verbose(`Received stats - Performing basic tracking for a player`, playerStats)
        // Load the current player data
        let player = await Player.findOne({ server: server.id, steamId: playerStats.steamId });
        // Update with the new data
        await Player.update(player.id, playerStats);

        // Detect if player killed any zombies
        if (player.zombieKills < playerStats.zombieKills && player.zombieKills !== 0) {
          let zombiesKilled = playerStats.zombieKills - player.zombieKills;
          sails.log.debug(`Detected a zombie kill! ${player.name} of server ${server.name} has killed ${playerStats.zombieKills} zombies in total. - Detected ${zombiesKilled} kills`);
          player.zombiesKilled = zombiesKilled;
          loggingObject.emit('zombieKill', player);
        }

        // Detect if player killed any players
        if (player.playerKills < playerStats.playerKills && player.playerKills !== 0) {
          let playersKilled = playerStats.playerKills - player.playerKills;
          sails.log.debug(`Detected a player kill! ${player.name} of server ${server.name} has killed ${playerStats.playerKills} players in total. - Detected ${playersKilled} kills`);
          player.playersKilled = playersKilled;
          loggingObject.emit('playerKill', player);
        }

        // Detect if player leveled up
        if (player.level < playerStats.level && player.level !== 0) {
          let levels = playerStats.level - player.level;
          sails.log.debug(`Detected a level up! ${player.name} of server ${server.name} has leveled up to ${playerStats.level}. - Detected ${levels} levels`);
          player.levels = levels;
          loggingObject.emit('levelup', player);
        }

        // Detect if player gained score
        if (player.score < playerStats.score && player.score !== 0) {
          let scoreGained = playerStats.score - player.score;
          player.scoreGained = scoreGained;
          loggingObject.emit('score', player);
        }
      }
    }

    return
  }

  async function locationTracking(server, loggingObject, playerList, createdTrackingRecords, playerRecords) {

    for (const onlinePlayer of playerList) {
      let playerRecord = playerRecords.filter(player => onlinePlayer.steamid === player.steamId);

      if (!_.isUndefined(playerRecord)) {
        let trackingRecord = createdTrackingRecords.filter(record => record.player === playerRecord.id);

        if (!trackingRecord.length > 1) {

          await TrackingInfo.update(trackingRecord[0].id, {
            x: onlinePlayer.position.x,
            y: onlinePlayer.position.y,
            z: onlinePlayer.position.z
          })
        }


      }

    }
  }

};


function getPlayerList(server) {
  return new Promise((resolve, reject) => {
    sevenDays.getPlayerList({
      ip: server.ip,
      port: server.webPort,
      authName: server.authName,
      authToken: server.authToken
    }).exec({
      success: (data) => {
        let playersToSend = data.players.filter(player => player.online)
        resolve(playersToSend)
      },
      error: (error) => {
        sails.log.warn(`Error getting playerlist for tracking - ${error}`);
        resolve([])
      }
    })
  })

}