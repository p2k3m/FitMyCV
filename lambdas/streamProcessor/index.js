exports.handler = async (event, context) => {
    // Robust logging at start
    console.log('Stream Processor Started', {
        requestId: context.requestId,
        env: {
            AWS_REGION: process.env.AWS_REGION,
            STATE_MACHINE_ARN: process.env.STATE_MACHINE_ARN
        }
    });

    try {
        // Safe Import Pattern: Prevent cold-start crashes from hiding logs
        const { SFNClient, StartExecutionCommand } = require('@aws-sdk/client-sfn');
        const { unmarshall } = require('@aws-sdk/util-dynamodb');

        const region = process.env.AWS_REGION || 'ap-south-1';
        const sfnClient = new SFNClient({ region: region });

        // Use provided env var or fallback to known hardcoded global
        const STATE_MACHINE_ARN = process.env.STATE_MACHINE_ARN ||
            'arn:aws:states:ap-south-1:957650740525:stateMachine:ResumeForge-resume-flow';

        console.log('Configuration Loaded', { region, STATE_MACHINE_ARN });

        for (const record of event.Records) {
            try {
                // Process logic inline to access scope
                if (record.eventName !== 'INSERT' && record.eventName !== 'MODIFY') {
                    console.log('Skipping event type:', record.eventName);
                    continue;
                }

                if (!record.dynamodb || !record.dynamodb.NewImage) {
                    console.warn('Missing DynamoDB Image', record.eventID);
                    continue;
                }

                const newItem = unmarshall(record.dynamodb.NewImage);

                // Strict check for "uploaded" status
                if (newItem.status !== 'uploaded') {
                    console.log('Skipping status:', newItem.status, 'JobId:', newItem.jobId);
                    continue;
                }

                console.log('Processing Job:', newItem.jobId);

                const input = {
                    jobId: newItem.jobId,
                    resumePath: newItem.resumePath || newItem.key || newItem.s3Key || '',
                    jobDescription: newItem.jobDescription || newItem.sessionInputs?.jobDescription || '',
                    jobSkills: newItem.jobSkills || [],
                    manualCertificates: newItem.manualCertificates || [],
                    targetTitle: newItem.targetTitle || 'General Application',
                    bucket: newItem.bucket || newItem.s3Bucket || process.env.S3_BUCKET || 'resume-forge-data-ats',
                    requestId: newItem.requestId || newItem.jobId
                };

                const executionName = `job-${newItem.jobId}-${Date.now()}`;

                const command = new StartExecutionCommand({
                    stateMachineArn: STATE_MACHINE_ARN,
                    name: executionName,
                    input: JSON.stringify(input)
                });

                const result = await sfnClient.send(command);
                console.log('SUCCESS: Step Function Started', {
                    executionArn: result.executionArn,
                    jobId: newItem.jobId
                });

            } catch (recordError) {
                console.error('Record Processing Error', {
                    error: recordError.message,
                    stack: recordError.stack,
                    record: JSON.stringify(record)
                });
                // Note: We swallow individual record errors to avoid blocking the whole batch,
                // BUT in a strict system we might want to rethrow. 
                // For now, logging is priority.
            }
        }

    } catch (globalError) {
        console.error('FATAL: Stream Processor Crash', {
            error: globalError.message,
            stack: globalError.stack
        });
        throw globalError; // Ensure Lambda service knows it failed
    }
};
