// ui.js - UI rendering and interaction logic
export class UI {
  constructor(player, playlistManager) {
    this.player = player;
    this.playlistManager = playlistManager;

    this.songs = [];
    this.favorites = [];
    this.settings = { sort: 'title', hiddenSongs: [] };
    this.listeners = {};

    this.songIndexById = new Map();
    this.currentView = 'home';
    this.viewOrder = ['home', 'library', 'favorites', 'playlists'];
    this.activePlaylistId = null;
    this.isLoading = false;
    this.isSeeking = false;
    this.currentSongId = null;
    this.pendingOptionsSong = null;
    this.playlistEditId = null;
    this.currentLyrics = [];
    this.lyricsIndex = -1;
    this.searchQuery = '';
    this._seekRaf = null;
    this._mediaSessionBound = false;

    this._cacheDom();
    this._bindStaticEvents();
    this._bindPlayerEvents();
    this._bindPlaylistEvents();
  }

  on(event, callback) {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(callback);
  }

  _emit(event, ...args) {
    (this.listeners[event] || []).forEach((cb) => cb(...args));
  }

  setSongs(songs) {
    this.songs = Array.isArray(songs) ? songs : [];
    this.songIndexById = new Map(this.songs.map((song, idx) => [song.id, idx]));
    this.renderCurrentView();
  }

  setFavorites(favorites) {
    this.favorites = Array.isArray(favorites) ? favorites : [];
    this.renderCurrentView();
    this._updateFavoriteIcons();
  }

  setSettings(settings) {
    this.settings = { ...this.settings, ...settings };
    this.renderCurrentView();
  }

  setLoading(isLoading) {
    this.isLoading = isLoading;
    this.renderCurrentView();
  }

  showView(view) {
    const next = this.viewOrder.includes(view) ? view : 'home';
    const currentIndex = this.viewOrder.indexOf(this.currentView);
    const nextIndex = this.viewOrder.indexOf(next);
    this.currentView = next;

    this.views.forEach((section) => {
      const name = section.dataset.view;
      if (name === next) {
        section.dataset.state = 'active';
      } else if (this.viewOrder.indexOf(name) < nextIndex) {
        section.dataset.state = 'left';
      } else {
        section.dataset.state = 'right';
      }
    });

    this.navButtons.forEach((button) => {
      button.classList.toggle('active', button.dataset.view === next);
    });

    this.renderCurrentView();
  }

  renderCurrentView() {
    switch (this.currentView) {
      case 'home':
        this.renderHome();
        break;
      case 'search':
        this.renderSearch();
        break;
      case 'library':
        this.renderLibrary();
        break;
      case 'favorites':
        this.renderFavorites();
        break;
      case 'playlists':
        this.renderPlaylists();
        break;
      default:
        this.renderHome();
    }
  }

  renderHome() {
    const view = this.getView('home');
    if (!view) return;

    if (this.isLoading) {
      view.innerHTML = this.renderSkeleton('Loading your library...');
      return;
    }

    const visibleSongs = this.getVisibleSongs();
    const recent = this.sortSongs(visibleSongs, 'recent').slice(0, 6);
    const favorites = visibleSongs.filter((song) => this.favorites.includes(song.id)).slice(0, 6);

    view.innerHTML = `
      <div class="section-title">Home</div>
      <div class="search-bar home-search">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15.5 14h-.8l-.3-.3A6.5 6.5 0 1 0 14 15.5l.3.3v.7L20 22l2-2-6.5-6zM9.5 14A4.5 4.5 0 1 1 9.5 5a4.5 4.5 0 0 1 0 9z"/></svg>
        <input id="home-search-input" type="search" placeholder="Search songs, artists, albums">
      </div>
      <div id="home-search-results" class="search-results"></div>
      <div id="home-main">
        <div class="section-title">Recently Added</div>
        <div class="horizontal-scroll">
          ${recent.length ? recent.map((song) => this.renderAlbumCard(song)).join('') : '<div class="section-subtitle">No songs yet.</div>'}
        </div>

        <div class="section-title">Favorites</div>
        ${favorites.length ? this.renderSongList(favorites) : '<div class="section-subtitle">No favorites yet.</div>'}
      </div>
    `;

    const input = view.querySelector('#home-search-input');
    const results = view.querySelector('#home-search-results');
    const main = view.querySelector('#home-main');

    input.value = this.searchQuery;
    input.oninput = (event) => {
      const value = event.target.value.trim();
      this.searchQuery = value;
      this.debounce(() => this.renderSearchResults(value, results), 250);
      main.style.display = value ? 'none' : 'block';
    };

    if (this.searchQuery) {
      main.style.display = 'none';
      this.renderSearchResults(this.searchQuery, results);
    } else {
      results.innerHTML = '';
    }

    this.attachListHandlers(view);
  }

  renderSearch() {
    const view = this.getView('search');
    if (!view) return;

    view.innerHTML = `
      <div class="section-title">Search</div>
      <div class="search-bar">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15.5 14h-.8l-.3-.3A6.5 6.5 0 1 0 14 15.5l.3.3v.7L20 22l2-2-6.5-6zM9.5 14A4.5 4.5 0 1 1 9.5 5a4.5 4.5 0 0 1 0 9z"/></svg>
        <input id="search-input" type="search" placeholder="Search songs, artists, albums">
      </div>
      <div id="search-results" class="search-results"></div>
    `;

    const input = view.querySelector('#search-input');
    const results = view.querySelector('#search-results');

    input.value = this.searchQuery;
    input.oninput = (event) => {
      const value = event.target.value.trim();
      this.searchQuery = value;
      this.debounce(() => this.renderSearchResults(value, results), 250);
    };

    this.renderSearchResults(this.searchQuery, results);
  }

