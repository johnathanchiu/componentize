import 'dotenv/config';
import { createApp } from './app';
import { appConfig } from './config';

async function start() {
  const server = await createApp();

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
