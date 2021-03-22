const cryptoJS = require('crypto-js');
const an = require('./ancestor');
const constants = require('./constants');
const ds = require('./datastore');
const sr = require('./server-response');
const ServerResponse = sr.ServerReponse;
const uuid = require('uuid');

/**
 * @class Representation of an individual teacher's secret questions and answers.
 */
class SecretQuestions {
    /**
     * Instantiates a new SecretQuestions object.
     * 
     * @constructor
     * @param {object} secretQuestions_JSON The teacher's secret questions and answers.
     * @param {string} secretQuestions_JSON.question_1 Secret question 1.
     * @param {string} secretQuestions_JSON.question_2 Secret question 2.
     * @param {string} secretQuestions_JSON.answer_1 Secret question 1's answer.
     * @param {string} secretQuestions_JSON.answer_2 Secret question 2's answer.
     */
    constructor(secretQuestions_JSON) {
        this.question_1 = secretQuestions_JSON.question_1;
        this.question_2 = secretQuestions_JSON.question_2;
        this.answer_1 = secretQuestions_JSON.answer_1;
        this.answer_2 = secretQuestions_JSON.answer_2;
    }

    /**
     * Compares two sets of unencrypted SecretQuestions to ensure all values
     * are equal.
     * 
     * @param {SecretQuestions} otherSecretQuestions Another SecretQuestions object
     * against which to compare this one.
     * @return {boolean} Whether the two sets of secret questions have identical values.
     */
    deepCompare(otherSecretQuestions) {
        if (this.question_1 !== otherSecretQuestions.question_1) {
            return false;
        } else if (this.question_2 !== otherSecretQuestions.question_2) {
            return false;
        } else if (this.answer_1 !== otherSecretQuestions.answer_1) {
            return false;
        } else if (this.answer_2 !== otherSecretQuestions.answer_2) {
            return false;
        } else {
            return true;
        }
    }
}


/** 
 * @class Represents a temporary reset code for a teacher's credentials and its expiration time. 
 */
class ResetCode {
    /**
     * Instantiates a new ResetCode object.
     * 
     * @param {object} resetCode_JSON [optional] The reset_code data of a teacher's credentials.
     * Defaults to empty string properties when creating new credentials (for which
     * a reset code will not yet have been issued).
     * @param {string} resetCode_JSON.code The randomly-generated temporary reset code.
     * @param {string} resetCode_JSON.expires When the reset-code expires (stored as string 
     * instead of number for encryption purposes).
     */
    constructor(resetCode_JSON = null) {
        if (resetCode_JSON) {
            this.code = resetCode_JSON.code;
            this.expires = resetCode_JSON.expires;
        } else {
            this.code = "";
            this.expires = "";
        }
    }

    /** 
     * Generates a new, random code and sets it to expire in 30 minutes. 
    */
    refreshCode() {
        this.code = uuid.v4();
        this.expires = (Date.now() + constants.RESET_CODE_LIFETIME).toString(10);
    }

    /**
     * Validates whether the reset code is unexpired.
     * 
     * @return {boolean} Whether the code is still unexpired.
     */
    isUnexpired() {
        const expirationTime = parseInt(this.expires, 10);
        return Date.now() < expirationTime;
    }

    /** 
     * Clears the ResetCode, reverting properties to empty strings,
     * once a ResetCode and secret question answers have been used successfully. 
    */
    clearCode() {
        this.code = "";
        this.expires = "";
    }
}


/**
 * @class Represents two decrypted secret questions (without answers) and a decrypted 
 * temporary reset code to send to a client requesting to reset an unknown password.
 */
class ResetCodeChallenge {
    /**
     * Instantiates a new ResetCodeChallenge object.
     * 
     * @constructor
     * @param {string} secret_question_1 The first decrypted secret question (without answer).
     * @param {string} secret_question_2 The second decrypted secret question (without answer).
     * @param {string} reset_code The decrypted reset code.
     */
    constructor(secret_question_1, secret_question_2, reset_code) {
        this.secret_question_1 = secret_question_1;
        this.secret_question_2 = secret_question_2;
        this.reset_code = reset_code;
    }
}

/**
 * @class Representiation of an individual teacher's login credentials.
 */