  renderLibrary() {
    const view = this.getView('library');
    if (!view) return;

    const visibleSongs = this.getVisibleSongs();
    const sortedSongs = this.sortSongs(visibleSongs, this.settings.sort);

    view.innerHTML = `
      <div class="section-title">All Songs</div>
      <div class="section-subtitle">${sortedSongs.length} tracks</div>
      <div class="sort-chips">
        ${this.renderSortChip('title', 'Title')}
        ${this.renderSortChip('artist', 'Artist')}
        ${this.renderSortChip('recent', 'Recently Added')}
        ${this.renderSortChip('duration', 'Duration')}
      </div>
      ${this.isLoading ? this.renderSkeleton('Loading songs...') : this.renderSongList(sortedSongs)}
    `;

    this.attachListHandlers(view);
  }

  renderFavorites() {
    const view = this.getView('favorites');
    if (!view) return;

    const favoriteSongs = this.getVisibleSongs().filter((song) => this.favorites.includes(song.id));

    view.innerHTML = `
      <div class="section-title">Favorites</div>
      <div class="section-subtitle">${favoriteSongs.length} tracks</div>
      ${favoriteSongs.length ? this.renderSongList(favoriteSongs) : '<div class="section-subtitle">Tap the heart to save your favorites.</div>'}
    `;

    this.attachListHandlers(view);
  }

  renderPlaylists() {
    const view = this.getView('playlists');
    if (!view) return;

    if (this.activePlaylistId) {
      this.renderPlaylistDetail(view, this.activePlaylistId);
      return;
    }

    const playlists = this.playlistManager.getPlaylists();

    view.innerHTML = `
      <div class="section-title">Playlists</div>
      <div class="section-subtitle">${playlists.length} collections</div>
      <button id="create-playlist" class="primary-btn" type="button">New Playlist</button>
      <div class="playlist-grid">
        ${playlists.length ? playlists.map((playlist) => this.renderPlaylistCard(playlist)).join('') : '<div class="section-subtitle">Create your first playlist.</div>'}
      </div>
    `;

    const createButton = view.querySelector('#create-playlist');
    createButton.addEventListener('click', () => this.openPlaylistModal());

    view.querySelectorAll('.playlist-card').forEach((card) => {
      card.addEventListener('click', () => {
        this.activePlaylistId = card.dataset.playlist;
        this.renderPlaylists();
      });
    });
  }

  renderPlaylistDetail(view, playlistId) {
    const playlist = this.playlistManager.getPlaylist(playlistId);
    if (!playlist) {
      this.activePlaylistId = null;
      this.renderPlaylists();
      return;
    }

    const songs = this.getVisibleSongs().filter((song) => playlist.songIds.includes(song.id));

    view.innerHTML = `
      <button id="back-playlists" class="ghost-btn" type="button">Back</button>
      <div class="section-title">${this.escapeHtml(playlist.name)}</div>
      <div class="section-subtitle">${songs.length} tracks</div>
      <div class="song-list">
        ${songs.map((song) => this.renderSongItem(song, true)).join('')}
      </div>
      <div class="section-subtitle">Drag to reorder tracks.</div>
      <button id="rename-playlist" class="ghost-btn" type="button">Rename Playlist</button>
      <button id="delete-playlist" class="ghost-btn" type="button">Delete Playlist</button>
    `;

    view.querySelector('#back-playlists').addEventListener('click', () => {
      this.activePlaylistId = null;
      this.renderPlaylists();
    });

    view.querySelector('#delete-playlist').addEventListener('click', () => {
      if (confirm('Delete this playlist?')) {
        this.playlistManager.deletePlaylist(playlistId);
        this.activePlaylistId = null;
        this.renderPlaylists();
        this.showToast('Playlist deleted.');
      }
    });

    view.querySelector('#rename-playlist').addEventListener('click', () => {
      this.openPlaylistRename(playlist);
    });

    this.attachListHandlers(view, playlistId);
  }

  renderSearchResults(query, container) {
    const cleanQuery = query.trim().toLowerCase();
    if (!cleanQuery) {
      container.innerHTML = '';
      return;
    }

    const results = this.getVisibleSongs().filter((song) => {
      return [song.title, song.artist, song.album].some((field) =>
        String(field || '').toLowerCase().includes(cleanQuery)
      );
    });

    if (!results.length) {
      container.innerHTML = '<div class="search-empty">No results found.</div>';
      return;
    }

    container.innerHTML = this.renderSongList(results, cleanQuery);
    this.attachListHandlers(container);
  }

  renderSongList(songs, highlight = '') {
    return `<div class="song-list">${songs.map((song) => this.renderSongItem(song, false, highlight)).join('')}</div>`;
  }

