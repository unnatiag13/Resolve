import express from 'express';
import cors from 'cors';
import requestRoutes from './routes/requestRoutes.js';
import { getAnalyticsOverview } from './controllers/requestController.js';
import errorHandler from './middleware/errorHandler.js';

const app = express();

// Enable CORS
app.use(cors());

// Body parser
app.use(express.json());

// Basic endpoints
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Welcome to the ResolveAI Request Resolution API',
    version: '1.0.0',
    phase: 1,
    status: 'operational'
  });
});

app.get('/health', (req, res) => {
  res.json({
    success: true,
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Register routes
app.use('/api/requests', requestRoutes);
app.get('/api/analytics/overview', getAnalyticsOverview);

// Centralized error handling
app.use(errorHandler);

export default app;
