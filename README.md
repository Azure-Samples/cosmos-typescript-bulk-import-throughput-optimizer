# Cosmos DB bulk import

[![CI badge](https://github.com/vjrantal/cosmos-typescript-bulk-import-throughput-optimizer/workflows/CI/badge.svg)](https://github.com/vjrantal/cosmos-typescript-bulk-import-throughput-optimizer/actions?query=workflow%3ACI)

## Introduction

This repository implements the same logic in TypeScript as what [https://github.com/Azure-Samples/cosmos-dotnet-bulk-import-throughput-optimizer](https://github.com/Azure-Samples/cosmos-dotnet-bulk-import-throughput-optimizer) implements in dotnet.

The purpose is to find optimal ways to bulk insert in TypeScript / JavaScript. A secondary purpose is to compare the bulk insert performance between the two SDKs because they use different server-side API from Cosmos DB.

## Results

| Import mechanism | Import method | Consumed RU | Items per second |
| - | - | - | - |
| Parallel | Create | 27600 | 779 |
| Parallel | Upsert | 27600 | 917 |
| Stored Procedure | Create | 25650 | 1493 |
| Stored Procedure | Upsert | 25722 | 1330 |

Above results are when running the optimizer on Standard F2s VM in the same Azure region as where Cosmos DB is provisioned. The provisioned throughput was set to 10000 RU/s and 5000 items were inserted.

### Parallel vs Stored Procedure

As seen in above results, Stored Procedure gives better performance. It was also observed that Parallel import is heavy on CPU. The relative improvement with Stored Procedure is even higher if there is more distance between client and server because the is a lot less requests sent. For example, when run on laptop outside of Azure, the Parallel import achieved only ~100 items per second while the Stored Procedure achieved ~1000 items per second.

The limitation of Stored Procedure is that the scope is within a single Partition Key so it means bulk import works only if all items have the same value as the Partition Key.

## Build

```bash
npm install
npm run build
```

## Run locally

```bash
export ENDPOINT_URL="https://<your-account>.documents.azure.com:443/"
export AUTHORIZATION_KEY="<your-account-key>"
node dist/main.js
```

## Run tests locally

```bash
npm run test
```

## Attribution

The original author for the bulk import with stored procedures is [Patrick Schuler](https://github.com/p-schuler) and the main parts of the related code has been taken from [here](https://github.com/p-schuler/CosmosSamples/tree/427f403e8eb2e195aa6305108d912bde13e7e1ae/nodejs/BulkInsert).
