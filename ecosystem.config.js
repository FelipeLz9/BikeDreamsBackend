module.exports = {
  apps: [
    {
      name: 'bikedreams-backend',
      script: 'src/index.ts',
      interpreter: 'bun',
      instances: 'max',
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 3001,
        HOST: '0.0.0.0'
      },
      env_development: {
        NODE_ENV: 'development',
        PORT: 3001,
        HOST: '0.0.0.0'
      },
      env_staging: {
        NODE_ENV: 'staging',
        PORT: 3001,
        HOST: '0.0.0.0'
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3001,
        HOST: '0.0.0.0'
      },
      env_test: {
        NODE_ENV: 'test',
        PORT: 3002,
        HOST: '0.0.0.0'
      },
      // PM2 Configuration
      watch: false,
      ignore_watch: ['node_modules', 'dist', 'logs', 'coverage'],
      max_memory_restart: '1G',
      min_uptime: '10s',
      max_restarts: 10,
      restart_delay: 4000,
      
      // Logging
      log_file: 'logs/combined.log',
      out_file: 'logs/out.log',
      error_file: 'logs/error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      
      // Advanced features
      kill_timeout: 5000,
      listen_timeout: 3000,
      wait_ready: true,
      
      // Health monitoring
      health_check_grace_period: 3000,
      health_check_fatal_exceptions: true,
      
      // Environment-specific settings
      env_file: {
        development: '.env.development',
        staging: '.env.staging',
        production: '.env.production',
        test: '.env.test'
      }
    }
  ],

  // Deployment configuration
  deploy: {
    production: {
      user: 'deploy',
      host: 'your-production-server.com',
      ref: 'origin/main',
      repo: 'git@github.com:your-org/bikedreams-backend.git',
      path: '/var/www/bikedreams-backend',
      'pre-deploy-local': '',
      'post-deploy': 'npm install && npm run build:prod && pm2 reload ecosystem.config.js --env production',
      'pre-setup': ''
    },
    staging: {
      user: 'deploy',
      host: 'your-staging-server.com',
      ref: 'origin/develop',
      repo: 'git@github.com:your-org/bikedreams-backend.git',
      path: '/var/www/bikedreams-backend-staging',
      'pre-deploy-local': '',
      'post-deploy': 'npm install && npm run build:staging && pm2 reload ecosystem.config.js --env staging',
      'pre-setup': ''
    }
  }
};
