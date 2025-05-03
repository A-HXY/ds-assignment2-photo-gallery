import { SQSHandler } from "aws-lambda";
import { S3Client,GetObjectCommand,GetObjectCommandInput, } from "@aws-sdk/client-s3";
import { SQSClient,SendMessageCommand, } from "@aws-sdk/client-sqs";

const s3 = new S3Client({ region: process.env.REGION || "eu-west-1" });
const sqs = new SQSClient({ region: process.env.REGION || "eu-west-1" });
const DLQ_URL = process.env.DLQ_URL!;

export const handler: SQSHandler = async (event) => {
  console.log("SQS Event: ", JSON.stringify(event));

  for (const record of event.Records) {
    const snsMessage = JSON.parse(record.body);
    const s3Event = JSON.parse(snsMessage.Message);

    for (const s3Record of s3Event.Records) {
      const bucketName = s3Record.s3.bucket.name;
      const objectKey = decodeURIComponent(
        s3Record.s3.object.key.replace(/\+/g, " ")
      );

      if (!objectKey.endsWith(".jpeg") && !objectKey.endsWith(".png")) {
        console.log("Invalid file type detected:", objectKey);

        await sqs.send(
          new SendMessageCommand({
            QueueUrl: DLQ_URL,
            MessageBody: JSON.stringify({ Records: [s3Record] }),
          })
        );
        
        console.log("Message sent to DLQ.");
        continue;
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

