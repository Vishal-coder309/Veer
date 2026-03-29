// Vercel serverless entry point.
// Vercel calls this file as a function — no app.listen() needed.
const app = require('../server/app');
module.exports = app;
