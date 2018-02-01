module.exports = {


  friendlyName: 'Update connection info',


  description: 'Update ip, port, authname and/or authtoken for a sdtdServer',


  inputs: {
    serverId: {
      required: true,
      type: 'string'
    },
    serverIp: {
      description: 'Ip of the SdtdServer',
      type: 'string',
    },

    webPort: {
      type: 'number',
    },

    authName: {
      type: 'string',
    },

    authToken: {
      type: 'string',
    }
  },


  exits: {

    notFound: {
      description: 'Server with given ID not found in the system',
      responseType: 'notFound'
    },
    success: {}

  },

  /**
   * @memberof SdtdServer
   * @name update-connection-info
   * @method
   * @description Updates basic connection info for a server in the DB
   * @param {string} serverId
   * @param {string} serverIp
   * @param {number} webPort
   * @param {string} authName
   * @param {string} authToken
   */


  fn: async function (inputs, exits) {

    try {
      sails.log.debug(`API - SdtdServer:update-connection-info - Updating connection info for server ${inputs.serverId}`);

      let server = await SdtdServer.findOne(inputs.serverId)

      let ip = ('' == inputs.serverIp) ? server.ip : inputs.serverIp;
      let webPort = ('' == inputs.webPort) ? server.webPort : inputs.webPort;
      let authName = ('' == inputs.authName) ? server.authName : inputs.authName;
      let authToken = ('' == inputs.authToken) ? server.authToken : inputs.authToken;

      await SdtdServer.update({
        id: inputs.serverId
      }, {
        ip: ip,
        webPort: webPort,
        authName: authName,
        authToken: authToken
      })

    sails.hooks.sdtdlogs.stop(inputs.serverId);
    sails.hooks.sdtdlogs.start(inputs.serverId);

      return exits.success()
    } catch (error) {
      sails.log.error(`API - SdtdServer:update-connection-info - ${error}`);
      return exits.error(error)
    }


  }


};