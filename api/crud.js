const auth = require('./auth');
const constants = require('./constants');
const cloudStorage = require('./storage');
const ds = require('./datastore');
const an = require('./ancestor');
const Ancestor = an.Ancestor;
const sr = require('./server-response');
const ServerResponse = sr.ServerReponse;
const bd = require('./batch-delete');
const dataNumber = require('./data-number');

/**
 * Determines and returns the base URL to which a request was sent.
 * 
 * @param {object} req The request sent from the client
 * @return {string} The base URL to which the request was sent
 */
function getBaseUrl(req) {    
    let hostname = req.hostname;
    
    /* Add the PORT number to hostname if it is 'localhost'
     * since requests to localhost include port number. */
    if (hostname === 'localhost') {
        hostname += ":" + constants.PORT;
    }
    return req.protocol + "://" + hostname;
}


/**
 * Retrieves the entity with the provided specifications from Datastore.
 * 
 * @param {string} baseUrl The base URL to which the request was sent
 * @param {string} collectionName The collection name received in the request URL
 * @param {string} entityId The Datastore-generated id of the entity
 * @param {string} authReceived The "Authorization" header received from the client
 * @param {Ancestor} entityAncestor [optional] The ancestor associated with this entity in Datastore
 * @return {Promise<ServerResponse>} The status code and content to send to the client
 */
async function getEntity(baseUrl, collectionName, entityId, authReceived, entityAncestor = null) {    
    const transaction = ds.datastore.transaction();
    try {
        /* If authorization is required to GET an entity of this type,
         * validate credentials. */
        const entityType = 
            entityAncestor ? 
            constants.COLLECTIONS.children[collectionName] :
            constants.COLLECTIONS.roots[collectionName];
        const entityTypeName = entityType.entityTypeName;

        await transaction.run();

        /* The only entity type which the client can GET which requires authentication is
         * Teacher. Therefore, only verify authentication if Teacher is the entity type. */
        if (entityTypeName === constants.TEACHER) {
            const responseInfo = await auth.validateAuthHeader(
                transaction,
                authReceived,
                entityId
            );
            if (responseInfo !== null) {
                await transaction.rollback();
                return responseInfo;
            }
        }
        
        const datastoreKey = ds.generateDatastoreKey(entityTypeName, entityId, entityAncestor);
        const datastoreResponse = await transaction.get(datastoreKey);
        const entity = datastoreResponse[0];

        await transaction.commit();

        /* If the entity returned is undefined, return 404 not found. */
        if (entity === undefined) {
            return new ServerResponse(
                404,
                {"error": constants.ITEM_NOT_FOUND}
            );
        }

        /* Add id and "self" url to the entity. */
        entity.id = ds.getDatastoreId(entity);
        entity.self = ds.getSelfUrl(baseUrl, collectionName, entityId, entityAncestor);
        
        /* Replace any foreign key ids with objects containing the "id" and "self" link. */
        if (entityType.requiresEmbeddedSelfLinks === true) {
            entityType.addEmbeddedSelfLinks(baseUrl, entity, entityAncestor);
        }

        /* Return 200 OK status code and entity content to client. */
        return new ServerResponse(
            200,
            entity
        );
    } catch(err) {
        await transaction.rollback();
        console.log(err);
        return new ServerResponse(
            500,
            {"error": constants.SERVER_ERROR}
        );
    }
}


/**
 * Gets the entities from the specified collection. Uses pagination.
 * Response includes cursor if there are more results to retrieve. Pass in cursor
 * to next call to continue where this retrieval left off.
 * 
 * @param {string} baseUrl The URL to which this request was sent
 * @param {string} collectionName The collection name received in the request URL
 * @param {string} startCursor [optional] The Datastore cursor at which to start this retrieval
 * @param {Ancestor} entityAncestor [optional] The ancestor of this entity in Datastore
 * @param {string} teacherId [optional] The ID of the teacher by which to filter projects
 * @return {Promise<ServerResponse>} The status code and content to send to the client
 */
