const ds = require('./datastore');
const et = require('./entity-type');
const secret = require('./secret.json');

/* The port number at which the current process is running. */
const PORT = process.env.PORT || 8080;

/* The secret key used for encryption. */
const SECRET = secret.secret;

/* Google Cloud Storage Constants. */
const BUCKET_NAME = process.env.GCLOUD_STORAGE_BUCKET || 'kidizen-science-images';
const CLOUD_STORAGE_BASE_URL = 'https://storage.googleapis.com';
const DEFAULT_PROFILE_PHOTO = 
    'https://storage.googleapis.com/kidizen-science-images/1606709615803_defaultUserPhoto.png';

/* Constants for Datastore entity type names. */
const PROJECT = 'Project';
const TEACHER = 'Teacher';
const OBSERVATION = 'Observation';
const CREDENTIAL = 'Credential';

/* Constants for collection path names. */
const PROJECTS = 'projects';
const TEACHERS = 'teachers';
const OBSERVATIONS = 'observations';

/* Constants for types. */
const STRING = 'string';
const OBJECT = 'object';
const NUMBER = 'number';
const BOOLEAN = 'boolean';

/* Constants for HTTP methods. */
const POST = "POST";
const GET = "GET";
const PUT = "PUT";
const PATCH = "PATCH";
const DELETE = "DELETE";

/* Constants differentiating GETting 1 versus multiple entities of a given type. */
const GET_ONE = "GET_ONE";
const GET_LIST = "GET_LIST";

/* Constants for MIME types. */
const JSON_MIME_TYPE = 'application/json';
const FORM_DATA_MIME_TYPE = 'multipart/form-data';

/* Content-Type header name. */
const CONTENT_TYPE_HEADER = 'Content-Type';

/* Constants for image formats allowed. */
const IMAGE_MIME_TYPES_ALLOWED = ['image/jpeg', 'image/png'];
const IMAGE_FORMAT_ERROR = 'Images must be in JPEG or PNG format.';
const INVALID_IMAGE_URL = 'The image URL provided is improperly formatted, the image does not exist, '
    + 'or the image is not in an acceptable format';

/* Constants for error messages. */
const NO_SUCH_COLLECTION = "The collection you are seeking does not exist.";
const INVALID_ID = "All IDs must be positive integers.";
const INVALID_PROPERTIES = "At least one parameter was missing, invalid, or extraneous.";
const INVALID_UPDATE = "No valid parameter was included or at least 1 parameter was invalid.";
const ITEM_NOT_FOUND = "The item you requested could not be found.";
const ANCESTOR_NOT_FOUND = "The project with project_id cannot be found.";
const TEACHER_NOT_FOUND = "The teacher with teacher_id cannot be found.";
const CREDENTIAL_NOT_FOUND = "No credentials could be found on file for the teacher whose credentials were provided.";
const SERVER_ERROR = "An internal server error has occurred.";

/* Constant for ResetCode timeout in milliseconds (30 minutes). */
const RESET_CODE_LIFETIME = 30 * 60 * 1000;

/* Defintions of property validator functions. */
const VALIDATE_DS_ID = value => typeof(value) === STRING && ds.isValidId(value) === true;
const VALIDATE_STRING = value => typeof(value) === STRING && value.length > 0;
const VALIDATE_STRING_OR_NULL = value => VALIDATE_STRING(value) === true || value === null;
const VALIDATE_EMBEDDED_OBJECT = value => typeof(value) === OBJECT && value !== null;

const VALIDATE_PASSWORD = value => {
    if (typeof(value) !== 'string') {
        return false;
    } else if (value.length < 8 || value.length > 16) {
        return false;
    } else {
        for (const c of value) {
            if ((c >= 'A' && c <= 'Z') || (c >= 'a' && c <= 'z') || (c >= '0' && c <= '9')) {
                continue;
            } else {
                return false;
            }
        }
        return true;
    }
};

const VALIDATE_SECRET_QUESTIONS = value => {
    if (VALIDATE_EMBEDDED_OBJECT(value) === false) {
        return false;
    } else if (Object.keys(value).length !== 4) {
        return false;
    } else if (VALIDATE_STRING(value.question_1) === false) {
        return false;
    } else if (VALIDATE_STRING(value.question_2) === false) {
        return false;
    } else if (VALIDATE_STRING(value.answer_1) === false) {
        return false;
    } else if (VALIDATE_STRING(value.answer_2) === false) {
        return false;
    } else if (value.question_1 === value.question_2) {
        return false;
    } else if (value.answer_1 === value.answer_2) {
        return false;
    } else {
        return true;
    }
};