  renderSongItem(song, showRemove, highlight = '') {
    const duration = this.formatDuration(song.duration);
    const title = highlight ? this.highlightText(song.title, highlight) : this.escapeHtml(song.title);
    const artist = highlight ? this.highlightText(song.artist, highlight) : this.escapeHtml(song.artist);
    const liked = this.favorites.includes(song.id);

    return `
      <div class="song-item" data-song-id="${song.id}" data-playlist-remove="${showRemove ? 'true' : 'false'}" ${showRemove ? 'draggable=\"true\"' : ''}>
        <img class="song-cover" src="${song.cover}" alt="${this.escapeHtml(song.title)} cover" loading="lazy">
        <div class="song-meta">
          <span class="song-title">${title}</span>
          <span class="song-artist">${artist}</span>
        </div>
        <div class="song-actions">
          ${showRemove ? '<span class="drag-handle" aria-hidden="true">⋮⋮</span>' : ''}
          ${!showRemove ? `<button class="icon-btn" data-action="favorite" aria-label="Favorite">
            <svg viewBox="0 0 24 24" class="heart-icon ${liked ? 'liked' : ''}"><path d="M12 20.5s-7.5-4.35-9.5-8.94C.71 8.1 2.68 5 5.92 5c2 0 3.23 1.08 4.08 2.25C10.85 6.08 12.08 5 14.08 5c3.24 0 5.21 3.1 3.42 6.56C19.5 16.15 12 20.5 12 20.5z"/></svg>
          </button>` : ''}
          ${showRemove ? '<button class="ghost-btn" data-action="remove" aria-label="Remove from playlist">Remove</button>' : ''}
          <button class="icon-btn play" data-action="play" aria-label="Play">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.2v13.6a.8.8 0 0 0 1.2.7l10.4-6.8a.8.8 0 0 0 0-1.4L9.2 4.5a.8.8 0 0 0-1.2.7z"/></svg>
          </button>
          ${!showRemove ? `<button class="icon-btn" data-action="options" aria-label="Options">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 10h2v4H5v-4zm6 0h2v4h-2v-4zm6 0h2v4h-2v-4z"/></svg>
          </button>` : ''}
        </div>
      </div>
    `;
  }

  renderAlbumCard(song) {
    return `
      <div class="album-card" data-song-id="${song.id}">
        <img class="album-art" src="${song.cover}" alt="${this.escapeHtml(song.title)} cover" loading="lazy">
        <div class="album-title">${this.escapeHtml(song.title)}</div>
        <div class="album-artist">${this.escapeHtml(song.artist)}</div>
      </div>
    `;
  }

  renderPlaylistCard(playlist) {
    const coverSong = this.songs.find((song) => playlist.songIds.includes(song.id));
    const cover = coverSong ? coverSong.cover : 'assets/icons/icon-192.png';
    return `
      <div class="playlist-card" data-playlist="${playlist.id}">
        <img class="playlist-cover" src="${cover}" alt="${this.escapeHtml(playlist.name)} cover" loading="lazy">
        <div class="playlist-title">${this.escapeHtml(playlist.name)}</div>
        <div class="playlist-count">${playlist.songIds.length} tracks</div>
      </div>
    `;
  }

  renderSortChip(value, label) {
    const active = this.settings.sort === value ? 'active' : '';
    return `<button class="chip ${active}" data-sort="${value}" type="button">${label}</button>`;
  }

  renderSkeleton(label) {
    return `
      <div class="card">
        <div class="section-title">${label}</div>
        <div class="skeleton skeleton-line" style="width: 60%;"></div>
        <div class="skeleton skeleton-line" style="width: 80%;"></div>
        <div class="skeleton skeleton-line" style="width: 70%;"></div>
      </div>
    `;
  }

  attachListHandlers(container, playlistId = null) {
    if (!container) return;

    container.querySelectorAll('.song-item').forEach((item) => {
      const songId = item.dataset.songId;
      item.addEventListener('click', (event) => {
        const actionButton = event.target.closest('[data-action]');
        if (actionButton) return;
        this.playSong(songId, true);
      });
    });

    container.querySelectorAll('.album-card').forEach((card) => {
      card.addEventListener('click', () => this.playSong(card.dataset.songId, true));
    });

    container.querySelectorAll('[data-action="play"]').forEach((button) => {
      button.addEventListener('click', (event) => {
        event.stopPropagation();
        const songId = button.closest('.song-item').dataset.songId;
        this.playSong(songId, true);
      });
    });

    container.querySelectorAll('[data-action="favorite"]').forEach((button) => {
      button.addEventListener('click', (event) => {
        event.stopPropagation();
        const songId = button.closest('.song-item').dataset.songId;
        this.toggleFavorite(songId);
      });
    });

    container.querySelectorAll('[data-action="options"]').forEach((button) => {
      button.addEventListener('click', (event) => {
        event.stopPropagation();
        const songId = button.closest('.song-item').dataset.songId;
        this.openSongSheet(songId);
      });
    });

    container.querySelectorAll('[data-action="remove"]').forEach((button) => {
      button.addEventListener('click', (event) => {
        event.stopPropagation();
        const songId = button.closest('.song-item').dataset.songId;
        this.playlistManager.removeSongFromPlaylist(playlistId, songId);
        this.showToast('Removed from playlist.');
        this.renderPlaylists();
      });
    });

    this.attachLongPress(container);
    if (playlistId) this.attachDragAndDrop(container, playlistId);
  }

