# Logging

## Format

All logs are in the following format:

| Name        | Description |
| ----------- | ----------- |
| `statusCode`  | The status code is a string that uniquely identifies an status condition. See [List of Status Codes](#status-codes). |
| `message`     | A human readable description of the status. |
| `logLevel`    | `INFO` or `ERROR` |

## Example

```
{
  "statusCode": "CpmsCodeReceived",
  "message": "Received CPMS status code 807 for penalty reference 1613512512_FPN and receipt reference ECMS-3515234132-1351235",
  "logLevel": "INFO"
}
```

## Status Codes

| Status Code           | Description   |
| --------------------- | ------------- |
| `PaymentAlreadyExists`  | Payment recorded in RSP. Removed message from SQS queue with no futher changes. |
| `CpmsCodeReceived`      | Received status code from CPMS for the given receipt reference. |
| `CancelledPayment`      | Payment has been cancelled (CPMS code 807). Removed message from SQS queue with no futher changes. |
| `ConfirmedPayment`      | Payment confirmed with CPMS (CPMS code 801). Payment recorded in RSP. |
| `PaymentPending`        | Payment pending or failed. Will continue to check unless exceeed max retries. |
| `PaymentServiceError` | An error has occurred when attempting to record a payment. The message is the error message from axios. |
| `DocumentsServiceError` | An error has occured when attempting to retrieve a penalty or penalty group. The message is the error message from axios. |
