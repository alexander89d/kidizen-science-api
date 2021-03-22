"use strict";

/* Create Express app. */
const express = require('express');
const app = express();

/* Import custom constants. */
const constants = require('./constants');

/* Import functions for generic CRUD functionality not bound to just one entity type. */
const crud = require('./crud');

/* Import Ancestor class. */
const an = require('./ancestor');

/* Import authorization functionality. */
const auth = require('./auth');

/* Import Datastore functionality. */
const ds = require('./datastore');

/* Import Cloud Storage functionality. */
const cloudStorage = require('./storage');

/* Enable Multer for handling image file uploads, limiting file size to 10 MB. */
const Multer = require('multer');
const multer = Multer({
    storage: Multer.memoryStorage(),
    limits: {
        fileSize: 10 * 1024 * 1024
    }
});

/* Enable body-parser. */
const bodyParser = require('body-parser');
app.use(bodyParser.json());

/* Enable trust proxy since the deployed app uses a proxy. */
app.enable('trust proxy');


/* Return 405 Method Not Allowed if client tries to get all teachers. */
app.get('/teachers', function(req, res) {
    res.set("Allow", constants.POST);
    res.status(405).end();
});

/* Return 405 Method Not Allowed if client tries to post a credential. */
app.post('/teachers/:teacherId/credentials', function(req, res) {
    res.set("Allow", `${constants.GET}, ${constants.PUT}, ${constants.PATCH}`);
    res.status(405).end();
});

/* Return 405 Method Not Allowed if client tries to delete a credential. */
app.delete('/teachers/:teacherId/credentials', function(req, res) {
    res.set("Allow", `${constants.GET}, ${constants.PUT}, ${constants.PATCH}`);
    res.status(405).end();
});


/* Gets a teacher's secret questions (without answers) and a temporary reset code
 * so they can reset a forgotten password. */
app.get('/teachers/:teacherId/credentials', function(req, res) {
    const teacherId = req.params.teacherId;
    if (ds.isValidId(teacherId) === false) {
        res.status(400).json({
            "error": constants.INVALID_ID
        });
    } else {
        auth.getCredentialResetChallenge(teacherId).then(responseInfo => {
            res.status(responseInfo.status).json(responseInfo.content);
        });
    }
});

/* ALlows teachers to reset an unknown password using secret questions / answers
 * and a reset_code. */
app.put('/teachers/:teacherId/credentials', function(req, res) {
    const teacherId = req.params.teacherId;
    const contentTypeHeader = req.get(constants.CONTENT_TYPE_HEADER);
    if (ds.isValidId(teacherId) === false) {
        res.status(400).json({
            "error": constants.INVALID_ID
        });
    } else if (contentTypeHeader.includes(constants.JSON_MIME_TYPE) === false) {
        res.status(415).json({
            "error": `This endpoint only accepts content of type ${constants.JSON_MIME_TYPE}`
        }); 
    } else {
        const authReceived = req.get("Authorization");
        auth.resetUnkownPassword(req.body, teacherId, authReceived).then(responseInfo => {
            if (responseInfo.status === 401) {
                res.set(
                    'WWW-Authenticate', 
                    'Basic realm="Access to protected endpoints (see API spec)"'
                );
            }
            if (Object.keys(responseInfo).includes('content') === true) {
                res.status(responseInfo.status).json(responseInfo.content);
            } else {
                res.status(responseInfo.status).end();
            }
        });
    }
});

/* Allows updating of teacher password / secret_questions if password is known. */
app.patch('/teachers/:teacherId/credentials', function(req, res) {
    const teacherId = req.params.teacherId;
    const contentTypeHeader = req.get(constants.CONTENT_TYPE_HEADER);
    if (ds.isValidId(teacherId) === false) {
        res.status(400).json({
            "error": constants.INVALID_ID
        });
    } else if (contentTypeHeader.includes(constants.JSON_MIME_TYPE) === false) {
        res.status(415).json({
            "error": `This endpoint only accepts content of type ${constants.JSON_MIME_TYPE}`
        }); 
    } else {
        const authReceived = req.get("Authorization");
        auth.updateCredentialPasswordKnown(req.body, teacherId, authReceived).then(responseInfo => {
            if (responseInfo.status === 401) {
                res.set(
                    'WWW-Authenticate', 
                    'Basic realm="Access to protected endpoints (see API spec)"'
                );
            }
            if (Object.keys(responseInfo).includes('content') === true) {
                res.status(responseInfo.status).json(responseInfo.content);
            } else {
                res.status(responseInfo.status).end();
            }
        });
    }
});

