/* Import axios for making async HTTP requests. */
const axios = require('axios');

/* Import authorization functionality. */
const auth = require('./auth');

/* Import constants. */
const constants = require('./constants');

/* Import Datastore functionality. */
const ds = require('./datastore');

/* Import EntityType class. */
const et = require('./entity-type');
const EntityType = et.EntityType;

/* Import ParsedImageUrl class. */
const piu = require('./parsed-image-url');
const ParsedImageUrl = piu.ParsedImageUrl;

/* Import util for formatting image urls. */
const {format} = require('util');

/* Make new Cloud Storage instance. */
const {Storage} = require('@google-cloud/storage');
const storage = new Storage();

/* Obtain the storage bucket designated for storing images. */
const bucket = storage.bucket(constants.BUCKET_NAME);

/* Import the ServerResponse class. */
const sr = require('./server-response');
const ServerResponse = sr.ServerReponse;


/**
 * Stores the given image in Cloud Storage.
 * 
 * @param {object} imageFile The file retrieved by Multer that was sent with this request.
 * @return {Promise<ServerResponse>} The status code and content to return to the client.
 */
function writeImageToStorage(imageFile) {
    /* Prepend timestamp to filename to help ensure unique filename. */
    const filename = Date.now().toString(10) + '_' + imageFile.originalname;

    /* Create a blob into which to write file data. */
    const blob = bucket.file(filename);
    
    /* Construct and return a promise that resolves with the 
     * server reponse based on the outomce of writing the file data
     * to the bucket. */
    return new Promise((resolve, reject) => {
        /* Create a new write stream to write the data to the storage bucket. */
        const blobStream = blob.createWriteStream({
            resumable: false
        });

        /* If an error occurs, resolve the promise with status 500 and
         * an error message. */
        blobStream.on('error', err => {
            console.log(err);
            resolve(
                new ServerResponse(
                    500,
                    {"error": "An error occurred while uploading the file you submitted to Cloud Storage"}
                )
            );
        });

        /* If the writeStream finishes successfully, resolve the promise with a
         * 201 created server response containing the public url of the image. */
        blobStream.on('finish', () => {
            const publicUrl = format(
                `${constants.CLOUD_STORAGE_BASE_URL}/${bucket.name}/${blob.name}`
            );          
            resolve(
                new ServerResponse(
                    201,
                    {"publicUrl": publicUrl}
                )
            );
        });

        /* Close the writeStream. */
        blobStream.end(imageFile.buffer);
    });
}


/**
 * Posts an image file to Datastore.
 * 
 * @param {object} imageFile The image file data to be stored in Cloud Storage
 * @param {string} authReceived The content of the Authorization header received from the client
 * @return {Promise<ServerResponse>} The response status code and content to send to the client
 */
async function postImage(imageFile, authReceived) {
    /* Validate that the client has provided a valid Teacher credential (image is being stored in
     * general storage and not yet linked to an entity, so it does not matter which specific teacher's
     * credentials are provided). */
    const transaction = ds.datastore.transaction();
    await transaction.run();

    const authResponse = await auth.validateAuthHeader(transaction, authReceived);
    if (authResponse !== null) {
        await transaction.rollback();
        return authResponse;
    }

    /* Write the image into cloud storage. */
    const writeResponse = await writeImageToStorage(imageFile);
    if (writeResponse.status !== 201) {
        await transaction.rollback();
    } else {
        await transaction.commit();
    }
    return writeResponse;
}


/**
 * Fetches the URL at which a given entity's image property is located (null if no image).
 * 
 * @param {object} entityData The data of the entity from which to retrieve the image URL
 * @param {EntityType} entityType The type of entity that entityData represents
 * @return {?string} The URL at which the image is located (null if it does not exist)
 */
function getImageUrl(entityData, entityType) {
    const imagePath = entityType.getImageLocation();
    if (imagePath === null) {
        return null;
    }

    /* Trace the path through the properties in image path
     * until URL itself is reached (at end of path). */
    let prop = entityData;
    for (const key of imagePath) {
        prop = prop[key];
        
        /* If this property is undefined, return null to indicate image
         * does not exist. */
        if (prop === undefined) {
            return null;
        }
    }
    return prop;
}


/**
 * Special-purpose validator for image URLs that ensures:
 * 1. URL is correctly-formatted Cloud Storage URL
 * 2. Image at that URL exists
 * 3. Image at that URL is a valid format
 * 
 * @param {string} imageUrl The URL at which the image is located
 * @return {Promise<boolean>} Whether the URL represents a valid image in Cloud Storage
 */
async function validateImageUrl(imageUrl) {
    try {
        /* Ensure the URL is correctly formatted. */
        const parsedImageUrl = new ParsedImageUrl(imageUrl);
        if (parsedImageUrl.baseUrl !== constants.CLOUD_STORAGE_BASE_URL) {
            return false;
        } else if (parsedImageUrl.bucketName !== constants.BUCKET_NAME) {
            return false;
        }

        /* Ensure the image exists */
        const response = await axios.get(imageUrl);
        if (response.status === 200) {
            /* Ensure the image is the proper format */
            const imageMimeType = response.headers['content-type'];
            if (constants.IMAGE_MIME_TYPES_ALLOWED.includes(imageMimeType) === true) {
                return true;
            } else {
                return false;
            }
        } else {
            return false;
        }
    } catch(err) {
        return false;
    }
}


/**
 * Deletes the image at the provided URL from Cloud Storage.
 * 
 * @param {string} imageUrl The url of the image in Cloud Storage.
 * @return {Promise<boolean>} Whether the image was successfully deleted.
 */
async function deleteImage(imageUrl) {
    try {
        const parsedImageUrl = new ParsedImageUrl(imageUrl);
        await bucket.file(parsedImageUrl.fileName).delete();
        return true;
    } catch(err) {
        console.log(err);
        return false;
    }
}


module.exports = {
    "postImage": postImage,
    "getImageUrl": getImageUrl,
    "validateImageUrl": validateImageUrl,
    "deleteImage": deleteImage
};
