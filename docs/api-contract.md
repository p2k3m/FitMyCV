# FitMyCV API Contract

This document describes the Phase-1 serverless API for generating tailored CVs and cover letters. All endpoints are RESTful and fronted by API Gateway.

## Authentication
None required.

## Content Types
- **Request:** `application/json` unless uploading files.
- **Response:** `application/json` for metadata; downloads are pre-signed S3 URLs to PDF/DOCX files.

## Endpoints

### 1. Upload CV
- **POST** `/cv/upload`
- **Purpose:** Accept a user CV as PDF/DOCX and return a temporary upload record.
- **Request (multipart/form-data):**
  - `file` (required): PDF or DOCX file.
  - `user_session` (optional): UUID generated client-side to group requests.
- **Response 200:**
```json
{
  "upload_id": "uuid",
  "original_filename": "resume.pdf",
  "content_type": "application/pdf"
}
```
- **Notes:** Lambda stores the raw file in an S3 `uploads` prefix and forwards the object key to the Extractor.

### 2. Parse CV
- **POST** `/cv/parse`
- **Purpose:** Extract structured text sections from the uploaded CV.
- **Request:**
```json
{
  "upload_id": "uuid",
  "object_key": "uploads/uuid.pdf"
}
```
- **Response 200:**
```json
{
  "sections": {
    "summary": "...",
    "skills": ["python", "aws"],
    "experience": ["..."],
    "projects": ["..."],
    "education": ["..."],
    "certifications": ["..."]
  },
  "raw_text": "concatenated plain text"
}
```

### 3. Analyze JD
- **POST** `/jd/analyze`
- **Purpose:** Extract requirements and keywords from a pasted Job Description.
- **Request:**
```json
{
  "job_description": "Full text...",
  "target_role_hint": "Senior ML Engineer" // optional
}
```
- **Response 200:**
```json
{
  "target_title": "Senior Machine Learning Engineer",
  "required_skills": ["python", "mlops"],
  "good_to_have_skills": ["langchain"],
  "keyword_list": ["tensorflow", "sagemaker"],
  "role_alignment_points": ["own model lifecycle", "deploy on aws"],
  "tone": "professional"
}
```

### 4. Rewrite CV
- **POST** `/cv/rewrite`
- **Purpose:** Generate tailored CV sections aligned to the JD.
- **Request:**
```json
{
  "cv_sections": { /* output from Parse CV */ },
  "jd_analysis": { /* output from Analyze JD */ },
  "user_preferences": {
    "tone": "executive", // optional override
    "max_length_pages": 2
  }
}
```
- **Response 200:**
```json
{
  "tailored_cv": {
    "summary": "...",
    "core_skills": ["..."],
    "experience": [ {"company": "...", "title": "...", "bullets": ["..."] } ],
    "projects": [ {"name": "...", "impact": "..."} ],
    "education": ["..."],
    "certifications": ["..."]
  },
  "ats_keywords": ["..."],
  "assumptions": ["..."],
  "cover_letter": "..." // optional inline preview
}
```

### 5. Format CV & Cover Letter
- **POST** `/cv/format`
- **Purpose:** Apply HTML template(s) and render PDFs.
- **Request:**
```json
{
  "tailored_cv": { /* from Rewrite CV */ },
  "template_id": "template-modern",
  "include_docx": true
}
```
- **Response 200:**
```json
{
  "cv_pdf_url": "https://.../cv.pdf",
  "cv_docx_url": "https://.../cv.docx",
  "cover_letter_pdf_url": "https://.../cover-letter.pdf"
}
```

### 6. Health Check
- **GET** `/health`
- **Purpose:** Basic ping for uptime checks.
- **Response 200:** `{ "status": "ok", "timestamp": "..." }`

## Error Handling
Errors return standard AWS API Gateway format:
```json
{
  "message": "validation error: upload_id missing",
  "request_id": "...",
  "status_code": 400
}
```

## Versioning
Prefix future versions with `/v1/`. Current contract assumes `/v1` base path when deployed via API Gateway stage configuration.
