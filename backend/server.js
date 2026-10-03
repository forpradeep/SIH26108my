const env = require('./config/env'); // loads .env first

// Only needed when the Atlas "mongodb+srv://" lookup fails on your network's DNS.
if (String(env.MONGODB_URI).startsWith('mongodb+srv://')) {
  require('dns').setServers(['8.8.8.8', '8.8.4.4']);
}

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { connectDB } = require('./config/db');
const routes = require('./routes');
const requestDeadline = require('./middleware/timeout');
const notFound = require('./middleware/notFound');
const errorHandler = require('./middleware/errorHandler');

const app = express();

app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(helmet());
app.use(cors({ origin: env.corsOrigins, credentials: true }));
app.use(requestDeadline);               // 30 s hard budget per request
app.use(express.json({ limit: '1mb' })); // multipart bodies are handled by multer in the route

// /api/v1/health, /recommend, /recommend/upload, /standards/:id, /feedback
app.use('/api/v1', routes);

app.use(notFound);     // unknown URL -> JSON envelope
app.use(errorHandler); // every error -> { error: { code, message, details } }

// Start listening only after MongoDB is connected.
async function start() {
  await connectDB();
  console.log('MongoDB connected.');
  return app.listen(env.port, () => {
    console.log(`API listening on http://localhost:${env.port}/api/v1`);
  });
}

// `node server.js` starts the server; `require('./server')` (tests) does not.
if (require.main === module) {
  start().catch((err) => {
    console.error('Startup failed:', err.message);
    process.exit(1);
  });
}

module.exports = { app, start };

