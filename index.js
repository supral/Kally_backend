require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const mongoSanitize = require('mongo-sanitize');
const morgan = require('morgan');
const compression = require('compression');
const connectDB = require('./config/db');
const authRoutes = require('./routes/auth');
const vendorRoutes = require('./routes/vendors');
const branchRoutes = require('./routes/branches');
const customerRoutes = require('./routes/customers');
const searchRoutes = require('./routes/search');
const membershipTypeRoutes = require('./routes/membershipTypes');
const membershipRoutes = require('./routes/memberships');
const serviceRoutes = require('./routes/services');
const leadRoutes = require('./routes/leads');
const leadStatusRoutes = require('./routes/leadStatuses');
const appointmentRoutes = require('./routes/appointments');
const reportRoutes = require('./routes/reports');
const settingsRoutes = require('./routes/settings');
const guidelinesRoutes = require('./routes/guidelines');
const loyaltyRoutes = require('./routes/loyalty');
const packageRoutes = require('./routes/packages');
const salesImageRoutes = require('./routes/salesImages');
const manualSalesRoutes = require('./routes/manualSales');
const ticketRoutes = require('./routes/tickets');
const activityLogRoutes = require('./routes/activityLog');

connectDB();

const app = express();
app.disable('x-powered-by');
// Ensure correct client IP detection behind proxies (Render/Railway/Nginx).
// In local dev this is harmless; in production it's often required for rate limiting to work as intended.
if (process.env.TRUST_PROXY) {
  const trustProxy = Number(process.env.TRUST_PROXY);
  app.set('trust proxy', Number.isFinite(trustProxy) ? trustProxy : true);
} else if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}
// Security headers: HSTS in production, cross-origin for API
const helmetOptions = {
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  ...(process.env.NODE_ENV === 'production' && {
    hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
  }),
};
app.use(helmet(helmetOptions));

// CORS: allow localhost, and in production any origins listed in FRONTEND_URL (comma-separated)
const allowedOrigins = process.env.FRONTEND_URL
  ? process.env.FRONTEND_URL.split(',').map((u) => u.trim().replace(/\/$/, '')).filter(Boolean)
  : [];
app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);
    if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return cb(null, true);
    if (allowedOrigins.length && allowedOrigins.some((allowed) => origin === allowed || origin.startsWith(allowed + '/'))) return cb(null, true);
    return cb(null, false);
  },
  credentials: true,
  optionsSuccessStatus: 200,
}));
if (process.env.NODE_ENV !== 'production') {
  app.use(morgan('dev'));
}
app.use(compression());
// Support large JSON imports (legacy data). Override with JSON_BODY_LIMIT if needed.
app.use(express.json({ limit: process.env.JSON_BODY_LIMIT || '50mb' }));

// Handle payload too large / JSON parse errors cleanly.
app.use((err, req, res, next) => {
  if (err && (err.type === 'entity.too.large' || err.status === 413)) {
    return res.status(413).json({ success: false, message: 'Upload too large. Increase JSON_BODY_LIMIT on the backend.' });
  }
  if (err && err.type === 'entity.parse.failed') {
    return res.status(400).json({ success: false, message: 'Invalid JSON body.' });
  }
  return next(err);
});

// Strip $ and . from request data to prevent NoSQL operator injection
app.use((req, res, next) => {
  if (req.body && typeof req.body === 'object') req.body = mongoSanitize(req.body);
  if (req.query && typeof req.query === 'object') req.query = mongoSanitize(req.query);
  if (req.params && typeof req.params === 'object') req.params = mongoSanitize(req.params);
  next();
});

// Global API rate limit: reduce impact of DoS and scraping (exclude health for monitoring)
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  message: { success: false, message: 'Too many requests. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => process.env.NODE_ENV !== 'production' || req.path === '/api/health',
});
app.use('/api', apiLimiter);

// Stricter rate limit on auth to mitigate brute-force (login/register)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  message: { success: false, message: 'Too many login attempts. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV !== 'production',
});
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/vendors', vendorRoutes);
app.use('/api/branches', branchRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/membership-types', membershipTypeRoutes);
app.use('/api/memberships', membershipRoutes);
app.use('/api/services', serviceRoutes);
app.use('/api/leads', leadRoutes);
app.use('/api/lead-statuses', leadStatusRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/loyalty', loyaltyRoutes);
app.use('/api/packages', packageRoutes);
app.use('/api/sales-images', salesImageRoutes);
app.use('/api/manual-sales', manualSalesRoutes);
app.use('/api/tickets', ticketRoutes);
app.use('/api/activity-log', activityLogRoutes);
app.use('/api/guidelines', guidelinesRoutes);

app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'API is running' });
});

// 404 handler for undefined API routes
app.use('/api', (req, res) => {
  res.status(404).json({ success: false, message: 'API route not found.' });
});

// Global error handler for unhandled errors
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err.message || err);
  res.status(500).json({ success: false, message: 'Internal server error.' });
});

const PORT = process.env.PORT || 5000;
// In production, bind to 0.0.0.0 so the server accepts external connections (e.g. Render, Railway)
const HOST = process.env.HOST || (process.env.NODE_ENV === 'production' ? '0.0.0.0' : 'localhost');
app.listen(PORT, HOST, () => {
  console.log(`Server running at http://${HOST}:${PORT}`);
});