async function getEntities(
    baseUrl, 
    collectionName, 
    startCursor = null, 
    entityAncestor = null,
    teacherId = null
) {
    /* Create a read-only transaction so that, if there is an ancestor, entities
     * are only fetched after verifying that ancestor exists. */
    const transaction = ds.datastore.transaction({readOnly: true});
    try {
        await transaction.run();

        /* If the entity has an ancestor, verify that the ancestor exists. */
        let ancestorKey = null;
        if (entityAncestor !== null) {
            ancestorKey = ds.generateAncestorKey(entityAncestor);
            const ancestorData = await ds.getAncestorData(transaction, ancestorKey);
            if (!ancestorData) {
                await transaction.rollback();
                return new ServerResponse(
                    404,
                    {"error": constants.ANCESTOR_NOT_FOUND}
                );
            }
        }
        
        /* If a teacher_id was passed in for filtering projects, verify that the teacer
         * with teacher_id exists, returning 404 Not Found if it does not. */
        if (teacherId !== null) {
            const teacherExists = await ds.teacherExists(transaction, teacherId);
            if (teacherExists === false) {
                return new ServerResponse(
                    404,
                    {"error": constants.TEACHER_NOT_FOUND}
                );
            }
        }

        /* Query Datastore for the specified collection. */
        const entityType = 
            entityAncestor ? 
            constants.COLLECTIONS.children[collectionName] :
            constants.COLLECTIONS.roots[collectionName];
        const query = ds.datastore.createQuery(entityType.entityTypeName);
        query.limit(entityType.maxPerPage);
        
        /* Start from the startCursor if one was specified. */
        if (startCursor !== null) {
            query.start(startCursor);
        }
        
        /* Limit the query to entities with the given ancestor if one is specified. */
        if (entityAncestor !== null) {
            query.hasAncestor(ancestorKey);
        }

        /* Filter the results by the teacher_id if supplied. */
        if (teacherId !== null) {
            query.filter("teacher_id", teacherId);
        }

        /* Try retrieving entities from Datastore. */
        let datastoreResponse;
        try {
            datastoreResponse = await transaction.runQuery(query);
        } catch(err) {
            await transaction.rollback();

            /* If this was a parsing error (due to an invalid cursor since
            * calling function already ensures valid collection), return 403
            * forbidden to indicate invalid cursor. */
            if (err.code === 3) {
                return new ServerResponse(
                    403,
                    {"error": "The start cursor provided is not a valid Datastore cursor."}
                );
            } else {
                console.log(err);
                return new ServerResponse(
                    500,
                    {"error": constants.SERVER_ERROR}
                );
            }
        }

        /* Commit transaction now that query finished successfully. */
        await transaction.commit();
        
        /* Add id and "self" links to each entity before returning. */
        const entities = datastoreResponse[0];
        const info = datastoreResponse[1];
        for (const entity of entities) {
            entity.id = ds.getDatastoreId(entity);
            entity.self = ds.getSelfUrl(baseUrl, collectionName, entity.id, entityAncestor);

            /* Replace any foreign key ids with objects containing the "id" and "self" link. */
            if (entityType.requiresEmbeddedSelfLinks === true) {
                entityType.addEmbeddedSelfLinks(baseUrl, entity, entityAncestor);
            }
        }

        /* Set entities as a property of results, adding a "next" property
        * if Datastore provided an end cursor. */
        const results = {
            "entities": entities
        };
        
        if (info.moreResults !== ds.Datastore.NO_MORE_RESULTS) {
            const endCursor = encodeURIComponent(info.endCursor);
            let nextUrl = baseUrl + "/";
            if (entityAncestor !== null) {
                nextUrl += entityAncestor.collectionName + "/" + entityAncestor.entityId + "/";
            } else if (teacherId !== null) {
                nextUrl += constants.TEACHERS + "/" + teacherId + "/";
            }
            nextUrl += collectionName + "?start=" + endCursor;
            results.next = nextUrl;
        } else {
            results.next = null;
        }

        /* Return 200 OK status and the Datastore results to calling function. */
        return new ServerResponse(
            200,
            results
        );
    } catch(err) {
        await transaction.rollback();
        console.log(err);
        return new ServerResponse(
            500,
            {"error": constants.SERVER_ERROR}
        );
    }
}


