console.log("Loading Resume Upload Lambda Module");

// Pure function, no dependencies required
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
    console.log('Upload Handler Event:', JSON.stringify({
        httpMethod: event.httpMethod,
        path: event.path,
        headers: event.headers,
        requestContext: event.requestContext
    }));

    try {
        // ULTRA LAZY LOAD: Require EVERYTHING inside the handler.
        const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
        const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
        const { DynamoDBDocumentClient, PutCommand, GetCommand } = require("@aws-sdk/lib-dynamodb");
        const { randomUUID } = require("crypto");

        const s3 = new S3Client({});
        const ddb = new DynamoDBClient({});
        const docClient = DynamoDBDocumentClient.from(ddb);

        // Handle OPTIONS preflight request
        if (event.httpMethod === 'OPTIONS') {
            return {
                statusCode: 200,

                body: ""
            };
        }

        // Route: GET /api/job-status
        if (event.httpMethod === 'GET' && (event.resource === '/api/job-status' || event.path === '/api/job-status')) {
            const jobId = event.queryStringParameters && event.queryStringParameters.jobId;

            if (!jobId) {
                return {
                    statusCode: 400,

                    body: JSON.stringify({ success: false, error: 'Missing jobId parameter' })
                };
            }

            const tableName = process.env.RESUME_TABLE_NAME || 'ResumeForgeLogs';

            try {
                const result = await docClient.send(new GetCommand({
                    TableName: tableName,
                    Key: { jobId: jobId }
                }));

                if (!result.Item) {
                    return {
                        statusCode: 404,

                        body: JSON.stringify({ success: false, error: 'Job not found' })
                    };
                }

                return {
                    statusCode: 200,

                    body: JSON.stringify(result.Item)
                };
            } catch (dbError) {
                console.error('DynamoDB Error:', dbError);
                return {
                    statusCode: 500,

                    body: JSON.stringify({ success: false, error: 'Failed to fetch job status', details: dbError.message })
                };
            }
        }

        // Route: POST /api/process-cv
        const bodyContent = event.isBase64Encoded ? Buffer.from(event.body, 'base64') : event.body;
        const parts = parseMultipart(bodyContent, event.headers);

        const resumePart = parts.find(p => p.name === 'resume');
        const jdPart = parts.find(p => p.name === 'manualJobDescription' || p.name === 'jobDescription');
        const titlePart = parts.find(p => p.name === 'targetTitle');

        if (!resumePart) {
            return {
                statusCode: 400,

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
        const targetTitle = titlePart ? titlePart.data.toString('utf8') : 'General Application';
        const tableName = process.env.RESUME_TABLE_NAME || 'ResumeForgeLogs';

        const item = {
            jobId: jobId,
            timestamp: new Date().toISOString(),
            status: 'uploaded',
            s3Key: key,
            bucket: bucket,
            jobDescription: jobDescription,
            jobSkills: [],
            manualCertificates: [],
            targetTitle: targetTitle,
            // Backwards compat
            linkedinProfileUrl: jobId,
            candidateName: 'Uploaded via Ultra Lazy Load Fix',
            resumePath: key
        };

        await docClient.send(new PutCommand({
            TableName: tableName,
            Item: item
        }));

        console.log('Successfully uploaded and persisted:', jobId);

        const response = {
            statusCode: 200,

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

        console.log('Returning Response:', JSON.stringify(response));
        return response;

    } catch (error) {
        console.error('Handler Error:', error);
        return {
            statusCode: 500,

            body: JSON.stringify({ success: false, error: error.message, stack: error.stack })
        };
    }
};
