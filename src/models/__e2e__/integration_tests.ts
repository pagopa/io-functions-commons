// tslint:disable: no-console
import * as messageIntegration from "./message_integration";
import * as profileIntegration from "./profile_integration";
import * as serviceIntegration from "./service_integration";

serviceIntegration
  .test()
  .then()
  .catch(console.error);
profileIntegration
  .test()
  .then()
  .catch(console.error);
messageIntegration
  .test()
  .then()
  .catch(console.error);
