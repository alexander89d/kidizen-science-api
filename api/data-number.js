const constants = require('./constants');
const ds = require('./datastore');
const an = require('./ancestor');
const Ancestor = an.Ancestor;

/**
 * @class Represents the embedded JSON entity observation.data_number.
 */
class ObservationDataNumber {
    /**
     * Instantiates a new ObservationDataNumber object.
     * 
     * @constructor
     * @param {object} dataNumberJSON The JSON embedded entity containing the observation's data_number.
     * @param {number} dataNumberJSON.quantity How many of the item described were observed.
     * @param {string} dataNumberJSON.description The description of what was observed. 
     * Used by API when the project's data_number.must_be_unique property is set to true.
     */
    constructor(dataNumberJSON) {
        this.quantity = dataNumberJSON.quantity;
        this.description = dataNumberJSON.description;
    }

    /**
     * Determines whether this ObservationDataNumber is equal to another one.
     * 
     * @param {ObservationDataNumber} otherODN The ObservationDataNumber to compare to this one.
     * @return {boolean} Whether the two ObservationDataNumbers are identical.
     */
    deepEquals(otherODN) {
        return this.quantity === otherODN.quantity && this.description === otherODN.description;
    }
}

/**
 * @class Represents the embedded JSON entity project.data_number.
 */
class ProjectDataNumber {
    /**
     * Instantiates a new ProjectDataNumber object.
     * 
     * @constructor
     * @param {object} dataNumberJSON The JSON embedded entity containing the project's data_number info.
     * @param {string} dataNumberJSON.name What the data_number is tracking.
     * @param {number} dataNumberJSON.number The current numeric value of the data_number.
     * @param {boolean} dataNumberJSON.must_be_unique Whether each item type observed 
     * should be counted just once.
     */
    constructor(dataNumberJSON) {
        this.name = dataNumberJSON.name;
        this.number = dataNumberJSON.number;
        this.must_be_unique = dataNumberJSON.must_be_unique;
    }

    /**
     * Adjusts the value of the project's data_number.number property
     * based on the new observation data that has been added.
     * 
     * @param {ObservationDataNumber} newObservationDataNumber The data_number of the observation being
     * added to the project.
     * @param {Set.<string>} otherODNDescriptions [optional] The observation
     * data_number.descriptions associated with all other observations of this project.
     * @return {boolean} Whether the value of the project's data_number.number
     * has been changed.
     */
    addObservation(newObservationDataNumber, otherODNDescriptions = null) {
        /* If this project only counts each unique thing observed once,
         * add 1 to the total number observed only if that item has not already been observed. */
        if(this.must_be_unique === true) {
            if (otherODNDescriptions.has(newObservationDataNumber.description)) {
                return false;
            } else {
                this.number++;
                return true;
            }
        } 
        
        /* Otherwise, since each observation is not required to be unique,
         * simply add the total quantity of what was observed in this new observation. */
        else {
            this.number += newObservationDataNumber.quantity;
            return true;
        }
    }

    /**
     * Adjusts the value of the project's data_number.number property
     * based on the observation data deleted (or replaced).
     * 
     * @param {ObservationDataNumber} oldObservationDataNumber The ObservationDataNumber
     * of the observation being deleted from the project (or replaced).
     * @param {Set.<string>} otherODNDescriptions [optional] The observation
     * data_number.descriptions associated with all other observations of this project.
     * @return {boolean} Whether the value of the project's data_number.number
     * has been changed.
     */
    deleteObservation(oldObservationDataNumber, otherODNDescriptions = null) {
        /* If this project only counts each unique thing observed once,
         * subtract 1 from the total number observed only if that item
         * is included in any other observations. */
        if(this.must_be_unique === true) {
            if (otherODNDescriptions.has(oldObservationDataNumber.description)) {
                return false;
            } else {
                this.number--;
                return true;
            }
        } 
        
        /* Otherwise, since each observation is not required to be unique,
         * simply subtract the total quantity of what was observed from this observation. */
        else {
            this.number -= oldObservationDataNumber.quantity;
            return true;
        }
    }
}


