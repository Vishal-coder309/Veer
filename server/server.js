// Local development entry point — imports the shared app and starts listening.
// Vercel uses api/index.js instead.
const app = require('./app');

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`VEER API running on port ${PORT}`));
