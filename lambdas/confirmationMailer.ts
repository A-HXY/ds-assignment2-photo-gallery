import { SNSHandler } from "aws-lambda";
import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";

const ses = new SESClient({ region: process.env.REGION });

export const handler: SNSHandler = async (event) => {
  console.log("ConfirmationMailer received:", JSON.stringify(event));

  for (const record of event.Records) {
    const message = JSON.parse(record.Sns.Message);
    const { id, update } = message;
    const { status, reason } = update;

    const email = process.env.RECIPIENT!;
    const subject = `Your photo ${id} has been reviewed`;
    const body = `Status: ${status}\nReason: ${reason}`;

    try {
      await ses.send(
        new SendEmailCommand({
          Destination: {
            ToAddresses: [email],
          },
          Message: {
            Subject: { Data: subject },
            Body: {
              Text: { Data: body },
            },
          },
          Source: process.env.SENDER!,
        })
      );
      console.log(`Email sent for image ${id}`);
    } catch (err) {
      console.error("SES send error:", err);
    }
  }
};
