/// <reference path="./worker-configuration.d.ts" />

interface Env {
  BOOTSTRAP_TOKEN: string;
  SESSION_SIGNING_KEY: string;
  CREDENTIAL_ENCRYPTION_KEY: string;
  CF_ACCOUNT_ID?: string;
  AI_GATEWAY_ID?: string;
  AI_GATEWAY_TOKEN?: string;
}

