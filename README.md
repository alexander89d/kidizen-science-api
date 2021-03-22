# Kidizen Science API Specifications
**Notes:** 
- **Use HTTPS when calling out to all endpoints. HTTP connections will be redirected to use HTTPS.**
- **Request bodies, when required, must be formatted in JSON unless otherwise specified.**
- **For all routes requiring authorization, include a [Basic authorization header](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Authorization) with the credentials in the form "teacher_id:password" base64-encoded. HTTP request frameworks such as [axios](https://www.npmjs.com/package/axios#request-config) allow convenience configuration options for automatically formatting Basic authorization headers.**

## Table of Contents
[Images](#images)
- [Upload New Image](#upload-new-image)

[Teachers](#teachers)
- [Add New Teacher](#add-new-teacher)
- [Get a Teacher](#get-a-teacher)
- [Update a Teacher](#update-a-teacher)
- [Delete a Teacher](#delete-a-teacher)

[Credentials](#credentials)
- [Get Teacher Secret Questions](#get-teacher-secret-questions)
- [Update Teacher Password using Reset Code](#update-teacher-password-using-reset-code)
- [Update Teacher Credentials using Current Password](#update-teacher-credentials-using-current-password)

[Projects](#projects)
- [Add New Project](#add-new-project)
- [Get a Project](#get-a-project)
- [List Projects](#list-projects)
- [List Projects of Teacher](#list-projects-of-teacher)
- [Update a Project](#update-a-project)
- [Delete a Project](#delete-a-project)

[Project Observations](#project-observations)
- [Add New Observation](#add-new-observation)
- [Get an Observation](#get-an-observation)
- [List Observations](#list-observations)
- [Update an Observation](#update-an-observation)
- [Delete an Observation](#delete-an-observation)

## Images

**Notes:** 
- **Images can only be directly uploaded to this API. They can be fetched directly from Google's Cloud Storage via the URL returned.**
- **Images are automatically deleted from cloud storage upon deleting the entity with which they are associated or updating the image url of the entity with which they are associated.**
- **Due to this auto deletion of images, image URLs should only be associated with one entity.**

### Upload New Image
`POST /images`

**Authorization Required? Yes**

Notes:
- Image files must be uploaded as a field named 'image' in a request body of content type multipart/form-data.
- Images must be in JPEG or PNG format.
- Images must be no larger than 10 MB.
- Any valid teacher credentials can be used to authenticate at this endpoint. When creating a new account, teachers are given a default "blank" profile photo. They can then use this endpoint to upload a new profile photo or add photos for projects / observations.

#### Parameters
Name | Type | In | Required | Description
-----|------|----|----------|------------
image | JPEG or PNG file | body | yes | The image to upload to cloud storage (max size 10 MB).

##### Example Request Body (encoded as multipart/form-data)
    image: seagulls.jpg

#### Response Codes
Code | Status | Notes
-----|--------|------
201 | Created | The image has been uploaded to cloud storage. The response body contains its URL, which should be included with the new or updated project or observation with which it will be associated.
400 | Bad Request | The image file was of the wrong type, improperly sent to the API, or not included in the request body.
401 | Unauthorized | The user does not have the proper authentication to upload an image to cloud storage.
403 | Forbidden | The file size exceeds the 10 MB limit.
415 | Unsupported Media Type | The requet body is not of type multipart/form-data.

##### Example 201 Response Body
    {
        "publicUrl": "https://storage.googleapis.com/kidizen-science-images/1605334241334_proj1-seagulls.jpg"
    }

##### Example 400 Response Body
    {
        "error": "Images must be in JPEG or PNG format"
    }

##### Example 401 Response Body
    {
        "error": "You do not have the correct authentication to upload an image to cloud storage"
    }

##### Example 403 Response Body
    {
        "error": "Images can be no larger than 10 MB"
    }

##### Example 415 Response Body
    {
        "error": "This endpoint only accepts content of type multipart/form-data"
    }

[Back to Top](#table-of-contents)

## Teachers

**Note: Since a teacher must be authenticated to view their own profile information, getting all teachers' profiles is _not_ supported.**

### Add New Teacher
`POST /teachers`

**Authorization Required? No**

Notes: 
- Teachers should make note of their passwords as well as their answers to secret questions. Once created, they *cannot* be fetched from the server.
- A default "blank" profile photo is associated with a newly-created teacher account since adding a photo to Cloud Storage requires valid teacher credentials from a previously-created account. Therefore, no profile photo should be included when calling out to this endpoint.
- Use `PATCH /teachers/:teacherId` to add a profile photo: see [Update a Teacher](#update-a-teacher).

#### Parameters
Name | Type | In | Required | Description
-----|------|----|----------|------------
name | string | body | yes |The name of the teacher.
email | string | body | yes | The teacher's email.
school | string | body | yes | The teacher's school.
password | string | body | yes | The teacher's password (8-16 alphanumeric characters).
secret_questions | embedded JSON object | yes | Secret questions and their answers
*question_1* | *string* | *yes* | *A secret question whose answer is hard for others to guess.*
*answer_1* | *string* | *yes* | *The answer to the question.*
*question_2* | *string* | *yes* | *A different secret question (cannot be identical to question_1).*
*answer_2* | *string* | *yes* | *The answer to the question (cannot be identical to answer_1).*

##### Example Request Body
    {
        "name": "Albert Einstein",
        "email": "genius@bogusemail.com",
        "school": "Birdseye View Elementary School",
        "password": "relativity",
        "secret_questions": {
            "question_1": "What is the answer to life, the universe, and everything?",
            "answer_1": "42",
            "question_2": "What does the fox say?",
            "answer_2": "Ring-ding-ding-ding-dingeringeding!"
        }
    }

#### Response Codes
Code | Status | Notes
-----|--------|------
201 | Created |
400 | Bad Request | The parameters did not match the required format.

##### Example 201 Response Body
    {
        "id": "123456"
        "self": "<api_url>/teachers/123456"
    }

##### Example 400 Response Body
    {
        "error": "At least one parameter was missing, of the wrong type, or included uneccessarily."
    }

[Back to Top](#table-of-contents)

### Get a Teacher
`GET /teachers/:teacherId`

**Authorization Required? Yes**

#### Parameters
Name | Type | In | Required | Description
-----|------|----|----------|------------
teacher_id | string | path | yes | The id of the teacher.

#### Response Codes
Code | Status | Notes
-----|--------|------
200 | OK |
401 | Unauthorized | The user does not have the proper authentication to view the teacher's information.
404 | Not Found | The teacher with the given id could not be found.

##### Example 200 Response Body
    {
        "id": 123456,
        "self": "<api_url>/teachers/123456"
        "name": "Albert Einstein",
        "profile_photo": "https://pixabay.com/images/id-645461/",
        "email": "genius@bogusemail.com",
        "school": "Birdseye View Elementary School"
    }

##### Example 401 Response Body
    {
        "error": "You must be authenticated to view this record."
    }

##### Example 404 Response Body
    {
        "error": "The record you are seeking could not be found."
    }

[Back to Top](#table-of-contents)

### Update a Teacher
`PATCH /teachers/:teacherId`

**Authorization Required? Yes**

Notes: 
- Any properties the user does not want to update can be omitted from the request, although at least one property must be included. 
- A teacher's credentials _cannot_ be updated through this endpoint. See the [Credentials](#credentials) section below for information on how to update teacher credentials.
- A teacher's profile_photo can be updated through this route. Set to "null" to delete current profile_photo and set to default "blank" profile photo. If default "blank" profile_photo is already current profile_photo, it is _not_ deleted from Cloud Storage.

#### Parameters
Name | Type | In | Required | Description
-----|------|----|----------|------------
teacher_id | string | path | yes | The id of the teacher to update.
name | string | body | no\* |The name of the teacher.
profile_photo | string or null | body | no\* | The url where the photo is stored (null to revert to default).
email | string | body | no\* | The teacher's email.
school | string | body | no\* | The teacher's school.

\* At least one property to update must be included in the request body.

##### Example Request Body
    {
        "school": "Supernova Primary School"
    }

#### Response Codes
Code | Status | Notes
-----|--------|------
200 | OK |
400 | Bad Request | The parameters did not match the required format.
401 | Unauthorized | The user does not have the proper authentication to update this teacher's information.
404 | Not Found | The teacher with the given id could not be found.

##### Example 200 Response Body
    {
        "id": "123456"
        "self": "<api_url>/teachers/123456"
    }

##### Example 400 Response Body
    {
        "error": "No valid parameter was included or at least 1 parameter was invalid."
    }

##### Example 401 Response Body
    {
        "error": "You must be authenticated to update this record."
    }

##### Example 404 Response Body
    {
        "error": "The record you are seeking could not be found."
    }

[Back to Top](#table-of-contents)

### Delete a Teacher
`DELETE /teachers/:teacherId`

**Authorization Required? Yes**

Note: Deleting a teacher deletes all associated projects (including their observations) and the teacher's credentials.

#### Parameters
Name | Type | In | Required | Description
-----|------|----|----------|------------
teacher_id | string | path | yes | The id of the teacher.

#### Response Codes
Code | Status | Notes
-----|--------|------
204 | No Content | All projects, observations, and keys associated with this teacher have been deleted.
401 | Unauthorized | The user does not have the proper authentication to delete the teacher's record.
404 | Not Found | The teacher with the given id could not be found.

##### Example 401 Response Body
    {
        "error": "You must be authenticated to delete this record."
    }

##### Example 404 Response Body
    {
        "error": "The record you are seeking could not be found."
    }

[Back to Top](#table-of-contents)

## Credentials
**Note: Routes only exist for getting secret questions (for helping teachers reset passwords) and updating credentials. Creation and deletion of credentials is handled internally by the API when teacher entities are created or deleted.**

### Get Teacher Secret Questions
`GET /teachers/:teacherId/credentials`

**Authorization Required? No**

Note: Use this endpoint to obtain the secret questions associated with a teacher's account. Only the questions and a temporary reset code lasting 30 minutes will be returned; the answers to those questions and the current password will *not* be returned.

#### Parameters
Name | Type | In | Required | Description
-----|------|----|----------|------------
teacher_id | string | path | yes | The id of the teacher.

#### Response Codes
Code | Status | Notes
-----|--------|------
200 | OK |
404 | Not Found | The teacher with the given id could not be found.

##### Example 200 Response Body
    {
        "secret_question_1": "What is the answer to life, the universe, and everything?",
        "secret_question_2": "What does the fox say?",
        "reset_code": "1b9d6bcd-bbfd-4b2d-9b5d-ab8dfbbd4bed"
    }

##### Example 404 Response Body
    {
        "error": "The teacher with teacher_id could not be found"
    }

[Back to Top](#table-of-contents)

### Update Teacher Password using Reset Code
`PUT /teachers/:teacherId/credentials`

**Authorization Required? Yes (see notes below)**

Notes:
- Use this endpoint for resetting a teacher's password for whom a temporary reset code has previously been obtained using `GET /teachers/:teacherId/credentials`: see [Get Teacher Secret Questions](#get-teacher-secret-questions).
- Include the temporary reset code as the "password" in the authorization heading.
- Include a *new* password in the request body. It cannot match the current password.
- Include the *current* secret questions and their answers in the request body. They cannot be reset through this endpoint but are instead used for verification purposes.

#### Parameters
Name | Type | In | Required | Description
-----|------|----|----------|------------
password | string | body | yes | The teacher's password (8-16 alphanumeric characters).
secret_questions | embedded JSON object | body | yes | Secret questions and their answers
*question_1* | *string* | *body* | *yes* | *A secret question whose answer is hard for others to guess.*
*answer_1* | *string* | *body* | *yes* | *The answer to the question.*
*question_2* | *string* | *body* | *yes* | *A different secret question (cannot be identical to question_1).*
*answer_2* | *string* | *body* | *yes* | *The answer to the question (cannot be identical to answer_1).*

##### Example Request Body
    {
        "password": "EEqualsMC2",
        "secret_questions": {
            "question_1": "What is the answer to life, the universe, and everything?",
            "answer_1": "42",
            "question_2": "What does the fox say?",
            "answer_2": "Ring-ding-ding-ding-dingeringeding!"
        },
    }

#### Response Codes
Code | Status | Notes
-----|--------|------
204 | No Content | The password has been updated successfully. The temporary code has been deleted.
400 | Bad Request | The parameters did not match the required format.
401 | Unauthorized | The temporary code and/or the secret questions and answers were incorrect.
403 | Forbidden | Another user's credentials were proivded who cannot update this record.
403 | Forbidden | The new password provided matches the current password. A new one must be provided.
404 | Not Found | The teacher with the given ID could not be found.

##### Example 400 Response Body
    {
        "error": "At least one parameter was missing, of the wrong type, or included uneccessarily."
    }

##### Example 401 Response Body
    {
        "error": "You must be authenticated to update this record."
    }

##### Example 403 Response Body
    {
        "error": "The teacher whose credentials were provided cannot update this record."
    }

##### Example 404 Response Body
    {
        "error": "The teacher with teacher_id could not be found."
    }

[Back to Top](#table-of-contents)

### Update Teacher Credentials using Current Password
`PATCH /teachers/:teacherId/credentials`

**Authorization Required? Yes**

Note: If updating an embedded JSON object (a secret question), all fields of the embedded object must be included in the request body.

#### Parameters
Name | Type | In | Required | Description
-----|------|----|----------|------------
password | string | body | no\* | A new password (8-16 alphanumeric characters).
secret_questions | embedded JSON object | body | no\* | Secret questions and their answers
*question_1* | *string* | *body* | *no\** | *A secret question whose answer is hard for others to guess.*
*answer_1* | *string* | *body* | *no\** | *The answer to the question.*
*question_2* | *string* | *body* | *no\** | *A different secret question (cannot be identical to question_1).*
*answer_2* | *string* | *body* | *no\** | *The answer to the question (cannot be identical to answer_1).*

\* At least one property to update must be included in the request body.

##### Example Request Body
    {
        "password": "Manhattan"
    }

#### Response Codes
Code | Status | Notes
-----|--------|------
204 | No Content | The credentials have been updated successfully.
400 | Bad Request | The parameters did not match the required format.
401 | Unauthorized | The password for the teacher with teacher_id was incorrect.
403 | Forbidden | Another user's credentials were provided who cannot update this teacher's record.
404 | Not Found | The teacher with the given ID could not be found.

##### Example 400 Response Body
    {
        "error": "No valid parameter was included or at least 1 parameter was invalid."
    }

##### Example 401 Response Body
    {
        "error": "You must be authenticated to update this record."
    }

##### Example 403 Response Body
    {
        "error": "The teacher whose credentials were provided cannot update this record."
    }

##### Example 404 Response Body
    {
        "error": "The teacher with teacher_id could not be found."
    }

[Back to Top](#table-of-contents)

## Projects

### Add New Project
`POST /projects`

**Authorization Required? Yes**

#### Parameters
Name | Type | In | Required | Description
-----|------|----|----------|------------
teacher_id | string | body | yes | The id of the teacher sponsoring this project.
name | string | body | yes | The name of this project.
data_number\* | embedded JSON object | body | yes | Configuration info for this project's data number.
*data_number.name* | *string* | *body* | *yes* | *The name for this numeric data field.*
*data_number.must_be_unique* | *boolean* | *body* | *yes* | *Whether each item type observed should be counted just once.*
*data_number.number* | *number* | *body* | *yes* | *The initial value of the data number field.*
description_image | embedded JSON object | body | yes | The image to show with the project description.
*description_image.title* | *string* | *body* | *yes* | *The title of this image.*
*description_image.url* | *string* | *body* | *yes* | *The url at which this image is stored.*
*description_image.alt_text* | *string* | *body* | *yes* | *The image's description for screen reader users.*
description_text | string | body | yes | The description of this project.

\* The data_number property can only be directly set when creating a new project. The number will then be updated by the API automatically as observations are added or deleted.

##### Example Request Body
    {
        "teacher_id": "123456",
        "name": "Bird Species in Corvallis, Oregon",
        "data_number": {
            "name": "Number of Bird Species Reported",
            "must_be_unique": true,
            "number": 2
        },
        "description_image": {
            "title": "Seagulls",
            "url": "https://pixabay.com/images/id-4026280/",
            "alt_text": "3 seagulls flying over water"
        },
        "description_text": "Students will take pictures of birds throughout Corvallis, OR and identify the species type. Whenever a student reports a species type not already included in observations, the count of species found will be increased."
    }

#### Response Codes
Code | Status | Notes
-----|--------|------
201 | Created |
400 | Bad Request | The parameters did not match the required format.
401 | Unauthorized | The user does not have the proper authentication to assign a project to this teacher.
404 | Not Found | The teacher with the specified teacher_id could not be found.

##### Example 201 Response Body
    {
        "id": "456789"
        "self": "<api_url>/projects/456789"
    }

##### Example 400 Response Body
    {
        "error": "At least one parameter was missing, of the wrong type, or included uneccessarily."
    }

##### Example 401 Response Body
    {
        "error": "You do not have the correct authentication to assign this project to this teacher."
    }

##### Example 404 Response Body
    {
        "error": "The teacher with teacher_id cannot be found."
    }

[Back to Top](#table-of-contents)

### Get a Project
`GET /projects/:projectId`

**Authorization Required? No**

#### Parameters
Name | Type | In | Required | Description
-----|------|----|----------|------------
project_id | string | path | yes | The id of the project.

#### Response Codes
Code | Status | Notes
-----|--------|------
200 | OK |
404 | Not Found | The project with the given id could not be found.

##### Example 200 Response Body
    {
        "id": "456789",
        "self": "<api_url>/projects/456789",
        "teacher": {
            "id": "123456,
            "self": "<api_url>/teachers/123456"
        }
        "name": "Bird Species in Corvallis, Oregon",
        "data_number": {
            "name": "Number of Bird Species Reported",
            "must_be_unique": true,
            "number": 2
        },
        "description_image": {
            "title": "Seagulls",
            "url": "https://pixabay.com/images/id-4026280/",
            "alt_text": "3 seagulls flying over water"
        },
        "description_text": "Students will take pictures of birds throughout Corvallis, OR and identify the species type. Whenever a student reports a species type not already included in observations, the count of species found will be increased."
    }

##### Example 404 Response Body
    {
        "error": "The record you are seeking could not be found."
    }

[Back to Top](#table-of-contents)

### List Projects
`GET /projects`

**Authorization Required? No**

Note: This route returns a maximum of 5 project records per request. If there are more than 5 records after the starting point, a Datastore cursor will be included in the reponse body as the "cursor" property. Pass that cursor in as the "start" property of the query string to have the next request start with the result after which this request left off.

#### Parameters
Name | Type | In | Required | Description
-----|------|----|----------|------------
start | string | query string | no | The Datastore-provided cursor at which to start the retrieval.

#### Response Codes
Code | Status | Notes
-----|--------|------
200 | OK | A "next" URL is included in the response if there are more results to return (null otherwise).
403 | Forbidden | The "start" property of the query string is not a valid Datastore cursor.

##### Example 200 Response Body
    {
        entities: [
            {
                "id": "456789",
                "self": "<api_url>/projects/456789",
                "teacher": {
                    "id": "123456,
                    "self": "<api_url>/teachers/123456"
                }
                "name": "Bird Species in Corvallis, Oregon",
                "data_number": {
                    "name": "Number of Bird Species Reported",
                    "must_be_unique": true,
                    "number": 2
                },
                "description_image": {
                    "title": "Seagulls",
                    "url": "https://pixabay.com/images/id-4026280/",
                    "alt_text": "3 seagulls flying over water"
                },
                "description_text": "Students will take pictures of birds throughout Corvallis, OR and identify the species type. Whenever a student reports a species type not already included in observations, the count of species found will be increased."
            }
        ],
        next: null
    }

##### Example 403 Response Body
    {
        "error": "The starting cursor included with the request is invalid."
    }

[Back to Top](#table-of-contents)

### List Projects of Teacher
`GET /teachers/:teacherId/projects`

**Authorization Required? No**

Note: This route returns a maximum of 5 project records per request. If there are more than 5 records after the starting point, a Datastore cursor will be included in the reponse body as the "cursor" property. Pass that cursor in as the "start" property of the query string to have the next request start with the result after which this request left off.

#### Parameters
Name | Type | In | Required | Description
-----|------|----|----------|------------
teacher_id | string | path | yes | The teacher_id by which to filter projects.
start | string | query string | no | The Datastore-provided cursor at which to start the retrieval.

#### Response Codes
Code | Status | Notes
-----|--------|------
200 | OK | A "next" URL is included in the response if there are more results to return (null otherwise).
403 | Forbidden | The "start" property of the query string is not a valid Datastore cursor.
404 | Not Found | The teacher with the given id could not be found.

##### Example 200 Response Body
    {
        entities: [
            {
                "id": "456789",
                "self": "<api_url>/projects/456789",
                "teacher": {
                    "id": "123456,
                    "self": "<api_url>/teachers/123456"
                }
                "name": "Bird Species in Corvallis, Oregon",
                "data_number": {
                    "name": "Number of Bird Species Reported",
                    "must_be_unique": true,
                    "number": 2
                },
                "description_image": {
                    "title": "Seagulls",
                    "url": "https://pixabay.com/images/id-4026280/",
                    "alt_text": "3 seagulls flying over water"
                },
                "description_text": "Students will take pictures of birds throughout Corvallis, OR and identify the species type. Whenever a student reports a species type not already included in observations, the count of species found will be increased."
            }
        ],
        next: null
    }

##### Example 403 Response Body
    {
        "error": "The starting cursor included with the request is invalid."
    }

##### Example 404 Response Body
    {
        "error": "The teacher with the given id could not be found."
    }

[Back to Top](#table-of-contents)

### Update a Project
`PATCH /projects/:projectId`

**Authorization Required? Yes**

Notes: 
- Any properties the user does not want to update can be omitted from the request, although at least one property must be included. 
- The teacher cannot be updated since a project entity is bound to one specific teacher for the lifetime of the entity. 
- The data_number property cannot be modified since it is controlled internally by the API once initially configured.

#### Parameters
Name | Type | In | Required | Description
-----|------|----|----------|------------
project_id | string | path | yes | The id of the project to update.
name | string | body | no\* | The name of this project.
description_image | embedded JSON object | body | no\* | The image to show with the project description.
*description_image.title* | *string* | *body* | *no\** | *The title of this image.*
*description_image.url* | *string* | *body* | *no\** | *The url at which this image is stored.*
*description_image.alt_text* | *string* | *body* | *no\** | *The image's description for screen reader users.*
description_text | string | body | no\* | The description of this project.

\* At least one property to update must be included in the request body.

##### Example Request Body
    {
        "name": "Let's Find Cool Birds!"
    }

#### Response Codes
Code | Status | Notes
-----|--------|------
200 | OK |
400 | Bad Request | The parameters did not match the required format.
401 | Unauthorized | The user does not have the proper authentication to update this project's information.
404 | Not Found | The project with the given id could not be found.

##### Example 200 Response Body
    {
        "id": "456789"
        "self": "<api_url>/projects/456789"
    }

##### Example 400 Response Body
    {
        "error": "No valid parameter was included or at least 1 parameter was invalid."
    }

##### Example 401 Response Body
    {
        "error": "You must be authenticated to update this record."
    }

##### Example 404 Response Body
    {
        "error": "The record you are seeking could not be found."
    }

[Back to Top](#table-of-contents)

### Delete a Project
`DELETE /projects/:projectId`

**Authorization Required? Yes**

Note: Deleting a project deletes all associated observations and key sets.

#### Parameters
Name | Type | In | Required | Description
-----|------|----|----------|------------
project_id | string | path | yes | The id of the project.

#### Response Codes
Code | Status | Notes
-----|--------|------
204 | No Content | All observations and key sets associated with this project have been deleted.
401 | Unauthorized | The user does not have the proper authentication to delete the project's record.
404 | Not Found | The project with the given id could not be found.

##### Example 401 Response Body
    {
        "error": "You must be authenticated to delete this record."
    }

##### Example 404 Response Body
    {
        "error": "The record you are seeking could not be found."
    }

[Back to Top](#table-of-contents)

## Project Observations

### Add New Observation
`POST /projects/:projectId/observations`

**Authorization Required? Yes**

Note: Whenever a new observation is added to a project, the API recalculates the associated project's data_number.number property's value and updates it in the project's record in Datastore if needed.

#### Parameters
Name | Type | In | Required | Description
-----|------|----|----------|------------
project_id | string | path | yes | The id of the project to which to add this observation.
date | string | body | yes | The date on which this observation was recorded by the student.
data_image | embedded JSON object | body | yes | The image to show with this observation.
*data_image.title* | *string* | *body* | *yes* | *The title of this image.*
*data_image.url* | *string* | *body* | *yes* | *The url at which this image is stored.*
*data_image.alt_text* | *string* | *body* | *yes* | *The image's description for screen reader users.*
data_number | embedded JSON object | body | yes | Information about quantitative data observed.
*data_number.description* | *string* | *body* | *yes* | *The description of what was observed. Used by API when the project's data_number.must_be_unique property is set to true.*
*data_number.quantity* | *number* | *body* | *yes* | *How many of the item described were observed.*
data_description | string | body | yes | The description of the data recorded.

##### Example Request Body
    {
        "date": "2020-10-01T08:01:00.5Z",
        "data_image": {
            "title": "American Goldfinch",
            "url": "https://pixabay.com/images/id-5283117/",
            "alt_text": "An American Goldfinch."
        },
        "data_number":{
            "description": "American Goldfinch",
            "quantity": 1
        },
        "data_description": "I found this American Goldfinch on a walk with my family!"
    }

#### Response Codes
Code | Status | Notes
-----|--------|------
201 | Created |
400 | Bad Request | The parameters did not match the required format.
401 | Unauthorized | The user does not have the proper authentication to add an observation to this project.
404 | Not Found | The project with the specified project_id could not be found.

##### Example 201 Response Body
    {
        "id": "212434"
        "self": "<api_url>/projects/456789/observations/212434"
    }

##### Example 400 Response Body
    {
        "error": "At least one parameter was missing, of the wrong type, or included uneccessarily."
    }

##### Example 401 Response Body
    {
        "error": "You do not have the correct authentication to add this observation to this project."
    }

##### Example 404 Response Body
    {
        "error": "The project with project_id cannot be found."
    }

[Back to Top](#table-of-contents)

### Get an Observation
`GET /projects/:projectId/observations/:observationId`

**Authorization Required? No**

#### Parameters
Name | Type | In | Required | Description
-----|------|----|----------|------------
project_id | string | path | yes | The id of the project.
observation_id | string | path | yes | The id of the observation.

#### Response Codes
Code | Status | Notes
-----|--------|------
200 | OK |
404 | Not Found | The project with the project_id and/or the observation with the observation_id could not be found.

##### Example 200 Response Body
    {
        "id": "212434",
        "self": "<api_url>/projects/456789/observations/212434"
        "project": {
            "id": "456789"
            "self": "<api_url>/projects/456789"
        },
        "date": "2020-10-01T08:01:00.5Z",
        "data_image": {
            "title": "American Goldfinch",
            "url": "https://pixabay.com/images/id-5283117/",
            "alt_text": "An American Goldfinch."
        },
        "data_number": {
            "description": "American Goldfinch",
            "quantity": 1
        },
        "data_description": "I found this American Goldfinch on a walk with my family!"
    }

##### Example 404 Response Body
    {
        "error": "The record you are seeking could not be found."
    }

[Back to Top](#table-of-contents)

### List Observations

`GET /projects/:projectId/observations`

**Authorization Required? No**

Note: This route returns a maximum of 5 observation records per request. If there are more than 5 records after the starting point, a Datastore cursor will be included in the reponse body as the "cursor" property. Pass that cursor in as the "start" property of the query string to have the next request start with the result after which this request left off.

#### Parameters
Name | Type | In | Required | Description
-----|------|----|----------|------------
project_id | string | path | yes | The id of the project for which to get observations.
start | string | query string | no | The Datastore-provided cursor at which to start the retrieval.

#### Response Codes
Code | Status | Notes
-----|--------|------
200 | OK | A "next" URL is included in the response if there are more results to return (null otherwise).
403 | Forbidden | The "start" property of the query string is not a valid Datastore cursor.
404 | Not Found | The project with the given id could not be found.

##### Example 200 Response Body
    {
        entities: [
            {
                "id": "212434",
                "self": "<api_url>/projects/456789/observations/212434",
                "project": {
                    "id": "456789",
                    "self": "<api_url>/projects/456789"
                },
                "date": "2020-10-01T08:01:00.5Z",
                "data_image": {
                    "title": "American Goldfinch",
                    "url": "https://pixabay.com/images/id-5283117/",
                    "alt_text": "An American Goldfinch."
                },
                "data_number": {
                    "description": "American Goldfinch",
                    "quantity": 1
                },
                "data_description": "I found this American Goldfinch on a walk with my family!"
            },
            {
                "id": "987654",
                "self": "<api_url>/projects/456789/observations/987654",
                "project": {
                    "id": "456789",
                    "self": "<api_url>/projects/456789"
                },
                "date": "2020-10-11T11:11:11.11Z",
                "data_image": {
                    "title": "Western Bluebird",
                    "url": "https://pixabay.com/images/id-5283117/",
                    "alt_text": "A Western Bluebird with blue and orange colors."
                },
                "data_number": {
                    "description": "Western Bluebird",
                    "quantity": 1
                },
                "data_description": "I saw this Western Bluebird out my window!"
            },
            {
                "id": "656656",
                "self": "<api_url>/projects/456789/observations/656656",
                "project": {
                    "id": "456789",
                    "self": "<api_url>/projects/456789"
                },
                "date": "2020-10-07T11:51:33.627Z",
                "data_image": {
                    "title": "American Goldfinch",
                    "url": "https://pixabay.com/images/id-5283119/",
                    "alt_text": "A different American Goldfinch."
                },
                "data_number": {
                    "description": "American Goldfinch",
                    "quantity": 1
                },
                "data_description": "I found this American Goldfinch in my back yard."
            }
        ],
        next: null
    }

##### Example 403 Response Body
    {
        "error": "The starting cursor included with the request is invalid."
    }

##### Example 404 Response Body
    {
        "error": "The project with the given id could not be found."
    }

[Back to Top](#table-of-contents)

### Update an Observation
`PATCH /projects/:projectId/observations/:observationId`

**Authorization Required? Yes**

Notes: 
- Any properties the user does not want to update can be omitted from the request, although at least one property must be included. 
- The project_id property cannot be updated since an observation entity is bound to a specific project for the lifetime of the observation entity.
- Whenever the data_number property is included in an observation update request, the API recalculates the associated project's data_number.number property's value and updates it in the project's record in Datastore if needed.
- If updating an embedded JSON object, all fields of the embedded object must be included in the request body.

#### Parameters
Name | Type | In | Required | Description
-----|------|----|----------|------------
project_id | string | path | yes | The id of the project to which this observation belongs.
observation_id | string | path | yes | The id of the observation to update.
date | string | body | no\* | The date on which this observation was recorded by the student.
data_image | embedded JSON object | body | no\* | The image to show with this observation.
*data_image.title* | *string* | *body* | *no\** | *The title of this image.*
*data_image.url* | *string* | *body* | *no\** | *The url at which this image is stored.*
*data_image.alt_text* | *string* | *body* | *no\** | *The image's description for screen reader users.*
data_number | embedded JSON object | body | no\* | Information about quantitative data observed.
*data_number.description* | *string* | *body* | *no\** | *The description of what was observed. Used by API when the project's data_number.must_be_unique property is set to true.*
*data_number.quantity* | *number* | *body* | *no\** | *How many of the item described were observed.*
data_description | string | body | no\* | The description of the data recorded.

\* At least one property to update must be included in the request body.

##### Example Request Body
    {
        "data_number": {
            "description": "American Goldfinch",
            "quantity": 5
        }
    }

#### Response Codes
Code | Status | Notes
-----|--------|------
200 | OK |
400 | Bad Request | The parameters did not match the required format.
401 | Unauthorized | The user does not have the proper authentication to update this observation's information.
404 | Not Found | The project with the given project_id and/or the observation with the given observation_id could not be found.

##### Example 200 Response Body
    {
        "id": "212434"
        "self": "<api_url>/projects/456789/observations/212434"
    }

##### Example 400 Response Body
    {
        "error": "No valid parameter was included or at least 1 parameter was invalid."
    }

##### Example 401 Response Body
    {
        "error": "You must be authenticated to update this record."
    }

##### Example 404 Response Body
    {
        "error": "The record you are seeking could not be found."
    }

[Back to Top](#table-of-contents)

### Delete an Observation
`DELETE /projects/:projectId/observations/:observationId`

**Authorization Required? Yes**

Note: Whenever an observation is deleted from a project, the API recalculates the associated project's data_number.number property's value and updates it in the project's record in Datastore if needed.

#### Parameters
Name | Type | In | Required | Description
-----|------|----|----------|------------
project_id | string | path | yes | The id of the project to which the observation belongs.
observation_id | string | path | yes | The id of the observation.

#### Response Codes
Code | Status | Notes
-----|--------|------
204 | No Content | 
401 | Unauthorized | The user does not have the proper authentication to delete the observation's record.
404 | Not Found | The project with the given project_id and/or the observation with the given observation_id could not be found.

##### Example 401 Response Body
    {
        "error": "You must be authenticated to delete this record."
    }

##### Example 404 Response Body
    {
        "error": "The record you are seeking could not be found."
    }

[Back to Top](#table-of-contents)
