import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as sns from "aws-cdk-lib/aws-sns";
import * as sqs from "aws-cdk-lib/aws-sqs";
import * as subs from "aws-cdk-lib/aws-sns-subscriptions";
import * as s3n from "aws-cdk-lib/aws-s3-notifications";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as lambdanode from "aws-cdk-lib/aws-lambda-nodejs";
import * as events from "aws-cdk-lib/aws-lambda-event-sources";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";

export class DsAssignment2PhotoGalleryStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // 1. S3 Bucket for image uploads
    const imageBucket = new s3.Bucket(this, "ImageUploadBucket", {
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    // 2. DLQ for invalid image formats
    const deadLetterQueue = new sqs.Queue(this, "DLQ", {
      queueName: "InvalidImageDLQ",
      retentionPeriod: cdk.Duration.days(14),
    });

    // 3. SNS Topic
    const uploadTopic = new sns.Topic(this, "ImageUploadTopic", {
      displayName: "Image Upload Topic",
    });

    // 4. SQS Queue subscribed to SNS
    const imageQueue = new sqs.Queue(this, "ImageUploadQueue", {
      receiveMessageWaitTime: cdk.Duration.seconds(10),
    });

    uploadTopic.addSubscription(new subs.SqsSubscription(imageQueue));

    // 5. S3 notification to SNS
    imageBucket.addEventNotification(
      s3.EventType.OBJECT_CREATED,
      new s3n.SnsDestination(uploadTopic)
    );

    // 6. DynamoDB Table for image records
    const imageTable = new dynamodb.Table(this, "ImageTable", {
      partitionKey: { name: "id", type: dynamodb.AttributeType.STRING },
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // 7. Lambda: Log valid image uploads
    const logImageFn = new lambdanode.NodejsFunction(this, "LogImageFn", {
      runtime: lambda.Runtime.NODEJS_20_X,
      entry: `${__dirname}/../lambdas/logImage.ts`,
      handler: "handler",
      timeout: cdk.Duration.seconds(10),
      memorySize: 128,
      environment: {
        BUCKET_NAME: imageBucket.bucketName,
        REGION: "eu-west-1",
        DLQ_URL: deadLetterQueue.queueUrl,
        TABLE_NAME: imageTable.tableName,
      },
    });

    imageBucket.grantRead(logImageFn);
    deadLetterQueue.grantSendMessages(logImageFn);
    imageTable.grantWriteData(logImageFn);

    logImageFn.addEventSource(
      new events.SqsEventSource(imageQueue, {
        batchSize: 5,
        maxBatchingWindow: cdk.Duration.seconds(5),
      })
    );

    // 8. Lambda: Remove invalid image
    const removeImageFn = new lambdanode.NodejsFunction(this, "RemoveImageFn", {
      architecture: lambda.Architecture.ARM_64,
      runtime: lambda.Runtime.NODEJS_22_X,
      entry: `${__dirname}/../lambdas/removeImage.ts`,
      timeout: cdk.Duration.seconds(10),
      memorySize: 128,
      environment: {
        REGION: "eu-west-1",
      },
    });

    removeImageFn.addEventSource(
      new events.SqsEventSource(deadLetterQueue, {
        batchSize: 5,
        maxBatchingWindow: cdk.Duration.seconds(5),
      })
    );

    imageBucket.grantDelete(removeImageFn);

    // 9. Lambda: Add Metadata
    const addMetadataFn = new lambdanode.NodejsFunction(this, "AddMetadataFn", {
      runtime: lambda.Runtime.NODEJS_20_X,
      entry: `${__dirname}/../lambdas/addMetadata.ts`,
      handler: "handler",
      environment: {
        REGION: "eu-west-1",
        TABLE_NAME: imageTable.tableName,
      },
    });

    uploadTopic.addSubscription(
      new subs.LambdaSubscription(addMetadataFn, {
        filterPolicy: {
          metadata_type: sns.SubscriptionFilter.stringFilter({
            allowlist: ["Caption", "Date", "Name"],
          }),
        },
      })
    );

    imageTable.grantWriteData(addMetadataFn);

    // 10. Lambda: Update Status
    const updateStatusFn = new lambdanode.NodejsFunction(this, "UpdateStatusFn", {
      runtime: lambda.Runtime.NODEJS_20_X,
      entry: `${__dirname}/../lambdas/updateStatus.ts`,
      handler: "handler",
      environment: {
        REGION: "eu-west-1",
        TABLE_NAME: imageTable.tableName,
      },
    });

    uploadTopic.addSubscription(
      new subs.LambdaSubscription(updateStatusFn, {
        filterPolicyWithMessageBody: {
          update: sns.FilterOrPolicy.policy({
            exists: sns.SubscriptionFilter.existsFilter()
          })
        }
      })
    );    

    imageTable.grantWriteData(updateStatusFn);

    // 12. Lambda: Confirmation Mailer
    const confirmationMailerFn = new lambdanode.NodejsFunction(
      this,
      "ConfirmationMailerFn",
      {
        runtime: lambda.Runtime.NODEJS_20_X,
        entry: `${__dirname}/../lambdas/confirmationMailer.ts`,
        handler: "handler",
        environment: {
          REGION: "eu-west-1",
          TABLE_NAME: imageTable.tableName,
          SOURCE_EMAIL: "your_verified_email@example.com", 
        },
      }
    );

    uploadTopic.addSubscription(
      new subs.LambdaSubscription(confirmationMailerFn, {
        filterPolicyWithMessageBody: {
          update: sns.FilterOrPolicy.policy({
            exists: sns.SubscriptionFilter.existsFilter()
          })
        }
      })
    );    

    imageTable.grantReadData(confirmationMailerFn);

    // 12. Output bucket name
    new cdk.CfnOutput(this, "BucketName", {
      value: imageBucket.bucketName,
    });
  }
}
