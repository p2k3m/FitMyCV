const { SFNClient, StartExecutionCommand } = require('@aws-sdk/client-sfn');
const { unmarshall } = require('@aws-sdk/util-dynamodb');

const sfnClient = new SFNClient({ region: process.env.AWS_REGION || 'ap-south-1' });
const STATE_MACHINE_ARN = process.env.STATE_MACHINE_ARN ||
    'arn:aws:states:ap-south-1:957650740525:stateMachine:ResumeForge-resume-flow';

exports.handler = async (event, context) => {
    console.log('DynamoDB Stream event received', {
        recordCount: event.Records.length,
        requestId: context.requestId
    });

    for (const record of event.Records) {
        try {
            await processRecord(record);
        } catch (error) {
            console.error('Failed to process record', {
                eventID: record.eventID,
                error: error.message,
                stack: error.stack
            });
            // Don't throw - process other records even if one fails
        }
    }
};

async function processRecord(record) {
    // Only process INSERT events
    if (record.eventName !== 'INSERT') {
        console.log('Skipping non-INSERT event', {
            eventName: record.eventName,
            eventID: record.eventID
        });
        return;
    }

    if (!record.dynamodb?.NewImage) {
        console.warn('No NewImage in record', { eventID: record.eventID });
        return;
    }

    // Unmarshal DynamoDB record
    const newItem = unmarshall(record.dynamodb.NewImage);

    // Only trigger for jobs with status 'uploaded'
    if (newItem.status !== 'uploaded') {
        console.log('Skipping job with non-uploaded status', {
            jobId: newItem.jobId,
            status: newItem.status
        });
        return;
    }

    console.log('Processing new job', {
        jobId: newItem.jobId,
        status: newItem.status,
        hasJobDescription: !!newItem.jobDescription,
        itemKeys: Object.keys(newItem)
    });

    // Prepare Step Function input
    const input = {
        jobId: newItem.jobId,
        resumePath: newItem.resumePath || newItem.key || newItem.s3Key || '',
        jobDescription: newItem.jobDescription || '',
        bucket: newItem.bucket || newItem.s3Bucket || process.env.S3_BUCKET || 'resume-forge-data-ats',
        requestId: newItem.requestId || newItem.jobId
    };

    // Generate unique execution name
    const executionName = `job-${newItem.jobId}-${Date.now()}`;

    try {
        const command = new StartExecutionCommand({
            stateMachineArn: STATE_MACHINE_ARN,
            name: executionName,
            input: JSON.stringify(input)
        });

        const result = await sfnClient.send(command);

        console.log('Step Function execution started', {
            jobId: newItem.jobId,
            executionArn: result.executionArn,
            executionName
        });
    } catch (error) {
        console.error('Failed to start Step Function execution', {
            jobId: newItem.jobId,
            error: error.message,
            errorCode: error.name,
            stack: error.stack
        });
        throw error; // Re-throw to mark as failed in DynamoDB Streams
    }
}
