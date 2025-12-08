import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import { randomUUID } from "crypto";

const s3 = new S3Client({});
const ddb = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(ddb);

// Simple multipart parser
function parseMultipart(body, headers) {
    const contentType = headers['content-type'] || headers['Content-Type'];
    if (!contentType) throw new Error('Missing Content-Type');

    // Extract boundary
    const boundaryMatch = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i);
    if (!boundaryMatch) throw new Error('Missing boundary in Content-Type');
    const boundary = boundaryMatch[1] || boundaryMatch[2];

    const buffer = Buffer.isBuffer(body) ? body : Buffer.from(body);
    const boundaryBuffer = Buffer.from(`--${boundary}`);
    const parts = [];

    let start = buffer.indexOf(boundaryBuffer) + boundaryBuffer.length; // Skip first boundary
    let end = buffer.indexOf(boundaryBuffer, start);

    while (end !== -1) {
        // Part is between start and end
        // But usually there is \r\n after boundary

        // Find header end (\r\n\r\n)
        const headerEnd = buffer.indexOf('\r\n\r\n', start);
        if (headerEnd === -1 || headerEnd > end) {
            // Malformed or no headers?
            break;
        }

        const headerBuffer = buffer.subarray(start, headerEnd);
        const contentBuffer = buffer.subarray(headerEnd + 4, end - 2); // Exclude trailing \r\n before next boundary

        const headerStr = headerBuffer.toString('utf8').trim(); // Trim leading \r\n if any
        const headers = {};

        headerStr.split('\r\n').forEach(line => {
            const [key, ...vals] = line.split(':');
            if (key) headers[key.trim().toLowerCase()] = vals.join(':').trim();
        });

        const contentDisposition = headers['content-disposition'];
        if (contentDisposition) {
            const nameMatch = contentDisposition.match(/name="([^"]+)"/);
            const filenameMatch = contentDisposition.match(/filename="([^"]+)"/);

            parts.push({
                name: nameMatch ? nameMatch[1] : null,
                filename: filenameMatch ? filenameMatch[1] : null,
                contentType: headers['content-type'],
                data: contentBuffer
            });
        }

        start = end + boundaryBuffer.length;
        end = buffer.indexOf(boundaryBuffer, start);
    }

    return parts;
}

export const handler = async (event) => {
    console.log('Upload Handler Event:', JSON.stringify({ ...event, body: '[HIDDEN]' }));

    try {
        const bodyContent = event.isBase64Encoded ? Buffer.from(event.body, 'base64') : event.body;
        const parts = parseMultipart(bodyContent, event.headers);

        const resumePart = parts.find(p => p.name === 'resume');
        const jdPart = parts.find(p => p.name === 'manualJobDescription' || p.name === 'jobDescription');

        if (!resumePart) {
            return {
                statusCode: 400,
                body: JSON.stringify({ success: false, error: 'Missing resume file' })
            };
        }

        const jobId = randomUUID();
        const bucket = process.env.S3_BUCKET || 'resume-forge-data-ats'; // Fallback from logs
        const key = `cv/${jobId}/original.pdf`;

        // Upload to S3
        await s3.send(new PutObjectCommand({
            Bucket: bucket,
            Key: key,
            Body: resumePart.data,
            ContentType: resumePart.contentType || 'application/pdf'
        }));

        // Get Job Description
        const jobDescription = jdPart ? jdPart.data.toString('utf8') : '';

        // Write to DynamoDB (ResumeForgeLogs)
        // Ensure we write enough data for StreamProcessor
        const tableName = process.env.RESUME_TABLE_NAME;

        const item = {
            jobId: jobId,
            timestamp: new Date().toISOString(),
            status: 'uploaded',
            s3Key: key, // Crucial for StreamProcessor
            bucket: bucket,
            jobDescription: jobDescription,
            // Add backwards compat fields found in logs
            linkedinProfileUrl: jobId, // Seems misused as ID
            candidateName: 'Uploaded via Fix',
            resumePath: key // Redundant but safe
        };

        await docClient.send(new PutCommand({
            TableName: tableName,
            Item: item
        }));

        console.log('Successfully uploaded and persisted:', jobId);

        return {
            statusCode: 200,
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Credentials": true
            },
            body: JSON.stringify({
                success: true,
                jobId: jobId,
                message: "Upload successful",
                // Mimic old response structure partially
                upload: {
                    bucket: bucket,
                    key: key
                }
            })
        };

    } catch (error) {
        console.error('Upload Error:', error);
        return {
            statusCode: 500,
            headers: { "Access-Control-Allow-Origin": "*" },
            body: JSON.stringify({ success: false, error: error.message })
        };
    }
};
