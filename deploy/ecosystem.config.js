// PM2 — gerencia as duas instâncias do 37 Sushi
// Uso: pm2 start deploy/ecosystem.config.js
// Docs: https://pm2.keymetrics.io/docs/usage/application-declaration/

module.exports = {
  apps: [
    {
      name: '37sushi-paranavaí',
      cwd: '/opt/37sushi/paranavaí',
      script: 'backend/src/server.js',
      node_args: '--experimental-vm-modules',
      env_file: '/opt/37sushi/paranavaí/.env',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '400M',
      error_file: '/var/log/37sushi/paranavaí-error.log',
      out_file: '/var/log/37sushi/paranavaí-out.log',
      time: true,
    },
    {
      name: '37sushi-cianorte',
      cwd: '/opt/37sushi/cianorte',
      script: 'backend/src/server.js',
      node_args: '--experimental-vm-modules',
      env_file: '/opt/37sushi/cianorte/.env',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '400M',
      error_file: '/var/log/37sushi/cianorte-error.log',
      out_file: '/var/log/37sushi/cianorte-out.log',
      time: true,
    },
  ],
};
