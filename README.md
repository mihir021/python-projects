# Python Projects

A collection of Python and web development projects covering full-stack application development, data science, and machine learning.

---

## Projects

### 🎵 Music APP

A full-stack music player application with a Flask REST API backend and a Progressive Web App (PWA) frontend.

**Location:** `Music APP/`

**Features:**
- Library view with song listing
- Search and filter songs
- Favorites management
- Create and manage playlists
- Full-screen now-playing view with album art
- Shuffle, repeat, and volume controls
- Installable as a PWA (offline support via Service Worker)

**Tech Stack:**
- **Backend:** Python, Flask, Flask-CORS, PyMongo
- **Frontend:** HTML5, CSS3, Vanilla JavaScript
- **Database:** MongoDB
- **Testing:** Playwright

**Backend Setup:**

```bash
cd "Music APP/backend"
pip install -r requirements.txt
export MONGODB_URI="<your-mongodb-connection-string>"
python app.py
```

The API server starts on `http://localhost:5000`.

**API Endpoints:**

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Health check |
| GET | `/api/songs` | Get all songs |
| GET | `/api/playlists` | Get all playlists |
| PUT | `/api/playlists` | Update playlists |
| GET | `/api/favorites` | Get favorite songs |
| PUT | `/api/favorites` | Update favorites |
| GET | `/api/settings` | Get user settings |
| PUT | `/api/settings` | Update user settings |

---

### 🎵 MUSIC_APP (PWA)

A standalone Progressive Web App music player with no backend dependency.

**Location:** `MUSIC_APP/music-app/`

**Features:**
- Fully client-side music player
- Offline support via Service Worker
- PWA manifest for installation on mobile/desktop
- Song library, search, favorites, and playlists

**Tech Stack:** HTML5, CSS3, Vanilla JavaScript

**Run:**
Open `MUSIC_APP/music-app/index.html` in a browser (or serve with any static file server).

---

### 🌾 IIT-RAM FarmLink (v0.1)

An agricultural marketplace demo built for the IIT-RAM Hackathon.

**Location:** `IIT-RAM_V_0.1/`

**Features:**
- Product listing grid with filters (Organic / Surplus)
- Price negotiation between farmers and buyers
- Cold-chain logistics tracking with temperature monitoring
- Escrow payment system
- MongoDB backend queries

**Tech Stack:** HTML5, CSS3, Vanilla JavaScript, MongoDB

**Run:**
Open `IIT-RAM_V_0.1/index.html` in a browser.

---

### 📊 Data Analysis & Learning (T1)

Jupyter notebooks covering data analysis using Pandas with real-world datasets.

**Location:** `T1/`

**Notebooks:**
- `CH2.ipynb` / `CH3.ipynb` – Chapter exercises
- `DataAnalysis.ipynb` – Exploratory data analysis
- `Hw.ipynb` – Homework assignments
- `TCS.ipynb` – TCS company data analysis

**Datasets (in `T1/DataForTest/`):**
- `movies.csv`, `auto-mpg.csv`, `ipl-matches.csv`, and more

---

### 📚 Pandas Task Notebooks

Hands-on Pandas tutorials and exercises.

**Location:** `Task/`

**Notebooks:**
- `Unit-1_Pandas.ipynb` – Introduction to Pandas
- `Unit-1_Pandas_(Part-2).ipynb` – Advanced Pandas operations

---

### 📂 Datasets Collection

A large collection of CSV/XLSX datasets for data science practice.

**Location:** `Python-2_26-main/Dataset-1/`

**Includes:**
- `bollywood.csv`, `titanic.csv`, `California_Houses.csv`
- `diabetes.csv`, `advertising.csv`, `loan.csv`
- `amazon_fires.csv`, `winequalityN.csv`
- IPL cricket, automobile, unemployment data, and 20+ more files

---

## Repository Structure

```
python-projects/
├── Music APP/              # Full-stack music player (Flask + MongoDB + PWA)
│   ├── backend/            # Flask REST API
│   │   ├── app.py
│   │   └── requirements.txt
│   ├── assets/             # Frontend assets (CSS, JS, icons)
│   ├── data/songs.json     # Song database
│   └── index.html          # PWA frontend
├── MUSIC_APP/              # Standalone PWA music player
│   └── music-app/
├── IIT-RAM_V_0.1/          # FarmLink agricultural marketplace demo
├── T1/                     # Data analysis Jupyter notebooks
├── Task/                   # Pandas learning notebooks
└── Python-2_26-main/       # Datasets for data science practice
```

---

## Requirements

- **Python 3.10+** (for Flask backend)
- **MongoDB** (for Music APP backend)
- **Jupyter Notebook** (for data analysis notebooks)
- A modern web browser (for frontend projects)

## License

This repository is for educational and portfolio purposes.
