import { withoutUndefinedValues } from "@pagopa/ts-commons/lib/types";
import { RCAuthenticationConfig } from "../../generated/definitions/RCAuthenticationConfig";
import { RCClientCert } from "../../generated/definitions/RCClientCert";
import { RCConfigurationProdEnvironment } from "../../generated/definitions/RCConfigurationProdEnvironment";
import { RCConfigurationResponse } from "../../generated/definitions/RCConfigurationResponse";
import { RCConfigurationTestEnvironment } from "../../generated/definitions/RCConfigurationTestEnvironment";
import {
  RCTestEnvironmentConfig,
  RetrievedRCConfiguration,
  RCAuthenticationConfig as RCAuthenticationConfigModel,
  RCClientCert as RCClientCertModel,
  RCEnvironmentConfig
} from "../models/rc_configuration";

const getCert = (cert: RCClientCertModel): RCClientCert => ({
  client_cert: cert.clientCert,
  client_key: cert.clientKey,
  server_ca: cert.serverCa
});

const getDetailsAuthentication = (
  detailsAuth: RCAuthenticationConfigModel
): RCAuthenticationConfig => ({
  cert: detailsAuth.cert ? getCert(detailsAuth.cert) : undefined,
  header_key_name: detailsAuth.headerKeyName,
  key: detailsAuth.key,
  type: detailsAuth.type
});

const getTestEnvironment = (
  testEnv: RCTestEnvironmentConfig
): RCConfigurationTestEnvironment => ({
  base_url: testEnv.baseUrl,
  details_authentication: getDetailsAuthentication(
    testEnv.detailsAuthentication
  ),
  test_users: testEnv.testUsers
});

const getProdEnvironment = (
  prodEnvironment: RCEnvironmentConfig
): RCConfigurationProdEnvironment => ({
  base_url: prodEnvironment.baseUrl,
  details_authentication: prodEnvironment.detailsAuthentication
    ? getDetailsAuthentication(prodEnvironment.detailsAuthentication)
    : undefined
});

/**
 * Converts a retrieved RCConfiguration to a configuration that can be shared via API
 */
export const retrievedMessageToPublic = (
  retrievedConfiguration: RetrievedRCConfiguration
): RCConfigurationResponse =>
  withoutUndefinedValues({
    configuration_id: retrievedConfiguration.configurationId,
    description: retrievedConfiguration.description,
    disable_lollipop_for: retrievedConfiguration.disableLollipopFor,
    has_precondition: retrievedConfiguration.hasPrecondition,
    is_lollipop_enabled: retrievedConfiguration.isLollipopEnabled,
    name: retrievedConfiguration.name,
    prod_environment: retrievedConfiguration.prodEnvironment
      ? getProdEnvironment(retrievedConfiguration.prodEnvironment)
      : undefined,
    test_environment: retrievedConfiguration.testEnvironment
      ? getTestEnvironment(retrievedConfiguration.testEnvironment)
      : undefined
  });
