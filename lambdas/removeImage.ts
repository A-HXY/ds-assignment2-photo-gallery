import { SQSHandler } from "aws-lambda";
import { S3Client, DeleteObjectCommand } from "@aws-sdk/client-s3";

const s3 = new S3Client({ region: process.env.REGION });

export const handler: SQSHandler = async (event) => {
  console.log("RemoveImageFn received event:", JSON.stringify(event));

  for (const record of event.Records) {
    try{
    const snsMessage = JSON.parse(record.body);
    const s3Event = JSON.parse(snsMessage.Message);
  
    for (const s3Record of s3Event.Records) {
      const bucket = s3Record.s3.bucket.name;
      const key = decodeURIComponent(
        s3Record.s3.object.key.replace(/\+/g, " ")
      );

        await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
        console.log(`Deleted invalid file: ${key}`);
      }
    } catch (err) {
      console.error("RemoveImageFn Error:", err);
    }
  }
};