class Credential {
    /**
     * Instantiates a new Credential object, copying the credential data passed in
     * and encrypting it if it has not yet been encrypted.
     * 
     * @constructor
     * @param {object} credentialData_JSON The credential data.
     * @param {string} credentialData_JSON.password The teacher's password.
     * @param {object} credentialData_JSON.secret_questions Secret questions and answers.
     * @param {string} credentialData_JSON.secret_questions.question_1 Secret question 1.
     * @param {string} credentialData_JSON.secret_questions.question_2 Secret question 2.
     * @param {string} credentialData_JSON.secret_questions.answer_1 Secret question 1's answer.
     * @param {string} credentialData_JSON.secret_questions.answer_2 Secret question 2's answer.
     * @param {object} credentialData_JSON.reset_code [optional] Information about the most
     * recently-generated reset code. Defaults to empty string properties upon new credential creation
     * since reset code has not yet been issued.
     * @param {string} credentialData_JSON.reset_code.code The randomly-generated temporary reset code.
     * @param {string} credentialData_JSON.reset_code.expires When the reset-code expires.
     * @param {boolean} encrypted [optional] Whether the credentialData has been encrypted yet.
     * @param {object} datastoreKey [optional] The Datastore key of this entity
     * (null if not yet added to Datastore).
     */
    constructor(credentialData_JSON, encrypted = true, datastoreKey = null) {
        this.data = {
            "password": credentialData_JSON.password,
            "secret_questions": new SecretQuestions(credentialData_JSON.secret_questions),
            "reset_code": new ResetCode(
                Object.keys(credentialData_JSON).includes("reset_code") ?
                credentialData_JSON.reset_code :
                null
            )
        };
        if (encrypted === false) {
            this.encryptPassword();
            this.encryptSecretQuestions();
            this.encryptResetCode();
        }
        this.datastoreKey = datastoreKey;
    }

    /**
     * Encrypts a string using AES.
     * 
     * @private
     * @param {string} plaintext The text to encrypt.
     * @return {string} Plaintext now encrypted as ciphertext.
     */
    static encryptString(plaintext) {
        const ciphertext = cryptoJS.AES.encrypt(plaintext, constants.SECRET).toString();
        return ciphertext;
    }


    /**
     * Decrypts a string previously encrypted with encryptString above.
     * 
     * @private
     * @param {string} ciphertext The text to decrypt.
     * @return {string} The ciphertext now decrypted as plaintext.
     */
    static decryptString(ciphertext) {
        const bytes = cryptoJS.AES.decrypt(ciphertext, constants.SECRET);
        const plaintext = bytes.toString(cryptoJS.enc.Utf8);
        return plaintext;
    }

    /**
     * Encrypts the current password using AES.
     * 
     * @private
     */
    encryptPassword() {
        this.data.password = Credential.encryptString(this.data.password);
    }

    /**
     * Encrypts the current SecretQuestions using AES.
     * 
     * @private
     */
    encryptSecretQuestions() {
        const secretQuestions = this.data.secret_questions;
        const secretQuestionsKeys = Object.keys(secretQuestions);
        for (const key of secretQuestionsKeys) {
            secretQuestions[key] = Credential.encryptString(secretQuestions[key]);
        }
    }

    /**
     * Encrypts the current ResetCode using AES.
     * 
     * @private
     */
    encryptResetCode() {
        const resetCode = this.data.reset_code;
        const resetCodeKeys = Object.keys(resetCode);
        for (const key of resetCodeKeys) {
            resetCode[key] = Credential.encryptString(resetCode[key]);
        }
    }

    /**
     * Decrypts the current password using AES. Pair with call to encryptPassword() to
     * make password encrypted again.
     * 
     * @private
     */
    decryptPassword() {
        this.data.password = Credential.decryptString(this.data.password);
    }

    /**
     * Decrypts the current SecretQuestions using AES. Pair with call to encryptSecretQuestions
     * to encrypt them again.
     * 
     * @private
     */
    decryptSecretQuestions() {
        const secretQuestions = this.data.secret_questions;
        const secretQuestionsKeys = Object.keys(secretQuestions);
        for (const key of secretQuestionsKeys) {
            secretQuestions[key] = Credential.decryptString(secretQuestions[key]);
        }
    }

    /**
     * Decrypts the current ResetCode using AES. Pair with call to encryptResetCode
     * to encrypt it again.
     * 
     * @private
     */
    decryptResetCode() {
        const resetCode = this.data.reset_code;
        const resetCodeKeys = Object.keys(resetCode);
        for (const key of resetCodeKeys) {
            resetCode[key] = Credential.decryptString(resetCode[key]);
        }
    }