/* Gets the root entity with the given id from Datastore. */
app.get('/:collectionName/:entityId', function(req, res) {
    const collectionName = req.params.collectionName;
    const entityId = req.params.entityId;
    const possibleCollections = Object.keys(constants.COLLECTIONS.roots);
    if (possibleCollections.includes(collectionName) === false) {
        res.status(404).json({
            "error": constants.NO_SUCH_COLLECTION
        });
    } else if (ds.isValidId(entityId) === false) {
        res.status(400).json({
            "error": constants.INVALID_ID
        });
    } else {
        const baseUrl = crud.getBaseUrl(req);
        const authReceived = req.get("Authorization");
        crud.getEntity(baseUrl, collectionName, entityId, authReceived).then(responseInfo => {
            if (responseInfo.status === 401) {
                res.set(
                    'WWW-Authenticate', 
                    'Basic realm="Access to protected endpoints (see API spec)"'
                );
            }
            res.status(responseInfo.status).json(responseInfo.content);
        });
    }
});

/* Gets the given child of a root entity from Datastore. */
app.get('/:ancestorCollection/:ancestorId/:childCollection/:childId', function(req, res) {
    const ancestorCollection = req.params.ancestorCollection;
    const ancestorId = req.params.ancestorId;
    const childCollection = req.params.childCollection;
    const childId = req.params.childId;
    const possibleAncestors = constants.COLLECTIONS.roots;
    const possibleChildren = constants.COLLECTIONS.children;
    if (
        Object.keys(possibleAncestors).includes(ancestorCollection) == false
        || Object.keys(possibleChildren).includes(childCollection) == false
    ) {
        res.status(404).json({
            "error": constants.NO_SUCH_COLLECTION
        });
    } else if (ds.isValidId(ancestorId) === false || ds.isValidId(childId) === false) {
        res.status(400).json({
            "error": constants.INVALID_ID
        });
    } else {
        const baseUrl = crud.getBaseUrl(req);
        const ancestor = new an.Ancestor(ancestorCollection, ancestorId);
        const authReceived = req.get("Authorization");
        crud.getEntity(baseUrl, childCollection, childId, authReceived, ancestor).then(responseInfo => {
            if (responseInfo.status === 401) {
                res.set(
                    'WWW-Authenticate', 
                    'Basic realm="Access to protected endpoints (see API spec)"'
                );
            }
            res.status(responseInfo.status).json(responseInfo.content);
        });
    }
});

/* Gets a list of entities of the given root collection. Uses pagination. 
 * If there are more entities to fetch from the collection, a "next" link will
 * be included in the response. Send the next GET request to that "next" link
 * to continue where the previous one left off. */
app.get('/:collectionName', function (req, res) {
    const collectionName = req.params.collectionName;
    const possibleCollections = Object.keys(constants.COLLECTIONS.roots);
    if (possibleCollections.includes(collectionName) === false) {
        res.status(404).json({
            "error": constants.NO_SUCH_COLLECTION
        });
    } else {
        const baseUrl = crud.getBaseUrl(req);
        let startCursor = null;
        if (Object.keys(req.query).includes('start') === true) {
            startCursor = decodeURIComponent(req.query.start);
        }
        crud.getEntities(baseUrl, collectionName, startCursor).then(responseInfo => {
            res.status(responseInfo.status).json(responseInfo.content);
        });
    }
});

/* Gets all projects of the given teacher. Uses pagination. 
 * If there are more entities to fetch from the collection, a "next" link will
 * be included in the response. Send the next GET request to that "next" link
 * to continue where the previous one left off. */
app.get('/teachers/:teacherId/projects', function(req, res) {
    const teacherId = req.params.teacherId;
    if (ds.isValidId(teacherId) === false) {
        res.status(400).json({
            "error": constants.INVALID_ID
        });
    } else {
        const baseUrl = crud.getBaseUrl(req);
        let startCursor = null;
        if (Object.keys(req.query).includes('start') === true) {
            startCursor = decodeURIComponent(req.query.start);
        }
        crud.getEntities(
            baseUrl, 
            constants.PROJECTS, 
            startCursor, 
            null, 
            teacherId
        ).then(responseInfo => {
            res.status(responseInfo.status).json(responseInfo.content);
        });
    }
});

