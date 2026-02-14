require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
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
const loyaltyRoutes = require('./routes/loyalty');
const packageRoutes = require('./routes/packages');

connectDB();

const app = express();
// Allow API to be used from a different origin (deployed frontend); avoids ERR_BLOCKED_BY_RESPONSE
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));

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
app.use(express.json({ limit: '10mb' }));

app.use('/api/auth', authRoutes);
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