  attachDragAndDrop(container, playlistId) {
    let dragged = null;

    container.querySelectorAll('.song-item[draggable="true"]').forEach((item) => {
      item.addEventListener('dragstart', () => {
        dragged = item;
        item.classList.add('dragging');
      });

      item.addEventListener('dragend', () => {
        if (dragged) dragged.classList.remove('dragging');
        dragged = null;
      });
    });

    container.addEventListener('dragover', (event) => {
      event.preventDefault();
      const target = event.target.closest('.song-item[draggable="true"]');
      if (!target || target === dragged) return;
      target.classList.add('drag-over');
    });

    container.addEventListener('dragleave', (event) => {
      const target = event.target.closest('.song-item[draggable="true"]');
      if (target) target.classList.remove('drag-over');
    });

    container.addEventListener('drop', (event) => {
      event.preventDefault();
      const target = event.target.closest('.song-item[draggable="true"]');
      if (!dragged || !target || dragged === target) return;

      target.classList.remove('drag-over');
      const list = target.parentElement;
      const draggedIndex = Array.from(list.children).indexOf(dragged);
      const targetIndex = Array.from(list.children).indexOf(target);
      if (draggedIndex < targetIndex) {
        target.after(dragged);
      } else {
        target.before(dragged);
      }

      const newOrder = Array.from(list.querySelectorAll('.song-item')).map((item) => item.dataset.songId);
      this.playlistManager.reorderSongs(playlistId, newOrder);
      this.showToast('Playlist reordered.');
    });
  }
  attachLongPress(container) {
    if (container.dataset.longpress === 'true') return;
    container.dataset.longpress = 'true';
    let timer = null;
    let startX = 0;
    let startY = 0;

    const clearTimer = () => {
      if (timer) clearTimeout(timer);
      timer = null;
    };

    container.addEventListener('pointerdown', (event) => {
      const item = event.target.closest('.song-item');
      if (!item || event.target.closest('[data-action]')) return;
      startX = event.clientX;
      startY = event.clientY;
      timer = setTimeout(() => {
        this.openSongSheet(item.dataset.songId);
      }, 450);
    });

    container.addEventListener('pointermove', (event) => {
      if (!timer) return;
      if (Math.abs(event.clientX - startX) > 10 || Math.abs(event.clientY - startY) > 10) {
        clearTimer();
      }
    });

    container.addEventListener('pointerup', clearTimer);
    container.addEventListener('pointerleave', clearTimer);
  }

  playSong(songId, openModal) {
    const index = this.songIndexById.get(songId);
    if (index === undefined) return;
    this.player.playByIndex(index);
    if (openModal) this.showNowPlaying();
  }

  toggleFavorite(songId) {
    const isFavorite = this.favorites.includes(songId);
    if (isFavorite) {
      this.favorites = this.favorites.filter((id) => id !== songId);
      this.showToast('Removed from favorites.');
    } else {
      this.favorites = [...this.favorites, songId];
      this.showToast('Added to favorites.');
    }
    this._emit('favoriteChanged', this.favorites);
    this._updateFavoriteIcons();
    this.renderCurrentView();
  }

  openSongSheet(songId) {
    const song = this.songs.find((item) => item.id === songId);
    if (!song) return;
    this.pendingOptionsSong = songId;
    this.sheetSong.innerHTML = `
      <img src="${song.cover}" alt="${this.escapeHtml(song.title)} cover" loading="lazy">
      <div>
        <div class="song-title">${this.escapeHtml(song.title)}</div>
        <div class="song-artist">${this.escapeHtml(song.artist)}</div>
      </div>
    `;
    const isFavorite = this.favorites.includes(songId);
    this.sheetLike.textContent = isFavorite ? 'Unlike' : 'Like';
    this.openSheet(this.songSheet);
  }

  openSheet(sheet) {
    this.sheetBackdrop.classList.remove('hidden');
    sheet.classList.remove('hidden');
    sheet.setAttribute('aria-hidden', 'false');
  }

  closeSheets() {
    this.sheetBackdrop.classList.add('hidden');
    [this.songSheet, this.playlistSheet].forEach((sheet) => {
      sheet.classList.add('hidden');
      sheet.setAttribute('aria-hidden', 'true');
    });
  }

  openPlaylistSheet() {
    const playlists = this.playlistManager.getPlaylists();
    this.playlistList.innerHTML = playlists.length
      ? playlists
          .map((playlist) => {
            return `<button class="sheet-btn" data-playlist-id="${playlist.id}">${this.escapeHtml(playlist.name)}</button>`;
          })
          .join('')
      : '<div class="section-subtitle">No playlists yet.</div>';

    this.playlistList.querySelectorAll('[data-playlist-id]').forEach((button) => {
      button.addEventListener('click', () => {
        if (!this.pendingOptionsSong) return;
        this.playlistManager.addSongToPlaylist(button.dataset.playlistId, this.pendingOptionsSong);
        this.showToast('Added to playlist.');
        this.closeSheets();
      });
    });

    this.openSheet(this.playlistSheet);
  }

  openPlaylistModal() {
    this.playlistEditId = null;
    this.playlistModalTitle.textContent = 'Create Playlist';
    this.playlistSave.textContent = 'Create';
    this.playlistName.value = '';
    this.playlistModal.classList.remove('hidden');
  }

  openPlaylistRename(playlist) {
    if (!playlist) return;
    this.playlistEditId = playlist.id;
    this.playlistModalTitle.textContent = 'Rename Playlist';
    this.playlistSave.textContent = 'Save';
    this.playlistName.value = playlist.name || '';
    this.playlistModal.classList.remove('hidden');
  }

  closePlaylistModal() {
    this.playlistModal.classList.add('hidden');
    this.playlistEditId = null;
  }

  deleteSong(songId) {
    if (!songId) return;
    if (!this.settings.hiddenSongs.includes(songId)) {
      this.settings.hiddenSongs = [...this.settings.hiddenSongs, songId];
    }
    this.songs = this.songs.filter((song) => song.id !== songId);
    this.songIndexById = new Map(this.songs.map((song, idx) => [song.id, idx]));
    this.player.setSongs(this.songs);
    this.favorites = this.favorites.filter((id) => id !== songId);
    this.playlistManager.getPlaylists().forEach((playlist) => {
      this.playlistManager.removeSongFromPlaylist(playlist.id, songId);
    });
    this._emit('favoriteChanged', this.favorites);
    this._emit('settingsChanged', { hiddenSongs: this.settings.hiddenSongs });
    if (this.currentSongId === songId) {
      this.player.pause();
      this.currentSongId = null;
      this.miniTitle.textContent = 'Not Playing';
      this.miniArtist.textContent = 'Select a song';
      this.npTitle.textContent = 'Not Playing';
      this.npArtist.textContent = 'Select a song to start';
    }
    this.showToast('Song removed from library.');
    this.renderCurrentView();
  }

