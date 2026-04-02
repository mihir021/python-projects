/**
 * Playlist.js
 * Manages user library, playlists, favorites using localStorage
 */

class PlaylistManager {
    constructor() {
        this.library = [];
        this.favorites = [];
        this.playlists = [];
        try {
            this.favorites = JSON.parse(localStorage.getItem('pwa_favorites')) || [];
            this.playlists = JSON.parse(localStorage.getItem('pwa_playlists')) || [];
        } catch (e) {
            console.warn("Storage restricted", e);
        }
    }

    setLibrary(songs) {
        // Here we handle both fetched songs and user-uploaded local songs.
        // We'll merge them. 
        // For local songs, we need an IndexDB solution realistically if they want to keep them across sessions,
        // but for this MVP we'll just keep them in memory for the session if uploaded.
        this.library = songs;
    }

    addLocalSong(file) {
        const fileUrl = URL.createObjectURL(file);
        // Clean filename, simple fallback
        const filename = file.name.replace(/\.[^/.]+$/, ""); 
        
        const newSong = {
            id: 'local_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
            title: filename,
            artist: 'Local File',
            album: 'Unknown Album',
            duration: 0, // Gets updated on load
            cover: 'assets/icons/default-cover.png',
            src: fileUrl,
            isLocal: true
        };
        
        this.library.unshift(newSong); // Add to top of library
        return newSong;
    }

    getAllSongs() {
        return this.library;
    }

    getSongById(id) {
        return this.library.find(s => s.id === id);
    }

    // Favorites
    isFavorite(songId) {
        return this.favorites.includes(songId);
    }

    toggleFavorite(songId) {
        if (this.isFavorite(songId)) {
            this.favorites = this.favorites.filter(id => id !== songId);
        } else {
            this.favorites.push(songId);
        }
        this.saveFavorites();
        return this.isFavorite(songId);
    }

    getFavoriteSongs() {
        return this.favorites
            .map(id => this.getSongById(id))
            .filter(song => song !== undefined); // Remove nulls if local files were purged
    }

    saveFavorites() {
        // Note: we only save IDs. Local files will disappear on refresh since ObjectURLs die,
        // so favorites of local files might break on refresh. 
        localStorage.setItem('pwa_favorites', JSON.stringify(this.favorites));
    }

    // Playlists
    createPlaylist(name) {
        const pl = {
            id: 'pl_' + Date.now(),
            name: name,
            songIds: []
        };
        this.playlists.push(pl);
        this.savePlaylists();
        return pl;
    }

    deletePlaylist(id) {
        this.playlists = this.playlists.filter(pl => pl.id !== id);
        this.savePlaylists();
    }

    addSongToPlaylist(playlistId, songId) {
        const pl = this.playlists.find(p => p.id === playlistId);
        if (pl && !pl.songIds.includes(songId)) {
            pl.songIds.push(songId);
            this.savePlaylists();
            return true;
        }
        return false;
    }

    removeSongFromPlaylist(playlistId, songId) {
        const pl = this.playlists.find(p => p.id === playlistId);
        if (pl) {
            pl.songIds = pl.songIds.filter(id => id !== songId);
            this.savePlaylists();
        }
    }

    getPlaylistById(id) {
        return this.playlists.find(p => p.id === id);
    }

    getPlaylistSongs(playlistId) {
        const pl = this.getPlaylistById(playlistId);
        if (!pl) return [];
        return pl.songIds
            .map(id => this.getSongById(id))
            .filter(song => song !== undefined);
    }

    savePlaylists() {
        localStorage.setItem('pwa_playlists', JSON.stringify(this.playlists));
    }
}
