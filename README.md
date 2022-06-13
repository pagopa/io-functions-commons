# io-functions-commons

Common code across Azure functions of project IO.

## Integration tests
The `__integrations__` folder contains a sub-project which uses `jest` to execute tests against production-like reources. Such test suites expect resources to be up-and-running and they don't care if they are local or cloud resources.

### Run integration tests with local resources
```sh
# run Mailhog, used to simulate an email recipient
docker run -d -p 1025:1025 -p 8025:8025 --name mailhog mailhog/mailhog

# run a local mock of CosmosDB
npm install -g @zeit/cosmosdb-server
nohup cosmosdb-server -p 3000 &

# execute test passing references as env variables
set NAME and BASE64KEY to the desired storage

STORAGE_CONN_STRING="DefaultEndpointsProtocol=https;AccountName=<NAME>;AccountKey=<BASE64KEY>;EndpointSuffix=core.windows.net" \
MAILHOG_HOSTNAME=localhost \
COSMOSDB_URI=https://localhost:3000/ \
COSMOSDB_KEY="dummy key" \
COSMOSDB_DATABASE_NAME=integration-tests \
yarn test:integration
```