/**
 * Posts a new entity of the given type to Datastore with the provided data. Includes ancestors if 
 * entityAncestor is included in arguments.
 * 
 * @param {string} baseUrl The URL to which the client sent this request
 * @param {object} entityData The data of the new entity to create in Datastore
 * @param {string} collectionName The collection name received in the request URL
 * @param {string} authReceived The "Authorization" header received from the client
 * @param {Ancestor} entityAncestor [optional] The ancestor to associate with this entity in Datastore
 * @return {Promise<ServerResponse>} The status code and content to send to the client
 */
async function postEntity(baseUrl, entityData, collectionName, authReceived, entityAncestor = null) {
    /* Create a new transaction so that, if entity has an ancestor,
     * it is only posted if ancestor exists. */
    const transaction = ds.datastore.transaction();
    try {
        /* Validate that the entityData received matches the requirements for
         * creating a new entity for the given collection. */
        const entityType = 
            entityAncestor ? 
            constants.COLLECTIONS.children[collectionName] :
            constants.COLLECTIONS.roots[collectionName];
        const entityTypeName = entityType.entityTypeName;
        if (entityType.validateProperties(entityData, entityType.createProperties) === false) {
            return new ServerResponse(
                400,
                {"error": constants.INVALID_PROPERTIES}
            );
        }
        
        /* Ensure image URL is valid and exists if this entity type has images. */
        const imageUrl = cloudStorage.getImageUrl(entityData, entityType);
        if (imageUrl !== null) {
            const urlIsValid = await cloudStorage.validateImageUrl(imageUrl);
            if (urlIsValid === false) {
                return new ServerResponse(
                    400,
                    {"error": constants.INVALID_IMAGE_URL}
                )
            }
        }

        /* If this entity type is a Teacher, use the default profile photo stored in Cloud Storage. */
        if (entityTypeName === constants.TEACHER) {
            entityData.profile_photo = constants.DEFAULT_PROFILE_PHOTO;
        }

        /* If this entity has an ancestor, verify that its parent entity exists and get parent's data
         * (parent's data is used by certain entity types). */
        await transaction.run();

        let ancestorData = null;
        if (entityAncestor !== null) {
            const ancestorKey = ds.generateAncestorKey(entityAncestor);
            ancestorData = await ds.getAncestorData(transaction, ancestorKey);
            if (!ancestorData) {
                await transaction.rollback();
                return new ServerResponse(
                    404,
                    {"error": constants.ANCESTOR_NOT_FOUND}
                );
            }
        }

        /* If this entity is a project, verify that the teacher with teacher_id exists,
         * returning 404 Not Found if false. */
        if (entityTypeName === constants.PROJECT) {
            const teacherExists = await ds.teacherExists(transaction, entityData.teacher_id);
            if (teacherExists === false) {
                return new ServerResponse(
                    404,
                    {"error": constants.TEACHER_NOT_FOUND}
                );
            }
        }

        /* If this method requires authentication for this entity type,
         * ensure authentication provided is valid. */
        if (entityType.methodRequiresCredentials(constants.POST) === true) {
            /* Get the teacher_id associated with this particular entity. */
            let teacherIdExpected = "";
            if (entityTypeName === constants.PROJECT) {
                teacherIdExpected = entityData.teacher_id;
            } else if (entityTypeName === constants.OBSERVATION) {
                teacherIdExpected = ancestorData.teacher_id;
            }

            /* Validate the credentials provided for the teacherIdExpected. */
            const responseInfo = await auth.validateAuthHeader(
                transaction,
                authReceived,
                teacherIdExpected
            );
            if (responseInfo !== null) {
                await transaction.rollback();
                return responseInfo;
            }
        }

        /* Remove password and secret questions/answers from teacher entity before
         * saving to Datastore. */
        let credentialDataCopy = null;
        if (entityTypeName === constants.TEACHER) {
            credentialDataCopy = new auth.Credential(
                {
                    password: entityData.password,
                    secret_questions: entityData.secret_questions
                },
                false
            );
            delete entityData.password;
            delete entityData.secret_questions;
        }

        /* Add the new entity to Datastore. Its id is null when generating the key
         * because Datastore will automatically generate and fill in the entity id. */
        const datastoreKey = ds.generateDatastoreKey(entityTypeName, null, entityAncestor);
        await transaction.save({"key": datastoreKey, "data": entityData});

        /* If the new entity is an observation, update the data_number property of the
         * corresponding project. */
        if (entityTypeName === constants.OBSERVATION) {
            const succeeded = await dataNumber.processPostedObservation(
                transaction, ancestorData, entityData.data_number
            );
            if (!succeeded) {
                await transaction.rollback();
                return new ServerResponse(
                    500,
                    {"error": constants.SERVER_ERROR}
                );
            }
        }

        /* Commit the transaction now that saving succeeded. */
        await transaction.commit();

        /* If the new entity is a teacher, post their credentials to Datastore. Previous transaction
         * must first be committed in order for teacher_id to be availabe. */
        if (entityTypeName === constants.TEACHER) {
            const succeeded = await auth.postCredential(
                credentialDataCopy,
                datastoreKey.id
            );
            if (!succeeded) {
                return new ServerResponse(
                    500,
                    {"error": constants.SERVER_ERROR}
                );
            }
        }

        /* Return status 201 to indicate successful entity creation and
         * send entity id and self link to client. */
        return new ServerResponse(
            201,
            {
                "id": datastoreKey.id,
                "self": ds.getSelfUrl(baseUrl, collectionName, datastoreKey.id, entityAncestor)
            }
        );
    } catch(err) {
        await transaction.rollback();
        console.log(err);
        return new ServerResponse(
            500,
            {"error": constants.SERVER_ERROR}
        );
    }
}


