#!/bin/bash
set -e

# Configuration
REGION="us-east-1"
TF_DIR="$(dirname "$0")"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo "Starting Terraform Import Process..."

# 1. Fetch CloudFront Distribution ID
echo "Fetching CloudFront Distribution ID..."
# We look for a distribution that matches the expected domain or comment if possible.
# Since we don't know the exact domain or it is 'fitmycv.example.com' in defaults, 
# better to check if we can find it by the error message or assume user provides it or we find it by tags.
# In the previous error, we saw the OAC name 'fitmycv-frontend-oac' exists.
# Let's try to find the distribution by tag Project=FitMyCV or simply list them.

# Hardcoded Distribution ID based on previous discovery
DIST_ID="E37O5HIIRD90L5"
# DIST_ID=$(aws cloudfront list-distributions --query "DistributionList.Items[?Tags.Items != null && contains(Tags.Items[?Key=='Project'].Value, 'FitMyCV')].Id | [0]" --output text)

# if [ "$DIST_ID" == "None" ] || [ -z "$DIST_ID" ]; then
#     echo "Could not auto-detect CloudFront Distribution with tag Project=FitMyCV."
#     echo "Attempting to list all distributions to help you find it:"
#     aws cloudfront list-distributions --query "DistributionList.Items[*].{ID:Id, Domain:DomainName, Comment:Comment}" --output table
#     read -p "Please enter the CloudFront Distribution ID to import: " DIST_ID
# fi

echo -e "Target Distribution ID: ${GREEN}${DIST_ID}${NC}"

# 2. Fetch Origin Access Control (OAC) ID
echo "Fetching Origin Access Control ID..."
OAC_ID=$(aws cloudfront list-origin-access-controls --query "OriginAccessControlList.Items[?Name=='fitmycv-frontend-oac'].Id | [0]" --output text)

if [ "$OAC_ID" == "None" ] || [ -z "$OAC_ID" ]; then
    echo -e "${RED}Error: OAC 'fitmycv-frontend-oac' not found!${NC}"
    echo "It might have a different name or not exist."
    exit 1
fi

echo -e "Target OAC ID: ${GREEN}${OAC_ID}${NC}"

# 3. Perform Imports
cd "$TF_DIR"

# Initialize terraform if needed (assumed already init, but good to ensure)
# terraform init

echo "Importing CloudFront Distribution..."
terraform import aws_cloudfront_distribution.cdn ${DIST_ID} || echo "Import of distribution failed or already imported."

echo "Importing Origin Access Control..."
terraform import aws_cloudfront_origin_access_control.frontend ${OAC_ID} || echo "Import of OAC failed or already imported."

# Bucket policy is usually dependent on the bucket name.
# Accessing the bucket name from basic vars or prompt might be needed.
# For now, let's assume the default 'fitmycv-frontend'.
BUCKET_NAME="fitmycv-frontend"
echo "Importing S3 Bucket Policy for ${BUCKET_NAME}..."
terraform import aws_s3_bucket_policy.frontend ${BUCKET_NAME} || echo "Import of bucket policy failed or already imported."

echo -e "${GREEN}Import process completed. Please run 'terraform plan' to verify state matches configuration.${NC}"
