import { withoutUndefinedValues } from "@pagopa/ts-commons/lib/types";

import { RCAuthenticationConfig } from "../../generated/definitions/RCAuthenticationConfig";
import { RCClientCert } from "../../generated/definitions/RCClientCert";
import { RCConfigurationProdEnvironment } from "../../generated/definitions/RCConfigurationProdEnvironment";
import { RCConfigurationPublic } from "../../generated/definitions/RCConfigurationPublic";
import { RCConfigurationTestEnvironment } from "../../generated/definitions/RCConfigurationTestEnvironment";
import {
  RCAuthenticationConfig as RCAuthenticationConfigModel,
  RCClientCert as RCClientCertModel,
  RCEnvironmentConfig,
  RCTestEnvironmentConfig,
  RetrievedRCConfiguration,
} from "../models/rc_configuration";

const getCert = (cert: RCClientCertModel): RCClientCert => ({
  client_cert: cert.clientCert,
  client_key: cert.clientKey,
  server_ca: cert.serverCa,
});

const getDetailsAuthentication = (
  detailsAuth: RCAuthenticationConfigModel,
): RCAuthenticationConfig => ({
  cert: detailsAuth.cert ? getCert(detailsAuth.cert) : undefined,
  header_key_name: detailsAuth.headerKeyName,
  key: detailsAuth.key,
  type: detailsAuth.type,
});

const getTestEnvironment = (
  testEnv: RCTestEnvironmentConfig,
): RCConfigurationTestEnvironment => ({
  base_url: testEnv.baseUrl,
  details_authentication: getDetailsAuthentication(
    testEnv.detailsAuthentication,
  ),
  test_users: testEnv.testUsers,
});

const getProdEnvironment = (
  prodEnvironment: RCEnvironmentConfig,
): RCConfigurationProdEnvironment => ({
  base_url: prodEnvironment.baseUrl,
  details_authentication: getDetailsAuthentication(
    prodEnvironment.detailsAuthentication,
  ),
});

/**
 * Converts a RetrievedRCConfiguration to a configuration that can be shared via API
 */
export const retrievedRCConfigurationToPublic = (
  publicConfiguration: RetrievedRCConfiguration,
): RCConfigurationPublic =>
  withoutUndefinedValues({
    configuration_id: publicConfiguration.configurationId,
    description: publicConfiguration.description,
    disable_lollipop_for: publicConfiguration.disableLollipopFor,
    has_precondition: publicConfiguration.hasPrecondition,
    is_lollipop_enabled: publicConfiguration.isLollipopEnabled,
    name: publicConfiguration.name,
    prod_environment: publicConfiguration.prodEnvironment
      ? getProdEnvironment(publicConfiguration.prodEnvironment)
      : undefined,
    test_environment: publicConfiguration.testEnvironment
      ? getTestEnvironment(publicConfiguration.testEnvironment)
      : undefined,
  });
