#!/bin/bash
API_URL="https://j3a7m3jz11.execute-api.ap-south-1.amazonaws.com/prod/api/process-cv"
FILE_PATH="dummy.pdf"
JD_TEXT="We are looking for a Software Engineer."

echo "Testing upload to $API_URL"

# Create dummy pdf if not exists
if [ ! -f "$FILE_PATH" ]; then
    echo "Creating dummy PDF"
    echo "Dummy PDF content" > "$FILE_PATH"
fi

curl -v -X POST "$API_URL" \
  -F "resume=@$FILE_PATH;type=application/pdf" \
  -F "manualJobDescription=$JD_TEXT" \
  > response.json 2> curl_output.txt

cat response.json
cat curl_output.txt
