// PM2 process definition. Start with:  pm2 start ecosystem.config.cjs
// Runs the Express server (which also serves the built client from client/dist).
// DATABASE_URL / PORT are read from server/.env via dotenv.
module.exports = {
  apps: [
    {
      name: "walkin",
      cwd: "./server",
      script: "npm",
      args: "start",
      env: {
        NODE_ENV: "production",
      },
    },
  ],
};
