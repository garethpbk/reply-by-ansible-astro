// Reply By Ansible - Custom Audio Player
// Vanilla TypeScript, persists across View Transitions

interface EpisodeData {
  episodeNumber: number;
  title: string;
  audioUrl: string;
  duration?: string;
  image?: string;
}

interface SavedPosition {
  time: number;
  duration: number;
}

interface Preferences {
  volume: number;
  playbackRate: number;
  isMuted: boolean;
}

// ─── Storage ───────────────────────────────────────────────────────────────────

const Storage = {
  getPosition(ep: number): SavedPosition | null {
    try {
      const raw = localStorage.getItem(`rba-pos-${ep}`);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  },

  savePosition(ep: number, time: number, duration: number) {
    try {
      localStorage.setItem(`rba-pos-${ep}`, JSON.stringify({ time, duration }));
    } catch { /* quota exceeded */ }
  },

  getProgress(ep: number): number {
    const pos = this.getPosition(ep);
    if (!pos || !pos.duration || pos.duration === 0) return 0;
    return Math.min(pos.time / pos.duration, 1);
  },

  getPrefs(): Preferences {
    try {
      const raw = localStorage.getItem('rba-prefs');
      if (raw) return JSON.parse(raw);
    } catch { /* ignore */ }
    return { volume: 1, playbackRate: 1, isMuted: false };
  },

  savePrefs(prefs: Preferences) {
    try {
      localStorage.setItem('rba-prefs', JSON.stringify(prefs));
    } catch { /* ignore */ }
  },

  getLastEpisode(): EpisodeData | null {
    try {
      const raw = localStorage.getItem('rba-last-episode');
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  },

  saveLastEpisode(ep: EpisodeData) {
    try {
      localStorage.setItem('rba-last-episode', JSON.stringify(ep));
    } catch { /* ignore */ }
  },
};

// ─── Duration Parsing ──────────────────────────────────────────────────────────

function parseDuration(str: string): number {
  const parts = str.split(':').map(Number);
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return parts[0] || 0;
}

function formatTime(seconds: number): string {
  const s = Math.floor(seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => n.toString().padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`;
}

// ─── Playback Speed Options ────────────────────────────────────────────────────

const SPEEDS = [0.5, 1, 1.25, 1.5, 2];

function nextSpeed(current: number): number {
  const idx = SPEEDS.indexOf(current);
  return SPEEDS[(idx + 1) % SPEEDS.length];
}

// ─── Player Bar HTML ───────────────────────────────────────────────────────────

const PLAYER_HTML = `
<div class="player-bar" role="region" aria-label="Audio player">
  <div class="player-episode-info">
    <span class="player-ep-number"></span>
    <span class="player-ep-title"></span>
  </div>

  <div class="player-controls">
    <button class="player-skip-back" aria-label="Skip back 15 seconds" title="Back 15s">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M1 4v6h6"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/>
      </svg>
      <span>15</span>
    </button>
    <button class="player-play-pause" aria-label="Play">
      <svg class="icon-play" width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
        <polygon points="5,3 19,12 5,21"/>
      </svg>
      <svg class="icon-pause" width="28" height="28" viewBox="0 0 24 24" fill="currentColor" style="display:none">
        <rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>
      </svg>
    </button>
    <button class="player-skip-forward" aria-label="Skip forward 30 seconds" title="Forward 30s">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M23 4v6h-6"/><path d="M20.49 15a9 9 0 1 1-2.13-9.36L23 10"/>
      </svg>
      <span>30</span>
    </button>
  </div>

  <div class="player-seek">
    <span class="player-current-time">0:00</span>
    <input type="range" class="player-seek-bar" min="0" max="1000" value="0" step="1" aria-label="Seek" />
    <span class="player-total-time">0:00</span>
  </div>

  <div class="player-extras">
    <button class="player-speed" aria-label="Playback speed" title="Playback speed">1x</button>
    <div class="player-volume-group">
      <button class="player-mute" aria-label="Mute" title="Mute">
        <svg class="icon-vol" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polygon points="11,5 6,9 2,9 2,15 6,15 11,19"/>
          <path d="M19.07 4.93a10 10 0 0 1 0 14.14"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
        </svg>
        <svg class="icon-muted" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="display:none">
          <polygon points="11,5 6,9 2,9 2,15 6,15 11,19"/>
          <line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/>
        </svg>
      </button>
      <input type="range" class="player-volume-bar" min="0" max="100" value="100" step="1" aria-label="Volume" />
    </div>
    <button class="player-close" aria-label="Close player" title="Close player">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
      </svg>
    </button>
  </div>
</div>
`;

// ─── Main Init ─────────────────────────────────────────────────────────────────

declare global {
  interface Window {
    __rbaAudio?: HTMLAudioElement;
    __rbaInitialized?: boolean;
    __rbaCurrentEpisode?: EpisodeData | null;
    __rbaUpdateProgress?: () => void;
  }
}

function init() {
  // Prevent double-init from View Transitions re-running the script
  if (window.__rbaInitialized) {
    updateAllProgressBars();
    updateAllPlayButtons();
    return;
  }
  window.__rbaInitialized = true;

  // Create or reuse audio element
  const audio = window.__rbaAudio || new Audio();
  window.__rbaAudio = audio;
  audio.preload = 'metadata';

  // Apply saved preferences
  const prefs = Storage.getPrefs();
  audio.volume = prefs.volume;
  audio.playbackRate = prefs.playbackRate;
  audio.muted = prefs.isMuted;

  let currentEpisode: EpisodeData | null = window.__rbaCurrentEpisode || null;
  let isSeeking = false;
  let saveDebounce: ReturnType<typeof setTimeout> | null = null;

  // ─── Build Persistent Player UI ──────────────────────────────────────────

  function getContainer(): HTMLElement | null {
    return document.getElementById('persistent-player');
  }

  function ensurePlayerBuilt() {
    const container = getContainer();
    if (!container) return;
    if (!container.querySelector('.player-bar')) {
      container.innerHTML = PLAYER_HTML;
    }
  }

  function showPlayer() {
    const container = getContainer();
    if (!container) return;
    ensurePlayerBuilt();
    container.classList.add('active');
    document.body.classList.add('player-active');
  }

  function hidePlayer() {
    const container = getContainer();
    if (!container) return;
    container.classList.remove('active');
    document.body.classList.remove('player-active');
  }

  function $(sel: string): HTMLElement | null {
    const container = getContainer();
    return container ? container.querySelector(sel) : null;
  }

  // ─── UI Updates ──────────────────────────────────────────────────────────

  function updatePlayPauseUI(playing: boolean) {
    const iconPlay = $('.icon-play') as HTMLElement;
    const iconPause = $('.icon-pause') as HTMLElement;
    const btn = $('.player-play-pause');
    if (iconPlay) iconPlay.style.display = playing ? 'none' : 'block';
    if (iconPause) iconPause.style.display = playing ? 'block' : 'none';
    if (btn) btn.setAttribute('aria-label', playing ? 'Pause' : 'Play');
  }

  function updateTimeUI(current: number, total: number) {
    const ct = $('.player-current-time');
    const tt = $('.player-total-time');
    const seek = $('.player-seek-bar') as HTMLInputElement;
    if (ct) ct.textContent = formatTime(current);
    if (tt) tt.textContent = formatTime(total);
    if (seek && !isSeeking && total > 0) {
      seek.value = String((current / total) * 1000);
    }
  }

  function updateEpisodeInfoUI(ep: EpisodeData) {
    const num = $('.player-ep-number');
    const title = $('.player-ep-title');
    if (num) num.textContent = `Episode ${ep.episodeNumber}`;
    if (title) title.textContent = ep.title;
  }

  function updateSpeedUI(rate: number) {
    const btn = $('.player-speed');
    if (btn) btn.textContent = rate === 1 ? '1x' : `${rate}x`;
  }

  function updateVolumeUI(vol: number, muted: boolean) {
    const volBar = $('.player-volume-bar') as HTMLInputElement;
    const iconVol = $('.icon-vol') as HTMLElement;
    const iconMuted = $('.icon-muted') as HTMLElement;
    if (volBar) volBar.value = String(muted ? 0 : vol * 100);
    if (iconVol) iconVol.style.display = muted ? 'none' : 'block';
    if (iconMuted) iconMuted.style.display = muted ? 'block' : 'none';
  }

  // ─── Play Episode ────────────────────────────────────────────────────────

  function playEpisode(ep: EpisodeData) {
    const isSameEpisode = currentEpisode && currentEpisode.episodeNumber === ep.episodeNumber;

    if (isSameEpisode) {
      // Toggle play/pause
      if (audio.paused) {
        audio.play();
      } else {
        audio.pause();
      }
      return;
    }

    // Save position of previous episode
    if (currentEpisode && audio.currentTime > 0) {
      Storage.savePosition(currentEpisode.episodeNumber, audio.currentTime, audio.duration || 0);
    }

    currentEpisode = ep;
    window.__rbaCurrentEpisode = ep;
    Storage.saveLastEpisode(ep);

    showPlayer();
    updateEpisodeInfoUI(ep);

    audio.src = ep.audioUrl;

    // Restore saved position
    const saved = Storage.getPosition(ep.episodeNumber);
    if (saved && saved.time > 0) {
      audio.currentTime = saved.time;
    }

    // Set duration from episode data while metadata loads
    if (ep.duration) {
      updateTimeUI(saved?.time || 0, parseDuration(ep.duration));
    }

    audio.play();
    updateAllPlayButtons();
  }

  // ─── Audio Events ────────────────────────────────────────────────────────

  audio.addEventListener('play', () => {
    updatePlayPauseUI(true);
    updateAllPlayButtons();
  });

  audio.addEventListener('pause', () => {
    updatePlayPauseUI(false);
    updateAllPlayButtons();
    // Save immediately on pause
    if (currentEpisode) {
      Storage.savePosition(currentEpisode.episodeNumber, audio.currentTime, audio.duration || 0);
    }
  });

  audio.addEventListener('timeupdate', () => {
    if (!isSeeking) {
      updateTimeUI(audio.currentTime, audio.duration || 0);
    }
    // Debounced save
    if (currentEpisode && !saveDebounce) {
      saveDebounce = setTimeout(() => {
        if (currentEpisode) {
          Storage.savePosition(currentEpisode.episodeNumber, audio.currentTime, audio.duration || 0);
          updateCardProgress(currentEpisode.episodeNumber, audio.currentTime, audio.duration || 0);
        }
        saveDebounce = null;
      }, 3000);
    }
  });

  audio.addEventListener('loadedmetadata', () => {
    updateTimeUI(audio.currentTime, audio.duration);
    // Re-seek after metadata if we have a saved position (some browsers reset)
    if (currentEpisode) {
      const saved = Storage.getPosition(currentEpisode.episodeNumber);
      if (saved && saved.time > 0 && Math.abs(audio.currentTime - saved.time) > 2) {
        audio.currentTime = saved.time;
      }
    }
  });

  audio.addEventListener('ended', () => {
    if (currentEpisode) {
      // Mark as completed (time=0 means finished)
      Storage.savePosition(currentEpisode.episodeNumber, 0, audio.duration || 0);
      updateCardProgress(currentEpisode.episodeNumber, 0, 0);
    }
    updatePlayPauseUI(false);
    updateAllPlayButtons();
  });

  // ─── Player Controls ─────────────────────────────────────────────────────

  function attachPlayerControls() {
    const container = getContainer();
    if (!container) return;

    // Play/Pause
    container.querySelector('.player-play-pause')?.addEventListener('click', () => {
      if (audio.paused) audio.play(); else audio.pause();
    });

    // Skip back 15s
    container.querySelector('.player-skip-back')?.addEventListener('click', () => {
      audio.currentTime = Math.max(0, audio.currentTime - 15);
    });

    // Skip forward 30s
    container.querySelector('.player-skip-forward')?.addEventListener('click', () => {
      audio.currentTime = Math.min(audio.duration || 0, audio.currentTime + 30);
    });

    // Seek bar
    const seekBar = container.querySelector('.player-seek-bar') as HTMLInputElement;
    if (seekBar) {
      seekBar.addEventListener('input', () => {
        isSeeking = true;
        const pct = Number(seekBar.value) / 1000;
        const dur = audio.duration || 0;
        updateTimeUI(pct * dur, dur);
      });
      seekBar.addEventListener('change', () => {
        const pct = Number(seekBar.value) / 1000;
        audio.currentTime = pct * (audio.duration || 0);
        isSeeking = false;
      });
    }

    // Speed
    container.querySelector('.player-speed')?.addEventListener('click', () => {
      const newRate = nextSpeed(audio.playbackRate);
      audio.playbackRate = newRate;
      updateSpeedUI(newRate);
      const p = Storage.getPrefs();
      p.playbackRate = newRate;
      Storage.savePrefs(p);
    });

    // Volume
    const volBar = container.querySelector('.player-volume-bar') as HTMLInputElement;
    if (volBar) {
      volBar.addEventListener('input', () => {
        const vol = Number(volBar.value) / 100;
        audio.volume = vol;
        audio.muted = false;
        updateVolumeUI(vol, false);
        Storage.savePrefs({ volume: vol, playbackRate: audio.playbackRate, isMuted: false });
      });
    }

    // Mute
    container.querySelector('.player-mute')?.addEventListener('click', () => {
      audio.muted = !audio.muted;
      updateVolumeUI(audio.volume, audio.muted);
      const p = Storage.getPrefs();
      p.isMuted = audio.muted;
      Storage.savePrefs(p);
    });

    // Close
    container.querySelector('.player-close')?.addEventListener('click', () => {
      audio.pause();
      if (currentEpisode) {
        Storage.savePosition(currentEpisode.episodeNumber, audio.currentTime, audio.duration || 0);
      }
      hidePlayer();
      currentEpisode = null;
      window.__rbaCurrentEpisode = null;
      updateAllPlayButtons();
    });
  }

  // Build initial UI and attach controls
  ensurePlayerBuilt();
  attachPlayerControls();
  updateSpeedUI(audio.playbackRate);
  updateVolumeUI(audio.volume, audio.muted);

  // If we already had a playing episode (View Transition re-init), restore UI
  if (currentEpisode) {
    showPlayer();
    updateEpisodeInfoUI(currentEpisode);
    updatePlayPauseUI(!audio.paused);
    updateTimeUI(audio.currentTime, audio.duration || 0);
  }

  // ─── Event Delegation for Play Buttons ───────────────────────────────────

  document.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest('[data-play-episode]') as HTMLElement;
    if (!btn) return;

    const ep: EpisodeData = {
      episodeNumber: Number(btn.dataset.episodeNumber),
      title: btn.dataset.title || '',
      audioUrl: btn.dataset.audioUrl || '',
      duration: btn.dataset.duration || undefined,
      image: btn.dataset.image || undefined,
    };

    playEpisode(ep);
  });

  // Continue Listening button
  document.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest('.continue-listening-btn') as HTMLElement;
    if (!btn) return;

    const lastEp = Storage.getLastEpisode();
    if (lastEp) {
      playEpisode(lastEp);
    }
  });

  // ─── Keyboard Shortcuts ──────────────────────────────────────────────────

  document.addEventListener('keydown', (e) => {
    // Don't capture when typing in inputs
    if ((e.target as HTMLElement).matches('input, textarea, select, [contenteditable]')) return;
    if (!currentEpisode) return;

    switch (e.code) {
      case 'Space':
        e.preventDefault();
        if (audio.paused) audio.play(); else audio.pause();
        break;
      case 'ArrowLeft':
        e.preventDefault();
        audio.currentTime = Math.max(0, audio.currentTime - 15);
        break;
      case 'ArrowRight':
        e.preventDefault();
        audio.currentTime = Math.min(audio.duration || 0, audio.currentTime + 30);
        break;
    }
  });

  // ─── Save on page unload ─────────────────────────────────────────────────

  window.addEventListener('beforeunload', () => {
    if (currentEpisode && audio.currentTime > 0) {
      Storage.savePosition(currentEpisode.episodeNumber, audio.currentTime, audio.duration || 0);
    }
  });

  // ─── Progress Bars ───────────────────────────────────────────────────────

  function updateCardProgress(epNum: number, time: number, duration: number) {
    document.querySelectorAll(`[data-progress-episode="${epNum}"]`).forEach((el) => {
      const pct = duration > 0 ? Math.min((time / duration) * 100, 100) : 0;
      (el as HTMLElement).style.width = `${pct}%`;
    });
  }

  function updateAllPlayButtons() {
    document.querySelectorAll('[data-play-episode]').forEach((btn) => {
      const epNum = Number((btn as HTMLElement).dataset.episodeNumber);
      const isThis = currentEpisode && currentEpisode.episodeNumber === epNum && !audio.paused;
      btn.classList.toggle('is-playing', !!isThis);
    });
  }

  // Expose for dynamic card loading
  window.__rbaUpdateProgress = updateAllProgressBars;

  // ─── Continue Listening ──────────────────────────────────────────────────

  function initContinueListening() {
    const section = document.querySelector('.continue-listening') as HTMLElement;
    if (!section) return;

    // Don't show if already playing
    if (currentEpisode) return;

    const lastEp = Storage.getLastEpisode();
    if (!lastEp) return;

    const pos = Storage.getPosition(lastEp.episodeNumber);
    // Only show if there's a saved position > 0 (not finished)
    if (!pos || pos.time === 0) return;

    const titleEl = section.querySelector('.continue-listening-title');
    const epEl = section.querySelector('.continue-listening-ep');
    if (titleEl) titleEl.textContent = lastEp.title;
    if (epEl) epEl.textContent = `Episode ${lastEp.episodeNumber} · ${formatTime(pos.time)} remaining`;

    section.classList.add('visible');
  }

  // ─── Page Load (View Transitions) ────────────────────────────────────────

  function onPageReady() {
    updateAllProgressBars();
    updateAllPlayButtons();
    initContinueListening();

    // Re-ensure player controls are attached (container may be new after transition)
    ensurePlayerBuilt();
    // If currently playing, make sure UI is in sync
    if (currentEpisode) {
      showPlayer();
      updateEpisodeInfoUI(currentEpisode);
      updatePlayPauseUI(!audio.paused);
    }
  }

  // Astro View Transitions hook
  document.addEventListener('astro:page-load', onPageReady);

  // Initial page load
  onPageReady();
}

function updateAllProgressBars() {
  document.querySelectorAll('[data-progress-episode]').forEach((el) => {
    const epNum = Number((el as HTMLElement).dataset.progressEpisode);
    const progress = Storage.getProgress(epNum);
    (el as HTMLElement).style.width = `${progress * 100}%`;
  });
}

// Run on script load
init();
