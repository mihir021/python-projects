// app.js - Main bootstrap for Pulse Player
import { Player } from './player.js';
import { PlaylistManager } from './playlist.js';
import { UI } from './ui.js';

const API_BASE = window.PULSE_API_BASE || '';
const apiUrl = (path) => `${API_BASE}/api${path}`;

const DEFAULT_SETTINGS = {
  sort: 'title',
  hiddenSongs: [],
  volume: 1,
  shuffle: false,
  repeat: 'all'
};

const player = new Player();
const playlistManager = new PlaylistManager();
const ui = new UI(player, playlistManager);

let songs = [];
let favorites = [];
let settings = { ...DEFAULT_SETTINGS };

const fetchJSON = async (path, options = {}) => {
  const response = await fetch(apiUrl(path), {
    headers: { 'Content-Type': 'application/json' },
    ...options
  });
  if (!response.ok) throw new Error('Network error');
  return response.json();
};

const loadLocalFallback = async () => {
  try {
    const response = await fetch('./data/songs.json', { cache: 'force-cache' });
    if (!response.ok) throw new Error('Local cache unavailable');
    const localSongs = await response.json();

    songs = Array.isArray(localSongs) ? localSongs : [];
    favorites = [];
    settings = { ...DEFAULT_SETTINGS };

    const visibleSongs = songs;
    ui.setSongs(visibleSongs);
    ui.setFavorites(favorites);
    ui.setSettings(settings);
    playlistManager.setPlaylists([]);

    player.setSongs(visibleSongs);
    player.setShuffle(settings.shuffle);
    player.setRepeat(settings.repeat);
    player.setVolume(settings.volume);
    ui.showToast('Offline mode: using cached library.');
    return true;
  } catch (error) {
    return false;
  }
};

const syncSettings = async () => {
  try {
    await fetchJSON('/settings', {
      method: 'PUT',
      body: JSON.stringify({ settings })
    });
  } catch (error) {
    ui.showToast('Settings sync failed.');
  }
};

const loadRemoteData = async () => {
  ui.setLoading(true);
  try {
    const [songsData, playlistsData, favoritesData, settingsData] = await Promise.all([
      fetchJSON('/songs'),
      fetchJSON('/playlists'),
      fetchJSON('/favorites'),
      fetchJSON('/settings')
    ]);

    songs = Array.isArray(songsData) ? songsData : [];
    favorites = Array.isArray(favoritesData) ? favoritesData : [];
    settings = { ...DEFAULT_SETTINGS, ...(settingsData || {}) };

    const hidden = new Set(settings.hiddenSongs || []);
    const visibleSongs = songs.filter((song) => !hidden.has(song.id));

    ui.setSongs(visibleSongs);
    ui.setFavorites(favorites);
    ui.setSettings(settings);
    playlistManager.setPlaylists(Array.isArray(playlistsData) ? playlistsData : []);

    player.setSongs(visibleSongs);
    player.setShuffle(settings.shuffle);
    player.setRepeat(settings.repeat);
    player.setVolume(settings.volume);
  } catch (error) {
    const fallbackOk = await loadLocalFallback();
    if (!fallbackOk) {
      ui.showError('Unable to load your library from the server.');
    }
  } finally {
    ui.setLoading(false);
  }
};

const setupServiceWorker = () => {
  if (!('serviceWorker' in navigator)) return;
  const register = () => {
    navigator.serviceWorker.register('service-worker.js').catch(() => {
      // Service worker is optional for API mode.
    });
  };
  if (document.readyState === 'complete') {
    register();
  } else {
    window.addEventListener('load', register, { once: true });
  }
};

const connectEvents = () => {
  ui.on('favoriteChanged', async (newFavorites) => {
    favorites = newFavorites;
    try {
      await fetchJSON('/favorites', {
        method: 'PUT',
        body: JSON.stringify({ favorites })
      });
    } catch (error) {
      ui.showToast('Favorites sync failed.');
    }
  });

  ui.on('settingsChanged', async (newSettings) => {
    settings = { ...settings, ...newSettings };
    await syncSettings();
  });

  playlistManager.on('playlistsChanged', async (playlists) => {
    try {
      await fetchJSON('/playlists', {
        method: 'PUT',
        body: JSON.stringify({ playlists })
      });
    } catch (error) {
      ui.showToast('Playlist sync failed.');
    }
  });

  player.on('shuffle', (value) => {
    settings.shuffle = value;
    ui.setSettings(settings);
    syncSettings();
  });

  player.on('repeat', (mode) => {
    settings.repeat = mode;
    ui.setSettings(settings);
    syncSettings();
  });

  player.on('volume', (volume) => {
    settings.volume = volume;
    ui.setSettings(settings);
    syncSettings();
  });
};

const enforceIphoneOnly = () => {
  const isIphone = /iphone/i.test(navigator.userAgent);
  if (!isIphone) {
    ui.showIphoneOnly();
    return false;
  }
  return true;
};

window.addEventListener('DOMContentLoaded', async () => {
  connectEvents();
  ui.showView('home');
  if (!enforceIphoneOnly()) return;
  await loadRemoteData();
  setupServiceWorker();
});