  showNowPlaying() {
    this.nowPlayingModal.classList.remove('hidden');
    this.nowPlayingModal.setAttribute('aria-hidden', 'false');
  }

  hideNowPlaying() {
    this.nowPlayingModal.classList.add('hidden');
    this.nowPlayingModal.setAttribute('aria-hidden', 'true');
  }

  updateNowPlaying(song) {
    if (!song) return;
    this.currentSongId = song.id;
    this.currentLyrics = this.parseLyrics(song.lyrics || '');
    this.lyricsIndex = -1;

    this.miniCover.src = song.cover;
    this.miniTitle.textContent = song.title;
    this.miniArtist.textContent = song.artist;

    this.npCover.src = song.cover;
    this.npTitle.textContent = song.title;
    this.npArtist.textContent = song.artist;
    this.npBlur.style.backgroundImage = `url('${song.cover}')`;
    this.npCurrent.textContent = '0:00';
    this.npDuration.textContent = this.formatDuration(song.duration || 0);
    this.npSeek.value = 0;

    this._updateFavoriteIcons();
    this.updateThemeFromCover(song.cover);
    this.renderLyrics();
    this.updateMediaSession(song);
  }

  updatePlayState(isPlaying) {
    const icon = isPlaying ? this.pauseIcon : this.playIcon;
    this.miniPlay.innerHTML = icon;
    this.npPlay.innerHTML = icon;
    this.updateMediaSessionState(isPlaying);
  }

  updateSeekbar(current, duration) {
    if (!duration) return;
    if (!this.isSeeking) {
      const percent = Math.min(100, (current / duration) * 100);
      this.npSeek.value = percent;
      this.npCurrent.textContent = this.formatDuration(current);
      this.npDuration.textContent = this.formatDuration(duration);
    }
    this.updateLyricsHighlight(current);
  }

  renderLyrics() {
    if (!this.npLyrics) return;
    if (!this.currentLyrics.length) {
      this.npLyrics.innerHTML = '<div class="np-lyrics-line">Lyrics not available.</div>';
      return;
    }
    this.npLyrics.innerHTML = this.currentLyrics
      .map((line) => `<div class="np-lyrics-line" data-time="${line.time}">${this.escapeHtml(line.text)}</div>`)
      .join('');
  }

