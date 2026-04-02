/**
 * UI.js
 * Handles all DOM interactions, gestures, rendering and view switching
 */

class UIManager {
    constructor(player, playlistManager) {
        this.player = player;
        this.playlists = playlistManager;
        
        // Map DOM elements
        this.$ = (selector) => document.querySelector(selector);
        this.$$ = (selector) => document.querySelectorAll(selector);

        // Views
        this.views = {
            library: this.$('#view-library'),
            search: this.$('#view-search'),
            favorites: this.$('#view-favorites'),
            playlistsView: this.$('#view-playlists'),
            playlistDetail: this.$('#view-playlist-detail')
        };
        
        // Navigation
        this.navItems = this.$$('.nav-item');
        
        // Player UI
        this.miniPlayer = this.$('#mini-player');
        this.fullPlayer = this.$('#now-playing-screen');
        
        // Inputs & interactivity
        this.searchInput = this.$('#search-input');
        
        this.activePlaylistId = null;

        this.setupEventListeners();
        this.setupGestures();
    }

    init() {
        this.renderLibrary();
        this.renderFavorites();
        this.renderPlaylistsList();
    }

    setupEventListeners() {
        // Back Button
        this.$('#back-to-playlists')?.addEventListener('click', () => {
            this.switchView('view-playlists');
        });

        // Add Songs to Playlist button (in detail header)
        this.$('#add-songs-to-pl-btn')?.addEventListener('click', () => {
            if (this.activePlaylistId) this.showAddSongsModal(this.activePlaylistId);
        });

        // Close Add Songs modal
        this.$('#close-add-songs-modal')?.addEventListener('click', () => {
            this.$('#add-songs-modal').classList.add('hidden');
            this.$('#add-songs-search').value = '';
            // Refresh detail view to show newly added songs
            if (this.activePlaylistId) {
                const pl = this.playlists.getPlaylistById(this.activePlaylistId);
                if (pl) {
                    this.showPlaylistDetail(pl.id, pl.name);
                    // Keep detail view open instead of going back
                }
            }
        });

        // Add Songs search filter
        this.$('#add-songs-search')?.addEventListener('input', (e) => {
            this._renderAddSongsList(e.target.value);
        });

        // Navigation
        this.navItems.forEach(item => {
            item.addEventListener('click', (e) => {
                const targetId = e.currentTarget.dataset.target;
                this.switchView(targetId);
                
                // Active state
                this.navItems.forEach(n => n.classList.remove('active'));
                e.currentTarget.classList.add('active');
            });
        });

        // Player Expand/Minimize
        this.miniPlayer.addEventListener('click', (e) => {
            // Prevent expansion if clicking controls
            if (e.target.closest('.mini-controls')) return;
            this.expandPlayer();
        });

        this.$('#minimize-player-btn').addEventListener('click', () => {
            this.minimizePlayer();
        });

        // Primary Player Controls
        const togglePlay = (e) => { e.stopPropagation(); this.player.togglePlay(); };
        const playNext = (e) => { e.stopPropagation(); this.player.playNext(); };
        const playPrev = (e) => { e.stopPropagation(); this.player.playPrevious(); };

        this.$('#mini-play-btn').addEventListener('click', togglePlay);
        this.$('#mini-next-btn').addEventListener('click', playNext);

        this.$('#play-pause-btn').addEventListener('click', togglePlay);
        this.$('#next-btn').addEventListener('click', playNext);
        this.$('#prev-btn').addEventListener('click', playPrev);

        // Secondary Controls
        const shuffleBtn = this.$('#shuffle-btn');
        shuffleBtn.addEventListener('click', () => {
            const isShuffle = this.player.toggleShuffle();
            shuffleBtn.classList.toggle('active', isShuffle);
            this.showToast(isShuffle ? "Shuffle On" : "Shuffle Off");
        });

        const repeatBtn = this.$('#repeat-btn');
        const repeatIcon = repeatBtn.querySelector('.material-symbols-rounded');
        repeatBtn.addEventListener('click', () => {
            const mode = this.player.toggleRepeat();
            if (mode === 0) {
                repeatBtn.classList.remove('active');
                repeatIcon.textContent = 'repeat';
                this.showToast("Repeat Off");
            } else if (mode === 1) {
                repeatBtn.classList.add('active');
                repeatIcon.textContent = 'repeat';
                this.showToast("Repeat All");
            } else {
                repeatBtn.classList.add('active');
                repeatIcon.textContent = 'repeat_one';
                this.showToast("Repeat One");
            }
        });

        // Progress Seeking
        const progressContainer = this.$('#progress-container');
        let isDragging = false;
        
        const updateSeek = (e) => {
            const rect = progressContainer.getBoundingClientRect();
            let clickX;
            if (e.touches) {
                clickX = e.touches[0].clientX - rect.left;
            } else {
                clickX = e.clientX - rect.left;
            }
            
            clickX = Math.max(0, Math.min(clickX, rect.width));
            const percentage = clickX / rect.width;
            
            // Visual Update immediately
            this.$('#progress-bar-fill').style.width = `${percentage * 100}%`;
            this.$('#progress-handle').style.left = `${percentage * 100}%`;
            
            return percentage;
        };

        const seekStart = (e) => { isDragging = true; updateSeek(e); };
        const seekMove = (e) => { if(isDragging) updateSeek(e); };
        const seekEnd = (e) => { 
            if(isDragging) {
                const pct = updateSeek(e);
                if(this.player.audio.duration) {
                    this.player.seek(pct * this.player.audio.duration);
                }
                isDragging = false;
            }
        };

        progressContainer.addEventListener('mousedown', seekStart);
        document.addEventListener('mousemove', seekMove);
        document.addEventListener('mouseup', seekEnd);
        
        progressContainer.addEventListener('touchstart', seekStart, {passive: true});
        progressContainer.addEventListener('touchmove', seekMove, {passive: true});
        progressContainer.addEventListener('touchend', seekEnd);

        // Volume control (Desktop mostly)
        const volSlider = this.$('#volume-slider');
        if (volSlider) {
            volSlider.addEventListener('input', (e) => {
                this.player.setVolume(e.target.value);
            });
        }

        // Favorites
        this.$('#np-favorite-btn').addEventListener('click', () => {
            if (!this.player.currentSong) return;
            const isFav = this.playlists.toggleFavorite(this.player.currentSong.id);
            this.checkFavoriteStatus(this.player.currentSong.id);
            this.renderFavorites(); // Refresh views
            this.showToast(isFav ? "Added to Favorites" : "Removed from Favorites");
        });

        // Now Playing Options Menu
        this.$('#np-menu-btn').addEventListener('click', () => {
            if (this.player.currentSong) {
                this.showPlaylistSelector(this.player.currentSong.id);
            }
        });

        // Search Input
        this.searchInput.addEventListener('input', (e) => {
            this.handleSearch(e.target.value);
        });

        // Upload
        const uploadBtn = this.$('#upload-btn');
        const fileInput = this.$('#file-upload');
        uploadBtn.addEventListener('click', () => fileInput.click());
        fileInput.addEventListener('change', (e) => {
            const files = Array.from(e.target.files);
            if(files.length > 0) {
                let lastAdded;
                files.forEach(file => { lastAdded = this.playlists.addLocalSong(file); });
                this.renderLibrary();
                this.showToast(`Added ${files.length} song(s)`);
                
                // Play first added
                if(lastAdded) {
                    this.player.loadQueue(this.playlists.getAllSongs(), 0);
                    this.player.play();
                }
            }
        });
        
        // Playlist Modal Logic
        const createBtn = this.$('#create-playlist-btn');
        const plModal = this.$('#playlist-modal');
        const plCancel = this.$('#cancel-playlist-btn');
        const plSave = this.$('#save-playlist-btn');
        const plInput = this.$('#playlist-name-input');

        createBtn.addEventListener('click', () => {
            plModal.classList.remove('hidden');
            plInput.value = '';
            plInput.focus();
        });

        const savePlaylist = () => {
            const name = plInput.value.trim();
            if(name) {
                const newPl = this.playlists.createPlaylist(name);
                this.renderPlaylistsList();
                this.showToast(`Playlist ${name} created`);
                plModal.classList.add('hidden');
                
                // If it was triggered from select modal
                if (plInput.dataset.pendingSongId) {
                    this.playlists.addSongToPlaylist(newPl.id, plInput.dataset.pendingSongId);
                    this.showToast(`Song added to ${name}`);
                    delete plInput.dataset.pendingSongId;
                }
            }
        };

        plCancel.addEventListener('click', () => { 
            plModal.classList.add('hidden'); 
            delete plInput.dataset.pendingSongId;
        });
        
        plSave.addEventListener('click', savePlaylist);
    }

