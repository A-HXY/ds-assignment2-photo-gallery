import { SQSHandler } from "aws-lambda";
import {
  S3Client,
  GetObjectCommand,
  GetObjectCommandInput,
} from "@aws-sdk/client-s3";

const s3 = new S3Client({ region: process.env.REGION || "eu-west-1" });

export const handler: SQSHandler = async (event) => {
  console.log("SQS Event: ", JSON.stringify(event));

  for (const record of event.Records) {
    const body = JSON.parse(record.body);
    const snsMessage = JSON.parse(body.Message);

    for (const s3Record of snsMessage.Records) {
      const bucketName = s3Record.s3.bucket.name;
      const objectKey = decodeURIComponent(
        s3Record.s3.object.key.replace(/\+/g, " ")
      );

      if (!objectKey.endsWith(".jpeg") && !objectKey.endsWith(".png")) {
        throw new Error("Unsupported file type: " + objectKey);
      }

      const getObjectParams: GetObjectCommandInput = {
        Bucket: bucketName,
        Key: objectKey,
      };

      try {
        const image = await s3.send(new GetObjectCommand(getObjectParams));
        console.log("Valid image received:", objectKey);
      } catch (err) {
        console.error("Error downloading image:", err);
      }
    }
  }
};
