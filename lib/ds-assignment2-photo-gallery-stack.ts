import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';

import * as s3 from 'aws-cdk-lib/aws-s3';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as subs from 'aws-cdk-lib/aws-sns-subscriptions';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';

export class DsAssignment2PhotoGalleryStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // 1. S3 Bucket for Image Upload
    const imageBucket = new s3.Bucket(this, 'ImageBucket', {
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    // 2. DynamoDB Table to store image records
    const imageTable = new dynamodb.Table(this, 'ImageTable', {
      partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // 3. SNS Topic to distribute messages
    const topic = new sns.Topic(this, 'ImageTopic');

    // 4. Dead Letter Queue (DLQ)
    const dlq = new sqs.Queue(this, 'ImageDLQ', {
      queueName: 'ImageDLQ'
    });

    // 5. SQS Queue subscribed to SNS Topic (for Log Image)
    const imageQueue = new sqs.Queue(this, 'ImageQueue', {
      deadLetterQueue: {
        maxReceiveCount: 3,
        queue: dlq
      },
      queueName: 'ImageQueue'
    });

    // 6. Lambda: Log Image Uploads (subscribed to SQS)
    const logImageLambda = new lambda.Function(this, 'LogImageLambda', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('lambdas/logImage'),
      environment: {
        TABLE_NAME: imageTable.tableName
      }
    });

    // Grant write permission to Lambda
    imageTable.grantWriteData(logImageLambda);

    // 7. SNS subscription to SQS (for "image_upload" events only)
    topic.addSubscription(new subs.SqsSubscription(imageQueue, {
      filterPolicyWithMessageBody: {
        type: sns.SubscriptionFilter.stringFilter({
          allowlist: ['image_upload']
        })
      }
    }));    

    // Output important resource names
    new cdk.CfnOutput(this, 'BucketName', {
      value: imageBucket.bucketName,
      description: 'S3 Bucket for image uploads',
    });

    new cdk.CfnOutput(this, 'TopicArn', {
      value: topic.topicArn,
      description: 'SNS Topic ARN for publishing messages',
    });

    new cdk.CfnOutput(this, 'QueueUrl', {
      value: imageQueue.queueUrl,
      description: 'SQS Queue URL for image uploads',
    });

    new cdk.CfnOutput(this, 'TableName', {
      value: imageTable.tableName,
      description: 'DynamoDB table storing image metadata',
    });
  }
}
