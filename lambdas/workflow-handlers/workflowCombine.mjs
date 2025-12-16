// workflowCombine.mjs - Combines all enhancements into updated resume
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, UpdateCommand } from '@aws-sdk/lib-dynamodb';

const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');

const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION || 'ap-south-1' });
const docClient = DynamoDBDocumentClient.from(dynamoClient);
const s3Client = new S3Client({ region: process.env.AWS_REGION || 'ap-south-1' });

export const handler = async (event) => {
    console.log('CombineEnhancements handler invoked', JSON.stringify(event, null, 2));

    let { jobId, resumeText, resumeS3Bucket, resumeS3Key, sectionResults } = event;

    // Fetch resume text from S3 if not provided directly
    if (!resumeText && resumeS3Bucket && resumeS3Key) {
        console.log(`Fetching resume text from S3: ${resumeS3Bucket}/${resumeS3Key}`);
        try {
            const command = new GetObjectCommand({
                Bucket: resumeS3Bucket,
                Key: resumeS3Key
            });
            const response = await s3Client.send(command);
            const bodyContents = await response.Body.transformToString();
            const jsonContent = JSON.parse(bodyContents);
            resumeText = jsonContent.raw_text;
        } catch (error) {
            console.error('Failed to fetch resume from S3:', error);
            throw error;
        }
    }

    // Combine all enhancement results
    const appliedEnhancements = (sectionResults || []).map(result => result.type).join(', ');

    const combined = {
        updatedResume: (resumeText || '') + '\n\n[Enhanced Sections: ' + appliedEnhancements + ']',
        enhancementsApplied: sectionResults || [],
        timestamp: new Date().toISOString()
    };

    // Update job status in DynamoDB
    try {
        await docClient.send(new UpdateCommand({
            TableName: process.env.RESUME_TABLE_NAME || 'ResumeForgeLogs',
            Key: { jobId },
            UpdateExpression: 'SET #status = :status',
            ExpressionAttributeNames: {
                '#status': 'status'
            },
            ExpressionAttributeValues: {
                ':status': 'enhancing'
            }
        }));
        console.log('Updated job status to enhancing');
    } catch (error) {
        console.error('Failed to update DynamoDB:', error);
    }

    return combined;
};
