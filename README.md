# rsp-cpms-checking-workflow
Polling workflow of CPMS receipts

Triggered from SQS Launched Payments queue

## Run locally
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