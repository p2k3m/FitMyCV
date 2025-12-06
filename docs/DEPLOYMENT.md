# Deployment Guide

## Prerequisites

### Required GitHub Secrets

Configure the following secrets in your GitHub repository (Settings → Secrets and variables → Actions):

| Secret Name | Description | Example Value |
|------------|-------------|--------------| 
| `AWS_ACCESS_KEY_ID` | AWS IAM Access Key with deployment permissions | `AKIA...` |
| `AWS_SECRET_ACCESS_KEY` | AWS IAM Secret Access Key | `wJalr...` |
| `AWS_REGION` | AWS Region for deployment | `ap-south-1` |
| `GEMINI_API_KEY` | Google Gemini API key for AI features | `AIzaS...` |
| `FRONTEND_BUCKET` | (Optional) S3 bucket for frontend files | `resume-forge-app-2025` |
| `DEPLOY_BUCKET` | (Optional) S3 bucket for Lambda artifacts | `resume-forge-data-ats` |

### IAM Permissions Required

The AWS credentials must have permissions for:
- **Lambda**: `UpdateFunctionCode`, `UpdateFunctionConfiguration`, `GetFunction`
- **S3**: `PutObject`, `GetObject`, `DeleteObject`, `ListBucket`
- **CloudFront**: `CreateInvalidation`
- **IAM**: `PutRolePolicy`, `GetRolePolicy`
- **DynamoDB**: Access to tables (via IAM role updates)
- **EventBridge**: Access to event bus (via IAM role updates)

## Deployment

### Automatic Deployment

The application automatically deploys when changes are pushed to the `main` branch:

```bash
git add .
git commit -m "Your changes"
git push origin main
```

Monitor the deployment progress in GitHub Actions: https://github.com/p2k3m/FitMyCV/actions

### Manual Testing

To test font files are properly included:

```bash
# Download deployed Lambda
aws lambda get-function --function-name ResumeForge-prod-workflow-generate \
  --query 'Code.Location' --output text | xargs curl -o /tmp/lambda.zip

# Verify font files
unzip -l /tmp/lambda.zip | grep "\.afm"
```

## Deployment Workflow

The GitHub Actions workflow performs the following steps:

1. **Build Frontend** - Compiles React application
2. **Upload Frontend to S3** - Deploys static assets
3. **Download Font Files** - Fetches standard PDF fonts from pdfkit package
4. **Package Lambda** - Creates deployment ZIP with code and fonts
5. **Update Lambda Functions** - Deploys to all 5 Lambda functions
6. **Update Environment Variables** - Configures Lambda settings
7. **Update IAM Policies** - Ensures proper permissions
8. **Apply Terraform** - Updates CloudFront distribution
9. **Invalidate CloudFront Cache** - Ensures fresh content delivery

## Architecture

### Lambda Functions

- `ResumeForge-prod-resume-upload` - Handles CV uploads and validation
- `ResumeForge-prod-workflow-generate` - Generates PDF documents
- `ResumeForge-prod-workflow-score` - Scores CV against job description
- `ResumeForge-prod-workflow-combine` - Combines CV and cover letter
- `ResumeForge-prod-workflow-enhancement-section` - Enhances CV sections

### Infrastructure

- **Frontend**: CloudFront CDN → S3 Static Website
- **API**: API Gateway → Lambda Functions
- **Workflow**: EventBridge → Step Functions → Lambda
- **Storage**: DynamoDB + S3

## Troubleshooting

### Font File Issues

If PDF generation fails with font errors:
```bash
# Check if fonts are in Lambda package
aws lambda get-function --function-name ResumeForge-prod-workflow-generate \
  --query 'Code.Location' --output text | xargs curl -o /tmp/test.zip
unzip -l /tmp/test.zip | grep Helvetica
```

### Environment Variable Issues

Verify Lambda configuration:
```bash
aws lambda get-function-configuration \
  --function-name ResumeForge-prod-resume-upload \
  --query 'Environment.Variables'
```

### IAM Permission Issues

Check CloudWatch Logs:
```bash
aws logs filter-log-events \
  --log-group-name /aws/lambda/ResumeForge-prod-resume-upload \
  --start-time $(($(date +%s) * 1000 - 600000)) \
  --filter-pattern "ERROR"
```

## Local Development

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Access at: http://localhost:5173

### Lambda Functions

Lambda functions use the `lambda_extracted/` directory as source. To test changes:

1. Modify code in `lambda_extracted/`
2. Test locally if possible
3. Commit and push to trigger deployment

## Rollback

If a deployment causes issues:

```bash
# Rollback Lambda to previous version
aws lambda update-function-code \
  --function-name ResumeForge-prod-resume-upload \
  --s3-bucket resume-forge-data-ats \
  --s3-key lambda_code_fixed.zip  # Previous version

# Or use AWS Console to roll back to a previous version
```

## Monitoring

- **CloudWatch Logs**: Monitor Lambda execution logs
- **Step Functions**: Track workflow executions at https://console.aws.amazon.com/states/
- **DynamoDB**: View job status in `ResumeForgeLogs` table
- **CloudFront**: Monitor CDN performance and cache hit ratio

## Support

For issues or questions:
1. Check CloudWatch Logs for error details
2. Verify GitHub Actions workflow completed successfully
3. Review Step Functions execution history
4. Check DynamoDB table for job status
