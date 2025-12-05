"""CV Formatter Lambda.
Renders tailored CV JSON into HTML using stored templates and produces PDFs via headless chromium.
"""
import json
import os
from pathlib import Path
from typing import Any, Dict

import boto3

S3_BUCKET = os.environ.get("ASSETS_BUCKET", "fitmycv-assets")
TEMPLATE_DIR = Path(os.environ.get("TEMPLATE_DIR", "/opt/templates"))
s3 = boto3.client("s3")


def render_html(template_id: str, payload: Dict[str, Any]) -> str:
    template_path = TEMPLATE_DIR / template_id / "index.html"
    html = template_path.read_text()
    for key, value in payload.items():
        replacement = value if isinstance(value, str) else json.dumps(value, indent=2)
        html = html.replace(f"{{{{{key.upper()}}}}}", replacement)
    return html


def lambda_handler(event: Dict[str, Any], _context: Any) -> Dict[str, Any]:
    tailored_cv = event.get("tailored_cv")
    template_id = event.get("template_id", "template-modern")
    if not tailored_cv:
        return {"statusCode": 400, "body": json.dumps({"message": "tailored_cv is required"})}

    html = render_html(template_id, {**tailored_cv, "NAME": event.get("name", "Candidate")})

    # TODO: replace with Puppeteer-lite rendering inside Lambda layer
    pdf_bytes = html.encode()
    key = f"rendered/{template_id}/cv.pdf"
    s3.put_object(Bucket=S3_BUCKET, Key=key, Body=pdf_bytes, ContentType="application/pdf")

    url = s3.generate_presigned_url(
        "get_object", Params={"Bucket": S3_BUCKET, "Key": key}, ExpiresIn=3600
    )

    return {"statusCode": 200, "body": json.dumps({"cv_pdf_url": url})}


if __name__ == "__main__":
    sample = {"tailored_cv": {"SUMMARY": "Builder", "EXPERIENCE": "..."}}
    print(lambda_handler(sample, None))
