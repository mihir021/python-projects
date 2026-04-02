// player.js - Audio playback engine with shuffle/repeat logic
export class Player {
  constructor() {
    this.audio = new Audio();
    this.audio.preload = 'auto';
    this.audio.crossOrigin = 'anonymous';
    this.audio.setAttribute('playsinline', '');
    this.audio.setAttribute('webkit-playsinline', '');

    this.queue = [];
    this.order = [];
    this.orderIndex = 0;
    this.currentIndex = null;

    this.shuffle = false;
    this.repeat = 'all'; // 'none' | 'all' | 'one'

    this.listeners = {};
    this._progressTimer = null;
    this._lastEmit = 0;
    this._pendingSeek = null;
    this._audioContext = null;
    this._gainNode = null;
    this._lastDuration = 0;
    this._volume = 1;
    this._isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent || '');
    this._useWebAudio = !this._isIOS;

    this._bindEvents();
  }

  setSongs(songs) {
    const current = this.getCurrentSong();
    const currentId = current ? current.id : null;
    this.queue = Array.isArray(songs) ? songs : [];
    if (currentId) {
      const nextIndex = this.queue.findIndex((song) => song.id === currentId);
      this.currentIndex = nextIndex >= 0 ? nextIndex : null;
      this._rebuildOrder(true);
    } else {
      this._rebuildOrder(false);
    }
    this._emit('songsChanged', this.queue);
  }

  getCurrentSong() {
    return this.queue[this.currentIndex] || null;
  }

  playByIndex(index) {
    if (!this.queue.length) return;
    const safeIndex = Math.max(0, Math.min(index, this.queue.length - 1));
    this.currentIndex = safeIndex;
    this._syncOrderIndex();
    this._playCurrent();
  }

  play() {
    if (!this.queue.length) return;
    if (this.currentIndex === null) {
      this.currentIndex = 0;
      this._syncOrderIndex();
    }
    this._ensureAudioContext();
    this._playCurrent();
  }

  pause() {
    this.audio.pause();
    this._stopProgressTimer();
    this._emit('pause');
  }

  toggle() {
    if (this.audio.paused) this.play();
    else this.pause();
  }

  next({ fromEnded = false } = {}) {
    if (!this.queue.length) return;
    if (!this.order.length) this._rebuildOrder(true);

    if (this.orderIndex < this.order.length - 1) {
      this.orderIndex += 1;
      this.currentIndex = this.order[this.orderIndex];
      this._playCurrent();
      return;
    }

    if (fromEnded && this.repeat === 'none') {
      this.pause();
      this._emit('queueEnd');
      return;
    }

    if (this.repeat === 'all' || !fromEnded) {
      this._rebuildOrder(false);
      this.currentIndex = this.order[0] ?? 0;
      this.orderIndex = 0;
      this._playCurrent();
      return;
    }

    this.pause();
  }

  prev() {
    if (!this.queue.length) return;

    if (this.audio.currentTime > 3) {
      this.audio.currentTime = 0;
      return;
    }

    if (this.orderIndex > 0) {
      this.orderIndex -= 1;
      this.currentIndex = this.order[this.orderIndex];
      this._playCurrent();
      return;
    }

    if (this.repeat === 'all') {
      this.orderIndex = Math.max(0, this.order.length - 1);
      this.currentIndex = this.order[this.orderIndex];
      this._playCurrent();
    }
  }

  seekTo(seconds) {
    const duration = this._getDuration();
    if (!isFinite(duration) || duration <= 0) {
      this._pendingSeek = { type: 'time', value: seconds };
      return;
    }
    const target = Math.max(0, Math.min(seconds, duration));
    this._setCurrentTime(target);
    this._emitProgress();
  }

  seekPercent(percent) {
    const duration = this._getDuration();
    if (!isFinite(duration) || duration <= 0) {
      this._pendingSeek = { type: 'percent', value: percent };
      return;
    }
    const target = Math.max(0, Math.min(1, percent)) * duration;
    this._setCurrentTime(target);
    this._emitProgress();
  }

  setVolume(volume) {
    const safeVolume = Math.max(0, Math.min(1, Number(volume)));
    this._volume = safeVolume;
    this.audio.volume = safeVolume;
    if (this._gainNode) {
      this._gainNode.gain.value = safeVolume;
    }
    this._emit('volume', safeVolume);
  }

  setShuffle(value) {
    this.shuffle = Boolean(value);
    this._rebuildOrder(true);
    this._emit('shuffle', this.shuffle);
  }

  toggleShuffle() {
    this.setShuffle(!this.shuffle);
  }

  setRepeat(mode) {
    const allowed = ['none', 'all', 'one'];
    this.repeat = allowed.includes(mode) ? mode : 'all';
    this._emit('repeat', this.repeat);
  }

  cycleRepeat() {
    const next = this.repeat === 'none' ? 'all' : this.repeat === 'all' ? 'one' : 'none';
    this.setRepeat(next);
  }

  on(event, callback) {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(callback);
  }

  _emit(event, ...args) {
    (this.listeners[event] || []).forEach((cb) => cb(...args));
  }

  _playCurrent() {
    const song = this.queue[this.currentIndex];
    if (!song) return;

    this._ensureAudioContext();
    const resolvedSrc = new URL(song.file, window.location.href).href;
    if (this.audio.src !== resolvedSrc) {
      this.audio.src = song.file;
    }

    this.audio.play().catch(() => {
      this._emit('error', 'Playback failed. Tap play to try again.');
    });

    this._emit('play', song, this.currentIndex);
    this._startProgressTimer();
  }

  _rebuildOrder(preserveCurrent) {
    const indices = this.queue.map((_, i) => i);
    if (this.shuffle) this._shuffle(indices);
    this.order = indices;

    if (preserveCurrent && this.currentIndex !== null) {
      const pos = this.order.indexOf(this.currentIndex);
      this.orderIndex = pos >= 0 ? pos : 0;
      return;
    }

    this.orderIndex = 0;
    this.currentIndex = this.order[0] ?? null;
  }

  _syncOrderIndex() {
    if (!this.order.length) {
      this._rebuildOrder(true);
      return;
    }
    const pos = this.order.indexOf(this.currentIndex);
    if (pos >= 0) this.orderIndex = pos;
  }

  _shuffle(array) {
    for (let i = array.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
  }

  _startProgressTimer() {
    this._stopProgressTimer();
    this._progressTimer = setInterval(() => this._emitProgress(), 1000);
  }

  _stopProgressTimer() {
    if (this._progressTimer) {
      clearInterval(this._progressTimer);
      this._progressTimer = null;
    }
  }

  _emitProgress() {
    const current = this.audio.currentTime || 0;
    const duration = this._getDuration();
    this._emit('timeupdate', current, duration);
  }

  _bindEvents() {
    this.audio.addEventListener('ended', () => {
      if (this.repeat === 'one') {
        this._playCurrent();
      } else {
        this.next({ fromEnded: true });
      }
    });

    this.audio.addEventListener('timeupdate', () => {
      const now = Date.now();
      if (now - this._lastEmit > 500) {
        this._lastEmit = now;
        this._emitProgress();
      }
    });

    this.audio.addEventListener('loadedmetadata', () => {
      this._flushPendingSeek();
      this._emit('duration', this._getDuration());
    });

    this.audio.addEventListener('durationchange', () => {
      this._flushPendingSeek();
      this._emit('duration', this._getDuration());
    });

    this.audio.addEventListener('canplay', () => {
      this._flushPendingSeek();
    });

    this.audio.addEventListener('pause', () => {
      this._stopProgressTimer();
      this._emit('pause');
    });

    this.audio.addEventListener('play', () => {
      if (this._audioContext && this._audioContext.state === 'suspended') {
        this._audioContext.resume().catch(() => {});
      }
      const song = this.queue[this.currentIndex];
      if (song) this._emit('play', song, this.currentIndex);
    });

    this.audio.addEventListener('error', () => {
      this._emit('error', 'Playback error.');
    });
  }

  _ensureAudioContext() {
    if (!this._useWebAudio) return;
    if (this._audioContext) return;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    this._audioContext = new AudioCtx();
    const source = this._audioContext.createMediaElementSource(this.audio);
    this._gainNode = this._audioContext.createGain();
    this._gainNode.gain.value = this.audio.volume || 1;
    source.connect(this._gainNode).connect(this._audioContext.destination);
  }

  _flushPendingSeek() {
    if (!this._pendingSeek) return;
    const duration = this._getDuration();
    if (!isFinite(duration) || duration <= 0) return;
    const pending = this._pendingSeek;
    this._pendingSeek = null;
    if (pending.type === 'percent') {
      this.seekPercent(pending.value);
    } else {
      this.seekTo(pending.value);
    }
  }

  _setCurrentTime(target) {
    if (typeof this.audio.fastSeek === 'function') {
      this.audio.fastSeek(target);
      return;
    }
    this.audio.currentTime = target;
  }

  _getDuration() {
    const duration = this.audio.duration;
    if (isFinite(duration) && duration > 0) {
      this._lastDuration = duration;
      return duration;
    }
    const seekable = this.audio.seekable;
    if (seekable && seekable.length) {
      const end = seekable.end(seekable.length - 1);
      if (isFinite(end) && end > 0) {
        this._lastDuration = end;
        return end;
      }
    }
    return this._lastDuration || 0;
  }
}
