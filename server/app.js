require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();

app.use(cors({ origin: process.env.CLIENT_URL || '*', credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use('/api/auth', require('./routes/auth'));
app.use('/api/sessions', require('./routes/sessions'));
app.use('/api/topics', require('./routes/topics'));
app.use('/api/tests', require('./routes/tests'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/justification', require('./routes/justification'));
app.use('/api/daily', require('./routes/dailycommitment'));
app.use('/api/cron', require('./routes/cron'));

app.get('/api/health', (req, res) => res.json({ status: 'ok', app: 'VEER API', db: 'mongodb' }));
app.use((req, res) => res.status(404).json({ success: false, message: 'Route not found' }));
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ success: false, message: 'Internal server error' });
});

module.exports = app;
