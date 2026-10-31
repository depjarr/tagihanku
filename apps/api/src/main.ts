import 'dotenv/config';
import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');
  app.enableCors({
    origin: (process.env.CORS_ORIGIN ?? 'http://localhost:5173').split(','),
    allowedHeaders: ["Content-Type", "x-owner-token", "Authorization"],
  });
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }),
  );

  const doc = new DocumentBuilder()
    .setTitle('Tagihanku API')
    .setDescription('Pembuat tagihan memakai header x-owner-token; teman cukup memakai link share.')
    .setVersion('1.0')
    .addApiKey({ type: 'apiKey', name: 'x-owner-token', in: 'header' }, 'owner-token')
    .addBearerAuth()
    .build();
  SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, doc));

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
