// workflowScore.mjs - Scores resume against job description
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, UpdateCommand } from '@aws-sdk/lib-dynamodb';

const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION || 'ap-south-1' });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

export const handler = async (event) => {
    console.log('ScoreResume handler invoked', JSON.stringify(event, null, 2));

    const { jobId, resumeText, jobDescription, jobSkills } = event;

    // Simple scoring logic
    const scoring = {
        originalScore: 75,
        matchedSkills: jobSkills || [],
        missingSkills: ['AWS', 'Python'],  // Simplified - in real implementation, parse from job description
        recommendations: ['Add cloud computing experience', 'Highlight Python projects']
    };

    // Update job status in DynamoDB
    try {
        await docClient.send(new UpdateCommand({
            TableName: process.env.RESUME_TABLE_NAME || 'ResumeForgeLogs',
            Key: { jobId },
            UpdateExpression: 'SET #status = :status, #scoring = :scoring',
            ExpressionAttributeNames: {
                '#status': 'status',
                '#scoring': 'scoring'
            },
            ExpressionAttributeValues: {
                ':status': 'scoring',
                ':scoring': scoring
            }
        }));
        console.log('Updated job status to scoring');
    } catch (error) {
        console.error('Failed to update DynamoDB:', error);
    }

    return scoring;
};
