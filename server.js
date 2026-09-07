const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const axios = require('axios');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname)); // serves frontend

const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI;
const OWM_KEY = process.env.OWM_API_KEY;

// ── CONNECT TO MONGODB ──
mongoose.connect(MONGO_URI)
  .then(() => console.log('✅ MongoDB Connected'))
  .catch(err => console.log('❌ MongoDB Error:', err));

// ══════════════════════════════
//  SCHEMAS & MODELS
// ══════════════════════════════

// 1. AQI Search History
const searchSchema = new mongoose.Schema({
  city:      { type: String, required: true },
  country:   { type: String },
  lat:       { type: Number },
  lon:       { type: Number },
  aqi:       { type: Number },
  status:    { type: String },
  pm25:      { type: Number },
  pm10:      { type: Number },
  co:        { type: Number },
  no2:       { type: Number },
  so2:       { type: Number },
  o3:        { type: Number },
  searchedAt:{ type: Date, default: Date.now }
});
const Search = mongoose.model('Search', searchSchema);

// 2. Favourite Cities
const favouriteSchema = new mongoose.Schema({
  city:      { type: String, required: true, unique: true },
  country:   { type: String },
  addedAt:   { type: Date, default: Date.now }
});
const Favourite = mongoose.model('Favourite', favouriteSchema);

// ══════════════════════════════
//  EPA AQI CALCULATION
// ══════════════════════════════
const PM25_BP = [
  { cLow:0.0,   cHigh:12.0,  iLow:0,   iHigh:50  },
  { cLow:12.1,  cHigh:35.4,  iLow:51,  iHigh:100 },
  { cLow:35.5,  cHigh:55.4,  iLow:101, iHigh:150 },
  { cLow:55.5,  cHigh:150.4, iLow:151, iHigh:200 },
  { cLow:150.5, cHigh:250.4, iLow:201, iHigh:300 },
  { cLow:250.5, cHigh:350.4, iLow:301, iHigh:400 },
  { cLow:350.5, cHigh:500.4, iLow:401, iHigh:500 },
];
function pm25ToAQI(pm25) {
  const bp = PM25_BP.find(b => pm25 >= b.cLow && pm25 <= b.cHigh);
  if (!bp) return pm25 > 500.4 ? 500 : 0;
  return Math.round(((bp.iHigh - bp.iLow) / (bp.cHigh - bp.cLow)) * (pm25 - bp.cLow) + bp.iLow);
}
function getStatus(aqi) {
  if (aqi <= 50)  return 'Good';
  if (aqi <= 100) return 'Moderate';
  if (aqi <= 150) return 'Unhealthy for Sensitive Groups';
  if (aqi <= 200) return 'Unhealthy';
  if (aqi <= 300) return 'Very Unhealthy';
  return 'Hazardous';
}

// ══════════════════════════════
//  API ROUTES
// ══════════════════════════════

// ── GET live AQI for a city + save to MongoDB ──
app.get('/api/aqi/:city', async (req, res) => {
  const city = req.params.city;
  const apiKey = req.headers['x-api-key'] || OWM_KEY;

  if (!apiKey) return res.status(400).json({ error: 'No API key provided' });

  try {
    // Step 1: Geocode city
    const geoRes = await axios.get(
      `https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(city)}&limit=1&appid=${apiKey}`
    );
    if (!geoRes.data.length) return res.status(404).json({ error: `City "${city}" not found` });
    const { lat, lon, name, country } = geoRes.data[0];

    // Step 2: Get air quality
    const aqRes = await axios.get(
      `https://api.openweathermap.org/data/2.5/air_pollution?lat=${lat}&lon=${lon}&appid=${apiKey}`
    );
    const c = aqRes.data.list[0].components;
    const aqi = pm25ToAQI(c.pm2_5);
    const status = getStatus(aqi);

    // Step 3: Save to MongoDB
    const record = await Search.create({
      city: name, country, lat, lon,
      aqi, status,
      pm25: c.pm2_5, pm10: c.pm10,
      co: c.co, no2: c.no2, so2: c.so2, o3: c.o3
    });

    res.json({
      city: name, country, lat, lon,
      aqi, status,
      components: { pm25: c.pm2_5, pm10: c.pm10, co: c.co, no2: c.no2, so2: c.so2, o3: c.o3 },
      savedId: record._id
    });

  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to fetch AQI data' });
  }
});

// ── GET search history (last 20) ──
app.get('/api/history', async (req, res) => {
  try {
    const history = await Search.find()
      .sort({ searchedAt: -1 })
      .limit(20)
      .select('city country aqi status searchedAt');
    res.json(history);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET history for a specific city ──
app.get('/api/history/:city', async (req, res) => {
  try {
    const history = await Search.find({ city: new RegExp(req.params.city, 'i') })
      .sort({ searchedAt: -1 })
      .limit(10);
    res.json(history);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET all favourites ──
app.get('/api/favourites', async (req, res) => {
  try {
    const favs = await Favourite.find().sort({ addedAt: -1 });
    res.json(favs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── ADD a favourite city ──
app.post('/api/favourites', async (req, res) => {
  const { city, country } = req.body;
  if (!city) return res.status(400).json({ error: 'City name required' });
  try {
    const fav = await Favourite.findOneAndUpdate(
      { city },
      { city, country },
      { upsert: true, new: true }
    );
    res.json({ success: true, favourite: fav });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── REMOVE a favourite city ──
app.delete('/api/favourites/:city', async (req, res) => {
  try {
    await Favourite.deleteOne({ city: req.params.city });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET stats (most searched cities) ──
app.get('/api/stats', async (req, res) => {
  try {
    const topCities = await Search.aggregate([
      { $group: { _id: '$city', count: { $sum: 1 }, lastAQI: { $last: '$aqi' }, country: { $last: '$country' } } },
      { $sort: { count: -1 } },
      { $limit: 5 }
    ]);
    const totalSearches = await Search.countDocuments();
    res.json({ topCities, totalSearches });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Health check ──
app.get('/api/health', (req, res) => {
  res.json({
    status: 'running',
    mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    time: new Date().toISOString()
  });
});

app.listen(PORT, () => {
  console.log(`✅ AirSense backend running at http://localhost:${PORT}`);
});
