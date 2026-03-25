/**
 * PM2: EC2 프로덕션 실행용
 * 사용: 서버의 backend 디렉터리에 .env 배치 후
 *   pm2 start ecosystem.config.cjs
 *   pm2 save && pm2 startup
 */
module.exports = {
  apps: [
    {
      name: "careerflow-backend",
      cwd: __dirname,
      script: "dist/main.js",
      instances: 1,
      exec_mode: "fork",
      env: {
        NODE_ENV: "production",
        PORT: 4000
      }
    }
  ]
};
