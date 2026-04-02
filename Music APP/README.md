# Pulse Player (Personal Music Player PWA)

A premium, offline-ready personal music player built with pure HTML, CSS, and Vanilla JavaScript. Optimized for iPhone and backed by MongoDB (single-user).

## Features
- Premium dark UI with glassmorphism and animated wallpaper
- Mini player + full-screen Now Playing view with swipe gestures
- Real-time search with highlighted matches
- Favorites with animated heart
- Playlists with drag-and-drop reordering
- MongoDB persistence (single user)
- iPhone-safe-area support and no-input-zoom settings

## Add Your Songs
1. Place your audio files in the `songs/` folder (MP3 recommended).
2. Update `data/songs.json` with metadata for each track.

Example entry:
```json
{
  "id": "3",
  "title": "Love Dose",
  "artist": "Silver Hearts",
  "album": "Midnight Bloom",
  "cover": "assets/covers/love-dose.png",
  "file": "songs/love-dose.mp3",
  "duration": 222,
  "added": "2026-03-25"
}
```

Notes:
- `duration` is in seconds.
- `added` is a date string used for Recently Added sorting.
- You can use your own album art by placing images in `assets/` and pointing `cover` to them.

## Run Backend (Flask + MongoDB)
1. Create a virtual environment and install dependencies:
```
python3 -m venv .venv
source .venv/bin/activate
pip install -r backend/requirements.txt
```
2. Set your MongoDB URI (do not commit it to Git):
```
export MONGODB_URI="<your-mongodb-uri>"
export PULSE_DB="pulse_player"
```
3. Start the API server:
```
python backend/app.py
```
The API runs on `http://localhost:5000`.

## Run Frontend
In another terminal, from the project root:
```
python3 -m http.server 8000
```
Open `http://localhost:8000` in your browser.

If your API is hosted on a different domain, set it in `index.html`:
```html
<script>
  window.PULSE_API_BASE = "https://your-api-domain.com";
</script>
```

For local iPhone testing, use your machine’s LAN IP:
```html
<script>
  window.PULSE_API_BASE = "http://192.168.1.20:5000";
</script>
```

## Deploy
- Frontend: Netlify or GitHub Pages
- Backend: Render/Railway/VPS (any Flask-friendly host)
- Set `MONGODB_URI` in your host’s environment variables

## Troubleshooting
- If songs do not play, confirm file paths in `data/songs.json` match files in `songs/`.
- If backend calls fail, verify the API base URL and CORS.
