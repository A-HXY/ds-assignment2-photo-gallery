## Distributed Systems - Event-Driven Architecture.

__Name:__ Xinyue Huang

__Demo__: https://youtu.be/w1s0HbKjnl4

This repository contains the implementation of a skeleton design for an application that manages a photo gallery, illustrated below. The app uses an event-driven architecture and is deployed on the AWS platform using the CDK framework for infrastructure provisioning.

![](./images/arch.png)

### Code Status.

[Advice: In this section, state the status of your submission for each feature listed below. The status options are: (1) Completed & Tested; (2) Attempted (i.e. partially works); (3) Not Attempted. Option (1) implies the feature performs the required action (e.g. updates the table) __only when appropriate__, as dictated by the relevant filtering policy described in the specification.]

__Feature:__
+ Photographer:
  + Log new Images - Completed & Tested.
  + Metadata updating - Completed & Tested.
  + Invalid image removal - Completed & Tested.
  + Status Update Mailer - Completed & Tested.
+ Moderator
  + Status updating - Completed & Tested.

### Notes (Optional)

- All Lambda functions have been filtered using SNS `filterPolicy` or `filterPolicyWithMessageBody`, so only relevant messages trigger the correct handlers.
- Metadata messages with `metadata_type` attributes are routed exclusively to `addMetadataFn`.
- Review decision messages with an `update` field are routed only to `updateStatusFn` and `confirmationMailerFn`.
- Invalid image formats like `.txt` are successfully rerouted to the DLQ and handled by `removeImageFn`.
- DynamoDB table updates have been verified through the AWS CLI and CloudWatch Logs.
- The full deployment is managed with AWS CDK and verified through incremental testing.
- Email notifications require a verified sender email address in AWS SES.