    /**
     * Generates a new reset code for this Credential and returns 
     * the unencrypted secret questions (without answers) and the unencrypted reset code.
     * 
     * @return {ResetCodeChallenge} The reset code challenge to send to the client.
     */
    generateResetCodeChallenge() {
        /* Get decrypted secret questions to send to client. */
        this.decryptSecretQuestions();
        const decrypted_secret_question_1 = this.data.secret_questions.question_1;
        const decrypted_secret_question_2 = this.data.secret_questions.question_2;
        this.encryptSecretQuestions();

        /* Refresh the reset_code to send a new one to client and then encrypt new ResetCode
         * so it is encrypted when stored in Datastore. */
        this.data.reset_code.refreshCode();
        const refereshed_reset_code = this.data.reset_code.code;
        this.encryptResetCode();

        return new ResetCodeChallenge(
            decrypted_secret_question_1,
            decrypted_secret_question_2,
            refereshed_reset_code
        );
    }

    /**
     * Replaces the current password value with the new value passed in by the client
     * (encrypting it before storing it in Datastore).
     * 
     * @param {string} newPassword The new password desired by the user (plaintext).
     */
    updatePassword(newPassword) {
        this.data.password = newPassword;
        this.encryptPassword();
    }

    /**
     * Replaces the current SecretQuestions value with the new value passed in by the client
     * (encrypting it before storing it in Datastore).
     * @param {SecretQuestions} newSecretQuestions The new SecretQuestions desired by the user (plaintext).
     */
    updateSecretQuestions(newSecretQuestions) {
        this.data.secret_questions = newSecretQuestions;
        this.encryptSecretQuestions();
    }

    /** 
     * Clears the reset code properties and reeyncrypts the reset code. 
    */
    clearResetCode() {
        this.data.reset_code.clearCode();
        this.encryptResetCode();
    }

    /**
     * Determines whether the password passed in by the client matches the one stored
     * for this teacher in Datastore.
     * 
     * @param {string} passwordFromClient The password received from the client (currently in plaintext).
     * @return {boolean} Whether the password passed in matches the one in Datastore.
     */
    passwordsMatch(passwordFromClient) {
        this.decryptPassword();
        const passwordsAreEqual = passwordFromClient === this.data.password;
        this.encryptPassword();
        return passwordsAreEqual;
    }

    /**
     * Determines whether the SecretQuestions passed in by the client match those stored
     * for this teacher in Datastore.
     * 
     * @param {SecretQuestions} secretQuestionsFromClient The SecretQuestions passed in by the client.
     * @return {boolean} Whether the SecretQuestions passed in match those in Datastore.
     */
    secretQuestionsMatch(secretQuestionsFromClient) {
        this.decryptSecretQuestions();
        const questionsAreEqual = this.data.secret_questions.deepCompare(
            secretQuestionsFromClient
        );
        this.encryptSecretQuestions();
        return questionsAreEqual;
    }

    /**
     * Determines whether the reset code passed in by the client matches the one stored
     * for this teacher in Datastore as well as whether the reset code is unexpired.
     * 
     * @param {string} resetCodeFromClient The reset code received from the client.
     * @return {boolean} Whether the reset code received matches the one on file.
     */
    resetCodeValid(resetCodeFromClient) {        
        this.decryptResetCode();
        const resetCodesMatch = resetCodeFromClient === this.data.reset_code.code;
        const resetCodeUnexpired = this.data.reset_code.isUnexpired();
        this.encryptResetCode();
        return resetCodesMatch && resetCodeUnexpired;
    }
}


/**
 * Gets and returns the teacher_id of the project with project_id.
 * 
 * @param {object} transaction The Datastore transaction being run.
 * @param {string} projectId The ID of the project in Datastore.
 * @return {Promise<?string>} The teacher_id of the project (null on error).
 */
async function getTeacherOfProject(transaction, projectId) {
    try {
        const datastoreKey = ds.datastore.key([constants.PROJECT, parseInt(projectId, 10)]);
        const datastoreResponse = await transaction.get(datastoreKey);
        const project = datastoreResponse[0];
        return project.teacher_id;
    } catch(err) {
        console.log(err);
        return null;
    }
}

