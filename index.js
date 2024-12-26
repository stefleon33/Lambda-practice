const { S3 } = require("@aws-sdk/client-s3");
const sharp = require("sharp");
const { Readable } = require("stream");

const s3 = new S3();
const BUCKET_NAME = "two-point-five-lambda";

// Helper function to convert a stream to a buffer
const streamToBuffer = async (stream) => {
    return new Promise((resolve, reject) => {
        const chunks = [];
        stream.on("data", (chunk) => chunks.push(chunk));
        stream.on("end", () => resolve(Buffer.concat(chunks)));
        stream.on("error", (err) => reject(err));
    });
};

exports.handler = async (event) => {
    console.log("Event received:", JSON.stringify(event, null, 2));

    // Extract the object key from the event
    const key = decodeURIComponent(
        event.Records[0].s3.object.key.replace(/\+/g, " ")
    );
    console.log(`Processing object: ${key}`);

    // Skip processing if the file is not in the "original-images/" folder
    if (!key.startsWith("original-images/")) {
        console.log("Skipping file as it is not in the 'original-images/' folder.");
        return { statusCode: 200, body: "File skipped" };
    }

    try {
        // Fetch the object from S3
        console.log("Fetching object from S3...");
        const { Body, ContentType } = await s3.getObject({
            Bucket: BUCKET_NAME,
            Key: key,
        });
        console.log("Object fetched successfully.");

        // Convert the readable stream to a buffer
        console.log("Converting image data to buffer...");
        const inputBuffer = await streamToBuffer(Body);
        console.log("Image data converted to buffer.");

        // Resize the image using Sharp
        console.log("Resizing image...");
        const resizedImage = await sharp(inputBuffer)
            .resize(300, 300, { fit: "inside", withoutEnlargement: true })
            .toBuffer();
        console.log("Image resized successfully.");

        // Generate the output key
        const outputKey = `resized-images/${key.split("/").pop()}`;
        console.log(`Uploading resized image to: ${outputKey}`);

        // Upload the resized image back to S3
        await s3.putObject({
            Bucket: BUCKET_NAME,
            Key: outputKey,
            Body: resizedImage,
            ContentType: ContentType,
        });
        console.log(`Resized image uploaded successfully to ${outputKey}.`);

        // Return success response
        return {
            statusCode: 200,
            body: `Successfully resized and uploaded ${key} to ${outputKey}`,
        };
    } catch (error) {
        console.error("Error processing image:", error);
        return {
            statusCode: 500,
            body: `Error resizing image: ${error.message}`,
        };
    }
};