/* Gets a list of entities of the child of a root collection. Uses pagination. 
 * If there are more entities to fetch from the collection, a "next" link will
 * be included in the response. Send the next GET request to that "next" link
 * to continue where the previous one left off. */
app.get('/:ancestorCollection/:ancestorId/:childCollection', function(req, res) {
    const ancestorCollection = req.params.ancestorCollection;
    const ancestorId = req.params.ancestorId;
    const childCollection = req.params.childCollection;
    const possibleAncestors = constants.COLLECTIONS.roots;
    const possibleChildren = constants.COLLECTIONS.children;
    if (
        Object.keys(possibleAncestors).includes(ancestorCollection) == false
        || Object.keys(possibleChildren).includes(childCollection) == false
    ) {
        res.status(404).json({
            "error": constants.NO_SUCH_COLLECTION
        });
    } else if (ds.isValidId(ancestorId) === false) {
        res.status(400).json({
            "error": constants.INVALID_ID
        });
    } else {
        const baseUrl = crud.getBaseUrl(req);
        const ancestor = new an.Ancestor(ancestorCollection, ancestorId);
        let startCursor = null;
        if (Object.keys(req.query).includes('start') === true) {
            startCursor = decodeURIComponent(req.query.start);
        }
        crud.getEntities(baseUrl, childCollection, startCursor, ancestor).then(responseInfo => {
            res.status(responseInfo.status).json(responseInfo.content);
        });
    }
});

/* Adds the uploaded file to Cloud Datastore and returns image's public URL on success. */
app.post('/images', multer.single('image'), function(req, res) {
    const contentTypeHeader = req.get(constants.CONTENT_TYPE_HEADER);
    if (contentTypeHeader.includes(constants.FORM_DATA_MIME_TYPE) === false) {
        res.status(415).json({
            "error": `This endpoint only accepts content of type ${constants.FORM_DATA_MIME_TYPE}`
        });
    }
    else if (!req.file) {
        res.status(400).json({
            "error": "No image has been uploaded."
        });
    } else if (constants.IMAGE_MIME_TYPES_ALLOWED.includes(req.file.mimetype) === false) {
        res.status(400).json({
            "error": constants.IMAGE_FORMAT_ERROR
        });
    } else {
        const authReceived = req.get("Authorization");
        cloudStorage.postImage(req.file, authReceived).then(responseInfo => {
            if (responseInfo.status === 401) {
                res.set(
                    'WWW-Authenticate',
                    'Basic realm="Access to protected endpoints (see API spec)"'
                );
            }
            res.status(responseInfo.status).json(responseInfo.content);
        });
    }
});

/* Posts the entity of the given type to Datastore as a root with no ancestors. */
app.post('/:collectionName', function(req, res) {
    const collectionName = req.params.collectionName;
    const possibleCollections = Object.keys(constants.COLLECTIONS.roots);
    const contentTypeHeader = req.get(constants.CONTENT_TYPE_HEADER);
    if (possibleCollections.includes(collectionName) === false) {
        res.status(404).json({
            "error": constants.NO_SUCH_COLLECTION
        });
    } else if (contentTypeHeader.includes(constants.JSON_MIME_TYPE) === false) {
        res.status(415).json({
            "error": `This endpoint only accepts content of type ${constants.JSON_MIME_TYPE}`
        });
    } else {
        const baseUrl = crud.getBaseUrl(req);
        const authReceived = req.get("Authorization");
        crud.postEntity(baseUrl, req.body, collectionName, authReceived).then(responseInfo => {
            if (responseInfo.status === 401) {
                res.set(
                    'WWW-Authenticate', 
                    'Basic realm="Access to protected endpoints (see API spec)"'
                );
            }
            res.status(responseInfo.status).json(responseInfo.content);
        });
    }
});

