/* eslint-disable no-console */
import * as messageIntegration from "./message_integration";

messageIntegration
  .test()
  .then()
  .catch(console.error);
