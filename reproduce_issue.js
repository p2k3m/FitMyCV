
const fs = require('fs');
const https = require('https');
const path = require('path');

// Create a dummy PDF file
const dummyPdfPath = path.join(__dirname, 'dummy.pdf');
fs.writeFileSync(dummyPdfPath, '%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<\n/Root 1 0 R\n>>\n%%EOF');

const boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW';
const hostname = 'j3a7m3jz11.execute-api.ap-south-1.amazonaws.com';
const pathStr = '/prod/api/process-cv';

const fileContent = fs.readFileSync(dummyPdfPath);

const postDataStart = [
    `--${boundary}`,
    'Content-Disposition: form-data; name="manualJobDescription"',
    '',
    'Software Engineer',
    `--${boundary}`,
    'Content-Disposition: form-data; name="resume"; filename="dummy.pdf"',
    'Content-Type: application/pdf',
    '',
    ''
].join('\r\n');

const postDataEnd = [
    '',
    `--${boundary}--`
].join('\r\n');

const options = {
    hostname: hostname,
    port: 443,
    path: pathStr,
    method: 'POST',
    headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': Buffer.byteLength(postDataStart) + fileContent.length + Buffer.byteLength(postDataEnd)
    }
};

const req = https.request(options, (res) => {
    let chunks = [];
    res.on('data', (d) => chunks.push(d));
    res.on('end', () => {
        const body = Buffer.concat(chunks).toString();
        console.log(`Status: ${res.statusCode}`);
        console.log(`Body: ${body}`);

        // Parse Job ID if successful
        try {
            const json = JSON.parse(body);
            if (json.jobId) {
                console.log(`Configuring GET request for Job ID: ${json.jobId}`);
                checkStatus(json.jobId);
            }
        } catch (e) {
            console.error("Failed to parse response");
        }
    });
});

req.on('error', (e) => {
    console.error(`problem with request: ${e.message}`);
});

req.write(postDataStart);
req.write(fileContent);
req.write(postDataEnd);
req.end();


function checkStatus(jobId) {
    const getOptions = {
        hostname: hostname,
        port: 443,
        path: `/prod/api/job-status?jobId=${jobId}`,
        method: 'GET'
    };

    const getReq = https.request(getOptions, (res) => {
        let chunks = [];
        res.on('data', (d) => chunks.push(d));
        res.on('end', () => {
            console.log(`GET Status: ${res.statusCode}`);
            console.log(`GET Body: ${Buffer.concat(chunks).toString()}`);
        });
    });
    getReq.end();
}