  updateLyricsHighlight(currentTime) {
    if (!this.currentLyrics.length || !this.npLyrics) return;
    let nextIndex = -1;
    for (let i = 0; i < this.currentLyrics.length; i += 1) {
      if (currentTime >= this.currentLyrics[i].time) nextIndex = i;
      else break;
    }
    if (nextIndex === this.lyricsIndex) return;
    const lines = this.npLyrics.querySelectorAll('.np-lyrics-line');
    if (this.lyricsIndex >= 0 && lines[this.lyricsIndex]) {
      lines[this.lyricsIndex].classList.remove('active');
    }
    if (nextIndex >= 0 && lines[nextIndex]) {
      lines[nextIndex].classList.add('active');
      lines[nextIndex].scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
    this.lyricsIndex = nextIndex;
  }

  updateMediaSession(song) {
    if (!('mediaSession' in navigator) || !song) return;
    this._initMediaSession();
    const artwork = this.buildMediaArtwork(song.cover);
    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: song.title || 'Unknown Track',
        artist: song.artist || 'Unknown Artist',
        album: song.album || '',
        artwork,
      });
    } catch (error) {
      // Ignore metadata errors on unsupported platforms.
    }
  }

  updateMediaSessionState(isPlaying) {
    if (!('mediaSession' in navigator)) return;
    try {
      navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';
    } catch (error) {
      // Playback state is optional and not supported everywhere.
    }
  }

  _initMediaSession() {
    if (!('mediaSession' in navigator) || this._mediaSessionBound) return;
    this._mediaSessionBound = true;
    const safeHandler = (action, handler) => {
      try {
        navigator.mediaSession.setActionHandler(action, handler);
      } catch (error) {
        // Some actions are not supported on iOS Safari.
      }
    };

    safeHandler('play', () => this.player.play());
    safeHandler('pause', () => this.player.pause());
    safeHandler('previoustrack', () => this.player.prev());
    safeHandler('nexttrack', () => this.player.next());

    // Commenting out seekbackward/seekforward to show previous/next track on iOS lock screen
    // instead of skip 10s buttons
    // safeHandler('seekbackward', (details) => {
    //   const offset = details && details.seekOffset ? details.seekOffset : 10;
    //   const current = this.player.audio.currentTime || 0;
    //   this.player.seekTo(Math.max(0, current - offset));
    // });
    // safeHandler('seekforward', (details) => {
    //   const offset = details && details.seekOffset ? details.seekOffset : 10;
    //   const current = this.player.audio.currentTime || 0;
    //   this.player.seekTo(current + offset);
    // });

    safeHandler('seekto', (details) => {
      if (details && typeof details.seekTime === 'number') {
        this.player.seekTo(details.seekTime);
      }
    });
  }

  buildMediaArtwork(cover) {
    if (!cover) return [];
    const url = new URL(cover, window.location.href).href;
    const extension = cover.split('.').pop().toLowerCase();
    const typeMap = {
      png: 'image/png',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      webp: 'image/webp',
      svg: 'image/svg+xml',
    };
    const type = typeMap[extension] || 'image/png';
    return [
      { src: url, sizes: '512x512', type },
      { src: url, sizes: '256x256', type },
      { src: url, sizes: '128x128', type },
    ];
  }

  parseLyrics(raw) {
    if (!raw) return [];
    const lines = raw.split('\n');
    const parsed = [];
    const timeRegex = /\[(\d+):(\d+(?:\.\d+)?)\](.*)/;
    for (const line of lines) {
      const match = line.match(timeRegex);
      if (!match) continue;
      const minutes = Number(match[1]);
      const seconds = Number(match[2]);
      const text = match[3].trim();
      if (!text) continue;
      parsed.push({ time: minutes * 60 + seconds, text });
    }
    return parsed.sort((a, b) => a.time - b.time);
  }

  updateShuffle(isOn) {
    this.npShuffle.classList.toggle('active', isOn);
  }

  updateRepeat(mode) {
    this.npRepeat.dataset.mode = mode;
    this.npRepeat.classList.toggle('active', mode !== 'none');
    const iconMap = {
      none: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7h10V4l4 4-4 4V9H7a4 4 0 0 0 0 8h2v2H7a6 6 0 0 1 0-12z"/></svg>',
      all: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7h10V4l4 4-4 4V9H7a4 4 0 0 0 0 8h2v2H7a6 6 0 0 1 0-12z"/></svg>',
      one: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7h10V4l4 4-4 4V9H7a4 4 0 0 0 0 8h2v2H7a6 6 0 0 1 0-12z"/><text x="12" y="16" text-anchor="middle" font-size="8" fill="currentColor">1</text></svg>'
    };
    this.npRepeat.innerHTML = iconMap[mode] || iconMap.all;
  }

  showToast(message) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    this.toastContainer.appendChild(toast);
    setTimeout(() => toast.remove(), 2600);
  }

  showError(message) {
    this.showToast(message);
  }

  updateThemeFromCover(src) {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = src;
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const size = 30;
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, size, size);
        const data = ctx.getImageData(0, 0, size, size).data;
        let r = 0;
        let g = 0;
        let b = 0;
        for (let i = 0; i < data.length; i += 4) {
          r += data[i];
          g += data[i + 1];
          b += data[i + 2];
        }
        const count = data.length / 4;
        r = Math.round(r / count);
        g = Math.round(g / count);
        b = Math.round(b / count);
        this.npOverlay.style.background = `linear-gradient(180deg, rgba(${r}, ${g}, ${b}, 0.35) 0%, rgba(10, 10, 10, 0.92) 75%)`;
      } catch (error) {
        // No-op if canvas fails.
      }
    };
  }

  showIphoneOnly() {
    if (this.iphoneOnly) this.iphoneOnly.classList.remove('hidden');
  }

  getVisibleSongs() {
    const hidden = new Set(this.settings.hiddenSongs || []);
    return this.songs.filter((song) => !hidden.has(song.id));
  }

  sortSongs(list, mode) {
    const songs = [...list];
    switch (mode) {
      case 'artist':
        return songs.sort((a, b) => String(a.artist).localeCompare(String(b.artist)));
      case 'duration':
        return songs.sort((a, b) => (a.duration || 0) - (b.duration || 0));
      case 'recent':
        return songs.sort((a, b) => new Date(b.added || 0) - new Date(a.added || 0));
      case 'title':
      default:
        return songs.sort((a, b) => String(a.title).localeCompare(String(b.title)));
    }
  }

  formatDuration(seconds = 0) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  escapeHtml(text) {
    return String(text).replace(/[&<>"']/g, (char) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[char]));
  }

  highlightText(text, query) {
    const safeText = this.escapeHtml(text);
    const safeQuery = this.escapeRegex(query);
    const regex = new RegExp(`(${safeQuery})`, 'ig');
    return safeText.replace(regex, '<mark>$1</mark>');
  }

  escapeRegex(text) {
    return String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  debounce(callback, delay) {
    clearTimeout(this._debounceTimer);
    this._debounceTimer = setTimeout(callback, delay);
  }

  _updateFavoriteIcons() {
    const isLiked = this.currentSongId && this.favorites.includes(this.currentSongId);
    const miniIcon = this.miniFav.querySelector('svg');
    const modalIcon = this.npFav.querySelector('svg');
    if (miniIcon) miniIcon.classList.toggle('liked', isLiked);
    if (modalIcon) modalIcon.classList.toggle('liked', isLiked);
  }

  _cacheDom() {
    this.mainView = document.getElementById('main-view');
    this.views = Array.from(this.mainView.querySelectorAll('.view'));
    this.navButtons = Array.from(document.querySelectorAll('.nav-btn'));
    this.settingsButton = document.getElementById('open-settings');

    this.miniPlayer = document.getElementById('mini-player');
    this.miniCover = document.getElementById('mini-cover');
    this.miniTitle = document.getElementById('mini-title');
    this.miniArtist = document.getElementById('mini-artist');
    this.miniPlay = document.getElementById('mini-play');
    this.miniFav = document.getElementById('mini-fav');

    this.nowPlayingModal = document.getElementById('now-playing-modal');
    this.npBlur = document.getElementById('np-blur');
    this.npOverlay = document.querySelector('.np-overlay');
    this.npCover = document.getElementById('np-cover');
    this.npTitle = document.getElementById('np-title');
    this.npArtist = document.getElementById('np-artist');
    this.npPlay = document.getElementById('np-play');
    this.npPrev = document.getElementById('np-prev');
    this.npNext = document.getElementById('np-next');
    this.npBack = document.getElementById('np-back');
    this.npMore = document.getElementById('np-more');
    this.npStar = document.getElementById('np-star');
    this.npSeek = document.getElementById('np-seekbar');
    this.npCurrent = document.getElementById('np-current');
    this.npDuration = document.getElementById('np-duration');
    this.npShuffle = document.getElementById('np-shuffle');
    this.npRepeat = document.getElementById('np-repeat');
    this.npFav = document.getElementById('np-fav');
    this.npVolume = document.getElementById('np-volume');
    this.npLyrics = document.getElementById('np-lyrics');

    this.sheetBackdrop = document.getElementById('sheet-backdrop');
    this.songSheet = document.getElementById('song-sheet');
    this.sheetClose = document.getElementById('sheet-close');
    this.sheetSong = document.getElementById('sheet-song');
    this.sheetAddPlaylist = document.getElementById('sheet-add-playlist');
    this.sheetLike = document.getElementById('sheet-like');
    this.sheetDelete = document.getElementById('sheet-delete');

    this.playlistSheet = document.getElementById('playlist-sheet');
    this.playlistSheetClose = document.getElementById('playlist-sheet-close');
    this.playlistList = document.getElementById('playlist-list');
    this.playlistCreate = document.getElementById('playlist-create');

    this.playlistModal = document.getElementById('playlist-create-modal');
    this.playlistName = document.getElementById('playlist-name');
    this.playlistModalTitle = document.getElementById('playlist-modal-title');
    this.playlistCancel = document.getElementById('playlist-cancel');
    this.playlistSave = document.getElementById('playlist-save');

    this.toastContainer = document.getElementById('toast-container');
    this.iphoneOnly = document.getElementById('iphone-only');

    this.playIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.2v13.6a.8.8 0 0 0 1.2.7l10.4-6.8a.8.8 0 0 0 0-1.4L9.2 4.5a.8.8 0 0 0-1.2.7z"/></svg>';
    this.pauseIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 5h4v14H7zM13 5h4v14h-4z"/></svg>';
  }

  _bindStaticEvents() {
    this.navButtons.forEach((button) => {
      button.addEventListener('click', () => this.showView(button.dataset.view));
    });

    if (this.settingsButton) {
      this.settingsButton.addEventListener('click', () => {
        this.showToast('Settings coming soon.');
      });
    }

    this.miniPlayer.addEventListener('click', () => this.showNowPlaying());
    this.miniPlay.addEventListener('click', (event) => {
      event.stopPropagation();
      this.player.toggle();
    });
    this.miniFav.addEventListener('click', (event) => {
      event.stopPropagation();
      if (this.currentSongId) this.toggleFavorite(this.currentSongId);
    });

    if (this.npBack) this.npBack.addEventListener('click', () => this.hideNowPlaying());
    if (this.npMore) this.npMore.addEventListener('click', () => {
      if (this.currentSongId) this.openSongSheet(this.currentSongId);
    });
    if (this.npStar) this.npStar.addEventListener('click', () => {
      if (this.currentSongId) this.toggleFavorite(this.currentSongId);
    });
    this.npPlay.addEventListener('click', () => this.player.toggle());
    this.npPrev.addEventListener('click', () => this.player.prev());
    this.npNext.addEventListener('click', () => this.player.next());
    this.npShuffle.addEventListener('click', () => this.player.toggleShuffle());
    this.npRepeat.addEventListener('click', () => this.player.cycleRepeat());
    this.npFav.addEventListener('click', () => {
      if (this.currentSongId) this.toggleFavorite(this.currentSongId);
    });

    const getSeekDuration = () => {
      const audio = this.player.audio;
      const direct = audio.duration;
      if (isFinite(direct) && direct > 0) return direct;
      const seekable = audio.seekable;
      if (seekable && seekable.length) {
        const end = seekable.end(seekable.length - 1);
        if (isFinite(end) && end > 0) return end;
      }
      return 0;
    };

    const updateSeekPreview = (percent) => {
      const duration = getSeekDuration();
      this.npCurrent.textContent = this.formatDuration((percent / 100) * duration);
    };

    const commitSeek = (event) => {
      const percent = Number(event.target.value);
      this.player.seekPercent(percent / 100);
      this.isSeeking = false;
      if (this._seekRaf) {
        cancelAnimationFrame(this._seekRaf);
        this._seekRaf = null;
      }
    };

    const beginSeek = () => {
      this.isSeeking = true;
    };

    this.npSeek.addEventListener('pointerdown', beginSeek);
    this.npSeek.addEventListener('touchstart', beginSeek);

    this.npSeek.addEventListener('input', (event) => {
      beginSeek();
      const percent = Number(event.target.value);
      updateSeekPreview(percent);
      if (this._seekRaf) cancelAnimationFrame(this._seekRaf);
      this._seekRaf = requestAnimationFrame(() => {
        this.player.seekPercent(percent / 100);
      });
    });

    this.npSeek.addEventListener('change', commitSeek);
    this.npSeek.addEventListener('pointerup', commitSeek);
    this.npSeek.addEventListener('touchend', commitSeek);

    this.npVolume.addEventListener('input', (event) => {
      this.player.setVolume(event.target.value);
    });

    this.sheetBackdrop.addEventListener('click', () => this.closeSheets());
    this.sheetClose.addEventListener('click', () => this.closeSheets());
    this.playlistSheetClose.addEventListener('click', () => this.closeSheets());

    this.sheetAddPlaylist.addEventListener('click', () => this.openPlaylistSheet());
    this.sheetLike.addEventListener('click', () => {
      if (this.pendingOptionsSong) this.toggleFavorite(this.pendingOptionsSong);
      this.closeSheets();
    });
    this.sheetDelete.addEventListener('click', () => {
      if (this.pendingOptionsSong) this.deleteSong(this.pendingOptionsSong);
      this.closeSheets();
    });

    this.playlistCreate.addEventListener('click', () => {
      this.closeSheets();
      this.openPlaylistModal();
    });

    this.playlistCancel.addEventListener('click', () => this.closePlaylistModal());
    this.playlistSave.addEventListener('click', () => {
      const name = this.playlistName.value.trim();
      if (!name) return;
      if (this.playlistEditId) {
        this.playlistManager.renamePlaylist(this.playlistEditId, name);
        this.showToast('Playlist renamed.');
        this.playlistEditId = null;
      } else {
        const playlist = this.playlistManager.createPlaylist(name);
        if (playlist && this.pendingOptionsSong) {
          this.playlistManager.addSongToPlaylist(playlist.id, this.pendingOptionsSong);
        }
        this.showToast('Playlist created.');
      }
      this.closePlaylistModal();
      this.renderPlaylists();
    });

    this.bindSwipeGestures();
    this.bindMiniPlayerSwipe();

    this.mainView.addEventListener('click', (event) => {
      const chip = event.target.closest('[data-sort]');
      if (chip) {
        this.settings.sort = chip.dataset.sort;
        this._emit('settingsChanged', { sort: this.settings.sort });
        this.renderLibrary();
      }
    });
  }

  bindSwipeGestures() {
    let startX = null;
    let startY = null;
    const wasPlaying = () => !this.player.audio.paused;

    this.nowPlayingModal.addEventListener('touchstart', (event) => {
      if (event.touches.length === 1) {
        startX = event.touches[0].clientX;
        startY = event.touches[0].clientY;
      }
    });

    this.nowPlayingModal.addEventListener('touchend', (event) => {
      if (startX === null) return;
      const endX = event.changedTouches[0].clientX;
      const endY = event.changedTouches[0].clientY;
      const deltaX = endX - startX;
      const deltaY = endY - (startY ?? endY);

      if (deltaY > 80 && Math.abs(deltaX) < 60) {
        this.hideNowPlaying();
        startX = null;
        startY = null;
        return;
      }

      const shouldPlay = wasPlaying();
      if (deltaX > 60) {
        this.player.prev();
        if (shouldPlay && this.player.audio.paused) {
          this.player.play();
        }
      }
      if (deltaX < -60) {
        this.player.next();
        if (shouldPlay && this.player.audio.paused) {
          this.player.play();
        }
      }

      startX = null;
      startY = null;
    });
  }

  bindMiniPlayerSwipe() {
    let startX = null;
    let startY = null;
    const wasPlaying = () => !this.player.audio.paused;

    this.miniPlayer.addEventListener('touchstart', (event) => {
      const target = event.target;
      // Don't trigger swipe if user is clicking on buttons
      if (target.closest('button')) return;

      if (event.touches.length === 1) {
        startX = event.touches[0].clientX;
        startY = event.touches[0].clientY;
      }
    });

    this.miniPlayer.addEventListener('touchmove', (event) => {
      if (startX === null) return;
      const moveX = event.touches[0].clientX;
      const deltaX = Math.abs(moveX - startX);

      // Prevent default scrolling when swiping horizontally
      if (deltaX > 10) {
        event.preventDefault();
      }
    }, { passive: false });

    this.miniPlayer.addEventListener('touchend', (event) => {
      if (startX === null) return;

      const endX = event.changedTouches[0].clientX;
      const endY = event.changedTouches[0].clientY;
      const deltaX = endX - startX;
      const deltaY = Math.abs(endY - (startY ?? endY));

      // Only process horizontal swipes (not vertical)
      if (deltaY < 40) {
        const shouldPlay = wasPlaying();

        if (deltaX > 60) {
          // Swipe right - previous track
          this.player.prev();
          if (shouldPlay && this.player.audio.paused) {
            this.player.play();
          }
        } else if (deltaX < -60) {
          // Swipe left - next track
          this.player.next();
          if (shouldPlay && this.player.audio.paused) {
            this.player.play();
          }
        }
      }

      startX = null;
      startY = null;
    });
  }

  _bindPlayerEvents() {
    this.player.on('play', (song) => {
      this.updateNowPlaying(song);
      this.updatePlayState(true);
    });

    this.player.on('pause', () => {
      this.updatePlayState(false);
    });

    this.player.on('timeupdate', (current, duration) => {
      this.updateSeekbar(current, duration);
    });

    this.player.on('duration', (duration) => {
      this.npDuration.textContent = this.formatDuration(duration);
    });

    this.player.on('shuffle', (value) => this.updateShuffle(value));
    this.player.on('repeat', (mode) => this.updateRepeat(mode));
    this.player.on('volume', (value) => {
      if (Number(this.npVolume.value) !== Number(value)) this.npVolume.value = value;
    });
    this.player.on('error', (message) => this.showError(message));
  }

  _bindPlaylistEvents() {
    this.playlistManager.on('playlistsChanged', () => {
      if (this.currentView === 'playlists') this.renderPlaylists();
    });
  }

  getView(name) {
    return this.views.find((view) => view.dataset.view === name);
  }
}