/**
 * Creates a new Credential entity associated with the given teacher.
 * 
 * @param {Credential} credentialToAdd The credential data to be associated with this teacher.
 * @param {string} teacherId The Datastore ID of the teacher to whom these credentials will belong.
 * @return {Promise<boolean>} Whether the operation succeeded.
 */
async function postCredential(credentialToAdd, teacherId) {
    try {
        if (!(credentialToAdd instanceof Credential)) {
            throw "credentialData must be an instance of Credential.";
        }
        
        /* Store credentials in Datastore. */
        const datastoreKey = ds.generateDatastoreKey(
            constants.CREDENTIAL, 
            null, 
            new an.Ancestor(constants.TEACHERS, teacherId)
        );
        await ds.datastore.save({"key": datastoreKey, "data": credentialToAdd.data});
        return true;
    } catch(err) {
        console.log(err);
        return false;
    }
}


/**
 * Gets the credentials of the teacher with teacher_id from Datastore.
 * 
 * @param {object} transaction The current Datastore transaction being run.
 * @param {string} teacherId The Datastore ID of the teacher whose credentials should be fetched.
 * @return {Promise<?Credential>} A Credential object containing the teacher's encrypted credentials
 * (null on error).
 */
async function getCredential(transaction, teacherId) {
    try {
        const teacherKey = ds.datastore.key([constants.TEACHER, parseInt(teacherId, 10)]);
        const query = ds.datastore.createQuery(constants.CREDENTIAL);
        query.hasAncestor(teacherKey);
        const datastoreResponse = await transaction.runQuery(query);

        const entities = datastoreResponse[0];
        if (entities.length !== 1) {
            return null;
        }

        const credentialData_JSON = entities[0];
        const credentialKey = credentialData_JSON[ds.Datastore.KEY];
        return new Credential(credentialData_JSON, true, credentialKey);
    } catch(err) {
        console.log(err);
        return null;
    }
}


/**
 * Gets secret questions (without answers) and a reset code so that a teacher can reset
 * a lost password.
 * 
 * @param {string} teacherId The ID of the teacher who would like to reset their password.
 * @return {Promise<ServerResponse>} The status code and content to send to the client.
 */
