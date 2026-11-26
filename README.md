# rsp-cpms-checking-workflow
Polling workflow of CPMS receipts

Triggered from SQS Launched Payments queue

## Runtime and dependencies

The service runs on Node.js 24 and uses OSLS with Serverless Offline for local
execution. Its Secrets Manager integration uses AWS SDK for JavaScript v3 directly
through `@aws-sdk/client-secrets-manager`; no application code uses AWS SDK v2.

## Run locally

By default (or with `USE_SECRETS_MANAGER=true`), the service loads its settings
from AWS Secrets Manager. Set `SECRETS_MANAGER_SECRET_NAME` and authenticate
the AWS profile that can read that secret.
`npm run start` automatically loads a root `.env` file if present and passes
its variables to the local Lambda. Existing environment variables take
precedence over values in the file. The `.env` file is ignored by Git.
- `nvm use` (Node.js 24.15.0)
- npm 11.12.1 or later in the 11.x series
- `npm i`
- `npm run start`

To use local configuration instead, set the following in your root `.env`
(all values below are dummy examples):

```dotenv
USE_SECRETS_MANAGER=false
CLIENT_ID=dummy-client-id
CLIENT_SECRET=dummy-client-secret
REGION=eu-west-1
PAYMENT_SERVICE_URL=http://127.0.0.1:3031/
CPMS_SERVICE_URL=http://127.0.0.1:4441/
DOCUMENT_SERVICE_URL=http://127.0.0.1:3030/
```

All six configuration values are required. No Secrets Manager request is made
in this mode, and no secret name or AWS profile is required for configuration.
Dummy credentials only work with local mock services; AWS-protected downstream
APIs still require valid signing credentials. Never commit real credentials.
Restart `npm run start` after changing `.env`.

## To invoke with a local SQS message

Leave `npm run start` running. In a second terminal at the repository root, run:

```sh
./events/invoke.sh
cat events/log-out.json
```

The script requires AWS CLI v2 and invokes only the local Lambda on port 3002
without request signing, so it needs no credentials or profile in that terminal.
It sends `events/sqs_event.json` directly to the Lambda, not to an actual SQS queue.
When using Secrets Manager, the running Lambda still needs the authenticated `AWS_PROFILE` and
`SECRETS_MANAGER_SECRET_NAME` configured in the root `.env`. For an SSO profile,
authenticate with `aws sso login --profile YOUR_PROFILE` before starting.
Use approved dummy event values and verify the configured non-production targets:
the handler can write to the downstream Payments service.

## Package for development
- `npm run build`

## Package for production
- `npm run build:prod`

## To run unit tests

- `npm run test`

## Test coverage

Unit tests use dummy values and do not call AWS or downstream services:

- `npm test` runs the isolated unit suite without coverage.
- `npm run test:coverage` runs the unit suite with coverage and enforces at
  least 95% statements, branches, functions, and lines per JavaScript file under
  `src/`.
- `npm run test:integration` builds the service and invokes its SQS handler
  through a separately started Serverless Offline process. Secrets Manager,
  Payments, CPMS, and Documents are served by synthetic loopback fixtures; no
  real AWS credentials, private data, or shared writes are used.

The integration command writes a self-contained HTML and JSON report to
`integration-results/`. If a run is forcibly terminated and leaves
`integration-results/run.lock`, confirm the recorded process is no longer
running before removing that stale lock and rerunning.

## To Lint

- `npm run lint`

## To auto fix linting errors

- `npm run lint:fix`