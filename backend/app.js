import express from 'express';
import cors from 'cors';
import requestRoutes from './routes/requestRoutes.js';
import { getAnalyticsOverview } from './controllers/requestController.js';
import { testGeminiConnection, analyzeRequestWithAI, getRobustRequestAnalysis } from './services/geminiService.js';
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
    phase: 2,
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

// Test Gemini Connection Endpoint
app.get('/api/test-gemini', async (req, res, next) => {
  try {
    const result = await testGeminiConnection();
    const statusCode = result.success ? 200 : 500;
    res.status(statusCode).json(result);
  } catch (error) {
    next(error);
  }
});

// Test Gemini AI Request Analyzer Endpoint (with Validation & Fallback)
app.post('/api/analyze-ai', async (req, res, next) => {
  try {
    const { description, location, requesterName, forceFallback } = req.body;
    if (!description || !description.trim()) {
      return res.status(400).json({
        success: false,
        message: 'description field is required'
      });
    }
    const result = await getRobustRequestAnalysis({ description, location, requesterName }, Boolean(forceFallback));
    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
});

// Register routes
app.use('/api/requests', requestRoutes);
app.get('/api/analytics/overview', getAnalyticsOverview);

// Centralized error handling
app.use(errorHandler);

export default app;