    setupGestures() {
        let touchstartY = 0;
        let touchendY = 0;
        let touchstartX = 0;
        let touchendX = 0;

        // Dismiss full page player with downward swipe
        this.fullPlayer.addEventListener('touchstart', e => {
            // Prevent interference with progress bar
            if(e.target.closest('.progress-container')) return;
            touchstartY = e.changedTouches[0].screenY;
            touchstartX = e.changedTouches[0].screenX;
        }, {passive:true});

        this.fullPlayer.addEventListener('touchend', e => {
            if(e.target.closest('.progress-container')) return;
            touchendY = e.changedTouches[0].screenY;
            touchendX = e.changedTouches[0].screenX;
            
            // Down sweep
            if (touchendY > touchstartY + 100 && Math.abs(touchendY - touchstartY) > Math.abs(touchendX - touchstartX)) {
                this.minimizePlayer();
            }
            
            // Lateral sweep for skipping
            if (touchendX < touchstartX - 100 && Math.abs(touchendX - touchstartX) > Math.abs(touchendY - touchstartY)) {
                this.player.playNext(); // Swipe left to next
            }
            if (touchendX > touchstartX + 100 && Math.abs(touchendX - touchstartX) > Math.abs(touchendY - touchstartY)) {
                this.player.playPrevious(); // Swipe right to prev
            }
        }, {passive:true});
    }

