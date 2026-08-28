// ResolveAI Server Module
import app from './app.js';
import dotenv from 'dotenv';
import { startSlaScheduler } from './services/slaScheduler.js';

import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });
dotenv.config();

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 5000;

function startServer(port) {
  const server = app.listen(port, () => {
    console.log(`ResolveAI backend server is running on port ${port}`);
    startSlaScheduler();
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`[Server Error] Port ${port} is already in use. Strict port 5000 mode enabled; exiting.`);
      process.exit(1);
    } else {
      console.error('Server error:', err);
      process.exit(1);
    }
  });
}

startServer(PORT);
