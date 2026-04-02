/**
 * Player.js
 * Handles Audio Playback, State, and Web Audio API integration
 */

class MusicPlayer {
    constructor() {
        this.audio = document.getElementById('audio-player');
        this.currentSong = null;
        this.queue = [];
        this.currentIndex = -1;
        
        // Playback State
        this.isPlaying = false;
        this.isShuffle = false;
        // repeatMode: 0 = none, 1 = all, 2 = one
        this.repeatMode = 0; 
        
        this.shuffledQueue = [];
        this.originalQueue = [];
        
        // Event Listeners on Audio Element
        this.setupAudioEvents();
    }

    // Web Audio API causes CORS blocks on external CDNs. Bypassing.

    setupAudioEvents() {
        this.audio.addEventListener('timeupdate', () => {
            if (window.UI) window.UI.updateProgress(this.audio.currentTime, this.audio.duration);
        });

        this.audio.addEventListener('ended', () => {
            this.handleSongEnd();
        });

        this.audio.addEventListener('loadedmetadata', () => {
            if (window.UI) window.UI.updateProgress(0, this.audio.duration);
        });

        // Media Session API for Lock Screen controls
        if ('mediaSession' in navigator) {
            navigator.mediaSession.setActionHandler('play', () => this.play());
            navigator.mediaSession.setActionHandler('pause', () => this.pause());
            navigator.mediaSession.setActionHandler('previoustrack', () => this.playPrevious());
            navigator.mediaSession.setActionHandler('nexttrack', () => this.playNext());
        }
    }

    updateMediaSession() {
        if ('mediaSession' in navigator && this.currentSong) {
            navigator.mediaSession.metadata = new MediaMetadata({
                title: this.currentSong.title,
                artist: this.currentSong.artist,
                album: this.currentSong.album || 'Unknown Album',
                artwork: [
                    { src: this.currentSong.cover, sizes: '512x512', type: 'image/jpeg' }
                ]
            });
        }
    }

    loadQueue(songs, startIndex = 0) {
        this.originalQueue = [...songs];
        
        if (this.isShuffle) {
            this.shuffleQueue(startIndex);
        } else {
            this.queue = [...this.originalQueue];
            this.currentIndex = startIndex;
        }
        
        this.loadSong(this.queue[this.currentIndex]);
    }

    shuffleQueue(startIndex = 0) {
        const currentSong = this.originalQueue[startIndex];
        let remainingSongs = this.originalQueue.filter((_, index) => index !== startIndex);
        
        // Fisher-Yates shuffle
        for (let i = remainingSongs.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [remainingSongs[i], remainingSongs[j]] = [remainingSongs[j], remainingSongs[i]];
        }
        
        this.queue = [currentSong, ...remainingSongs];
        this.currentIndex = 0;
    }

    unshuffleQueue() {
        const currentSongId = this.currentSong.id;
        this.queue = [...this.originalQueue];
        this.currentIndex = this.queue.findIndex(s => s.id === currentSongId);
    }

    loadSong(song) {
        if (!song) return;
        this.currentSong = song;
        
        // If it's a local object URL or external URL
        this.audio.src = song.src;
        this.audio.load();
        
        this.updateMediaSession();
        
        if (window.UI) {
            window.UI.updatePlayerMeta(song);
            window.UI.checkFavoriteStatus(song.id);
        }

        if (this.isPlaying) {
            this.play();
        }
    }

    async play() {
        try {
            await this.audio.play();
            this.isPlaying = true;
            if (window.UI) window.UI.setPlayState(true);
        } catch (e) {
            console.error("Playback failed:", e);
            if (window.UI) window.UI.showToast("Playback failed or was blocked.");
            this.isPlaying = false;
            if (window.UI) window.UI.setPlayState(false);
        }
    }

    pause() {
        this.audio.pause();
        this.isPlaying = false;
        if (window.UI) window.UI.setPlayState(false);
    }

    togglePlay() {
        if (!this.currentSong) return;
        if (this.isPlaying) {
            this.pause();
        } else {
            this.play();
        }
    }

    playNext() {
        if (this.queue.length === 0) return;
        
        if (this.repeatMode === 2) {
            // Repeat one - seek to 0 and play again
            this.seek(0);
            this.play();
            return;
        }

        this.currentIndex++;
        
        // End of queue
        if (this.currentIndex >= this.queue.length) {
            if (this.repeatMode === 1) {
                // Repeat all
                this.currentIndex = 0;
            } else {
                // Stop playing
                this.currentIndex--;
                this.pause();
                this.seek(0);
                return;
            }
        }

        const wasPlaying = this.isPlaying;
        this.loadSong(this.queue[this.currentIndex]);
        if (wasPlaying) this.play();
    }

    playPrevious() {
        if (this.queue.length === 0) return;

        // If played more than 3 seconds, previous restarts the song
        if (this.audio.currentTime > 3) {
            this.seek(0);
            return;
        }

        this.currentIndex--;
        
        // Beging of queue
        if (this.currentIndex < 0) {
            if (this.repeatMode === 1) {
                this.currentIndex = this.queue.length - 1;
            } else {
                this.currentIndex = 0;
            }
        }

        const wasPlaying = this.isPlaying;
        this.loadSong(this.queue[this.currentIndex]);
        if (wasPlaying) this.play();
    }

    handleSongEnd() {
        if (this.repeatMode === 2) {
            this.play(); // Repeat one
        } else {
            this.playNext(); // Proceed to next
        }
    }

    seek(time) {
        if (this.audio.duration) {
            this.audio.currentTime = time;
        }
    }

    setVolume(value) {
        this.audio.volume = value;
    }

    toggleShuffle() {
        this.isShuffle = !this.isShuffle;
        
        if (this.isShuffle) {
            this.shuffleQueue(this.currentIndex);
        } else {
            this.unshuffleQueue();
        }
        
        return this.isShuffle;
    }

    toggleRepeat() {
        this.repeatMode = (this.repeatMode + 1) % 3;
        return this.repeatMode;
    }
}
