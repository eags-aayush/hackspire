import { NestFactory } from '@nestjs/core';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors();
  app.useWebSocketAdapter(new IoAdapter(app));
  const port = process.env.PORT ?? 3000;
  await app.listen(port, '0.0.0.0');
}
await bootstrap();
