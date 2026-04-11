import { Logger, ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const logger = new Logger("Bootstrap");
  app.setGlobalPrefix("v1");
  const corsOriginRaw = process.env.CORS_ORIGIN?.trim();
  const allowOrigins = corsOriginRaw
    ? corsOriginRaw.split(",").map((v) => v.trim()).filter(Boolean)
    : [];
  const isProduction = process.env.NODE_ENV === "production";
  const devDefaultOrigins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:3001",
    "http://127.0.0.1:3001"
  ];
  const origin =
    allowOrigins.length > 0 ? allowOrigins : isProduction ? false : devDefaultOrigins;
  if (isProduction && allowOrigins.length === 0) {
    logger.warn(
      "CORS_ORIGIN is not set. Browser CORS is disabled until you set CORS_ORIGIN (comma-separated frontend origins)."
    );
  }
  app.enableCors({
    origin,
    methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "x-test-user-id"],
    credentials: false
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true
    })
  );

  const port = process.env.PORT ? Number(process.env.PORT) : 4000;
  await app.listen(port);
}

void bootstrap();
