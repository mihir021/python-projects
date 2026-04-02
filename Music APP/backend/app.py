from __future__ import annotations

import json
import os
from datetime import datetime
from pathlib import Path

from flask import Flask, jsonify, request
from flask_cors import CORS
from pymongo import MongoClient

MONGODB_URI = os.environ.get("MONGODB_URI")
DB_NAME = os.environ.get("PULSE_DB", "pulse_player")
USER_ID = "local-user"

DEFAULT_SETTINGS = {
    "sort": "title",
    "hiddenSongs": [],
    "volume": 1,
    "shuffle": False,
    "repeat": "all",
}

app = Flask(__name__)
CORS(app)

if not MONGODB_URI:
    raise RuntimeError("MONGODB_URI is required")

client = MongoClient(MONGODB_URI)
db = client[DB_NAME]

songs_col = db["songs"]
playlists_col = db["playlists"]
state_col = db["state"]


def seed_songs() -> None:
    data_path = Path(__file__).resolve().parent.parent / "data" / "songs.json"
    if not data_path.exists():
        return

    with data_path.open("r", encoding="utf-8") as f:
        songs = json.load(f)

    if not isinstance(songs, list):
        return

    songs_col.delete_many({})
    for song in songs:
        if "id" not in song:
            continue
        songs_col.replace_one({"_id": song["id"]}, {**song, "_id": song["id"]}, upsert=True)


def get_state() -> dict:
    state = state_col.find_one({"_id": USER_ID})
    if not state:
        state = {
            "_id": USER_ID,
            "favorites": [],
            "settings": DEFAULT_SETTINGS,
        }
        state_col.replace_one({"_id": USER_ID}, state, upsert=True)
    return state


def sanitize_playlist(playlist: dict) -> dict:
    playlist_id = playlist.get("id") or f"pl-{datetime.utcnow().timestamp()}"
    return {
        "_id": playlist_id,
        "id": playlist_id,
        "name": playlist.get("name", "Untitled"),
        "songIds": playlist.get("songIds", []),
        "createdAt": playlist.get("createdAt", datetime.utcnow().isoformat()),
        "updatedAt": datetime.utcnow().isoformat(),
    }


@app.get("/api/health")
def health():
    return jsonify({"status": "ok"})


@app.get("/api/songs")
def get_songs():
    seed_songs()
    songs = list(songs_col.find({}, {"_id": 0}))
    return jsonify(songs)


@app.get("/api/playlists")
def get_playlists():
    playlists = list(playlists_col.find({}, {"_id": 0}).sort("createdAt", 1))
    return jsonify(playlists)


@app.put("/api/playlists")
def put_playlists():
    payload = request.get_json(silent=True) or {}
    playlists = payload.get("playlists", [])
    if not isinstance(playlists, list):
        return jsonify({"error": "Invalid payload"}), 400

    playlists_col.delete_many({})
    for playlist in playlists:
        playlists_col.replace_one(
            {"_id": playlist.get("id")},
            sanitize_playlist(playlist),
            upsert=True,
        )
    return jsonify({"status": "ok"})


@app.get("/api/favorites")
def get_favorites():
    state = get_state()
    return jsonify(state.get("favorites", []))


@app.put("/api/favorites")
def put_favorites():
    payload = request.get_json(silent=True) or {}
    favorites = payload.get("favorites", [])
    if not isinstance(favorites, list):
        return jsonify({"error": "Invalid favorites"}), 400

    state_col.update_one(
        {"_id": USER_ID},
        {"$set": {"favorites": favorites}},
        upsert=True,
    )
    return jsonify({"status": "ok"})


@app.get("/api/settings")
def get_settings():
    state = get_state()
    settings = {**DEFAULT_SETTINGS, **state.get("settings", {})}
    return jsonify(settings)


@app.put("/api/settings")
def put_settings():
    payload = request.get_json(silent=True) or {}
    settings = payload.get("settings", {})
    if not isinstance(settings, dict):
        return jsonify({"error": "Invalid settings"}), 400

    merged = {**DEFAULT_SETTINGS, **settings}
    state_col.update_one(
        {"_id": USER_ID},
        {"$set": {"settings": merged}},
        upsert=True,
    )
    return jsonify({"status": "ok"})


if __name__ == "__main__":
    seed_songs()
    app.run(host="0.0.0.0", port=5000)
