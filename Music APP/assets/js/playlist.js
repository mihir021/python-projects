// playlist.js - Playlist management and persistence helpers
export class PlaylistManager {
  constructor() {
    this.playlists = [];
    this.listeners = {};
  }

  setPlaylists(playlists) {
    this.playlists = Array.isArray(playlists) ? playlists : [];
    this._emit('playlistsChanged', this.playlists);
  }

  getPlaylists() {
    return this.playlists;
  }

  createPlaylist(name) {
    const trimmed = String(name || '').trim();
    if (!trimmed) return null;
    const id = `pl-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const playlist = { id, name: trimmed, songIds: [], createdAt: new Date().toISOString() };
    this.playlists.push(playlist);
    this._emit('playlistsChanged', this.playlists);
    return playlist;
  }

  renamePlaylist(id, newName) {
    const trimmed = String(newName || '').trim();
    if (!trimmed) return false;
    const playlist = this.playlists.find((item) => item.id === id);
    if (!playlist) return false;
    playlist.name = trimmed;
    this._emit('playlistsChanged', this.playlists);
    return true;
  }

  deletePlaylist(id) {
    const before = this.playlists.length;
    this.playlists = this.playlists.filter((item) => item.id !== id);
    if (this.playlists.length !== before) {
      this._emit('playlistsChanged', this.playlists);
      return true;
    }
    return false;
  }

  addSongToPlaylist(playlistId, songId) {
    const playlist = this.playlists.find((item) => item.id === playlistId);
    if (!playlist) return false;
    if (!playlist.songIds.includes(songId)) {
      playlist.songIds.push(songId);
      this._emit('playlistsChanged', this.playlists);
    }
    return true;
  }

  removeSongFromPlaylist(playlistId, songId) {
    const playlist = this.playlists.find((item) => item.id === playlistId);
    if (!playlist) return false;
    playlist.songIds = playlist.songIds.filter((id) => id !== songId);
    this._emit('playlistsChanged', this.playlists);
    return true;
  }

  reorderSongs(playlistId, songIds) {
    const playlist = this.playlists.find((item) => item.id === playlistId);
    if (!playlist) return false;
    playlist.songIds = [...songIds];
    this._emit('playlistsChanged', this.playlists);
    return true;
  }

  getPlaylist(id) {
    return this.playlists.find((item) => item.id === id) || null;
  }

  on(event, callback) {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(callback);
  }

  _emit(event, ...args) {
    (this.listeners[event] || []).forEach((cb) => cb(...args));
  }
}
