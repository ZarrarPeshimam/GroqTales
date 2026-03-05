/**
 * GroqTales SDK Server
 *
 * Dedicated server for SDK endpoints and developer integrations
 */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');

const app = express();
const PORT = process.env.PORT || 3002;

// Super-fast, dependency-free health endpoint for Render liveness probes
app.get('/healthz', (req, res) => {
  console.log(`[${new Date().toISOString()}] GET /healthz - 200 OK`);
  res.status(200).send('OK');
});

// Security and middleware
app.use(helmet());

// CORS configuration — allow multiple origins
const allowedOrigins = [
  process.env.CORS_ORIGIN,
  process.env.FRONTEND_URL,
  'http://localhost:3000',
  'http://localhost:3001',
  'https://groqtales-backend-api.vercel.app',
  'https://groqtales-backend-api.onrender.com',
  'https://groqtales.vercel.app',
  'https://www.groqtales.xyz',
  `https://groqtales.pages.dev/`,
  'https://groqtales.netlify.app/',
  'https://groqtales.xyz',
].filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (Swagger UI, curl, server-to-server)
      if (!origin) return callback(null, true);
      if (allowedOrigins.some(allowed => origin.startsWith(allowed))) {
        return callback(null, true);
      }
      return callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-API-Key',
      'X-Request-ID',
    ],
  })
);

app.use(compression());
app.use(express.json({ limit: '10mb' }));

// Health check
app.get('/sdk/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'GroqTales SDK',
    version: process.env.SDK_VERSION || 'v1.0.0',
    timestamp: new Date().toISOString(),
  });
});

// Root welcome endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'Welcome to the GroqTales SDK Service',
    status: 'online',
    version: process.env.SDK_VERSION || 'v1.0.0',
    health: '/sdk/health'
  });
});

// SDK routes
app.use('/sdk/v1', require('./routes/sdk'));

// Start server
app.listen(PORT, () => {
  console.log(`🔧 GroqTales SDK server running on port ${PORT}`);
});
