import { S3 } from "@aws-sdk/client-s3";
import sharp from "sharp";

const s3 = new S3();
const BUCKET_NAME = "";

const streamToBuffer = (stream) => new Promise((resolve, reject) => {
    const chunks = [];
    stream.on('data', chunk => chunks.push(chunk));
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    stream.on('error', reject);
});

export const handler = async (event) => {
    console.log("Event:", JSON.stringify(event, null, 2));

    const key = decodeURIComponent(
        event.Records[0].s3.object.key.replace(/\+/g, " ")
    );
    console.log("Processing key:", key);

    if (!key.startsWith("original-images/")) {
        console.log("Not processing this file as it's not in the original-images/ folder");
        return { statusCode: 200, body: "File skipped" };
    }

    try {
        console.log("Fetching object from S3");
        const { Body, ContentType } = await s3.getObject({
            Bucket: BUCKET_NAME,
            Key: key,
        });
        console.log("Object fetched successfully");

        console.log("Reading image data");
        const inputBuffer = await streamToBuffer(Body);
        console.log("Image data read successfully");

        console.log("Resizing image");
        const resizedImage = await sharp(inputBuffer)
            .resize(300, 300, { fit: "inside", withoutEnlargement: true })
            .toBuffer();
        console.log("Image resized successfully");

        const outputKey = `resized-images/${key.split("/").pop()}`;
        console.log("Uploading resized image");
        await s3.putObject({
            Bucket: BUCKET_NAME,
            Key: outputKey,
            Body: resizedImage,
            ContentType: ContentType,
        });
        console.log("Resized image uploaded successfully");

        console.log(`Successfully resized ${key} to ${outputKey}`);
        return { statusCode: 200, body: "Image resized successfully" };
    } catch (error) {
        console.error("Error processing image:", error);
        return { statusCode: 500, body: `Error resizing image: ${error.message}` };
    }
};