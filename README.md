# rsp-cpms-checking-workflow
Polling workflow of CPMS receipts

Triggered from SQS Launched Payments queue

## Run locally

Ensure you have AWS credentials for secrets manager or set secrets in `config.js`
- `nvm use`
- `npm i`
- `npm run start`

## To invoke with a local SQS message

- `cd events`
- `./invoke.sh`

## Package for development
- `npm run build`

## Package for production
- `npm run build:prod`

## To run unit tests

- `npm run test`

## To Lint

- `npm run lint`

## To auto fix linting errors

- `npm run lint:fix`