/* Posts the given child of a root-level entity to Datastore. */
app.post('/:ancestorCollection/:ancestorId/:childCollection', function(req, res) {
    const ancestorCollection = req.params.ancestorCollection;
    const ancestorId = req.params.ancestorId;
    const childCollection = req.params.childCollection;
    const possibleAncestors = constants.COLLECTIONS.roots;
    const possibleChildren = constants.COLLECTIONS.children;
    const contentTypeHeader = req.get(constants.CONTENT_TYPE_HEADER);
    if (
        Object.keys(possibleAncestors).includes(ancestorCollection) == false
        || Object.keys(possibleChildren).includes(childCollection) == false
    ) {
        res.status(404).json({
            "error": constants.NO_SUCH_COLLECTION
        });
    } else if (ds.isValidId(ancestorId) === false) {
        res.status(400).json({
            "error": constants.INVALID_ID
        });
    } else if (contentTypeHeader !== constants.JSON_MIME_TYPE) {
        res.status(415).json({
            "error": `This endpoint only accepts content of type ${constants.JSON_MIME_TYPE}`
        });
    } else {
        const baseUrl = crud.getBaseUrl(req);
        const authReceived = req.get("Authorization");
        const ancestor = new an.Ancestor(ancestorCollection, ancestorId);
        crud.postEntity(
            baseUrl, 
            req.body, 
            childCollection, 
            authReceived, 
            ancestor
        ).then(responseInfo => {
            if (responseInfo.status === 401) {
                res.set(
                    'WWW-Authenticate', 
                    'Basic realm="Access to protected endpoints (see API spec)"'
                );
            }
            res.status(responseInfo.status).json(responseInfo.content);
        });
    }
});

/* Updates the given root-level entity in Datastore. */
app.patch('/:collectionName/:entityId', function(req, res) {
    const collectionName = req.params.collectionName;
    const entityId = req.params.entityId;
    const possibleCollections = Object.keys(constants.COLLECTIONS.roots);
    const contentTypeHeader = req.get(constants.CONTENT_TYPE_HEADER);
    if (possibleCollections.includes(collectionName) === false) {
        res.status(404).json({
            "error": constants.NO_SUCH_COLLECTION
        });
    } else if (ds.isValidId(entityId) === false) {
        res.status(400).json({
            "error": constants.INVALID_ID
        });
    } else if (contentTypeHeader.includes(constants.JSON_MIME_TYPE) === false) {
        res.status(415).json({
            "error": `This endpoint only accepts content of type ${constants.JSON_MIME_TYPE}`
        });
    } else {
        const baseUrl = crud.getBaseUrl(req);
        const authReceived = req.get("Authorization");
        crud.updateEntity(
            baseUrl, 
            req.body, 
            collectionName, 
            entityId,
            authReceived
        ).then(responseInfo => {
            if (responseInfo.status === 401) {
                res.set(
                    'WWW-Authenticate', 
                    'Basic realm="Access to protected endpoints (see API spec)"'
                );
            }
            res.status(responseInfo.status).json(responseInfo.content);
        });
    }
});

/* Updates the given child of a root entity in Datastore. */
app.patch('/:ancestorCollection/:ancestorId/:childCollection/:childId', function(req, res) {
    const ancestorCollection = req.params.ancestorCollection;
    const ancestorId = req.params.ancestorId;
    const childCollection = req.params.childCollection;
    const childId = req.params.childId;
    const contentTypeHeader = req.get(constants.CONTENT_TYPE_HEADER);
    const possibleAncestors = constants.COLLECTIONS.roots;
    const possibleChildren = constants.COLLECTIONS.children;
    if (
        Object.keys(possibleAncestors).includes(ancestorCollection) == false
        || Object.keys(possibleChildren).includes(childCollection) == false
    ) {
        res.status(404).json({
            "error": constants.NO_SUCH_COLLECTION
        });
    } else if (ds.isValidId(ancestorId) === false || ds.isValidId(childId) === false) {
        res.status(400).json({
            "error": constants.INVALID_ID
        });
    } else if (contentTypeHeader.includes(constants.JSON_MIME_TYPE) === false) {
        res.status(415).json({
            "error": `This endpoint only accepts content of type ${constants.JSON_MIME_TYPE}`
        });
    } else {
        const baseUrl = crud.getBaseUrl(req);
        const authReceived = req.get("Authorization");
        const ancestor = new an.Ancestor(ancestorCollection, ancestorId);
        crud.updateEntity(
            baseUrl,
            req.body,
            childCollection,
            childId,
            authReceived,
            ancestor
        ).then(responseInfo => {
            if (responseInfo.status === 401) {
                res.set(
                    'WWW-Authenticate', 
                    'Basic realm="Access to protected endpoints (see API spec)"'
                );
            }
            res.status(responseInfo.status).json(responseInfo.content);
        })
    }
});

