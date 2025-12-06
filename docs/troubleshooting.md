# Troubleshooting

## CloudFront 403 (Forbidden) at `/` or `favicon.ico`
If `https://<cloudfront_domain>/` or `https://<cloudfront_domain>/favicon.ico` returns HTTP 403, CloudFront cannot read from the frontend S3 bucket. Common causes:

- **No frontend files uploaded.** CloudFront requests `index.html` as the default root object. If the bucket is empty, S3 responds with `AccessDenied`, which surfaces as 403.
- **Bucket policy missing the CloudFront origin access control (OAC).** The distribution relies on an OAC; without a matching bucket policy S3 blocks the request.
- **Requests bypass CloudFront.** Hitting the S3 website endpoint directly is blocked because the bucket is private; always use the CloudFront domain.

### How to fix
1. **Confirm files exist in the bucket**
   ```bash
   aws s3 ls s3://$FRONTEND_BUCKET/
   aws s3 cp frontend/dist/ s3://$FRONTEND_BUCKET/ --recursive  # after `npm run build`
   ```

2. **Verify the bucket policy includes the CloudFront distribution**
   ```bash
   aws s3api get-bucket-policy --bucket $FRONTEND_BUCKET | jq
   ```
   It should match the policy Terraform renders in `infra/terraform/main.tf` under `data "aws_iam_policy_document" "frontend_bucket"` with the `cloudfront.amazonaws.com` service principal and `AWS:SourceArn` set to the distribution ARN.

3. **Redeploy Terraform if policy is missing**
   ```bash
   cd infra/terraform
   terraform apply -var="frontend_bucket=$FRONTEND_BUCKET"
   ```

4. **Wait for distribution invalidation/propagation**
   CloudFront caches error responses briefly. If you just uploaded files or updated the policy, wait a few minutes or create an invalidation for `/` and `/favicon.ico`.

If the bucket contains the built frontend and the OAC policy is attached, the CloudFront domain should return 200 for both `/` and `/favicon.ico`.
