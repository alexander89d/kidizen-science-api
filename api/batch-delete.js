const constants = require('./constants');
const ds = require('./datastore');
const storage = require('./storage');


/**
 * Deletes the observations of the given project from Datastore.
 * 
 * @param {object} transaction The current Datastore transaction being run.
 * @param {object} projectKey The key of the project being deleted from Datastore.
 * @return {Promise<boolean>} Whether the observations were deleted successfully.
 */
async function deleteObservationsOfProject(transaction, projectKey) {
    try {
        /* Get all observations belonging to this project, using their URLs
         * to delete their images and keys to delete the observations
         * themselves. */
        const query = ds.datastore.createQuery(constants.OBSERVATION);
        query.select(['__key__', 'data_image.url']);
        query.hasAncestor(projectKey);
        const datastoreResponse = await transaction.runQuery(query);
        const observations = datastoreResponse[0];

        /* Delete the image associated with each observation,
         * and store keys in array for batch deletion of observations. */
        const observationKeys = [];
        for (const observation of observations) {
            await storage.deleteImage(observation['data_image.url']);
            observationKeys.push(observation[ds.Datastore.KEY]);
        }

        /* Delete the observations. */
        await transaction.delete(observationKeys);
        return true;
    } catch(err) {
        console.log(err);
        return false;
    }
}


/**
 * Deletes all projects associated with the given teacher (as well as all observations
 * associated with those projects).
 * 
 * @param {object} transaction The current Datastore transaction that is running.
 * @param {string} teacherId The Datastore ID of the teacher whose projects should be deleted.
 * @return {Promise<boolean>} Whether the operation was successful.
 */
async function deleteProjectsOfTeacher(transaction, teacherId) {
    try {
        /* Get all projects belonging to this teacher, using their URLs
         * to delete their images and keys to delete the projects themselves. */
        const query = ds.datastore.createQuery(constants.PROJECT);
        query.select(['__key__', 'description_image.url']);
        query.filter("teacher_id", teacherId);
        const datastoreResponse = await transaction.runQuery(query);
        const projects = datastoreResponse[0];

        /* Delete the image associated with each project, delete the observations of
         * each project, and store keys in array for batch deletion of observations. */
        const projectKeys = [];
        for (const project of projects) {
            await storage.deleteImage(project['description_image.url']);
            const projectKey = project[ds.Datastore.KEY];
            projectKeys.push(projectKey);
            await deleteObservationsOfProject(transaction, projectKey);
        }

        /* Delete the projects themselves. */
        await transaction.delete(projectKeys);
        return true;
    } catch(err) {
        console.log(err);
        return false;
    }
}

module.exports = {
    "deleteObservationsOfProject": deleteObservationsOfProject,
    "deleteProjectsOfTeacher": deleteProjectsOfTeacher
};