    switchView(targetId) {
        Object.values(this.views).forEach(view => {
            view.classList.add('hidden');
            view.classList.remove('active');
        });
        const targetView = this.$('#' + targetId);
        targetView.classList.remove('hidden');
        // Trigger reflow for animation
        void targetView.offsetWidth;
        targetView.classList.add('active');
    }

    expandPlayer() {
        this.fullPlayer.classList.remove('hidden');
        // Reflow
        void this.fullPlayer.offsetWidth;
        this.fullPlayer.classList.add('active');
        this.miniPlayer.style.opacity = '0';
        this.miniPlayer.style.pointerEvents = 'none';
        document.body.style.overflow = 'hidden';
    }

    minimizePlayer() {
        this.fullPlayer.classList.remove('active');
        setTimeout(() => {
            this.fullPlayer.classList.add('hidden');
        }, 400); // match transition duration
        this.miniPlayer.style.opacity = '1';
        this.miniPlayer.style.pointerEvents = 'auto';
        document.body.style.overflow = '';
    }

    // Rendering Helpers
    createSongItem(song, index, queueSource) {
        const item = document.createElement('div');
        const isActive = this.player && this.player.currentSong && this.player.currentSong.id === song.id;
        item.className = 'list-item' + (isActive ? ' active-song' : '');
        item.dataset.id = song.id;
        
        let cover = song.cover || 'assets/icons/default-cover.png';
        if (song.isLocal) cover = 'assets/icons/default-cover.png'; // Placeholder for local 

        item.innerHTML = `
            <img src="${cover}" alt="cover" class="item-art">
            <div class="item-info">
                <div class="item-title truncate">${song.title}</div>
                <div class="metadata truncate">${song.artist}</div>
            </div>
            <div class="item-actions">
                <button class="icon-btn fav-btn ${this.playlists.isFavorite(song.id) ? 'active' : ''}">
                    <span class="material-symbols-rounded" style="color: ${this.playlists.isFavorite(song.id) ? 'var(--favorite)' : 'inherit'}">
                        ${this.playlists.isFavorite(song.id) ? 'favorite' : 'favorite_border'}
                    </span>
                </button>
                <button class="icon-btn song-options-btn" data-id="${song.id}" title="Add to Playlist">
                    <span class="material-symbols-rounded">more_vert</span>
                </button>
            </div>
        `;

        // Click to play or action
        item.addEventListener('click', (e) => {
            const favBtn = e.target.closest('.fav-btn');
            const optBtn = e.target.closest('.song-options-btn');
            
            if (favBtn) {
                e.stopPropagation();
                const isFav = this.playlists.toggleFavorite(song.id);
                const span = favBtn.querySelector('span');
                span.textContent = isFav ? 'favorite' : 'favorite_border';
                span.style.color = isFav ? 'var(--favorite)' : 'inherit';
                this.renderFavorites();
                return;
            }

            if (optBtn) {
                e.stopPropagation();
                this.showPlaylistSelector(song.id);
                return;
            }

            // Otherwise, play
            this.player.loadQueue(queueSource, index);
            this.player.play();
        });

        return item;
    }

