import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as sns from "aws-cdk-lib/aws-sns";
import * as sqs from "aws-cdk-lib/aws-sqs";
import * as subs from "aws-cdk-lib/aws-sns-subscriptions";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as lambdanode from "aws-cdk-lib/aws-lambda-nodejs";
import * as events from "aws-cdk-lib/aws-lambda-event-sources";

export class DsAssignment2PhotoGalleryStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // S3 Bucket
    const imageBucket = new s3.Bucket(this, "PhotoGalleryImageBucket", {
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    // DynamoDB table
    const imageTable = new dynamodb.Table(this, "ImageTable", {
      partitionKey: { name: "id", type: dynamodb.AttributeType.STRING },
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // SNS Topic
    const imageTopic = new sns.Topic(this, "ImageEventTopic", {
      displayName: "PhotoGalleryImageTopic",
    });

    // SQS DLQ
    const deadLetterQueue = new sqs.Queue(this, "DLQ", {
      retentionPeriod: cdk.Duration.days(14),
    });

    // SQS Queue for logging images
    const logImageQueue = new sqs.Queue(this, "LogImageQueue", {
      deadLetterQueue: {
        maxReceiveCount: 3,
        queue: deadLetterQueue,
      },
      visibilityTimeout: cdk.Duration.seconds(30),
    });

    // Subscription with filter policy: eventType === 'ImageUpload'
    imageTopic.addSubscription(
      new subs.SqsSubscription(logImageQueue, {
        filterPolicy: {
          eventType: sns.SubscriptionFilter.stringFilter({
            allowlist: ["ImageUpload"],
          }),
        },
      })
    );

    // Lambda: Log Image
    const logImageFn = new lambdanode.NodejsFunction(this, "LogImageFunction", {
      runtime: lambda.Runtime.NODEJS_18_X,
      entry: `${__dirname}/../lambdas/logImage.ts`,
      timeout: cdk.Duration.seconds(10),
      environment: {
        TABLE_NAME: imageTable.tableName,
        BUCKET_NAME: imageBucket.bucketName,
      },
    });

    // Grant permissions to lambda
    imageTable.grantWriteData(logImageFn);
    imageBucket.grantRead(logImageFn);

    // Add event source from SQS
    logImageFn.addEventSource(
      new events.SqsEventSource(logImageQueue, {
        batchSize: 5,
      })
    );

    // Output for CLI use
    new cdk.CfnOutput(this, "ImageBucketName", {
      value: imageBucket.bucketName,
    });
    new cdk.CfnOutput(this, "TopicArn", {
      value: imageTopic.topicArn,
    });
  }
}
