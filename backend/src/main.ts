import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix("v1");
  const corsOriginRaw = process.env.CORS_ORIGIN?.trim();
  const allowOrigins = corsOriginRaw
    ? corsOriginRaw.split(",").map((v) => v.trim()).filter(Boolean)
    : ["http://localhost:3000"];
  app.enableCors({
    origin: allowOrigins,
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
