import { createEnvConfig, type EnvConfig } from './env.config.js';

const envConfig = createEnvConfig(process.env);

export type AppConfig = {
  env: EnvConfig;
};

export const appConfig: AppConfig = {
  env: envConfig,
};
