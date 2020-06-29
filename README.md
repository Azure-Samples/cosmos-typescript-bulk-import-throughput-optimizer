[![](https://github.com/vjrantal/cosmos-typescript-bulk-import-throughput-optimizer/workflows/CI/badge.svg)](https://github.com/vjrantal/cosmos-typescript-bulk-import-throughput-optimizer/actions?query=workflow%3ACI)

# Introduction

This repository implements the same logic in TypeScript as what [https://github.com/Azure-Samples/cosmos-dotnet-bulk-import-throughput-optimizer](https://github.com/Azure-Samples/cosmos-dotnet-bulk-import-throughput-optimizer) implements in dotnet.

The purpose is to find optimal ways to bulk insert in TypeScript / JavaScript. A secondary purpose is to compare the bulk insert performance between the two SDKs because they use different server-side API from Cosmos DB.

Test results will be added to the repository to help choosing the right approach.

# Build

```
npm install
npm run build
```

# Run locally

```
export ENDPOINT_URL="https://<your-account>.documents.azure.com:443/"
export AUTHORIZATION_KEY="<your-account-key>"
node dist/main.js
```

# Run tests locally

```
npm run test
```
