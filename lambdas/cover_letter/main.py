"""Cover Letter Generator Lambda."""
import json
import os
from typing import Any, Dict

import boto3

MODEL_ARN = os.environ.get("BEDROCK_MODEL_ID", "anthropic.claude-3-sonnet-20240229-v1:0")
bedrock = boto3.client("bedrock-runtime")

BASE_PROMPT = (
    "Draft a concise cover letter using the tailored CV content and job description insights. "
    "Maintain ATS-friendly formatting and include 3-4 JD keywords verbatim."
)


def lambda_handler(event: Dict[str, Any], _context: Any) -> Dict[str, Any]:
    tailored_cv = event.get("tailored_cv", {})
    jd_analysis = event.get("jd_analysis", {})
    name = event.get("name", "Candidate")

    if not tailored_cv:
        return {"statusCode": 400, "body": json.dumps({"message": "tailored_cv is required"})}

    payload = json.dumps(
        {
            "prompt": f"{BASE_PROMPT}\nNAME:{name}\nCV:{tailored_cv}\nJD:{jd_analysis}"[:12000]
        }
    )
    if os.environ.get("OFFLINE", "false").lower() == "true":
        letter = f"Dear Hiring Manager, {name} is excited to apply."
    else:
        response = bedrock.invoke_model(
            body=payload, modelId=MODEL_ARN, accept="application/json", contentType="application/json"
        )
        body = json.loads(response["body"].read())
        letter = body.get("content", body)

    return {"statusCode": 200, "body": json.dumps({"cover_letter": letter})}


if __name__ == "__main__":
    print(lambda_handler({"tailored_cv": {"summary": "builder"}}, None))
