require('dotenv').config();
const app = require('./app');

const PORT = process.env.PORT || 5000;

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server started on port ${PORT}`);
  console.log(`Local: http://localhost:${PORT}`);
  console.log(`API: http://localhost:${PORT}/api/health`);
});