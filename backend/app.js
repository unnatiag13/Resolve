import express from 'express';
import cors from 'cors';
import requestRoutes from './routes/requestRoutes.js';
import departmentRouter from './routes/departmentRoutes.js';
import whatsappRoutes from './routes/whatsappRoutes.js';
import { getAnalyticsOverview } from './controllers/requestController.js';
import { testGeminiConnection, analyzeRequestWithAI, getRobustRequestAnalysis } from './services/groqService.js';
import { monitorSlaStates, getMonitoringOverview, getRequestsBySlaState } from './services/slaMonitoringService.js';
import { getResolutionSuggestions } from './services/resolutionSuggestionService.js';
import { getRequest } from './services/notionService.js';
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
app.get('/api/sla/monitor', async (req, res, next) => {
  try {
    const report = await monitorSlaStates();
    res.status(200).json({
      success: true,
      data: report
    });
  } catch (error) {
    next(error);
  }
});

app.get('/api/monitoring/overview', async (req, res, next) => {
  try {
    const overview = await getMonitoringOverview();
    res.status(200).json({
      success: true,
      data: overview
    });
  } catch (error) {
    next(error);
  }
});

app.get('/api/monitoring/requests', async (req, res, next) => {
  try {
    const { state } = req.query;
    if (!state) {
      return res.status(400).json({
        success: false,
        message: "Query parameter 'state' is required (Allowed values: NORMAL, WARNING, BREACHED)"
      });
    }
    const allowed = ['NORMAL', 'WARNING', 'BREACHED'];
    if (!allowed.includes(state.toUpperCase())) {
      return res.status(400).json({
        success: false,
        message: `Invalid state parameter. Allowed values: ${allowed.join(', ')}`
      });
    }
    const list = await getRequestsBySlaState(state);
    res.status(200).json({
      success: true,
      data: list
    });
  } catch (error) {
    next(error);
  }
});

app.post('/api/requests/:id/suggestions', async (req, res, next) => {
  try {
    const { id } = req.params;
    const request = await getRequest(id);
    if (!request) {
      return res.status(404).json({
        success: false,
        message: `Request with ID ${id} not found.`
      });
    }

    const suggestions = await getResolutionSuggestions(request);
    res.status(200).json({
      success: true,
      data: suggestions
    });
  } catch (error) {
    next(error);
  }
});

app.use('/api/departments', departmentRouter);
app.use('/api/requests', requestRoutes);
app.use('/api/whatsapp', whatsappRoutes);
app.get('/api/analytics/overview', getAnalyticsOverview);

// Centralized error handling
app.use(errorHandler);

export default app;
