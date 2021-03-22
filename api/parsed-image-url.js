/**
 * @class An image URL parsed into its 3 components (baseUrl + bucketName + fileName)
 */
class ParsedImageUrl {
    /**
     * Constructs a ParsedImageURL from the URL passed in as a string.
     * 
     * @constructor
     * @param {string} imageUrl The image URL to parse.
     */
    constructor(imageUrl) {
        /* Split the URL at slashes. */
        const imageUrlArr = imageUrl.split('/');

        /* Throw an error if the imageUrlArr was not split into 5 components 
         * (protocol + empty string after first slash + hostname + bucketName + fileName). */
        if (imageUrlArr.length !== 5) {
            throw "The image URL has the wrong number of components.";
        }

        this.baseUrl = imageUrlArr[0] + "//" + imageUrlArr[2];
        this.bucketName = imageUrlArr[3];
        this.fileName = imageUrlArr[4];
    }
}

module.exports = {
    "ParsedImageUrl": ParsedImageUrl
};
