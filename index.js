require('dotenv').config();
const express = require('express');
const cors = require('cors');
const screenWatermarkRoutes = require('./routes/screenWatermark');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/screen-watermark', screenWatermarkRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'aquamark-screen-api' });
});

app.listen(PORT, () => {
  console.log(`Aquamark Screen API running on port ${PORT}`);
});
