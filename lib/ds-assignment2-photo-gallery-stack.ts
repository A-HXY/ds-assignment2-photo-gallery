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

export class DsAssignment2PhotoGalleryStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // 1. Create the S3 bucket for image uploads
    const imageBucket = new s3.Bucket(this, "ImageUploadBucket", {
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    // 2. Create the SNS Topic for image upload events
    const uploadTopic = new sns.Topic(this, "ImageUploadTopic", {
      displayName: "Image Upload Topic",
    });

    // 3. Create an SQS queue to receive events from the topic
    const imageQueue = new sqs.Queue(this, "ImageUploadQueue", {
      receiveMessageWaitTime: cdk.Duration.seconds(10),
    });

    // 4. Subscribe the queue to the SNS topic
    uploadTopic.addSubscription(new subs.SqsSubscription(imageQueue));

    // 5. Configure S3 to notify SNS on object creation
    imageBucket.addEventNotification(
      s3.EventType.OBJECT_CREATED,
      new s3n.SnsDestination(uploadTopic)
    );

    // 6. Lambda function to log image upload info
    const logImageFn = new lambdanode.NodejsFunction(this, "LogImageFn", {
      runtime: lambda.Runtime.NODEJS_20_X,
      entry: `${__dirname}/../lambdas/logImage.ts`,
      handler: "handler",
      timeout: cdk.Duration.seconds(10),
      memorySize: 128,
      environment: {
        BUCKET_NAME: imageBucket.bucketName,
      },
    });
    
    //Create a Dead Letter Queue
    const deadLetterQueue = new sqs.Queue(this, "DLQ", {
      queueName: "InvalidImageDLQ",
      retentionPeriod: cdk.Duration.days(14),
    });    

    // Grant read access to the bucket
    imageBucket.grantRead(logImageFn);

    // 7. Trigger the Lambda from the SQS queue
    logImageFn.addEventSource(
      new events.SqsEventSource(imageQueue, {
        batchSize: 5,
        maxBatchingWindow: cdk.Duration.seconds(5),
      })
    );

    // Output bucket name for testing
    new cdk.CfnOutput(this, "BucketName", {
      value: imageBucket.bucketName,
    });
  }
}
