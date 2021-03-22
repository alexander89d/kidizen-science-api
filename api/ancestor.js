const constants = require('./constants');

/**
 * @class Represents the collectionName and entityId of an ancestor entity
 */
class Ancestor {
    /**
     * Instantiates a new Ancestor object.
     * 
     * @param {string} collectionName The collection name received in the request URL
     * @param {string} entityId The id of this entity in Datastore
     */
    constructor(collectionName, entityId) {
        this.collectionName = collectionName;
        this.entityId = entityId;
    }

    /**
     * Returns the Datastore entity type name based on the collection name.
     * @return {string} The name of this entity type in Datastore
     */
    getEntityTypeName() {
        return constants.COLLECTIONS.roots[this.collectionName].entityTypeName;
    }
}

module.exports = {
    "Ancestor": Ancestor
};
