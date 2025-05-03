import { SNSHandler } from "aws-lambda";
import { DynamoDBClient, UpdateItemCommand } from "@aws-sdk/client-dynamodb";

const ddb = new DynamoDBClient({ region: process.env.REGION });

export const handler: SNSHandler = async (event) => {
  console.log("AddMetadata event:", JSON.stringify(event));

  for (const record of event.Records) {
    const message = JSON.parse(record.Sns.Message);
    const metadataType = record.Sns.MessageAttributes?.metadata_type?.Value;

    if (!metadataType || !["Caption", "Date", "Name"].includes(metadataType)) {
      console.log("Invalid or missing metadata_type, skipping.");
      continue;
    }

    const id = message.id;
    const value = message.value;

    const updateParams = {
      TableName: process.env.TABLE_NAME!,
      Key: { id: { S: id } },
      UpdateExpression: `SET #attr = :val`,
      ExpressionAttributeNames: { "#attr": metadataType },
      ExpressionAttributeValues: { ":val": { S: value } },
    };

    try {
      await ddb.send(new UpdateItemCommand(updateParams));
      console.log(`Metadata added: ${metadataType} = ${value} for ${id}`);
    } catch (err) {
      console.error("Error updating metadata:", err);
    }
  }
};