const VALIDATE_PROJECT_DATA_NUMBER = value => {
    if (VALIDATE_EMBEDDED_OBJECT(value) === false) {
        return false;
    } else if (Object.keys(value).length !== 3) {
        return false;
    } else if (VALIDATE_STRING(value.name) === false) {
        return false;
    } else if (typeof(value.must_be_unique) !== BOOLEAN) {
        return false;
    } else if (typeof(value.number) !== NUMBER) {
        return false;
    } else {
        return true;
    }
};

const VALIDATE_IMAGE = value => {
    if (VALIDATE_EMBEDDED_OBJECT(value) === false) {
        return false;
    } else if (Object.keys(value).length !== 3) {
        return false;
    } else if (VALIDATE_STRING(value.title) === false) {
        return false;
    } else if (VALIDATE_STRING(value.url) === false) {
        return false;
    } else if (VALIDATE_STRING(value.alt_text) === false) {
        return false;
    } else {
        return true;
    }
};

const VALIDATE_OBSERVATION_DATA_NUMBER = value => {
    if (VALIDATE_EMBEDDED_OBJECT(value) === false) {
        return false;
    } else if (Object.keys(value).length !== 2) {
        return false;
    } else if (VALIDATE_STRING(value.description) === false) {
        return false;
    } else if (typeof(value.quantity) !== NUMBER) {
        return false;
    } else {
        return true;
    }
};

/* Functions to add embedded self links to entity data before returning it
 * to client (does not affect representation of entity data in Datastore). */
const PROJECT_ADD_EMBEDDED_SELF_LINKS = (baseUrl, project, ancestor = null) => {
    if (ancestor !== null) {
        throw "Projects must be root-level entities.";
    }
    
    /* Replace teacher_id field with teacher field. */
    const teacher_id = project.teacher_id;
    delete project.teacher_id;
    project.teacher = {
        id: teacher_id,
        self: ds.getSelfUrl(baseUrl, TEACHERS, teacher_id)
    };
};

const OBSERVATION_ADD_EMBEDDED_SELF_LINKS = (baseUrl, observation, ancestor) => {
    const project_id = ancestor.entityId;
    observation.project = {
        id: project_id,
        self: ds.getSelfUrl(baseUrl, PROJECTS, project_id)
    };
};

/* Define object containing entity types where each
 * collection name used in request URLs is mapped to an EntityType. Separate into "roots"
 * (for root-level entities) and "children" (for child-level entities) */
const COLLECTIONS = {
    "roots": {
        "projects": new et.EntityType(
            PROJECT,
            5,
            [
                new et.Property(
                    "teacher_id",
                    VALIDATE_DS_ID,
                    true
                ),
                new et.Property(
                    "name",
                    VALIDATE_STRING,
                    true
                ),
                new et.Property(
                    "data_number",
                    VALIDATE_PROJECT_DATA_NUMBER,
                    true
                ),
                new et.Property(
                    "description_image",
                    VALIDATE_IMAGE,
                    true
                ),
                new et.Property(
                    "description_text",
                    VALIDATE_STRING,
                    true
                )
            ],
            [
                new et.Property(
                    "name",
                    VALIDATE_STRING,
                    false
                ),
                new et.Property(
                    "description_image",
                    VALIDATE_IMAGE,
                    false
                ),
                new et.Property(
                    "description_text",
                    VALIDATE_STRING,
                    false
                )
            ],
            [POST, PATCH, DELETE],
            ["description_image", "url"],
            true,
            PROJECT_ADD_EMBEDDED_SELF_LINKS
        ),
        "teachers": new et.EntityType(
            TEACHER,
            0,
            [
                new et.Property(
                    "name",
                    VALIDATE_STRING,
                    true
                ),
                new et.Property(
                    "email",
                    VALIDATE_STRING,
                    true
                ),
                new et.Property(
                    "school",
                    VALIDATE_STRING,
                    true
                ),
                new et.Property(
                    "password",
                    VALIDATE_PASSWORD,
                    true
                ),
                new et.Property(
                    "secret_questions",
                    VALIDATE_SECRET_QUESTIONS,
                    true
                )
            ],
            [
                new et.Property(
                    "name",
                    VALIDATE_STRING,
                    false
                ),
                new et.Property(
                    "profile_photo",
                    VALIDATE_STRING_OR_NULL,
                    false
                ),
                new et.Property(
                    "email",
                    VALIDATE_STRING,
                    false
                ),
                new et.Property(
                    "school",
                    VALIDATE_STRING,
                    false
                )
            ],
            [GET_ONE, PATCH, DELETE],
            ["profile_photo"],
            false
        )
    },
    "children": {
        "observations": new et.EntityType(
            OBSERVATION,
            5,
            [
                new et.Property(
                    "date",
                    VALIDATE_STRING,
                    true
                ),
                new et.Property(
                    "data_image",
                    VALIDATE_IMAGE,
                    true
                ),
                new et.Property(
                    "data_number",
                    VALIDATE_OBSERVATION_DATA_NUMBER,
                    true
                ),
                new et.Property(
                    "data_description",
                    VALIDATE_STRING,
                    true
                ),
            ],
            [
                new et.Property(
                    "date",
                    VALIDATE_STRING,
                    false
                ),
                new et.Property(
                    "data_image",
                    VALIDATE_IMAGE,
                    false
                ),
                new et.Property(
                    "data_number",
                    VALIDATE_OBSERVATION_DATA_NUMBER,
                    false
                ),
                new et.Property(
                    "data_description",
                    VALIDATE_STRING,
                    false
                ),
            ],
            [POST, PATCH, DELETE],
            ["data_image", "url"],
            true,
            OBSERVATION_ADD_EMBEDDED_SELF_LINKS
        )
    }
};

