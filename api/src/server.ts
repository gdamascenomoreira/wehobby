import { buildApp } from './app.js';
import { loadConfig } from './config.js';
import { connectDatabase } from './db/client.js';

const config = loadConfig();
const database = connectDatabase(config.DATABASE_URL);
const app = await buildApp(config, { db: database.db });

app.addHook('onClose', () => database.close());

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    app.log.info({ signal }, 'shutting down');
    app.close().then(
      () => process.exit(0),
      (error: unknown) => {
        app.log.error(error, 'error during shutdown');
        process.exit(1);
      },
    );
  });
}

try {
  await app.listen({ host: config.HOST, port: config.PORT });
} catch (error) {
  app.log.fatal(error, 'failed to start');
  process.exit(1);
}
