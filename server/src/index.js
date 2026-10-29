import app from './app.js';
import { getDb } from './config/db.js';

const PORT = process.env.PORT || 5000;

async function bootstrap() {
  try {
    // Ensure database connection and schema
    await getDb();

    app.listen(PORT, () => {
      console.log(`[SERVER] StockSphere API server running on port ${PORT}`);
      console.log(`[SERVER] Health check available at http://localhost:${PORT}/health`);
    });
  } catch (err) {
    console.error('[SERVER ERROR] Failed to bootstrap application:', err);
    process.exit(1);
  }
}

bootstrap();
