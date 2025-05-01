import { SQSHandler } from "aws-lambda";
import {
  DynamoDBClient,
  PutItemCommand,
} from "@aws-sdk/client-dynamodb";

const ddbClient = new DynamoDBClient({});

export const handler: SQSHandler = async (event) => {
  console.log("Event received:", JSON.stringify(event));

  for (const record of event.Records) {
    try {
      // Step 1: Parse SNS message from SQS body
      const outer = JSON.parse(record.body);
      const message = JSON.parse(outer.Message);

      for (const s3Record of message.Records) {
        const fileName = decodeURIComponent(s3Record.s3.object.key.replace(/\+/g, " "));
        const fileType = fileName.split('.').pop()?.toLowerCase();

        if (fileType !== 'jpeg' && fileType !== 'png') {
          throw new Error(`Unsupported file type: ${fileType}`);
        }

        const tableName = process.env.TABLE_NAME;
        if (!tableName) {
          throw new Error("Missing TABLE_NAME environment variable");
        }

        // Step 2: Write to DynamoDB
        const command = new PutItemCommand({
          TableName: tableName,
          Item: {
            id: { S: fileName },
          },
        });

        await ddbClient.send(command);
        console.log(`Image "${fileName}" logged successfully.`);
      }
    } catch (err) {
      console.error("Error processing record:", err);
      throw err; // ensure SQS retries or DLQ receives it
    }
  }
};
