"""CV Extractor Lambda.

- Accepts S3 object key and file metadata from API Gateway event.
- Outputs plain text plus rough section splits for downstream services.
"""
import json
import os
from typing import Any, Dict

import boto3

S3_BUCKET = os.environ.get("UPLOAD_BUCKET", "fitmycv-uploads")
s3 = boto3.client("s3")


def lambda_handler(event: Dict[str, Any], _context: Any) -> Dict[str, Any]:
    object_key = event.get("object_key")
    if not object_key:
        return {"statusCode": 400, "body": json.dumps({"message": "object_key is required"})}

    response = s3.get_object(Bucket=S3_BUCKET, Key=object_key)
    raw_bytes = response["Body"].read()

    # TODO: add real PDF/DOCX parsing with PyMuPDF / python-docx
    raw_text = raw_bytes.decode(errors="ignore")
    sections = {
        "summary": raw_text[:280],
        "skills": [],
        "experience": [raw_text[:800]],
        "projects": [],
        "education": [],
        "certifications": [],
    }

    # Create result object
    result = {
        "sections": sections,
        "raw_text": raw_text,
        "success": True
    }

    # Upload result to S3 to avoid Step Function 256KB payload limit
    output_key = f"cv_extractions/{object_key}.json"
    s3.put_object(
        Bucket=S3_BUCKET,
        Key=output_key,
        Body=json.dumps(result),
        ContentType="application/json"
    )

    # Return S3 reference
    return {
        "extraction_bucket": S3_BUCKET,
        "extraction_key": output_key,
        "raw_text_s3_uri": f"s3://{S3_BUCKET}/{output_key}",  # For compatibility or debugging
        "success": True
    }


if __name__ == "__main__":
    print(lambda_handler({"object_key": "dev"}, None))
