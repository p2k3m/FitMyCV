// workflowCombine.mjs - Combines all enhancements into updated resume
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, UpdateCommand } from '@aws-sdk/lib-dynamodb';

const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION || 'ap-south-1' });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

export const handler = async (event) => {
    console.log('CombineEnhancements handler invoked', JSON.stringify(event, null, 2));

    const { jobId, resumeText, sectionResults } = event;

    // Combine all enhancement results
    const appliedEnhancements = (sectionResults || []).map(result => result.type).join(', ');

    const combined = {
        updatedResume: resumeText + '\n\n[Enhanced Sections: ' + appliedEnhancements + ']',
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
