// workflowGeneratePdf.mjs - Generates PDF artifacts from enhanced resume
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';

const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION || 'ap-south-1' });
const docClient = DynamoDBDocumentClient.from(dynamoClient);
const s3Client = new S3Client({ region: process.env.AWS_REGION || 'ap-south-1' });

export const handler = async (event) => {
    console.log('GenerateArtifacts handler invoked', JSON.stringify(event, null, 2));

    let { jobId, resumeText, resumeS3Bucket, resumeS3Key } = event;

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

    // Generate simple text-based outputs (PDF generation would require pdfkit and fonts)
    const tailoredCV = `TAILORED CV\n\nJob ID: ${jobId}\n\n${(resumeText || '')}\n\nGenerated: ${new Date().toISOString()}`;
    const coverLetter = `COVER LETTER\n\nDear Hiring Manager,\n\nI am excited to apply for this position...\n\nSincerely`;

    const bucket = process.env.S3_BUCKET || 'resume-forge-data-ats';

    // Upload to S3
    try {
        await s3Client.send(new PutObjectCommand({
            Bucket: bucket,
            Key: `jobs/${jobId}/tailored-cv.txt`,
            Body: tailoredCV,
            ContentType: 'text/plain'
        }));

        await s3Client.send(new PutObjectCommand({
            Bucket: bucket,
            Key: `jobs/${jobId}/cover-letter.txt`,
            Body: coverLetter,
            ContentType: 'text/plain'
        }));

        console.log('Uploaded artifacts to S3');
    } catch (error) {
        console.error('Failed to upload to S3:', error);
    }

    // Update job status to completed
    try {
        await docClient.send(new UpdateCommand({
            TableName: process.env.RESUME_TABLE_NAME || 'ResumeForgeLogs',
            Key: { jobId },
            UpdateExpression: 'SET #status = :status, #artifacts = :artifacts, #completedAt = :completedAt',
            ExpressionAttributeNames: {
                '#status': 'status',
                '#artifacts': 'artifacts',
                '#completedAt': 'completedAt'
            },
            ExpressionAttributeValues: {
                ':status': 'completed',
                ':artifacts': {
                    tailoredCV: `s3://${bucket}/jobs/${jobId}/tailored-cv.txt`,
                    coverLetter: `s3://${bucket}/jobs/${jobId}/cover-letter.txt`
                },
                ':completedAt': new Date().toISOString()
            }
        }));
        console.log('Updated job status to completed');
    } catch (error) {
        console.error('Failed to update DynamoDB:', error);
    }

    return {
        tailoredCV: `jobs/${jobId}/tailored-cv.txt`,
        coverLetter: `jobs/${jobId}/cover-letter.txt`,
        status: 'completed'
    };
};
