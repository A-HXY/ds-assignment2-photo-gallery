import { SNSHandler } from "aws-lambda";
import {
  DynamoDBClient,
  UpdateItemCommand,
} from "@aws-sdk/client-dynamodb";

const ddb = new DynamoDBClient({ region: process.env.REGION });

export const handler: SNSHandler = async (event) => {
  console.log("UpdateStatusFn received event:", JSON.stringify(event));

  for (const record of event.Records) {
    const message = JSON.parse(record.Sns.Message);
    const { id, date, update } = message;
    const { status, reason } = update;

    if (!["Pass", "Reject"].includes(status)) {
      console.warn(`Invalid status: ${status}`);
      continue;
    }

    try {
      await ddb.send(
        new UpdateItemCommand({
          TableName: process.env.TABLE_NAME!,
          Key: { id: { S: id } },
          UpdateExpression:
            "SET #s = :s, #r = :r, #d = :d",
          ExpressionAttributeNames: {
            "#s": "status",
            "#r": "reason",
            "#d": "reviewDate",
          },
          ExpressionAttributeValues: {
            ":s": { S: status },
            ":r": { S: reason },
            ":d": { S: date },
          },
        })
      );
      console.log(`Status updated for ${id}`);
    } catch (err) {
      console.error("DynamoDB update error:", err);
    }
  }
};
