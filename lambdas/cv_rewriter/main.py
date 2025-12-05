"""CV Rewriter Lambda.
Uses JD insights to tailor CV content section-by-section.
"""
import json
import os
from typing import Any, Dict

import boto3

MODEL_ARN = os.environ.get("BEDROCK_MODEL_ID", "anthropic.claude-3-sonnet-20240229-v1:0")
bedrock = boto3.client("bedrock-runtime")

SECTION_ORDER = [
    "summary",
    "core_skills",
    "experience",
    "projects",
    "education",
    "certifications",
]


PROMPT = (
    "Rewrite the CV section so the candidate already meets the job requirements."
    " Preserve factual education/employers but update designations, add missing skills, and keep ATS-safe hyphen bullets."
)


def lambda_handler(event: Dict[str, Any], _context: Any) -> Dict[str, Any]:
    cv_sections = event.get("cv_sections", {})
    jd_analysis = event.get("jd_analysis", {})
    if not cv_sections or not jd_analysis:
        return {"statusCode": 400, "body": json.dumps({"message": "cv_sections and jd_analysis are required"})}

    tailored = {}
    for section in SECTION_ORDER:
        content = cv_sections.get(section) or cv_sections.get(section.replace("core_", ""))
        prompt = json.dumps({
            "prompt": f"{PROMPT}\nSECTION:{section}\nINPUT:{content}\nJD:{jd_analysis}"[:12000]
        })
        if os.environ.get("OFFLINE", "false").lower() == "true":
            tailored[section] = content
        else:
            response = bedrock.invoke_model(body=prompt, modelId=MODEL_ARN, accept="application/json", contentType="application/json")
            body = json.loads(response["body"].read())
            tailored[section] = body.get("content", body)

    return {"statusCode": 200, "body": json.dumps({"tailored_cv": tailored})}


if __name__ == "__main__":
    demo_event = {
        "cv_sections": {"summary": "Experienced engineer", "skills": ["python"]},
        "jd_analysis": {"target_title": "Senior Engineer", "required_skills": ["python"]},
    }
    print(lambda_handler(demo_event, None))
