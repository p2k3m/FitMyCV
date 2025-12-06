#!/bin/bash
set -e

rest_api_id="j3a7m3jz11"
resource_id="v64no7"
region="ap-south-1"

echo "Creating Empty model..."
aws apigateway create-model --rest-api-id $rest_api_id --name "Empty" --content-type "application/json" --schema "{ \"type\": \"object\" }" --region $region || echo "Model Empty might already exist."

echo "Deleting existing OPTIONS method..."
aws apigateway delete-method --rest-api-id $rest_api_id --resource-id $resource_id --http-method OPTIONS --region $region || echo "Method not found, proceeding."

echo "Creating OPTIONS method..."
aws apigateway put-method --rest-api-id $rest_api_id --resource-id $resource_id --http-method OPTIONS --authorization-type NONE --region $region

echo "Creating Mock Integration..."
aws apigateway put-integration --rest-api-id $rest_api_id --resource-id $resource_id --http-method OPTIONS --type MOCK --request-templates '{"application/json":"{\"statusCode\": 200}"}' --region $region

echo "Creating Method Response..."
aws apigateway put-method-response --rest-api-id $rest_api_id --resource-id $resource_id --http-method OPTIONS --status-code 200 --response-parameters '{"method.response.header.Access-Control-Allow-Headers":false,"method.response.header.Access-Control-Allow-Methods":false,"method.response.header.Access-Control-Allow-Origin":false}' --region $region

echo "Creating Integration Response..."
aws apigateway put-integration-response --rest-api-id $rest_api_id --resource-id $resource_id --http-method OPTIONS --status-code 200 --response-templates '{"application/json": "{}"}' --response-parameters '{"method.response.header.Access-Control-Allow-Headers":"'"'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'"'","method.response.header.Access-Control-Allow-Methods":"'"'OPTIONS,POST,GET'"'","method.response.header.Access-Control-Allow-Origin":"'"'*'"'"}' --region $region

echo "Deploying API..."
aws apigateway create-deployment --rest-api-id $rest_api_id --stage-name prod --region $region

echo "Done."
