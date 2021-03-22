/**
 * @class Defines a property of a Datastore entity.
 */
class Property {
    /**
     * Instantiates a new Property object.
     * 
     * @constructor
     * @param {string} name The name of the property
     * @param {Function} validator A function to validate a property value
     * @param {boolean} required Whether the property is required for a Datastore entity
     */
    constructor(name, validator, required) {
        this.name = name;
        this.validator = validator;
        this.required = required;
    }
}


/**
 * @class Represents a type of Datastore entity and its required properties
 */
class EntityType {
    /**
     * Instantiates a new EntityType
     * 
     * @constructor
     * @param {string} entityTypeName The name of the entity being defined (used in Datastore keys)
     * @param {number} maxPerPage The maximum number of this entity type to return on a page of results
     * @param {Property[]} createProperties The required and optional properties when creating an entity
     * @param {Property[]} updateProperties The required and optional properties when updating an entity
     * @param {string[]} methodsRequiringCredentials The HTTP methods for which credentials are required
     * when working with this entity type.
     * @param {string[]} imageLocation [optional] The path for accessing the image url if it exists
     * @param {boolean} requiresEmbeddedSelfLinks [optional] Whether this entity needs embedded
     * self links added before sending entity data to client.
     * @param {Function} addEmbeddedSelfLinks [optional] Replaces foreign key IDs with id + self link
     */
    constructor(
        entityTypeName, 
        maxPerPage, 
        createProperties, 
        updateProperties,
        methodsRequiringCredentials,
        imageLocation = null, 
        requiresEmbeddedSelfLinks = false,
        addEmbeddedSelfLinks = null
    ) {
        this.entityTypeName = entityTypeName;
        this.maxPerPage = maxPerPage;
        this.createProperties = createProperties;
        this.updateProperties = updateProperties;
        this.methodsRequiringCredentials = methodsRequiringCredentials;
        this.imageLocation = imageLocation;
        this.requiresEmbeddedSelfLinks = requiresEmbeddedSelfLinks;
        this.addEmbeddedSelfLinks = addEmbeddedSelfLinks;
    }


    /**
     * Validate whether the entity data passed in contains all required properties
     * of the required types (and no extraneous properties)
     * 
     * @param {object} entityData The data of the entity to be added or updated in Datastore
     * @param {Property[]} expectedProperties The required and optional properties for this transaction
     * @return {boolean} Whether the entity data received is valid
     */
    validateProperties(entityData, expectedProperties) {
        /* Accumulator to ensure at least one expected prop was received. */
        let numProps = 0;

        /* Ensure all required properties are included 
         * and all required/optional properties are of the required type. */
        const entityDataKeys = Object.keys(entityData);
        for (const prop of expectedProperties) {
            /* If this property is required and it is not included in the entityData
             * received, return false. */
            const key = prop.name
            if (prop.required === true && entityDataKeys.includes(key) === false) {
                return false;
            }

            /* If this property is included in the entityData received,
             * validate that it meets requirements for that property. */
            if (entityDataKeys.includes(key) === true) {
                numProps++;
                const value = entityData[key];
                if (prop.validator(value) === false) {
                    return false;
                }
            }
        }
        
        /* Validate that at least one required or optional property
         * was included. */
        if (numProps < 1) {
            return false;
        }

        /* Ensure no extra properties are included. */
        for (const key of entityDataKeys) {
            const matchingElements = expectedProperties.filter(
                prop => prop.name === key
            );
            if (matchingElements.length === 0) {
                return false;
            }
        }

        return true;
    }


    /**
     * Gets the path of the image URL (if this entity type has an image)
     * 
     * @return {?string[]} The path for accessing the image URL (null if does not exist)
     */
    getImageLocation() {
        return this.imageLocation;
    }

    /**
     * Verifies whether the HTTP method the client is using requires credentials.
     * 
     * @param {string} method The method the client is using.
     * @return {boolean} Whether that method requires credentials.
     */
    methodRequiresCredentials(method) {
        return this.methodsRequiringCredentials.includes(method);
    }
}


module.exports = {
    "Property": Property,
    "EntityType": EntityType
}