/**
 * Fetches the observation.data_number.descriptions values of all other observations besides
 * the current one being posted, patched, or deleted.
 * 
 * @param {object} transaction The currently-running Datastore transaction.
 * @param {object} projectKey The key of the project whose observation.data_numbers will be fetched
 * from Datastore.
 * @param {string} observationIdToExculde [optional] The ID of the observation whose 
 * data_number.description should be excluded (since transactions are a snapshot of the database
 * before first operation within the transaction is performed, this is used for excluding the
 * observation.data_number.description of the observation being updated or deleted).
 * @return {Promise<?Set.<string>>} The descriptions of the other ObservationDataNumbers
 * associated with this project.
 */
async function getOtherODNDescriptions(transaction, projectKey, observationIdToExculde = null) {
    try {
        /* Get each observation.data_number.description of this project. */
        const query = ds.datastore.createQuery(constants.OBSERVATION);
        query.hasAncestor(projectKey);
        query.select('data_number.description');
        const datastoreResponse = await transaction.runQuery(query);
        const observations = datastoreResponse[0];

        /* Store the data_number.descriptions in a Set so that each unique one occurs only once. */
        const descriptionSet = new Set();
        for (const observation of observations) {
            if (observation[ds.Datastore.KEY].id !== observationIdToExculde) {
                descriptionSet.add(observation['data_number.description']);
            }
        }
        return descriptionSet;
    } catch(err) {
        console.log(err);
        return null;
    }
}


/**
 * Saves the updated project entity to Datastore, reflecting the
 * updated value of project.data_number.number.
 * 
 * @param {object} transaction The currently-running Datastore transaction.
 * @param {object} projectKey The project's Datastore key.
 * @param {object} currentProjectData The current data of the project in Datastore.
 * @param {ProjectDataNumber} newProjectDataNumber The updated project.data_number property.
 * @return {Promise<boolean>} Whether the project update succeeded.
 */
async function saveUpdatedProject(transaction, projectKey, currentProjectData, newProjectDataNumber) {
    try {
        /* Replace currentProjectData.data_number with the new data_number values before saving the updated
         * project to Datastore. */
        currentProjectData.data_number = newProjectDataNumber;
        await transaction.save({"key": projectKey, "data": currentProjectData});
        return true;
    } catch(err) {
        console.log(err);
        return false;
    }
}


/**
 * Updates the project.data_number.number property upon a new observation
 * being posted to Datastore.
 * 
 * @param {object} transaction The current Datastore transaction being run.
 * @param {object} projectData The data of the project associated with this observation.
 * @param {object} observationDataNumberJSON The data_number property of the new observation.
 * @return {Promise<boolean>} Whether the operation was successful.
 */
async function processPostedObservation(transaction, projectData, observationDataNumberJSON) {
    /* Construct data number objects from parameters passed in. */
    const projectKey = projectData[ds.Datastore.KEY];
    const projectDataNumber = new ProjectDataNumber(projectData.data_number);
    const newObservationDataNumber = new ObservationDataNumber(observationDataNumberJSON);
    
    /* If this project requires that each item counted toward data_number.number must be unique,
     * fetch the current observation data numbers counted toward the project's
     * data_number.number property so uniqueness can be checked. */
    let otherODNDescriptions = null;
    if (projectDataNumber.must_be_unique === true) {
        otherODNDescriptions = await getOtherODNDescriptions(transaction, projectKey);
        if (otherODNDescriptions === null) {
            return false;
        }
    }

    /* Adjust the project's data_number.number value based on the new
     * observation data passed in. */
    const projectDataNumberChanged = projectDataNumber.addObservation(
        newObservationDataNumber, otherODNDescriptions
    );
    if (projectDataNumberChanged === true) {
        const succeeded = await saveUpdatedProject(
            transaction, projectKey, projectData, projectDataNumber
        );
        if (!succeeded) {
            return false;
        }
    }

    return true;
}


/**
 * Updates the project.data_number.number property upon an observation
 * being updated in Datastore.
 * 
 * @param {object} transaction The current Datastore transaction being run.
 * @param {Ancestor} ancestorProject The project that is the ancestor of this observation.
 * @param {string} observationId The Datastore ID of the observation being updated.
 * @param {object} oldODN_JSON The observation.data_number before update.
 * @param {object} newODN_JSON The observation.data_number after update.
 * @return {Promise<boolean>} Whether the operation succeeded.
 */
