
const { LambdaClient, InvokeCommand } = require("@aws-sdk/client-lambda");

const client = new LambdaClient({ region: "ap-south-1" });

async function invoke() {
    const payload = {
        httpMethod: "GET",
        path: "/api/job-status",
        queryStringParameters: {
            jobId: "ca452764-ee33-4cbc-87ab-b9ee49977bcd"
        },
        requestContext: {
            http: { method: "GET" } // Format for HTTP API or REST API Proxy
        }
    };

    const command = new InvokeCommand({
        FunctionName: "ResumeForge-prod-resume-upload",
        InvocationType: "RequestResponse",
        LogType: "Tail",
        Payload: JSON.stringify(payload),
    });

    try {
        const response = await client.send(command);
        const logs = Buffer.from(response.LogResult, "base64").toString("utf-8");
        const result = Buffer.from(response.Payload).toString("utf-8");

        console.log("Response Payload:", result);
        console.log("------------------- LOGS -------------------");
        console.log(logs);
    } catch (error) {
        console.error("Error invoking lambda:", error);
    }
}

invoke();
