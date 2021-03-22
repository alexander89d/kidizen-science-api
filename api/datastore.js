const {Datastore} = require('@google-cloud/datastore');
const datastore = new Datastore();
 
/**
 * Creates a Datastore key in the correct format based on the arguments received.
 * 
 * @param {string} entityTypeName The type name of the entity to add (used for creating Datastore keys)
 * @param {string} entityId [optional] Datastore id of the entity (null if creating new entity)
 * @param {Ancestor} ancestor [optional] The ancestor to associate with this entity in Datastore
 * @return {object} the generated Datastore key
 */
function generateDatastoreKey(entityTypeName, entityId = null, ancestor = null) {
    /* Determine Datastore key path. Key path will end with entityTypeName
     * (followed by entityId if not null) for the specific entity being referenced. */
    const keyPath = [];
    if (ancestor !== null) {
        /* Add the type name followed by the id (converted to number) of the ancestor
         * to keyPath. */
        keyPath.push(ancestor.getEntityTypeName());
        keyPath.push(parseInt(ancestor.entityId, 10));
    }
    
    /* Add the entityTypeName and entityId (if it exists) for the entiy being referenced. */
    keyPath.push(entityTypeName);
    if (entityId !== null) {
        keyPath.push(parseInt(entityId, 10));
    }

    return datastore.key(keyPath);
}


/**
 * Creates a Datastore ancestor key in the correct format based on the arguments received.
 * Used when limiting a kind query to a specific ancestor.
 * 
 * @param {Ancestor} ancestor The ancestor entity for which to generate a Datastore key
 * @return {object} the generated Datastore ancestor key
 */
function generateAncestorKey(ancestor) {
    return datastore.key([ancestor.getEntityTypeName(), parseInt(ancestor.entityId, 10)]);
}


/**
 * Extracts the Datastore id from an entity's Datastore key.
 * 
 * @param {object} entity The Datastore entity from which to extract the id.
 * @return {string} the id of the entity in Datastore
 */
function getDatastoreId(entity){
    return entity[Datastore.KEY].id;
}


/**
 * Generate and return the "self" url for a Datastore entity.
 * 
 * @param {string} baseUrl The url to which this request was sent
 * @param {string} collectionName The name of the collection to which this entity belongs
 * @param {string} entityId The id of this entity in Datastore
 * @param {Ancestor} ancestor [optional] The Datastore ancestor of this entity
 * @return {string} The self url of the entity
 */
function getSelfUrl(baseUrl, collectionName, entityId, ancestor = null) {
    let self = baseUrl + "/";
    if (ancestor !== null) {
        self += ancestor.collectionName + "/" + ancestor.entityId + "/"
    }
    self += collectionName + "/" + entityId;

    return self;
}


/**
 * Determines whether the id string passed in by the user is a valid
 * positive integer.
 * 
 * @param {string} id The datastore id passed in by the client
 * @return Whether the id string represents a valid positive integer
 */
function isValidId(id) {
    for (const char of id) {
        if (char < '0' || char > '9') {
            return false;
        }
    }
    return true;
}


/**
 * Fetches the given ancestor entity from Datastore.
 * 
 * @param {object} transaction The current Datastore transaction being run
 * @param {object} key The key of the object for which to search Datastore
 * @return {Promise<?object>} The ancestor entity's data (null if it does not exist)
 */
async function getAncestorData(transaction, key) {
    try {
        const entities = await transaction.get(key);
        const entity = entities[0];
        if (entity === undefined) {
            return null;
        } else {
            return entity;
        }
    } catch(err) {
        console.log(err);
        return null;
    }
}


/**
 * Verifies whether a teacher with the given id exists in Datastore.
 * 
 * @param {object} transaction The current Datastore transaction being run.
 * @param {string} id The teacher's Datastore id.
 * @return {Promise<boolean>} Whether the teacher exists in Datastore.
 */
async function teacherExists(transaction, id) {
    try {
        const datastoreKey = datastore.key(["Teacher", parseInt(id, 10)]);
        const datastoreResponse = await transaction.get(datastoreKey)
        const entity = datastoreResponse[0];
        if (entity === undefined) {
            return false;
        } else {
            return true;
        }
    } catch(err) {
        console.log(err);
        return false;
    }
}


module.exports = {
    "Datastore": Datastore,
    "datastore": datastore,
    "getDatastoreId": getDatastoreId,
    "generateDatastoreKey": generateDatastoreKey,
    "generateAncestorKey": generateAncestorKey,
    "getSelfUrl": getSelfUrl,
    "isValidId": isValidId,
    "getAncestorData": getAncestorData,
    "teacherExists": teacherExists
};
