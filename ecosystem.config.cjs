module.exports = {
  apps: [
    {
      name: 'campaignflow-api',
      script: 'src/server.js',
      cwd: './backend',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: 5000,
        RUN_STANDALONE_WORKER: 'true'
      }
    },
    {
      name: 'campaignflow-worker',
      script: 'src/workers/campaignWorker.js',
      cwd: './backend',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        CAMPAIGN_WORKER_STANDALONE: 'true',
        CAMPAIGN_BATCH_SIZE: 50,
        CAMPAIGN_PACING_MS: 25,
        CAMPAIGN_POLL_INTERVAL_MS: 1500
      }
    },
    {
      name: 'campaignflow-import-worker',
      script: 'src/workers/index.js',
      cwd: './backend',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        IMPORT_BATCH_SIZE: 500,
        IMPORT_POLL_INTERVAL_MS: 1500
      }
    }
  ]
};
