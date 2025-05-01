import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as lambdanode from 'aws-cdk-lib/aws-lambda-nodejs';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as eventsources from 'aws-cdk-lib/aws-lambda-event-sources';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';

export class DsAssignment2PhotoGalleryStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Create a DynamoDB table
    const photoTable = new dynamodb.Table(this, 'PhotoTable', {
      partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // 2. Create an S3 bucket
    const bucket = new s3.Bucket(this, 'PhotoUploadBucket', {
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    // 3. Create a dead letter queue
    const dlq = new sqs.Queue(this, 'PhotoDLQ', {
      queueName: 'PhotoDLQ',
      retentionPeriod: cdk.Duration.days(1),
    });

    // 4. Create the main queue (connect to DLQ)
    const imageQueue = new sqs.Queue(this, 'PhotoQueue', {
      queueName: 'PhotoQueue',
      visibilityTimeout: cdk.Duration.seconds(30),
      deadLetterQueue: {
        maxReceiveCount: 3,
        queue: dlq,
      },
    });

    // 5. Create logImage Lambda
    const logImageFn = new lambdanode.NodejsFunction(this, 'LogImageFn', {
      runtime: lambda.Runtime.NODEJS_20_X,
      memorySize: 128,
      timeout: cdk.Duration.seconds(10),
      entry: 'lambdas/logImage.ts',
      environment: {
        TABLE_NAME: photoTable.tableName,
        BUCKET_NAME: bucket.bucketName,
      },
    });

    // 6. SQS → Lambda Trigger
    logImageFn.addEventSource(
      new eventsources.SqsEventSource(imageQueue, {
        batchSize: 5,
      })
    );

    // 7. Authorize Lambda to access DynamoDB&S3
    photoTable.grantWriteData(logImageFn);
    bucket.grantRead(logImageFn);

    // 8. Output the Bucket name (for convenient CLI upload and testing)
    new cdk.CfnOutput(this, 'UploadBucketName', {
      value: bucket.bucketName,
    });

    new cdk.CfnOutput(this, 'QueueName', {
      value: imageQueue.queueName,
    });
  }
}
