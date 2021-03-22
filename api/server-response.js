/**
 * @class Represents a server's response, including a status code and response content.
 */
class ServerResponse {
    /**
     * Instantiates a new ServerReponse object.
     * 
     * @param {number} status The status code to send to the client
     * @param {object} content [optional] The JSON content to send to the client
     */
    constructor(status, content = null) {
        this.status = status;
        this.content = content;
    }
}

module.exports = {
    "ServerReponse": ServerResponse
}