    showPlaylistSelector(songId) {
        const modal = this.$('#select-playlist-modal');
        const listContainer = this.$('#select-playlist-list');
        listContainer.innerHTML = '';
        
        const currentPlaylists = this.playlists.playlists;
        
        if (currentPlaylists.length === 0) {
            listContainer.innerHTML = `<div class="metadata" style="text-align: center; padding: var(--spacing-md)">No playlists created yet. Create one below to add this song!</div>`;
        } else {
            currentPlaylists.forEach(pl => {
                const li = document.createElement('div');
                li.className = 'modal-list-item truncate';
                li.textContent = pl.name;
                li.addEventListener('click', () => {
                    const added = this.playlists.addSongToPlaylist(pl.id, songId);
                    if (added) {
                        this.showToast(`Added to ${pl.name}`);
                        this.renderPlaylistsList();
                    } else {
                        this.showToast(`Already in ${pl.name}`);
                    }
                    modal.classList.add('hidden');
                });
                listContainer.appendChild(li);
            });
        }
        
        // Setup Modal Buttons
        const cancelBtn = this.$('#cancel-select-playlist-btn');
        const createBtn = this.$('#create-new-pl-from-select-btn');
        
        const close = () => { modal.classList.add('hidden'); };
        
        cancelBtn.onclick = close;
        createBtn.onclick = () => {
            close();
            this.$('#playlist-modal').classList.remove('hidden');
            // We can add a hidden state to the create playlist modal to auto-add song later, 
            // but MVP just lets them create one.
            this.$('#playlist-name-input').dataset.pendingSongId = songId;
        };
        
        modal.classList.remove('hidden');
    }

    renderLibrary() {
        const container = this.$('#library-list');
        container.innerHTML = '';
        const songs = this.playlists.getAllSongs();
        
        if (songs.length === 0) {
            container.innerHTML = `<div class="empty-state">No songs found.</div>`;
            return;
        }

        songs.forEach((song, i) => {
            container.appendChild(this.createSongItem(song, i, songs));
        });
    }