async function processUpdatedObservation(
    transaction, 
    ancestorProject, 
    observationId, 
    oldODN_JSON, 
    newODN_JSON
) {
    const oldODN = new ObservationDataNumber(oldODN_JSON);
    const newODN = new ObservationDataNumber(newODN_JSON);

    /* If the old and new ObservationDataNumbers have identical values,
     * no update is needed. */
    if (newODN.deepEquals(oldODN) === true) {
        return true;
    }

    /* Get the project's current data so that it can be updated. */
    const projectKey = ds.generateAncestorKey(ancestorProject);
    const currentProjectData = await ds.getAncestorData(transaction, projectKey);
    if (!currentProjectData) {
        return false;
    }

    /* If this project requires that each unique thing observed be counted
     * only once, get all other observation's data_number.descriptions to verify
     * uniqueness. */
    const projectDataNumber = new ProjectDataNumber(currentProjectData.data_number);
    let otherODNDescriptions = null;
    if(projectDataNumber.must_be_unique === true) {
        /* If the oldODN and newODN have the same description,
         * there will be no change to the project's data_number.number.
         * Therefore, return true since no further processing is needed. */
        if (oldODN.description === newODN.description) {
            return true;
        }
        
        otherODNDescriptions = await getOtherODNDescriptions(transaction, projectKey, observationId);
        if (otherODNDescriptions === null) {
            return false;
        }
    }

    /* Adjust the project's data_number.number value based on the updates
     * to the observation's data_number. */
    const oldPDNNumber = projectDataNumber.number;
    projectDataNumber.deleteObservation(
        oldODN, otherODNDescriptions
    );
    projectDataNumber.addObservation(
        newODN, otherODNDescriptions
    );
    const newPDNNumber = projectDataNumber.number;
    
    /* If the updates to the observation data number caused the project's data_number.number
     * to change, update the project's data in Datastore. */
    if (oldPDNNumber !== newPDNNumber) {
        const succeeded = await saveUpdatedProject(
            transaction, projectKey, currentProjectData, projectDataNumber
        );
        if (!succeeded) {
            return false;
        }
    }

    return true;
}


/**
 * Updates the project.data_number.number property upon an observation
 * being deleted from Datastore.
 * 
 * @param {object} transaction The current Datastore transaction being run.
 * @param {Ancestor} ancestorProject The project that is the ancestor of this observation.
 * @param {string} observationId The Datastore ID of the observation being updated.
 * @param {object} observationDataNumber_JSON The observation.data_number being deleted.
 * @return {Promise<boolean>} Whether the observation succeeded.
 */
async function processDeletedObservation(
    transaction, 
    ancestorProject, 
    observationId, 
    observationDataNumber_JSON
) {
    const observationDataNumber = new ObservationDataNumber(observationDataNumber_JSON);

    /* Get the project's current data so that it can be updated. */
    const projectKey = ds.generateAncestorKey(ancestorProject);
    const currentProjectData = await ds.getAncestorData(transaction, projectKey);
    if (!currentProjectData) {
        return false;
    }

    /* If this project requires that each unique thing observed be counted
     * only once, get all other observations' data_number.descriptions to verify
     * uniqueness. */
    const projectDataNumber = new ProjectDataNumber(currentProjectData.data_number);
    let otherODNDescriptions = null;
    if(projectDataNumber.must_be_unique === true) {
        otherODNDescriptions = await getOtherODNDescriptions(transaction, projectKey, observationId);
        if (otherODNDescriptions === null) {
            return false;
        }
    }

    /* Adjust the project's data_number.number value based on the new
     * observation data passed in. */
    const projectDataNumberChanged = projectDataNumber.deleteObservation(
        observationDataNumber, otherODNDescriptions
    );
    if (projectDataNumberChanged === true) {
        const succeeded = await saveUpdatedProject(
            transaction, projectKey, currentProjectData, projectDataNumber
        );
        if (!succeeded) {
            return false;
        }
    }

    return true;
}


module.exports = {
    "processPostedObservation": processPostedObservation,
    "processUpdatedObservation": processUpdatedObservation,
    "processDeletedObservation": processDeletedObservation
};