/* Deletes the given root entity (and any entities bound to it) from Datastore. */
app.delete('/:collectionName/:entityId', function(req, res) {
    const collectionName = req.params.collectionName;
    const entityId = req.params.entityId;
    const possibleCollections = Object.keys(constants.COLLECTIONS.roots);
    if (possibleCollections.includes(collectionName) === false) {
        res.status(404).json({
            "error": constants.NO_SUCH_COLLECTION
        });
    } else if (ds.isValidId(entityId) === false) {
        res.status(400).json({
            "error": constants.INVALID_ID
        });
    } else {
        const authReceived = req.get("Authorization");
        crud.deleteEntity(collectionName, entityId, authReceived).then(responseInfo => {
            if (responseInfo.status === 401) {
                res.set(
                    'WWW-Authenticate', 
                    'Basic realm="Access to protected endpoints (see API spec)"'
                );
            }
            if (Object.keys(responseInfo).includes('content') === true) {
                res.status(responseInfo.status).json(responseInfo.content);
            } else {
                res.status(responseInfo.status).end();
            }
        });
    }
});


/* Deletes the given child of a root entity from Datastore. */
app.delete('/:ancestorCollection/:ancestorId/:childCollection/:childId', function(req, res) {
    const ancestorCollection = req.params.ancestorCollection;
    const ancestorId = req.params.ancestorId;
    const childCollection = req.params.childCollection;
    const childId = req.params.childId;
    const possibleAncestors = constants.COLLECTIONS.roots;
    const possibleChildren = constants.COLLECTIONS.children;
    if (
        Object.keys(possibleAncestors).includes(ancestorCollection) == false
        || Object.keys(possibleChildren).includes(childCollection) == false
    ) {
        res.status(404).json({
            "error": constants.NO_SUCH_COLLECTION
        });
    } else if (ds.isValidId(ancestorId) === false || ds.isValidId(childId) === false) {
        res.status(400).json({
            "error": constants.INVALID_ID
        });
    } else {
        const authReceived = req.get("Authorization");
        const ancestor = new an.Ancestor(ancestorCollection, ancestorId);
        crud.deleteEntity(childCollection, childId, authReceived, ancestor).then(responseInfo => {
            if (responseInfo.status === 401) {
                res.set(
                    'WWW-Authenticate', 
                    'Basic realm="Access to protected endpoints (see API spec)"'
                );
            }
            if (Object.keys(responseInfo).includes('content') === true) {
                res.status(responseInfo.status).json(responseInfo.content);
            } else {
                res.status(responseInfo.status).end();
            }
        });
    }
});


/* Sends status 404 if client sends a request to a non-existent route. */
app.use(function(req, res, next) {
    res.status(404).json({"error": "The route to which you sent this request does not exist."});
});


/* Error handler. Catch Multer error JSON parsing error if one occurs.
 * Otherwise, report internal server error to user. */
app.use(function(err, req, res, next) {
    /* Catch Multer error if one occurs. */
    if (err instanceof Multer.MulterError) {
        /* Send 403 Forbidden if file is too large. */
        if (err.code && err.code === 'LIMIT_FILE_SIZE') {
            res.status(403).json({
                "error": "Images can be no larger than 10 MB"
            });
        } else {
            res.status(400).json({
                "error": "Unable to process image upload. Ensure data is encoded as "
                + "multipart/form-data and form field containing desired upload is named 'image'"
            });
        }
    }
    /* Catch Express body-parser JSON error if one occurs.
     *
     * ***CITATION: Idea for how to reliably catch a body-parser error
     * demonstrated in the Express.js body-parser GitHub Issues
     * tracker at the following URL: https://github.com/expressjs/body-parser/issues/122
     */
    else if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
        res.status(400).json({
            "error": "Unable to parse JSON in request body."
        });
    } else {
        console.log(err);
        res.status(500).json({
            "error": constants.SERVER_ERROR
        });
    }
});

/* Listen to the App Engine-specified port, or 8080 otherwise */
const PORT = constants.PORT;
app.listen(constants.PORT, () => {
    console.log(`Server listening on port ${PORT}...`);
});