/**
 * Updates the given entity in Datastore. All fields not included in request body
 * are left unchanged.
 * 
 * @param {string} baseUrl The base URL to which the client sent the request
 * @param {object} entityPatches The specific entity fields to update (all other fields left unchanged)
 * @param {string} collectionName The collection name represented in the request URL
 * @param {string} entityId The id of this entity in Datastore
 * @param {string} authReceived The "Authorization" header received from the client
 * @param {Ancestor} entityAncestor [optional] The ancestor of this entity in Datastore
 * @return {Promise<ServerResponse>} The status code and content to return to the client
 */
async function updateEntity(
    baseUrl, 
    entityPatches, 
    collectionName, 
    entityId,
    authReceived,
    entityAncestor = null
) {
    const transaction = ds.datastore.transaction();
    try {
        /* Validate that the entityData received matches the requirements for
         * updating an entity for the given collection. */
        const entityType = 
            entityAncestor ? 
            constants.COLLECTIONS.children[collectionName] :
            constants.COLLECTIONS.roots[collectionName];
        if (entityType.validateProperties(entityPatches, entityType.updateProperties) === false) {
            return new ServerResponse(
                400,
                {"error": constants.INVALID_UPDATE}
            );
        }

        /* Retrieve the entity's current data from Datastore. */
        const entityTypeName = entityType.entityTypeName;
        const datastoreKey = ds.generateDatastoreKey(entityTypeName, entityId, entityAncestor);
        
        await transaction.run();
        const datastoreResponse = await transaction.get(datastoreKey);
        const entityToUpdate = datastoreResponse[0];

        /* If the entity does not exist, return 404 not found to calling function. */
        if (entityToUpdate === undefined) {
            await transaction.rollback();
            return new ServerResponse(
                404,
                {"error": constants.ITEM_NOT_FOUND}
            );
        }

        /* If this method requires authentication for this entity type,
         * ensure authentication provided is valid. */
        if (entityType.methodRequiresCredentials(constants.PATCH) === true) {
            /* Get the teacher_id associated with this particular entity. */
            let teacherIdExpected = "";
            if (entityTypeName === constants.TEACHER) {
                teacherIdExpected = entityId;
            } else if (entityTypeName === constants.PROJECT) {
                teacherIdExpected = entityToUpdate.teacher_id;
            } else if (entityTypeName === constants.OBSERVATION) {
                teacherIdExpected = await auth.getTeacherOfProject(
                    transaction, 
                    entityAncestor.entityId
                );
                if (teacherIdExpected === null) {
                    await transaction.rollback();
                    return new ServerResponse(
                        500,
                        {"error": constants.SERVER_ERROR}
                    );
                }
            }

            /* Validate the credentials provided for the teacherIdExpected. */
            const responseInfo = await auth.validateAuthHeader(
                transaction,
                authReceived,
                teacherIdExpected
            );
            if (responseInfo !== null) {
                await transaction.rollback();
                return responseInfo;
            }
        }

        /* If the entityPatches contain an image URL and the URL is different than the original
         * URL, ensure that the new image URL is valid, and then delete the old image. */
        const oldImageUrl = cloudStorage.getImageUrl(entityToUpdate, entityType);
        const newImageUrl = cloudStorage.getImageUrl(entityPatches, entityType);
        
        /* If this entity type is a teacher and the profile_photo is set to null,
         * delete the old profile photo (if not the default) and replace it with the default. */
        if (entityTypeName === constants.TEACHER && entityPatches.profile_photo === null) {
            entityPatches.profile_photo = constants.DEFAULT_PROFILE_PHOTO;
            if (oldImageUrl !== constants.DEFAULT_PROFILE_PHOTO) {
                await cloudStorage.deleteImage(oldImageUrl);
            }
        }
        
        /* Otherwise, update the image normally if the URL has changed. */
        else if (newImageUrl !== null && newImageUrl !== oldImageUrl) {
            const urlIsValid = await cloudStorage.validateImageUrl(newImageUrl);
            if (urlIsValid === false) {
                await transaction.rollback();
                return new ServerResponse(
                    400,
                    {"error": constants.INVALID_IMAGE_URL}
                )
            } else if (oldImageUrl !== constants.DEFAULT_PROFILE_PHOTO) {
                await cloudStorage.deleteImage(oldImageUrl);
            }
        }

        /* Update the provided properties of entityPatches in entityToUpdate. */
        const keysToUpdate = Object.keys(entityPatches);
        let oldODN_JSON = null;
        for (const propKey of keysToUpdate) {
            /* If this entity is an observation, save a copy of its old data_number
             * property (if that property is being updated) for use in processing
             * the update to that property below before overwriting that property's values. */
            if (propKey === 'data_number' && entityTypeName === constants.OBSERVATION) {
                oldODN_JSON = {};
                oldODN_JSON.quantity = entityToUpdate.data_number.quantity;
                oldODN_JSON.description = entityToUpdate.data_number.description;
            }
            
            entityToUpdate[propKey] = entityPatches[propKey];
        }

        /* Save the updated entity to Datastore. */
        await transaction.save({"key": datastoreKey, "data": entityToUpdate});

        /* If the entity is an observation and the patches involved an observation.data_number,
         * update the corresponding project.data_number.number accordingly. */
        if (oldODN_JSON !== null) {
            const succeeded = await dataNumber.processUpdatedObservation(
                transaction,
                entityAncestor,
                entityId,
                oldODN_JSON,
                entityPatches.data_number
            );

            if (!succeeded) {
                await transaction.rollback();
                return new ServerResponse(
                    500,
                    {"error": constants.SERVER_ERROR}
                );
            }
        }

        await transaction.commit();

        /* Return status code 200 and the entity's id + "self" url to client. */
        return new ServerResponse(
            200,
            {
                "id": entityId,
                "self": ds.getSelfUrl(baseUrl, collectionName, entityId, entityAncestor)
            }
        );
    } catch(err) {
        await transaction.rollback();
        console.log(err);
        return new ServerResponse(
            500,
            {"error": constants.SERVER_ERROR}
        );
    }
}


