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
  client_key: cert.clientKey,
  client_cert: cert.clientCert,
  server_ca: cert.serverCa
});

const getDetailsAuthentication = (
  detailsAuth: RCAuthenticationConfigModel
): RCAuthenticationConfig => ({
  header_key_name: detailsAuth.headerKeyName,
  key: detailsAuth.key,
  type: detailsAuth.type,
  cert: detailsAuth.cert ? getCert(detailsAuth.cert) : undefined
});

const getTestEnvironment = (
  testEnv: RCTestEnvironmentConfig
): RCConfigurationTestEnvironment => ({
  test_users: testEnv.testUsers,
  base_url: testEnv.baseUrl,
  details_authentication: getDetailsAuthentication(
    testEnv.detailsAuthentication
  )
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
    name: retrievedConfiguration.name,
    description: retrievedConfiguration.description,
    has_precondition: retrievedConfiguration.hasPrecondition,
    disable_lollipop_for: retrievedConfiguration.disableLollipopFor,
    is_lollipop_enabled: retrievedConfiguration.isLollipopEnabled,
    test_environment: retrievedConfiguration.testEnvironment
      ? getTestEnvironment(retrievedConfiguration.testEnvironment)
      : undefined,
    prod_environment: retrievedConfiguration.prodEnvironment
      ? getProdEnvironment(retrievedConfiguration.prodEnvironment)
      : undefined
  });
