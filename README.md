# FitMyCV

Serverless pipeline that rewrites CVs to match any job description, then renders them with premium HTML/CSS templates for ATS-friendly PDFs and DOCX downloads.

## Phase-1 Scope (Dec 2025 Ready)
- Anonymous users: upload CV (PDF/DOCX), paste JD, click **Generate Tailored CV & Cover Letter**.
- LLM rewrites section-by-section: adds missing skills, adjusts designations, rewrites responsibilities for JD alignment, and optimizes ATS keywords.
- Template engine (HTML/CSS + Puppeteer-lite) produces visually attractive yet ATS-readable PDFs/DOCX.
- Outputs: Tailored CV (PDF/DOCX) and Cover Letter (PDF/text).

## Architecture Overview
- **Frontend:** React + Tailwind hosted on S3 + CloudFront (use the `cloudfront_domain` Terraform output as the canonical URL). No auth.
- **API Gateway:** Public REST endpoints (see [`docs/api-contract.md`](docs/api-contract.md)).
- **Lambdas:**
  - CV Extractor (PyMuPDF/python-docx) → plain text sections.
  - JD Analyzer (LLM) → skills, target title, keywords, verbs.
  - CV Rewriter (LLM) → JD-aligned sections with updated designations/skills.
  - CV Formatter (Puppeteer-lite/Chromium) → HTML → PDF/DOCX using templates in `templates/`.
  - Cover Letter Generator (LLM) → ATS-friendly cover letter.
- **Storage:** S3 uploads (raw CV), assets/templates, rendered outputs with pre-signed download URLs.
- **CI/CD:** GitHub Actions builds frontend, zips Lambdas, deploys Terraform stack (Copilot review is intentionally excluded from the pipeline).

## Deployed URL
- CloudFront distribution: `https://<cloudfront_domain>` where `<cloudfront_domain>` comes from `terraform output -raw cloudfront_domain` after deployment.

## Repository Layout
- `frontend/` – Vite + React + Tailwind starter UI with upload/JD inputs and download links.
- `lambdas/` – Python Lambda entry points for each microservice.
- `templates/` – Three HTML templates (modern, elegant, compact) used by the formatter.
- `prompts/` – Prompt library for section-wise rewriting.
- `docs/` – API contract and supporting docs.
- `infra/terraform/` – Minimal Terraform stack for S3 + CloudFront. Extend with API Gateway/Lambdas.
- `.github/workflows/deploy.yml` – CI pipeline for build + deploy.

## Running the Frontend Locally
```bash
cd frontend
npm install
npm run dev
```

## Deployment Notes
1. Set GitHub secrets: `AWS_ROLE_ARN`, `AWS_REGION`, `FRONTEND_BUCKET`, `DEPLOY_BUCKET` (for artifacts), and API keys for LLM services.
2. Run Terraform from `infra/terraform` to provision S3/CloudFront and capture the `cloudfront_domain` output. Update the placeholder URL above.
3. Upload HTML templates to the assets bucket if you want to serve them externally; the formatter Lambda expects them under `/opt/templates` via Lambda layer or S3 sync.
4. Wire API Gateway routes to the Lambdas to satisfy the contract in `docs/api-contract.md`.

## Quality Controls
- ATS-compliant text (no icons/tables in text layer).
- LLM rewrites focus on realism while injecting JD-aligned skills and impact statements.
- Templates own layout/beauty; LLM only produces text.
- Stateless, serverless delivery keeps costs minimal (<$10/month at low volume).