/**
 * Deletes the given entity (and any entities bound to it) from Datastore
 * 
 * @param {string} collectionName The name of the collection in the request URL
 * @param {string} entityId The id of this entity in Datastore
 * @param {string} authReceived The "Authorization" header received from the client.
 * @param {Ancestor} entityAncestor [optional] The ancestor of this entity in Datastore
 * @return {Promise<ServerResponse>} The response code and content (if any) to send to the client
 */
async function deleteEntity(collectionName, entityId, authReceived, entityAncestor = null) {
    const transaction = ds.datastore.transaction();
    try {
        /* Retrieve the entity's data from Datastore (since its data must be used in certain cases
         * before deletion). */
        const entityType = 
            entityAncestor ? 
            constants.COLLECTIONS.children[collectionName] :
            constants.COLLECTIONS.roots[collectionName];
        const entityTypeName = entityType.entityTypeName;
        const datastoreKey = ds.generateDatastoreKey(entityTypeName, entityId, entityAncestor);
        
        await transaction.run();
        const datastoreResponse = await transaction.get(datastoreKey);
        const entity = datastoreResponse[0];

        /* If the entity returned is undefined, return 404 not found. */
        if (entity === undefined) {
            await transaction.rollback();
            return new ServerResponse(
                404,
                {"error": constants.ITEM_NOT_FOUND}
            );
        }

        /* If this method requires authentication for this entity type,
         * ensure authentication provided is valid. */
        if (entityType.methodRequiresCredentials(constants.DELETE) === true) {
            /* Get the teacher_id associated with this particular entity. */
            let teacherIdExpected = "";
            if (entityTypeName === constants.TEACHER) {
                teacherIdExpected = entityId;
            } else if (entityTypeName === constants.PROJECT) {
                teacherIdExpected = entity.teacher_id;
            } else if (entityTypeName === constants.OBSERVATION) {
                teacherIdExpected = await auth.getTeacherOfProject(
                    transaction, 
                    entityAncestor.entityId
                );
                if (teacherIdExpected === null) {
                    await transaction.rollback();
                    return new ServerResponse(
                        500,
                        {"error": constants.SERVER_ERROR}
                    );
                }
            }

            /* Validate the credentials provided for the teacherIdExpected. */
            const responseInfo = await auth.validateAuthHeader(
                transaction,
                authReceived,
                teacherIdExpected
            );
            if (responseInfo !== null) {
                await transaction.rollback();
                return responseInfo;
            }
        }

        /* Delete any image associated with this entity. */
        const imageUrl = cloudStorage.getImageUrl(entity, entityType);
        if (imageUrl !== null && imageUrl !== constants.DEFAULT_PROFILE_PHOTO) {
            await cloudStorage.deleteImage(imageUrl);
        }

        /* If this entity is a Project, delete all associated Observations. */
        if (entityTypeName === constants.PROJECT) {
            await bd.deleteObservationsOfProject(transaction, datastoreKey);
        }

        /* If this entity is a Teacher, delete all associated Projects
         * (which will, in turn, delete all associated observations) as well
         * as the teacher's credentials. */
        else if (entityTypeName === constants.TEACHER) {
            await bd.deleteProjectsOfTeacher(transaction, entityId);
            await auth.deleteCredential(transaction, entityId);
        }

        /* Delete the entity from Datastore and return 204 no content to
         * client to indicate success. */
        await transaction.delete(datastoreKey);
        
        if (entityTypeName === constants.OBSERVATION) {
            const succeeded = await dataNumber.processDeletedObservation(
                transaction,
                entityAncestor,
                entityId,
                entity.data_number
            )

            if (!succeeded) {
                await transaction.rollback();
                return new ServerResponse(
                    500,
                    {"error": constants.SERVER_ERROR}
                );
            }
        }

        await transaction.commit();
        return new ServerResponse(204);
    } catch(err) {
        await transaction.rollback();
        console.log(err);
        return new ServerResponse(
            500,
            {"error": constants.SERVER_ERROR}
        );
    }
}


module.exports = {
    "getBaseUrl": getBaseUrl,
    "getEntity": getEntity,
    "getEntities": getEntities,
    "postEntity": postEntity,
    "updateEntity": updateEntity,
    "deleteEntity": deleteEntity
};
