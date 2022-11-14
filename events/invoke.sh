export AWS_DEFAULT_REGION=eu-west-1
export AWS_ACCESS_KEY=accesskey
export AWS_SECRET_ACCESS_KEY=secretaccesskey

aws lambda invoke --function-name rsp-cpms-checking-dev-checkForOrphanedPayments \
  --cli-binary-format raw-in-base64-out \
  --payload file://sqs_event.json \
  --cli-binary-format raw-in-base64-out  \
  log-out.json \
  --endpoint http://localhost:3002