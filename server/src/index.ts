import 'dotenv/config';
import { createApp } from './app';
import { appConfig } from './config';

async function start() {
  const server = await createApp();

  // Graceful shutdown handler
  const shutdown = async (signal: string) => {
    console.log(`\n${signal} received, shutting down gracefully...`);
    try {
      await server.close();
      console.log('Server closed');
      process.exit(0);
    } catch (err) {
      console.error('Error during shutdown:', err);
      process.exit(1);
    }
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  try {
    await server.listen({ port: appConfig.port, host: '0.0.0.0' });

    console.log('');
    console.log('Component Builder API v3.0');
    console.log(`Server running on http://localhost:${appConfig.port}`);
    console.log(`Environment: ${appConfig.env}`);
    console.log(`AI Model: ${appConfig.api.modelName}`);
    console.log('');
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
}

start();