async function getCredentialResetChallenge(teacherId) {
    const transaction = ds.datastore.transaction();
    try {
        await transaction.run();
        
        /* Get the teacher's current credential from Datastore. */
        const currentCredential = await getCredential(transaction, teacherId);
        if (currentCredential === null) {
            await transaction.rollback();
            return new ServerResponse(
                404,
                {"error": constants.TEACHER_NOT_FOUND}
            );
        }

        /* Generate the reset code challenge and resave the current credential to Datastore
         * since ResetCode has been updated. */
        const resetCodeChallenge = currentCredential.generateResetCodeChallenge();
        await transaction.save({
            "key": currentCredential.datastoreKey,
            "data": currentCredential.data
        });

        await transaction.commit();
        return new ServerResponse(
            200,
            resetCodeChallenge
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
 * Validates whether the authorization header received is correct for the given
 * teacher with teacherId.
 * 
 * @param {object} transaction The current Datastore transaction being run.
 * @param {string} authReceived The authorization header received from the client.
 * @param {string} teacherIdExpected [optional] The ID of the teacher in Datastore who has permission
 * to access this resource (null if any teacher can work with the resource).
 * @param {Credential} credentialExpected [optional] The Credential expected for this teacher
 * (can be passed in by calling function in same module to avoid unncecessary duplicate work
 * of fetching Credential twice).
 * @param {boolean} useResetCode [optional] Whether the teacher's credential should be validated
 * using a reset code instead of a password (for resetting forgotten password.)
 * @return {Promise<?ServerResponse>} The code and message to send to the client if invalid
 * (null if valid).
 */
async function validateAuthHeader(
    transaction, 
    authReceived, 
    teacherIdExpected = null,
    credentialExpected = null,
    useResetCode = false
) {
    /* If no authorization header was received, return 401 to indicate it is required. */
    if (!authReceived) {
        return new ServerResponse(
            401,
            {"error": "Authorization is required to access this endpoint."}
        )
    }
    
    /* Split the string at the first space so that the type and credentials can be processed
     * separately. */
    const spaceIndex = authReceived.indexOf(" ");
    
    /* If the string begins with a space or does not include a space,
     * report that it cannot be parsed. */
    if (spaceIndex <= 0) {
        return new ServerResponse(
            400,
            {"error": "The authorization credentials included could not be parsed"}
        )
    }
    
    const authType = authReceived.substring(0, spaceIndex);
    const authCredentialsBase64 = authReceived.substring(spaceIndex+1);
    if (authType !== "Basic") {
        return new ServerResponse(
            401,
            {"error": "Only Basic-type authorization headers are accepted"}
        );
    }

    /* Decode the auth credentials from base64 to utf8. */
    const base64Buffer = Buffer.from(authCredentialsBase64, "base64");
    const authCredentials = base64Buffer.toString("utf8");
    
    /* Split authCredentials into the id and password. Since neither usernames nor passwords
     * can include a colon, require that there is exactly one colon.*/
    const authCredentialsArr = authCredentials.split(":");
    if (authCredentialsArr.length !== 2) {
        return new ServerResponse(
            400,
            {"error": "The authorization credentials included could not be parsed"}
        );
    }
    
    const teacherIdReceived = authCredentialsArr[0];
    const passwordReceived = authCredentialsArr[1];

    /* If another user is trying to access this resource, report that it is forbidden. */
    if (teacherIdExpected !== null && teacherIdReceived !== teacherIdExpected) {
        return new ServerResponse(
            403,
            {
                "error": 
                "The teacher whose authorization credentials were provided does not own this resource."
            }
        );
    }

    /* If the credentials expected for this teacher were not passed in by the calling function,
     * retrieve them from Datastore. */
    if (credentialExpected === null) {
        credentialExpected = await getCredential(transaction, teacherIdReceived);
        if (credentialExpected === null) {
            return new ServerResponse(
                404,
                {"error": constants.CREDENTIAL_NOT_FOUND}
            );
        }
    }

    /* If a reset code is being used for validation, ensure the reset code is valid. */
    if (useResetCode === true) {
        if (credentialExpected.resetCodeValid(passwordReceived) === false) {
            return new ServerResponse(
                401,
                {"error": "The reset code provided is incorrect and/or expired."}
            );
        }
    }

    /* Othewrwise, ensure the password in Datastore matches the one sent by the client. */
    else {
        if (credentialExpected.passwordsMatch(passwordReceived) === false) {
            return new ServerResponse(
                401,
                {"error": "The password provided is incorrect."}
            );
        }
    }

    /* Return null to calling function to indicate no error was encountered in validation. */
    return null;
}


/**
 * Allows updating of a teacher's username and/or secret_questions when the current password
 * is known.
 * 
 * @param {object} credentialPatches The updates to make to this teacher's credentials.
 * @param {string} teacherId This teacher's Datastore ID.
 * @param {string} authReceived The Authentication header provided by the client.
 * @return {Promise<ServerResponse>} The response code and content to send to the client.
 */
async function updateCredentialPasswordKnown(credentialPatches, teacherId, authReceived) {
    const transaction = ds.datastore.transaction();
    try {
        /* Ensure patches are valid. */
        const entityType = constants.CREDENTIAL_ENTITY_TYPE;
        const propertiesValid = entityType.validateProperties(
            credentialPatches,
            entityType.updateProperties
        );
        if (propertiesValid === false) {
            return new ServerResponse(
                400,
                {"error": constants.INVALID_UPDATE}
            )
        }

        await transaction.run();

        /* Verify that the teacher with teacherId exists. */
        const teacherExists = await ds.teacherExists(transaction, teacherId);
        if (teacherExists === false) {
            await transaction.rollback();
            return new ServerResponse(
                404,
                {"error": constants.TEACHER_NOT_FOUND}
            );
        }

        /* Get the teacher's credentials on file from Datastore. */
        const credentialToUpdate = await getCredential(transaction, teacherId);
        if (credentialToUpdate === null) {
            await transaction.rollback();
            return new ServerResponse(
                404,
                {"error": constants.CREDENTIAL_NOT_FOUND}
            );
        }

        /* Validate that the authorization provided by the client contains the correct
         * teacher_id and current password. */
        const responseInfo = await validateAuthHeader(
            transaction,
            authReceived,
            teacherId,
            credentialToUpdate
        );
        if (responseInfo !== null) {
            await transaction.rollback();
            return responseInfo;
        }

        const patchKeys = Object.keys(credentialPatches);
        if (patchKeys.includes("password") === true) {
            credentialToUpdate.updatePassword(credentialPatches.password);
        }
        if (patchKeys.includes("secret_questions") === true) {
            const newSecretQuestions = new SecretQuestions(credentialPatches.secret_questions);
            credentialToUpdate.updateSecretQuestions(newSecretQuestions);
        }

        await transaction.save({
            "key": credentialToUpdate.datastoreKey,
            "data": credentialToUpdate.data
        });

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


/**
 * Resets an unknown password using secret questions and a reset code.
 * 
 * @param {object} requestBody The request body received from the client.
 * @param {string} teacherId This teacher's Datastore ID.
 * @param {string} authReceived The Authentication header provided by the client.
 */
async function resetUnknownPassword(requestBody, teacherId, authReceived) {
    const transaction = ds.datastore.transaction();
    try {
        /* Verify that the request body contains all required fields (password + secret_questions)
         * in the proper format. Use entityType.createProperties
         * since PUT requires all properties included. */
        const entityType = constants.CREDENTIAL_ENTITY_TYPE;
        const propertiesValid = entityType.validateProperties(
            requestBody,
            entityType.createProperties
        );
        if (propertiesValid === false) {
            return new ServerResponse(
                400,
                {"error": constants.INVALID_UPDATE}
            );
        }
        
        await transaction.run();

        /* Verify that the teacher with teacherId exists. */
        const teacherExists = await ds.teacherExists(transaction, teacherId);
        if (teacherExists === false) {
            await transaction.rollback();
            return new ServerResponse(
                404,
                {"error": constants.TEACHER_NOT_FOUND}
            );
        }

        /* Get the teacher's credentials on file from Datastore. */
        const credentialToUpdate = await getCredential(transaction, teacherId);
        if (credentialToUpdate === null) {
            await transaction.rollback();
            return new ServerResponse(
                404,
                {"error": constants.CREDENTIAL_NOT_FOUND}
            );
        }

        /* Validate that the authorization provided by the client contains the correct
         * teacher_id and reset_code. */
        const responseInfo = await validateAuthHeader(
            transaction,
            authReceived,
            teacherId,
            credentialToUpdate,
            true
        );
        if (responseInfo !== null) {
            await transaction.rollback();
            return responseInfo;
        }

        /* Verify that the secret questions and answers match what is expected. */
        if (credentialToUpdate.secretQuestionsMatch(requestBody.secret_questions) === false) {
            await transaction.rollback();
            return new ServerResponse(
                401,
                {"error": "The secret questions and answers provided do not match those on file."}
            )
        }

        /* Verify that the new password does not match the old password. */
        const newPassword = requestBody.password;
        if (credentialToUpdate.passwordsMatch(newPassword) === true) {
            await transaction.rollback();
            return new ServerResponse(
                403,
                {"error": "The new password cannot match the old one."}
            )
        }

        /* Update the password to the new one, reset the reset_code to empty string properties,
         * and resave the Credential to Datastore. */
        credentialToUpdate.updatePassword(newPassword);
        credentialToUpdate.clearResetCode();
        await transaction.save({
            "key": credentialToUpdate.datastoreKey, 
            "data": credentialToUpdate.data
        });

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


/**
 * Deletes the credential associated with a given teacher when that teacher is being deleted
 * from Datastore.
 * 
 * @param {object} transaction The current Datastore transaction being run.
 * @param {string} teacherId The ID of the teacher being deleted.
 * @return {Promise<boolean>} Whether the operation succeeded.
 */
async function deleteCredential(transaction, teacherId) {
    /* Get the credential associated with this teacher so key can be used to delete it. */
    const credentialToDelete = await getCredential(transaction, teacherId);
    if (credentialToDelete === null) {
        return false;
    }

    /* Delete the credential. */
    await transaction.delete(credentialToDelete.datastoreKey);
    return true;
}


 module.exports = {
    "Credential": Credential,
    "getTeacherOfProject": getTeacherOfProject,
    "getCredentialResetChallenge": getCredentialResetChallenge,
    "postCredential": postCredential,
    "validateAuthHeader": validateAuthHeader,
    "updateCredentialPasswordKnown": updateCredentialPasswordKnown,
    "resetUnkownPassword": resetUnknownPassword,
    "deleteCredential": deleteCredential
 };
