# 🌬️ AirSense — Node.js + MongoDB Backend

## 📁 Project Structure
```
airsense-backend/
├── server.js          ← Express backend (main file)
├── .env               ← Your secret keys (never upload this!)
├── package.json       ← Node.js dependencies
├── README.md          ← This file
└── public/
    └── index.html     ← Frontend (served by Express)
```

## 🚀 Setup Steps

### Step 1 — Install Node.js
Download from: https://nodejs.org (LTS version)

### Step 2 — Get MongoDB Atlas (Free)
1. Go to https://mongodb.com/atlas
2. Sign up for free
3. Create a free cluster (M0 - Free tier)
4. Click "Connect" → "Connect your application"
5. Copy the connection string — looks like:
   mongodb+srv://username:password@cluster0.xxxxx.mongodb.net/

### Step 3 — Setup .env file
Open `.env` and fill in:
```
MONGO_URI=mongodb+srv://YOUR_USER:YOUR_PASS@cluster0.xxxxx.mongodb.net/airsense
OWM_API_KEY=your_openweathermap_key
PORT=3000
```

### Step 4 — Install packages
```bash
npm install
```

### Step 5 — Run the server
```bash
node server.js
```

### Step 6 — Open in browser
Go to: http://localhost:3000

---

## 🔌 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/aqi/:city | Get live AQI + save to MongoDB |
| GET | /api/history | Last 20 searches |
| GET | /api/history/:city | History for specific city |
| GET | /api/favourites | Get all favourites |
| POST | /api/favourites | Add a favourite |
| DELETE | /api/favourites/:city | Remove a favourite |
| GET | /api/stats | Most searched cities |
| GET | /api/health | Check server + DB status |

---

## 🗄️ MongoDB Collections

### searches
Stores every AQI lookup:
- city, country, lat, lon
- aqi, status
- pm25, pm10, co, no2, so2, o3
- searchedAt (timestamp)

### favourites
Stores saved cities:
- city, country
- addedAt (timestamp)