/* Declare Credential EntityType separate from Collections since
 * end users do not directly post Credentials (but they are instead posted
 * as part of new Teacher entities). Therefore, generic CRUD functionality
 * should not consider Credential entity type valid type. */
const CREDENTIAL_ENTITY_TYPE = new et.EntityType(
    CREDENTIAL,
    0,
    [        
        new et.Property(
            "password",
            VALIDATE_PASSWORD,
            true
        ),
        new et.Property(
            "secret_questions",
            VALIDATE_SECRET_QUESTIONS,
            true
        )
    ],
    [
        new et.Property(
            "password",
            VALIDATE_PASSWORD,
            false
        ),
        new et.Property(
            "secret_questions",
            VALIDATE_SECRET_QUESTIONS,
            false
        )
    ],
    [POST, PUT, PATCH, DELETE],
    null,
    false
);

/* Freeze the exports object since all exports from this module are constants. */
module.exports = Object.freeze({
    "PORT": PORT,
    "SECRET": SECRET,
    "BUCKET_NAME": BUCKET_NAME,
    "CLOUD_STORAGE_BASE_URL": CLOUD_STORAGE_BASE_URL,
    "DEFAULT_PROFILE_PHOTO": DEFAULT_PROFILE_PHOTO,
    "PROJECT": PROJECT,
    "TEACHER": TEACHER,
    "OBSERVATION": OBSERVATION,
    "CREDENTIAL": CREDENTIAL,
    "PROJECTS": PROJECTS,
    "TEACHERS": TEACHERS,
    "OBSERVATIONS": OBSERVATIONS,
    "STRING": STRING,
    "OBJECT": OBJECT,
    "NUMBER": NUMBER,
    "BOOLEAN": BOOLEAN,
    "POST": POST,
    "GET": GET,
    "PUT": PUT,
    "PATCH": PATCH,
    "DELETE": DELETE,
    "GET_ONE": GET_ONE,
    "GET_LIST": GET_LIST,
    "JSON_MIME_TYPE": JSON_MIME_TYPE,
    "FORM_DATA_MIME_TYPE": FORM_DATA_MIME_TYPE,
    "CONTENT_TYPE_HEADER": CONTENT_TYPE_HEADER,
    "IMAGE_MIME_TYPES_ALLOWED": IMAGE_MIME_TYPES_ALLOWED,
    "IMAGE_FORMAT_ERROR": IMAGE_FORMAT_ERROR,
    "INVALID_IMAGE_URL": INVALID_IMAGE_URL,
    "NO_SUCH_COLLECTION": NO_SUCH_COLLECTION,
    "INVALID_ID": INVALID_ID,
    "INVALID_PROPERTIES": INVALID_PROPERTIES,
    "INVALID_UPDATE": INVALID_UPDATE,
    "ITEM_NOT_FOUND": ITEM_NOT_FOUND,
    "ANCESTOR_NOT_FOUND": ANCESTOR_NOT_FOUND,
    "TEACHER_NOT_FOUND": TEACHER_NOT_FOUND,
    "CREDENTIAL_NOT_FOUND": CREDENTIAL_NOT_FOUND,
    "SERVER_ERROR": SERVER_ERROR,
    "RESET_CODE_LIFETIME": RESET_CODE_LIFETIME,
    "COLLECTIONS": COLLECTIONS,
    "CREDENTIAL_ENTITY_TYPE": CREDENTIAL_ENTITY_TYPE
});
