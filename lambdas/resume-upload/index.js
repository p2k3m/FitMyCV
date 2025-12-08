const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, PutCommand } = require("@aws-sdk/lib-dynamodb");
const { randomUUID } = require("crypto");

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

    let start = buffer.indexOf(boundaryBuffer) + boundaryBuffer.length;
    let end = buffer.indexOf(boundaryBuffer, start);

    while (end !== -1) {
        const headerEnd = buffer.indexOf('\r\n\r\n', start);
        if (headerEnd === -1 || headerEnd > end) {
            break;
        }

        const headerBuffer = buffer.subarray(start, headerEnd);
        const contentBuffer = buffer.subarray(headerEnd + 4, end - 2);

        const headerStr = headerBuffer.toString('utf8').trim();
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

exports.handler = async (event) => {
    console.log('Upload Handler Event:', JSON.stringify({ ...event, body: '[HIDDEN]' }));

    // Dynamic CORS Origin
    const origin = event.headers.origin || event.headers.Origin || '*';

    // Handle OPTIONS (Preflight)
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers: {
                "Access-Control-Allow-Origin": origin,
                "Access-Control-Allow-Methods": "POST, OPTIONS",
                "Access-Control-Allow-Headers": "Content-Type, X-Amz-Date, Authorization, X-Api-Key, X-Amz-Security-Token",
                "Access-Control-Allow-Credentials": "true"
            },
            body: JSON.stringify({ message: "CORS preflight check successful" })
        };
    }

    try {
        const bodyContent = event.isBase64Encoded ? Buffer.from(event.body, 'base64') : event.body;
        const parts = parseMultipart(bodyContent, event.headers);

        const resumePart = parts.find(p => p.name === 'resume');
        const jdPart = parts.find(p => p.name === 'manualJobDescription' || p.name === 'jobDescription');

        if (!resumePart) {
            return {
                statusCode: 400,
                headers: {
                    "Access-Control-Allow-Origin": origin,
                    "Access-Control-Allow-Credentials": "true"
                },
                body: JSON.stringify({ success: false, error: 'Missing resume file' })
            };
        }

        const jobId = randomUUID();
        const bucket = process.env.S3_BUCKET || 'resume-forge-data-ats';
        const key = `cv/${jobId}/original.pdf`;

        await s3.send(new PutObjectCommand({
            Bucket: bucket,
            Key: key,
            Body: resumePart.data,
            ContentType: resumePart.contentType || 'application/pdf'
        }));

        const jobDescription = jdPart ? jdPart.data.toString('utf8') : '';
        const tableName = process.env.RESUME_TABLE_NAME || 'ResumeForgeLogs'; // Hardcode fallback nicely

        const item = {
            jobId: jobId,
            timestamp: new Date().toISOString(),
            status: 'uploaded',
            s3Key: key,
            bucket: bucket,
            jobDescription: jobDescription,
            linkedinProfileUrl: jobId,
            candidateName: 'Uploaded via Fix (CJS)',
            resumePath: key
        };

        await docClient.send(new PutCommand({
            TableName: tableName,
            Item: item
        }));

        console.log('Successfully uploaded and persisted:', jobId);

        return {
            statusCode: 200,
            headers: {
                "Access-Control-Allow-Origin": origin,
                "Access-Control-Allow-Credentials": "true"
            },
            body: JSON.stringify({
                success: true,
                jobId: jobId,
                message: "Upload successful",
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
            headers: {
                "Access-Control-Allow-Origin": origin,
                "Access-Control-Allow-Credentials": "true"
            },
            body: JSON.stringify({ success: false, error: error.message })
        };
    }
};