    renderFavorites() {
        const container = this.$('#favorites-list');
        container.innerHTML = '';
        const songs = this.playlists.getFavoriteSongs();

        if (songs.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <span class="material-symbols-rounded">heart_broken</span>
                    <p>No favorites yet</p>
                </div>
            `;
            return;
        }

        songs.forEach((song, i) => {
            container.appendChild(this.createSongItem(song, i, songs));
        });
    }

    renderPlaylistsList() {
        const container = this.$('#playlists-list');
        container.innerHTML = '';
        const lists = this.playlists.playlists;

        if (lists.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <span class="material-symbols-rounded">queue_music</span>
                    <p>Create a playlist</p>
                </div>
            `;
            return;
        }

        lists.forEach(pl => {
            const item = document.createElement('div');
            item.className = 'list-item';
            
            const songCount = pl.songIds.length;
            
            item.innerHTML = `
                <div class="item-art" style="background:var(--accent-primary-glow); display:flex; justify-content:center; align-items:center;">
                    <span class="material-symbols-rounded" style="color:var(--accent-primary)">library_music</span>
                </div>
                <div class="item-info">
                    <div class="item-title truncate">${pl.name}</div>
                    <div class="metadata truncate">${songCount} song${songCount !== 1 ? 's' : ''}</div>
                </div>
                <div class="item-actions">
                    <button class="icon-btn delete-pl-btn" data-id="${pl.id}">
                        <span class="material-symbols-rounded">delete_outline</span>
                    </button>
                </div>
            `;

            item.querySelector('.delete-pl-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                if(confirm('Delete playlist?')) {
                    this.playlists.deletePlaylist(pl.id);
                    this.renderPlaylistsList();
                }
            });

            item.addEventListener('click', () => {
                this.showPlaylistDetail(pl.id, pl.name);
            });

            container.appendChild(item);
        });
    }

    showPlaylistDetail(playlistId, playlistName) {
        this.activePlaylistId = playlistId;
        this.$('#detail-playlist-title').textContent = playlistName;
        const container = this.$('#playlist-detail-list');
        container.innerHTML = '';
        
        const songs = this.playlists.getPlaylistSongs(playlistId);
        if (songs.length === 0) {
            const empty = document.createElement('div');
            empty.className = 'empty-state';
            empty.innerHTML = `
                <span class="material-symbols-rounded">queue_music</span>
                <p>This playlist is empty.</p>
                <button class="btn-primary" id="empty-add-songs-btn" style="margin-top: var(--spacing-md); display: inline-flex; align-items: center; gap: 6px;">
                    <span class="material-symbols-rounded" style="font-size: 18px;">playlist_add</span> Add Songs
                </button>
            `;
            container.appendChild(empty);
            this.$('#empty-add-songs-btn')?.addEventListener('click', () => {
                this.showAddSongsModal(playlistId);
            });
        } else {
            songs.forEach((song, i) => {
                container.appendChild(this.createSongItem(song, i, songs));
            });
        }
        this.switchView('view-playlist-detail');
        // Visually keep Playlists tab highlighted
        this.navItems.forEach(n => {
            if (n.dataset.target === 'view-playlists') n.classList.add('active');
            else n.classList.remove('active');
        });
    }

    showAddSongsModal(playlistId) {
        this.activePlaylistId = playlistId;
        const modal = this.$('#add-songs-modal');
        this.$('#add-songs-search').value = '';
        this._renderAddSongsList('');
        modal.classList.remove('hidden');
    }

    _renderAddSongsList(query) {
        const container = this.$('#add-songs-list');
        container.innerHTML = '';
        const q = query.toLowerCase();
        const allSongs = this.playlists.getAllSongs();
        const pl = this.playlists.getPlaylistById(this.activePlaylistId);
        const alreadyIn = pl ? new Set(pl.songIds) : new Set();

        const filtered = allSongs.filter(s =>
            !q || s.title.toLowerCase().includes(q) || s.artist.toLowerCase().includes(q)
        );

        if (filtered.length === 0) {
            container.innerHTML = `<div class="metadata" style="text-align:center; padding: var(--spacing-md)">No songs found.</div>`;
            return;
        }

        filtered.forEach(song => {
            const row = document.createElement('div');
            row.className = 'add-song-row';
            const inList = alreadyIn.has(song.id);
            row.innerHTML = `
                <span class="add-song-title truncate">${song.title}<br><small style="color:var(--text-secondary)">${song.artist}</small></span>
                <button class="icon-btn add-song-row-btn ${inList ? 'added' : ''}" data-id="${song.id}" title="${inList ? 'Already added' : 'Add to playlist'}">
                    <span class="material-symbols-rounded">${inList ? 'check_circle' : 'add_circle'}</span>
                </button>
            `;
            row.querySelector('.add-song-row-btn').addEventListener('click', () => {
                const added = this.playlists.addSongToPlaylist(this.activePlaylistId, song.id);
                if (added) {
                    this.showToast(`Added: ${song.title}`);
                    alreadyIn.add(song.id);
                    // Update button state inline
                    const btn = row.querySelector('.add-song-row-btn');
                    btn.classList.add('added');
                    btn.querySelector('span').textContent = 'check_circle';
                } else {
                    this.showToast('Already in playlist');
                }
            });
            container.appendChild(row);
        });
    }

    updateActiveSongHighlight(songId) {
        this.$$('.list-item').forEach(item => {
            if (item.dataset.id === songId) {
                item.classList.add('active-song');
            } else {
                item.classList.remove('active-song');
            }
        });
    }

    handleSearch(query) {
        query = query.toLowerCase();
        const container = this.$('#search-results');
        container.innerHTML = '';
        
        if (!query) {
            container.innerHTML = `
                <div class="empty-state">
                    <span class="material-symbols-rounded">manage_search</span>
                    <p>Find your favorite music</p>
                </div>
            `;
            return;
        }

        const songs = this.playlists.getAllSongs().filter(s => 
            s.title.toLowerCase().includes(query) || 
            s.artist.toLowerCase().includes(query)
        );

        if (songs.length === 0) {
            container.innerHTML = `<div class="empty-state"><p>No results for "${query}"</p></div>`;
            return;
        }

        songs.forEach((song, i) => {
            container.appendChild(this.createSongItem(song, i, songs));
        });
    }

    // Player State Updates
    updatePlayerMeta(song) {
        this.updateActiveSongHighlight(song.id);
        
        let cover = song.cover || 'assets/icons/default-cover.png';
        if (song.isLocal) cover = 'assets/icons/default-cover.png';

        // Update Mini Player
        this.$('#mini-title').textContent = song.title;
        this.$('#mini-artist').textContent = song.artist;
        this.$('#mini-cover').src = cover;

        // Update Full Player
        this.$('#np-title').textContent = song.title;
        this.$('#np-artist').textContent = song.artist;
        this.$('#np-cover').src = cover;
        
        // Dynamic Blur Background
        this.$('#now-playing-bg').style.backgroundImage = `url(${cover})`;

        // Highlight active item in current view
        this.$$('.list-item').forEach(el => {
            el.classList.toggle('active', el.dataset.id === song.id);
        });
    }

    setPlayState(isPlaying) {
        // Toggle play/pause icons
        this.$('#mini-play-btn span').textContent = isPlaying ? 'pause' : 'play_arrow';
        this.$('#play-icon').textContent = isPlaying ? 'pause' : 'play_arrow';
        
        const artContainer = this.$('.np-art-container');
        if (isPlaying) {
            artContainer.classList.add('playing');
            artContainer.classList.remove('paused');
        } else {
            artContainer.classList.remove('playing');
            artContainer.classList.add('paused');
        }
    }

    formatTime(seconds) {
        if (isNaN(seconds)) return '0:00';
        seconds = Math.floor(seconds);
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m}:${s.toString().padStart(2, '0')}`;
    }

    updateProgress(current, duration) {
        this.$('#current-time').textContent = this.formatTime(current);
        if (duration) {
            this.$('#total-time').textContent = this.formatTime(duration);
            const percentage = (current / duration) * 100;
            
            this.$('#progress-bar-fill').style.width = `${percentage}%`;
            this.$('#progress-handle').style.left = `${percentage}%`;
            this.$('#mini-progress-bar').style.transform = `scaleX(${percentage / 100})`;
        }
    }

    checkFavoriteStatus(songId) {
        const isFav = this.playlists.isFavorite(songId);
        const btn = this.$('#np-favorite-btn');
        btn.classList.toggle('active', isFav);
        btn.querySelector('span').textContent = isFav ? 'favorite' : 'favorite_border';
    }

    showToast(msg) {
        const toast = this.$('#toast');
        toast.textContent = msg;
        toast.classList.add('show');
        
        if (this.toastTimeout) clearTimeout(this.toastTimeout);
        this.toastTimeout = setTimeout(() => {
            toast.classList.remove('show');
        }, 3000);
    }
}
