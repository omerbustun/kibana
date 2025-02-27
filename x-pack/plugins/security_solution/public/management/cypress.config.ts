/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { defineCypressConfig } from '@kbn/cypress-config';
// eslint-disable-next-line @kbn/imports/no_boundary_crossing
import { dataLoaders } from './cypress/support/data_loaders';

export default defineCypressConfig({
  defaultCommandTimeout: 60000,
  execTimeout: 120000,
  pageLoadTimeout: 12000,

  retries: {
    runMode: 1,
    openMode: 0,
  },

  screenshotsFolder:
    '../../../target/kibana-security-solution/public/management/cypress/screenshots',
  trashAssetsBeforeRuns: false,
  video: false,
  viewportHeight: 900,
  viewportWidth: 1440,
  experimentalStudio: true,

  env: {
    'cypress-react-selector': {
      root: '#security-solution-app',
    },
    KIBANA_URL: 'http://localhost:5601',
    ELASTICSEARCH_URL: 'http://localhost:9200',
    // Username/password used for both elastic and kibana
    ELASTICSEARCH_USERNAME: 'elastic',
    ELASTICSEARCH_PASSWORD: 'changeme',
  },

  e2e: {
    // baseUrl: To override, set Env. variable `CYPRESS_BASE_URL`
    baseUrl: 'http://localhost:5601',
    supportFile: 'public/management/cypress/support/e2e.ts',
    specPattern: 'public/management/cypress/e2e/mocked_data/*.cy.{js,jsx,ts,tsx}',
    experimentalRunAllSpecs: true,
    setupNodeEvents: (on, config) => {
      return dataLoaders(on, config);
    },
  },
});
