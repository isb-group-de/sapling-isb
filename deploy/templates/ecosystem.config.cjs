const appRoot = process.env.SAPLING_APP_ROOT || '/var/www/sapling';

module.exports = {
  apps: [
    {
      name: 'sapling-backend',
      script: 'dist/main.js',
      cwd: `${appRoot}/current/backend`,
      exec_mode: 'fork',
      instances: 1,
      autorestart: true,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        NODE_OPTIONS: '--max-old-space-size=4096',
      },
      time: true,
      out_file: `${appRoot}/shared/log/pm2-backend.out.log`,
      error_file: `${appRoot}/shared/log/pm2-backend.err.log`,
      merge_logs: true,
      kill_timeout: 10000,
      listen_timeout: 10000,
    },
  ],
};
