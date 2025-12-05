"""JD Analyzer Lambda.
Extracts keywords, skills, and role alignment cues from a job description.
"""
import json
import os
from typing import Any, Dict, List

import boto3

MODEL_ARN = os.environ.get("BEDROCK_MODEL_ID", "anthropic.claude-3-sonnet-20240229-v1:0")
bedrock = boto3.client("bedrock-runtime")


PROMPT_TEMPLATE = (
    "You are a JD analyst. Extract required skills, good-to-have skills, keywords, action verbs, and likely target title.\n"
    "Return JSON with keys: target_title, required_skills, good_to_have_skills, keyword_list, role_alignment_points, tone."
)


def lambda_handler(event: Dict[str, Any], _context: Any) -> Dict[str, Any]:
    job_description = event.get("job_description", "").strip()
    if not job_description:
        return {"statusCode": 400, "body": json.dumps({"message": "job_description is required"})}

    payload = json.dumps({"prompt": f"{PROMPT_TEMPLATE}\nJD:\n{job_description}"})
    # In production, call Bedrock/LLM. Here we stub a deterministic response for CI safety.
    if os.environ.get("OFFLINE", "false").lower() == "true":
        model_response = {
            "target_title": "Senior Machine Learning Engineer",
            "required_skills": ["python", "mlops", "aws"],
            "good_to_have_skills": ["langchain"],
            "keyword_list": ["sagemaker", "pytorch"],
            "role_alignment_points": ["own ml lifecycle", "deploy to production"],
            "tone": "professional",
        }
    else:
        response = bedrock.invoke_model(body=payload, modelId=MODEL_ARN, accept="application/json", contentType="application/json")
        body = json.loads(response["body"].read())
        model_response = body.get("content", body)

    return {"statusCode": 200, "body": json.dumps(model_response)}


if __name__ == "__main__":
    print(lambda_handler({"job_description": "We need an ML engineer on AWS."}, None))
