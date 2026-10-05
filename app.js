/**
 * LyricFlow Studio - Main Application Controller
 */
import { AudioManager } from './js/audioManager.js';
import { MediaPool } from './js/mediaPool.js';
import { LyricsParser } from './js/lyricsParser.js';
import { CanvasRenderer } from './js/renderer.js';
import { VideoRecorder } from './js/recorder.js';
import { PixabayService } from './js/pixabayService.js';

export const APP_VERSION = '1.0.37';

class App {
  constructor() {
    this.currentStep = 1;
    // Auto-stop limit duration in seconds (null = until audio ends)
    this.customMaxDuration = null;

    // Step 3 Live Preview Song Cues & Slow Auto-Advancer
    this._previewCueIndex = 0;
    this._previewAutoInterval = null;
    this._previewAutoPlaying = true;

    // Initialize modules
    this.audio = new AudioManager();
    this.mediaPool = new MediaPool();
    this.lyrics = new LyricsParser();
    this.pixabay = new PixabayService();

    // Canvases
    this.masterCanvas = document.getElementById('master-canvas');
    this.styleCanvas = document.getElementById('style-preview-canvas');

    this.renderer = new CanvasRenderer(this.masterCanvas, this.mediaPool, this.audio);
    this.stylePreviewRenderer = new CanvasRenderer(this.styleCanvas, this.mediaPool, this.audio);
    this.recorder = new VideoRecorder(this.masterCanvas, this.audio);

    // Sync slide indicator on slide changes
    this.mediaPool.onSlideChangeCallback = () => {
      this._updateSlideTelemetryUI();
    };

    // Lyrics File Source Tracking
    this.lyricsFileHandle = null;
    this.lyricsFileName = 'lyrics.txt';

    // Studio State
    this.activeCueIndex = -1;
    this.isStudioRecording = false;

    this.init();
  }

  init() {
    this._setupStepper();
    this._setupAssetUploads();
    this._setupLyricsEditor();
    this._setupStyleControls();
    this._setupStudioControls();
    this._setupExportControls();
    this._setupGlobalShortcuts();
    this._setupResetControls();
    this._setupVideoSpeedControls();
    this._setupProjectPersistenceControls();
    this._setupPwaInstall();
    this._setupSettingsMenu();
    this._setupPixabaySettings();
    this._setupPixabayModal();
    this._setupHelpModal();
    this._setupServiceWorker();
    this._checkAppVersionUpdate();

    // Default procedural backgrounds
    this.mediaPool.loadDefaultBackgrounds();
    this._renderBgPool();

    // Update Lucide icons
    if (window.lucide) window.lucide.createIcons();
  }

  showToast(message, type = 'info', duration = 3500) {
    const toast = document.getElementById('toast');
    const toastCard = document.getElementById('toast-card');
    const msgEl = document.getElementById('toast-message');
    const iconEl = document.getElementById('toast-icon');

    if (!toast || !msgEl) return;

    msgEl.textContent = message;
    
    if (toastCard) {
      toastCard.className = `toast-card toast-${type} text-white px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3 border pointer-events-auto`;
    }

    if (iconEl) {
      let iconName = 'info';
      let iconColor = 'text-brand-400';
      if (type === 'success') {
        iconName = 'check-circle-2';
        iconColor = 'text-emerald-400';
      } else if (type === 'error') {
        iconName = 'alert-circle';
        iconColor = 'text-red-400';
      } else if (type === 'warning') {
        iconName = 'alert-triangle';
        iconColor = 'text-amber-400';
      }
      iconEl.className = `${iconColor} shrink-0`;
      iconEl.innerHTML = `<i data-lucide="${iconName}" class="w-5 h-5"></i>`;
      if (window.lucide) window.lucide.createIcons();
    }

    toast.classList.remove('translate-y-20', 'opacity-0');
    toast.classList.add('translate-y-0', 'opacity-100');

    clearTimeout(this._toastTimeout);
    this._toastTimeout = setTimeout(() => {
      toast.classList.remove('translate-y-0', 'opacity-100');
      toast.classList.add('translate-y-20', 'opacity-0');
    }, duration);
  }

  showAppAlert({ title = 'Notice', message = '', type = 'info', confirmText = 'OK' }) {
    return new Promise((resolve) => {
      const modal = document.getElementById('app-dialog-modal');
      const titleEl = document.getElementById('app-dialog-title');
      const msgEl = document.getElementById('app-dialog-message');
      const confirmBtn = document.getElementById('app-dialog-confirm-btn');
      const cancelBtn = document.getElementById('app-dialog-cancel-btn');
      const inputContainer = document.getElementById('app-dialog-input-container');
      const iconContainer = document.getElementById('app-dialog-icon-container');
      const iconEl = document.getElementById('app-dialog-icon');

      if (!modal) {
        alert(message);
        return resolve();
      }

      titleEl.textContent = title;
      msgEl.textContent = message;
      confirmBtn.textContent = confirmText;
      confirmBtn.className = 'btn-primary px-5 py-1.5 text-xs';
      if (cancelBtn) cancelBtn.classList.add('hidden');
      if (inputContainer) inputContainer.classList.add('hidden');

      let iconName = 'info';
      let iconColor = 'text-brand-400';
      let bgBorder = 'bg-brand-500/15 border-brand-500/30';
      if (type === 'success') {
        iconName = 'check-circle-2';
        iconColor = 'text-emerald-400';
        bgBorder = 'bg-emerald-500/15 border-emerald-500/30';
      } else if (type === 'error' || type === 'danger') {
        iconName = 'alert-octagon';
        iconColor = 'text-red-400';
        bgBorder = 'bg-red-500/15 border-red-500/30';
      } else if (type === 'warning') {
        iconName = 'alert-triangle';
        iconColor = 'text-amber-400';
        bgBorder = 'bg-amber-500/15 border-amber-500/30';
      }

      if (iconContainer) iconContainer.className = `w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 ${iconColor} ${bgBorder}`;
      if (iconEl) {
        iconEl.setAttribute('data-lucide', iconName);
        if (window.lucide) window.lucide.createIcons();
      }

      modal.classList.remove('hidden');
      requestAnimationFrame(() => modal.classList.remove('opacity-0'));

      const cleanup = () => {
        modal.classList.add('opacity-0');
        setTimeout(() => modal.classList.add('hidden'), 200);
      };

      const onConfirm = () => {
        cleanup();
        resolve();
      };

      confirmBtn.addEventListener('click', onConfirm, { once: true });
    });
  }

  showAppConfirm({ title = 'Confirm Action', message = '', type = 'warning', confirmText = 'Confirm', cancelText = 'Cancel', isDanger = false }) {
    return new Promise((resolve) => {
      const modal = document.getElementById('app-dialog-modal');
      const titleEl = document.getElementById('app-dialog-title');
      const msgEl = document.getElementById('app-dialog-message');
      const confirmBtn = document.getElementById('app-dialog-confirm-btn');
      const cancelBtn = document.getElementById('app-dialog-cancel-btn');
      const inputContainer = document.getElementById('app-dialog-input-container');
      const iconContainer = document.getElementById('app-dialog-icon-container');
      const iconEl = document.getElementById('app-dialog-icon');

      if (!modal) {
        return resolve(confirm(message));
      }

      titleEl.textContent = title;
      msgEl.textContent = message;
      confirmBtn.textContent = confirmText;
      cancelBtn.textContent = cancelText;
      cancelBtn.classList.remove('hidden');
      if (inputContainer) inputContainer.classList.add('hidden');

      if (isDanger) {
        confirmBtn.className = 'px-5 py-1.5 text-xs font-semibold rounded-lg bg-red-600 hover:bg-red-500 text-white shadow-md shadow-red-500/25 border border-red-400/30 transition cursor-pointer';
      } else {
        confirmBtn.className = 'btn-primary px-5 py-1.5 text-xs cursor-pointer';
      }

      let iconName = isDanger ? 'trash-2' : 'help-circle';
      let iconColor = isDanger ? 'text-red-400' : 'text-amber-400';
      let bgBorder = isDanger ? 'bg-red-500/15 border-red-500/30' : 'bg-amber-500/15 border-amber-500/30';

      if (iconContainer) iconContainer.className = `w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 ${iconColor} ${bgBorder}`;
      if (iconEl) {
        iconEl.setAttribute('data-lucide', iconName);
        if (window.lucide) window.lucide.createIcons();
      }

      modal.classList.remove('hidden');
      requestAnimationFrame(() => modal.classList.remove('opacity-0'));

      const cleanup = () => {
        modal.classList.add('opacity-0');
        setTimeout(() => modal.classList.add('hidden'), 200);
      };

      const onConfirm = () => {
        cleanup();
        resolve(true);
      };
      const onCancel = () => {
        cleanup();
        resolve(false);
      };

      confirmBtn.addEventListener('click', onConfirm, { once: true });
      cancelBtn.addEventListener('click', onCancel, { once: true });
    });
  }

  goToStep(stepNumber) {
    if (stepNumber < 1 || stepNumber > 5) return;

    this.currentStep = stepNumber;

    // Show/hide step views (step-view-1 through step-view-5)
    for (let i = 1; i <= 5; i++) {
      const view = document.getElementById(`step-view-${i}`);
      const btn = document.getElementById(`step-btn-${i}`);
      if (view) {
        if (i === stepNumber) {
          view.classList.remove('hidden');
        } else {
          view.classList.add('hidden');
        }
      }
      if (btn) {
        btn.classList.toggle('active', i === stepNumber);
        btn.classList.toggle('completed', i < stepNumber);
      }
    }

    // Step-specific initializations
    if (stepNumber === 2) {
      this._updateCueListUI();
      this._updateLyricsSummary();
    } else if (stepNumber === 3) {
      this._syncStylePreview();
      this._startPreviewAutoAdvance();
    } else {
      this._stopPreviewAutoAdvance();
    }

    if (stepNumber === 4) {
      this._setupStudioSession();
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (window.lucide) window.lucide.createIcons();
  }

  // ==========================================
  // 1. STEPPER SETUP
  // ==========================================
  _setupStepper() {
    for (let i = 1; i <= 5; i++) {
      const btn = document.getElementById(`step-btn-${i}`);
      if (btn) {
        btn.addEventListener('click', () => this.goToStep(i));
      }
    }

    document.getElementById('step-1-next-btn')?.addEventListener('click', () => this.goToStep(2));
    document.getElementById('step-2-prev-btn')?.addEventListener('click', () => this.goToStep(1));
    document.getElementById('step-2-next-btn')?.addEventListener('click', () => this.goToStep(3));
    document.getElementById('step-3-prev-btn')?.addEventListener('click', () => this.goToStep(2));
    document.getElementById('step-3-next-btn')?.addEventListener('click', () => this.goToStep(4));
    document.getElementById('step-4-prev-btn')?.addEventListener('click', () => {
      if (this.isStudioRecording) {
        this.stopStudioRecording();
      }
      this.goToStep(3);
    });
  }

  // ==========================================
  // 2. ASSET UPLOAD SETUP
  // ==========================================
  _setupAssetUploads() {
    // Audio Upload
    const audioInput = document.getElementById('audio-input');
    const audioBadge = document.getElementById('audio-status-badge');
    const audioPreview = document.getElementById('audio-preview-container');
    const audioPlayer = document.getElementById('audio-player-preview');
    const audioName = document.getElementById('audio-file-name');
    const audioDur = document.getElementById('audio-file-duration');

    audioInput?.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (file) {
        try {
          const info = await this.audio.loadAudioFile(file);
          audioBadge.className = 'badge-success';
          audioBadge.textContent = 'Audio Ready';
          audioPreview.classList.remove('hidden');
          audioPlayer.src = this.audio.audioUrl;
          audioName.textContent = info.name;
          audioDur.textContent = this.audio.formatDuration(info.duration);
          this.showToast(`Loaded audio: ${file.name}`, 'success');
        } catch (err) {
          this.showToast('Failed to load audio file', 'error');
        }
      }
    });

    // Mode Selection Tabs: Videos / Pool vs Image Slideshow
    const tabVideo = document.getElementById('tab-mode-video-pool');
    const tabSlideshow = document.getElementById('tab-mode-slideshow');
    const dropzoneVideo = document.getElementById('dropzone-video-pool-container');
    const dropzoneSlideshow = document.getElementById('dropzone-slideshow-container');

    tabVideo?.addEventListener('click', () => {
      tabVideo.className = 'flex-1 py-1.5 px-2 rounded font-medium bg-brand-600 text-white transition text-center cursor-pointer';
      tabSlideshow.className = 'flex-1 py-1.5 px-2 rounded font-medium text-slate-400 hover:text-white transition text-center cursor-pointer';
      dropzoneVideo?.classList.remove('hidden');
      dropzoneSlideshow?.classList.add('hidden');
      this.mediaPool.setSlideshowMode(false);
      this._updateSlideshowUI();
      this.showToast('Background mode: Videos & Media Pool', 'info', 1200);
    });

    tabSlideshow?.addEventListener('click', () => {
      tabSlideshow.className = 'flex-1 py-1.5 px-2 rounded font-medium bg-brand-600 text-white transition text-center cursor-pointer';
      tabVideo.className = 'flex-1 py-1.5 px-2 rounded font-medium text-slate-400 hover:text-white transition text-center cursor-pointer';
      dropzoneSlideshow?.classList.remove('hidden');
      dropzoneVideo?.classList.add('hidden');
      this.mediaPool.setSlideshowMode(true);
      this._updateSlideshowUI();
      this.showToast('Background mode: Image Slideshow', 'info', 1200);
    });

    // Slideshow Folder Input
    const folderInput = document.getElementById('slideshow-folder-input');
    folderInput?.addEventListener('change', async (e) => {
      const files = e.target.files;
      if (files && files.length > 0) {
        try {
          const loaded = await this.mediaPool.addSlideshowFiles(files);
          this._updateSlideshowUI();
          this._renderBgPool();
          this.showToast(`Loaded ${loaded.length} slideshow images from folder!`, 'success');
        } catch (err) {
          this.showToast(err.message || 'Error loading folder images', 'error');
        }
      }
    });

    // Slideshow Multiple Files Input
    const filesInput = document.getElementById('slideshow-files-input');
    filesInput?.addEventListener('change', async (e) => {
      const files = e.target.files;
      if (files && files.length > 0) {
        try {
          const loaded = await this.mediaPool.addSlideshowFiles(files);
          this._updateSlideshowUI();
          this._renderBgPool();
          this.showToast(`Loaded ${loaded.length} slideshow images!`, 'success');
        } catch (err) {
          this.showToast(err.message || 'Error loading images', 'error');
        }
      }
    });

    // Clear Slideshow
    document.getElementById('btn-clear-slideshow')?.addEventListener('click', () => {
      this.mediaPool.slides = [];
      this.mediaPool.slideshowMode = false;
      this._updateSlideshowUI();
      this._renderBgPool();
      this.showToast('Cleared slideshow', 'info');
    });

    // Video Folder Input
    const videoFolderInput = document.getElementById('video-folder-input');
    videoFolderInput?.addEventListener('change', async (e) => {
      const files = e.target.files;
      if (files && files.length > 0) {
        try {
          const loaded = await this.mediaPool.addVideoFiles(files);
          this._renderBgPool();
          this.showToast(`Loaded ${loaded.length} videos from folder!`, 'success');
        } catch (err) {
          this.showToast(err.message || 'Error loading video folder', 'error');
        }
      }
    });

    // Video Multiple Files Input
    const videoFilesInput = document.getElementById('video-files-input');
    videoFilesInput?.addEventListener('change', async (e) => {
      const files = e.target.files;
      if (files && files.length > 0) {
        try {
          const loaded = await this.mediaPool.addVideoFiles(files);
          this._renderBgPool();
          this.showToast(`Loaded ${loaded.length} video files!`, 'success');
        } catch (err) {
          this.showToast(err.message || 'Error loading video files', 'error');
        }
      }
    });

    // Background Media Pool Upload
    const bgInput = document.getElementById('bg-input');
    bgInput?.addEventListener('change', async (e) => {
      const files = Array.from(e.target.files);
      for (const file of files) {
        try {
          await this.mediaPool.addFile(file);
        } catch (err) {
          console.warn(err);
        }
      }
      this._renderBgPool();
      this.showToast(`Added ${files.length} background assets`, 'success');
    });

    // Add Gradient BG button
    document.getElementById('btn-add-gradient-bg')?.addEventListener('click', () => {
      const palettes = [
        ['#020617', '#4338ca', '#be185d', '#059669'],
        ['#0f172a', '#7c3aed', '#db2777', '#2563eb'],
        ['#18181b', '#0284c7', '#0d9488', '#e11d48'],
        ['#09090b', '#dc2626', '#d97706', '#4f46e5'],
      ];
      const randomPalette = palettes[Math.floor(Math.random() * palettes.length)];
      this.mediaPool.addProceduralGradient(`Neon Motion ${this.mediaPool.assets.length + 1}`, randomPalette);
      this._renderBgPool();
      this.showToast('Added animated gradient background', 'success');
    });

    // Lyrics File Upload
    const lyricsInput = document.getElementById('lyrics-input');
    lyricsInput?.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        this.lyricsFileName = file.name || 'lyrics.txt';
        const reader = new FileReader();
        reader.onload = (ev) => {
          const text = ev.target.result;
          this.lyrics.setRawText(text);
          const rawInput = document.getElementById('raw-lyrics-input');
          if (rawInput) rawInput.value = this.lyrics.rawText;
          this._updateLyricsSummary();
          this.showToast(`Loaded lyrics (${this.lyrics.cues.length} cues)`, 'success');
        };
        reader.readAsText(file);
      }
    });

    document.getElementById('btn-quick-paste')?.addEventListener('click', () => {
      this.goToStep(2);
    });

    // Drag & Drop visual highlights
    document.querySelectorAll('.upload-dropzone').forEach(dropzone => {
      dropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropzone.classList.add('dragover');
      });
      dropzone.addEventListener('dragleave', () => {
        dropzone.classList.remove('dragover');
      });
      dropzone.addEventListener('drop', () => {
        dropzone.classList.remove('dragover');
      });
    });
  }

  _renderBgPool() {
    const list = document.getElementById('bg-pool-list');
    const countBadge = document.getElementById('bg-pool-count');
    const strip = document.getElementById('style-bg-selector-strip');
    const switcher = document.getElementById('studio-bg-switcher');

    if (!list) return;

    list.innerHTML = '';
    if (strip) strip.innerHTML = '';
    if (switcher) switcher.innerHTML = '';

    countBadge.textContent = this.mediaPool.slideshowMode
      ? `${this.mediaPool.slides.length} Slides`
      : `${this.mediaPool.assets.length} Loaded`;

    if ((this.mediaPool.slideshowMode ? this.mediaPool.slides.length : this.mediaPool.assets.length) > 0) {
      countBadge.className = 'badge-success';
    }

    const displayAssets = this.mediaPool.slideshowMode && this.mediaPool.slides.length > 0
      ? this.mediaPool.slides
      : this.mediaPool.assets;

    displayAssets.forEach((asset, idx) => {
      // Step 1 Pool Card
      const item = document.createElement('div');
      const isCurrentActive = this.mediaPool.slideshowMode
        ? idx === this.mediaPool.currentSlideIndex
        : asset.id === this.mediaPool.activeAssetId;

      item.className = `media-pool-item ${isCurrentActive ? 'active' : ''}`;
      item.innerHTML = `
        <img src="${asset.thumbnail}" class="w-full h-full object-cover">
        <div class="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 hover:opacity-100 transition p-1 text-center">
          <span class="text-[10px] text-white font-medium truncate">${asset.name}</span>
        </div>
        <span class="absolute top-1 left-1 px-1.5 py-0.5 rounded bg-black/70 text-[9px] font-mono text-white font-bold">${this.mediaPool.slideshowMode ? 'S' + (idx + 1) : idx + 1}</span>
      `;
      item.addEventListener('click', () => {
        if (this.mediaPool.slideshowMode) {
          this.mediaPool.setSlideIndex(idx);
        } else {
          this.mediaPool.setActiveAsset(asset.id);
        }
        this._renderBgPool();
      });
      list.appendChild(item);

      // Step 3 Selector Strip
      if (strip) {
        const stripItem = document.createElement('button');
        stripItem.type = 'button';
        stripItem.className = `w-14 h-9 rounded-lg overflow-hidden border-2 transition flex-shrink-0 relative ${isCurrentActive ? 'border-brand-500 ring-2 ring-brand-500/30' : 'border-slate-700 opacity-60 hover:opacity-100'}`;
        stripItem.innerHTML = `<img src="${asset.thumbnail}" class="w-full h-full object-cover">`;
        stripItem.addEventListener('click', () => {
          if (this.mediaPool.slideshowMode) {
            this.mediaPool.setSlideIndex(idx);
          } else {
            this.mediaPool.setActiveAsset(asset.id);
          }
          this._renderBgPool();
          this._syncStylePreview();
        });
        strip.appendChild(stripItem);
      }

      // Step 4 Studio Switcher
      if (switcher) {
        const studioBtn = document.createElement('button');
        studioBtn.type = 'button';
        studioBtn.className = `flex-shrink-0 flex items-center gap-2 p-1.5 rounded-xl border transition cursor-pointer ${isCurrentActive ? 'bg-brand-500/20 border-brand-500 text-white' : 'bg-slate-950/80 border-slate-800 text-slate-400 hover:border-slate-700'}`;
        studioBtn.innerHTML = `
          <div class="w-10 h-7 rounded overflow-hidden relative">
            <img src="${asset.thumbnail}" class="w-full h-full object-cover">
            <span class="absolute bottom-0 right-0 px-1 rounded-tl bg-black/80 text-[8px] font-mono text-white font-bold">${this.mediaPool.slideshowMode ? 'S' + (idx + 1) : idx + 1}</span>
          </div>
          <span class="text-xs font-medium truncate max-w-[90px] pr-1">${asset.name}</span>
        `;
        studioBtn.addEventListener('click', () => {
          if (this.mediaPool.slideshowMode) {
            this.mediaPool.setSlideIndex(idx);
          } else {
            this.mediaPool.setActiveAsset(asset.id);
          }
          this._renderBgPool();
          this.showToast(`Switched to: ${asset.name}`, 'info', 1000);
        });
        switcher.appendChild(studioBtn);
      }
    });

    if (window.lucide) window.lucide.createIcons();
  }

  _updateSlideshowUI() {
    const statusBar = document.getElementById('slideshow-status-bar');
    const statusText = document.getElementById('slideshow-status-text');
    const countBadge = document.getElementById('bg-pool-count');

    if (this.mediaPool.slideshowMode && this.mediaPool.slides.length > 0) {
      if (statusBar) {
        statusBar.classList.remove('hidden');
        statusBar.classList.add('flex');
      }
      if (statusText) {
        statusText.textContent = `Slideshow Active (${this.mediaPool.slides.length} slides loaded)`;
      }
      if (countBadge) {
        countBadge.textContent = `${this.mediaPool.slides.length} Slides`;
        countBadge.className = 'badge-success';
      }
    } else {
      if (statusBar) {
        statusBar.classList.add('hidden');
        statusBar.classList.remove('flex');
      }
      if (countBadge) {
        countBadge.textContent = `${this.mediaPool.assets.length} Loaded`;
      }
    }
    this._updateSlideTelemetryUI();
  }

  _updateLyricsSummary() {
    const badge = document.getElementById('lyrics-status-badge');
    const linesCount = document.getElementById('lyrics-lines-count');
    const cuesBadge = document.getElementById('cues-total-badge');

    if (this.lyrics.cues.length > 0) {
      if (badge) {
        badge.className = 'badge-success';
        badge.textContent = 'Lyrics Ready';
      }
      if (linesCount) linesCount.textContent = `${this.lyrics.cues.length} cue chunks ready`;
      if (cuesBadge) cuesBadge.textContent = `${this.lyrics.cues.length} Cues`;
    } else {
      if (badge) {
        badge.className = 'badge-neutral';
        badge.textContent = 'Required';
      }
      if (linesCount) linesCount.textContent = `0 lines ready`;
      if (cuesBadge) cuesBadge.textContent = `0 Cues`;
    }
  }

  // ==========================================
  // 3. LYRICS DELIMITATION & EDITOR
  // ==========================================
  _setupLyricsEditor() {
    const rawInput = document.getElementById('raw-lyrics-input');
    const charCount = document.getElementById('editor-char-count');

    rawInput?.addEventListener('input', (e) => {
      const val = e.target.value;
      this.lyrics.setRawText(val);
      const lines = val.split('\n').length;
      if (charCount) charCount.textContent = `${val.length} characters, ${lines} lines`;
      this._updateLyricsSummary();
      this._updateCueListUI();
    });

    // Delimitation mode buttons
    const modeButtons = [
      { id: 'chunk-by-empty-line', mode: 'empty-line' },
      { id: 'chunk-by-single-line', mode: 'single-line' },
      { id: 'chunk-by-two-lines', mode: 'two-lines' },
      { id: 'chunk-by-sentence', mode: 'sentence' },
    ];

    modeButtons.forEach(({ id, mode }) => {
      const btn = document.getElementById(id);
      btn?.addEventListener('click', () => {
        modeButtons.forEach(b => document.getElementById(b.id)?.classList.remove('active-chunk-rule'));
        btn.classList.add('active-chunk-rule');
        this.lyrics.setDelimitationMode(mode);
        this._updateCueListUI();
        this._updateLyricsSummary();
        this.showToast(`Grouped lyrics by ${mode.replace('-', ' ')}`, 'info');
      });
    });

    document.getElementById('btn-save-lyrics-file')?.addEventListener('click', () => {
      this.saveLyricsToFile();
    });

    document.getElementById('btn-format-trim')?.addEventListener('click', () => {
      this.lyrics.trimAll();
      if (rawInput) rawInput.value = this.lyrics.rawText;
      this._updateCueListUI();
      this.showToast('Trimmed extra lines and whitespace', 'info');
    });

    document.getElementById('btn-uppercase-all')?.addEventListener('click', () => {
      this.lyrics.toUpperCase();
      if (rawInput) rawInput.value = this.lyrics.rawText;
      this._updateCueListUI();
      this.showToast('Converted lyrics to UPPERCASE', 'info');
    });
  }

  async saveLyricsToFile() {
    const rawText = this.lyrics.rawText || '';
    if (!rawText.trim()) {
      this.showToast('No lyrics to save yet. Add or edit lyrics first!', 'warning');
      return;
    }

    const defaultName = this.lyricsFileName || 'lyrics.txt';

    // 1. Direct write to existing file handle if opened via File System Access API
    if (this.lyricsFileHandle) {
      try {
        const writable = await this.lyricsFileHandle.createWritable();
        await writable.write(rawText);
        await writable.close();
        this.showToast(`Saved lyrics back to ${this.lyricsFileHandle.name}!`, 'success', 3000);
        return;
      } catch (err) {
        console.warn('Direct file handle write fallback:', err);
      }
    }

    // 2. Modern Save File Picker
    if (window.showSaveFilePicker) {
      try {
        const handle = await window.showSaveFilePicker({
          suggestedName: defaultName,
          types: [{
            description: 'Lyrics Text File',
            accept: { 'text/plain': ['.txt', '.lrc', '.text'] }
          }]
        });
        this.lyricsFileHandle = handle;
        this.lyricsFileName = handle.name;
        const writable = await handle.createWritable();
        await writable.write(rawText);
        await writable.close();
        this.showToast(`Saved lyrics to ${handle.name}!`, 'success', 3000);
        return;
      } catch (err) {
        if (err.name === 'AbortError') return; // User cancelled
        console.warn('showSaveFilePicker fallback:', err);
      }
    }

    // 3. Standard browser download fallback
    try {
      const blob = new Blob([rawText], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = defaultName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      this.showToast(`Downloaded ${defaultName} to disk!`, 'success', 3000);
    } catch (e) {
      console.error('Save lyrics error:', e);
      this.showToast('Failed to save lyrics file', 'error');
    }
  }

  _updateCueListUI() {
    const container = document.getElementById('cue-chunks-container');
    const rawInput = document.getElementById('raw-lyrics-input');
    if (!container) return;

    if (this.lyrics.cues.length === 0) {
      container.innerHTML = `
        <div class="p-8 text-center text-slate-500 border border-dashed border-slate-800 rounded-xl">
          <i data-lucide="text-quote" class="w-8 h-8 mx-auto mb-2 opacity-50"></i>
          <p class="text-sm">No cues generated yet.</p>
          <p class="text-xs text-slate-600 mt-1">Paste lyrics in the left editor or load sample data.</p>
        </div>
      `;
      if (window.lucide) window.lucide.createIcons();
      return;
    }

    container.innerHTML = '';
    this.lyrics.cues.forEach((cue, idx) => {
      const card = document.createElement('div');
      card.className = 'cue-card flex items-start justify-between gap-3 group';
      card.innerHTML = `
        <div class="flex items-start gap-2.5 flex-1">
          <div class="flex flex-col gap-1 items-start">
            <span class="text-xs font-mono font-bold text-brand-400 bg-brand-500/10 px-2 py-0.5 rounded border border-brand-500/20">${idx + 1}</span>
            ${cue.autoSlide ? `<span class="text-[9px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-1.5 py-0.5 rounded flex items-center gap-1 shadow-sm max-w-[140px] truncate" title="${cue.slideTarget ? `Auto-switch to slide: ${cue.slideTarget}` : 'Automatically changes background slide'}"><i data-lucide="image" class="w-2.5 h-2.5 shrink-0"></i><span class="truncate">${cue.slideTarget ? cue.slideTarget : 'SLIDE'}</span></span>` : ''}
            ${cue.autoVideo ? `<span class="text-[9px] font-bold text-purple-400 bg-purple-500/10 border border-purple-500/30 px-1.5 py-0.5 rounded flex items-center gap-1 shadow-sm max-w-[140px] truncate" title="${cue.videoTarget ? `Auto-switch to video: ${cue.videoTarget}` : 'Automatically changes background video'}"><i data-lucide="film" class="w-2.5 h-2.5 shrink-0"></i><span class="truncate">${cue.videoTarget ? cue.videoTarget : 'VIDEO'}</span></span>` : ''}
          </div>
          <textarea class="cue-edit-textarea w-full bg-transparent text-sm text-slate-200 resize-none outline-none font-medium leading-relaxed focus:bg-slate-900/80 p-1 rounded transition" rows="${Math.max(1, cue.lines.length)}">${cue.text}</textarea>
        </div>
        <button class="btn-delete-cue text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition p-1" title="Delete cue">
          <i data-lucide="trash-2" class="w-4 h-4"></i>
        </button>
      `;

      const textarea = card.querySelector('.cue-edit-textarea');
      textarea.addEventListener('input', (e) => {
        this.lyrics.updateCueText(idx, e.target.value);
        if (rawInput) rawInput.value = this.lyrics.rawText;
        const charCount = document.getElementById('editor-char-count');
        if (charCount) charCount.textContent = `${this.lyrics.rawText.length} characters, ${this.lyrics.rawText.split('\n').length} lines`;
      });

      card.querySelector('.btn-delete-cue')?.addEventListener('click', () => {
        this.lyrics.deleteCue(idx);
        if (rawInput) rawInput.value = this.lyrics.rawText;
        this._updateCueListUI();
        this._updateLyricsSummary();
      });

      container.appendChild(card);
    });

    if (window.lucide) window.lucide.createIcons();
  }

  // ==========================================
  // 4. STYLE & LAYOUT CONTROLS
  // ==========================================
  _setupStyleControls() {
    // Aspect ratio buttons
    document.querySelectorAll('.aspect-ratio-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.aspect-ratio-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const ratio = btn.getAttribute('data-ratio');
        
        this.renderer.setAspectRatio(ratio);
        this.stylePreviewRenderer.setAspectRatio(ratio);

        const stageWrapper = document.getElementById('master-stage-wrapper');
        const previewWrapper = document.getElementById('style-preview-wrapper');

        // Adjust wrapper CSS aspect ratios
        [stageWrapper, previewWrapper].forEach(el => {
          if (!el) return;
          el.className = el.className.replace(/aspect-(video|square|\[9\/16\])/g, '');
          if (ratio === '16-9') el.classList.add('aspect-video');
          else if (ratio === '9-16') el.classList.add('aspect-[9/16]');
          else if (ratio === '1-1') el.classList.add('aspect-square');
        });

        this.showToast(`Aspect ratio changed to ${ratio.replace('-', ':')}`, 'info');
      });
    });

    // Font family
    const fontSelect = document.getElementById('font-family-select');
    fontSelect?.addEventListener('change', (e) => {
      this._updateStyle({ fontFamily: e.target.value });
    });

    // Font weight
    const weightSelect = document.getElementById('font-weight-select');
    weightSelect?.addEventListener('change', (e) => {
      this._updateStyle({ fontWeight: e.target.value });
    });

    // Italic Toggle
    const italicBtn = document.getElementById('btn-toggle-italic');
    let isItalic = false;
    italicBtn?.addEventListener('click', () => {
      isItalic = !isItalic;
      italicBtn.classList.toggle('active-chunk-rule', isItalic);
      this._updateStyle({ isItalic });
    });

    // Uppercase Toggle
    const upperBtn = document.getElementById('btn-toggle-uppercase');
    let isUpper = false;
    upperBtn?.addEventListener('click', () => {
      isUpper = !isUpper;
      upperBtn.classList.toggle('active-chunk-rule', isUpper);
      this._updateStyle({ isUppercase: isUpper });
    });

    // Font size slider
    const fontSizeSlider = document.getElementById('font-size-slider');
    const fontSizeVal = document.getElementById('font-size-val');
    fontSizeSlider?.addEventListener('input', (e) => {
      const val = parseInt(e.target.value, 10);
      fontSizeVal.textContent = `${val}px`;
      this._updateStyle({ fontSize: val });
    });

    // Max Width slider
    const maxWidthSlider = document.getElementById('max-width-slider');
    const maxWidthVal = document.getElementById('max-width-val');
    maxWidthSlider?.addEventListener('input', (e) => {
      const val = parseInt(e.target.value, 10);
      maxWidthVal.textContent = `${val}%`;
      this._updateStyle({ maxWidthPercent: val });
    });

    // Colors: Text, Stroke, Shadow, Box
    this._bindColorInput('text-color-picker', 'text-color-hex', (c) => this._updateStyle({ textColor: c }));
    this._bindColorInput('stroke-color-picker', 'stroke-color-hex', (c) => this._updateStyle({ strokeColor: c }));
    this._bindColorInput('shadow-color-picker', 'shadow-color-hex', (c) => this._updateStyle({ shadowColor: c }));
    this._bindColorInput('box-color-picker', 'box-color-hex', (c) => this._updateStyle({ boxColor: c }));

    // Stroke width slider
    const strokeWidthSlider = document.getElementById('stroke-width-slider');
    const strokeWidthVal = document.getElementById('stroke-width-val');
    strokeWidthSlider?.addEventListener('input', (e) => {
      const val = parseInt(e.target.value, 10);
      strokeWidthVal.textContent = `${val}px`;
      this._updateStyle({ strokeWidth: val });
    });

    // Box Opacity slider
    const boxOpacitySlider = document.getElementById('box-opacity-slider');
    const boxOpacityVal = document.getElementById('box-opacity-val');
    boxOpacitySlider?.addEventListener('input', (e) => {
      const val = parseInt(e.target.value, 10);
      boxOpacityVal.textContent = `${val}%`;
      this._updateStyle({ boxOpacity: val });
    });

    // Position Mode: Fixed vs Tap Points (1-6)
    const posFixedBtn = document.getElementById('pos-mode-fixed');
    const posTapBtn = document.getElementById('pos-mode-tap');
    const fixedControls = document.getElementById('fixed-pos-controls');
    const tapControls = document.getElementById('tap-pos-controls');
    const tapOverlay = document.getElementById('tap-points-overlay');
    const tapHint = document.getElementById('preview-tap-hint');
    const clearTapBtn = document.getElementById('btn-clear-tap-points');
    const testNextBtn = document.getElementById('btn-test-next-pos');

    posFixedBtn?.addEventListener('click', () => {
      posFixedBtn.className = 'flex-1 py-1.5 px-3 rounded text-xs font-medium bg-brand-600 text-white transition';
      posTapBtn.className = 'flex-1 py-1.5 px-3 rounded text-xs font-medium text-slate-400 hover:text-white transition';
      fixedControls?.classList.remove('hidden');
      tapControls?.classList.add('hidden');
      if (tapHint) tapHint.classList.add('hidden');
      this._updateStyle({ positionMode: 'fixed' });
      this._syncStylePreview();
    });

    posTapBtn?.addEventListener('click', () => {
      posTapBtn.className = 'flex-1 py-1.5 px-3 rounded text-xs font-medium bg-brand-600 text-white transition';
      posFixedBtn.className = 'flex-1 py-1.5 px-3 rounded text-xs font-medium text-slate-400 hover:text-white transition';
      fixedControls?.classList.add('hidden');
      tapControls?.classList.remove('hidden');
      if (tapHint) tapHint.classList.remove('hidden');
      this._updateStyle({ positionMode: 'custom_tap' });
      this._updateTapPointsOverlayUI();
      this._syncStylePreview();
    });

    // Handle Tap on Preview Screen
    tapOverlay?.addEventListener('click', (e) => {
      const rect = tapOverlay.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const clickY = e.clientY - rect.top;
      const normX = Math.max(0.1, Math.min(0.9, clickX / rect.width));
      const normY = Math.max(0.12, Math.min(0.88, clickY / rect.height));

      const points = this.stylePreviewRenderer.getTapPoints();
      if (points.length >= 6) {
        this.showToast('Maximum 6 landing points reached. Click "Clear All Points" to reset.', 'warning');
        return;
      }

      this.stylePreviewRenderer.addTapPoint(normX, normY);
      this.renderer.addTapPoint(normX, normY);
      this._updateTapPointsOverlayUI();
      
      // Auto-switch to tap mode if not already
      posTapBtn?.click();
      this._syncStylePreview();
      this.showToast(`Placed Point [${points.length + 1}] at ${Math.round(normX * 100)}%, ${Math.round(normY * 100)}%`, 'success', 1500);
    });

    clearTapBtn?.addEventListener('click', () => {
      this.stylePreviewRenderer.clearTapPoints();
      this.renderer.clearTapPoints();
      this._updateTapPointsOverlayUI();
      this._syncStylePreview();
      this.showToast('Cleared all tap landing points', 'info');
    });

    testNextBtn?.addEventListener('click', () => {
      const sampleInput = document.getElementById('preview-sample-text');
      const text = sampleInput?.value || 'LYRICS PREVIEW TEXT';
      this.stylePreviewRenderer.setCue({ index: 0, text });
    });

    // Fixed vertical presets (Top, Center, Bottom)
    document.querySelectorAll('.fixed-preset-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.fixed-preset-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const align = btn.getAttribute('data-align');
        this._updateStyle({ verticalAlign: align });
      });
    });

    // Horizontal alignment buttons
    document.querySelectorAll('.text-align-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.text-align-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const align = btn.getAttribute('data-align');
        this._updateStyle({ textAlign: align });
      });
    });

    // Transition Style Selector
    document.querySelectorAll('.transition-type-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.transition-type-btn').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        const transType = btn.getAttribute('data-transition');
        this._updateStyle({ transitionType: transType });
        this._advancePreviewCue(0);
        this.showToast(`Transition: ${btn.querySelector('.font-semibold')?.textContent}`, 'info', 1200);
      });
    });

    // Transition Speed Slider
    const transSpeedSlider = document.getElementById('transition-speed-slider');
    const transSpeedVal = document.getElementById('transition-speed-val');
    transSpeedSlider?.addEventListener('input', (e) => {
      const speed = parseFloat(e.target.value);
      if (transSpeedVal) {
        let desc = 'Standard';
        if (speed <= 0.2) desc = 'Fast';
        else if (speed <= 0.5) desc = 'Smooth';
        else if (speed <= 0.9) desc = 'Cinematic';
        else desc = 'Slow';
        transSpeedVal.textContent = `${speed.toFixed(2)}s (${desc})`;
      }
      this._updateStyle({ transitionSpeed: speed });
    });

    // Preview Screen Loaded Song Lyrics Controls
    document.getElementById('btn-preview-next-cue')?.addEventListener('click', () => {
      this._advancePreviewCue(1);
    });
    document.getElementById('btn-preview-prev-cue')?.addEventListener('click', () => {
      this._advancePreviewCue(-1);
    });
    document.getElementById('btn-preview-toggle-auto')?.addEventListener('click', () => {
      this._togglePreviewAutoAdvance();
    });

    // Test preview text input
    const previewSampleInput = document.getElementById('preview-sample-text');
    previewSampleInput?.addEventListener('input', (e) => {
      this.stylePreviewRenderer.setCue({ index: this._previewCueIndex, text: e.target.value });
    });
  }

  _getPreviewCues() {
    if (this.lyrics.cues && this.lyrics.cues.length > 0) {
      return this.lyrics.cues.map(c => c.text);
    }
    return [
      'CAUSE YOU WERE SKY AND I WAS OCEAN',
      'WE PAINTED DREAMS ACROSS THE MORNING',
      'A TIMELESS RHYTHM IN THE DARK',
      'LYRICFLOW STUDIO LIVE RECORDING'
    ];
  }

  _advancePreviewCue(direction = 1) {
    const cues = this._getPreviewCues();
    if (cues.length === 0) return;

    this._previewCueIndex = (this._previewCueIndex + direction + cues.length) % cues.length;
    const currentText = cues[this._previewCueIndex];

    const sampleInput = document.getElementById('preview-sample-text');
    const counterBadge = document.getElementById('preview-cue-counter');

    if (sampleInput) sampleInput.value = currentText;
    if (counterBadge) counterBadge.textContent = `Cue ${this._previewCueIndex + 1} / ${cues.length}`;

    this.stylePreviewRenderer.setCue({ index: this._previewCueIndex, text: currentText });
  }

  _startPreviewAutoAdvance() {
    this._stopPreviewAutoAdvance();
    this._previewAutoPlaying = true;
    this._updatePreviewAutoButtonUI();
    this._previewAutoInterval = setInterval(() => {
      if (this.currentStep === 3 && this._previewAutoPlaying) {
        this._advancePreviewCue(1);
      }
    }, 3500);
  }

  _stopPreviewAutoAdvance() {
    if (this._previewAutoInterval) {
      clearInterval(this._previewAutoInterval);
      this._previewAutoInterval = null;
    }
  }

  _togglePreviewAutoAdvance() {
    this._previewAutoPlaying = !this._previewAutoPlaying;
    this._updatePreviewAutoButtonUI();
    if (this._previewAutoPlaying) {
      this._startPreviewAutoAdvance();
      this.showToast('Auto-advancing lyrics slowly (3.5s)', 'info', 1500);
    } else {
      this._stopPreviewAutoAdvance();
      this.showToast('Paused lyrics auto-advance', 'info', 1500);
    }
  }

  _updatePreviewAutoButtonUI() {
    const autoIcon = document.getElementById('preview-auto-icon');
    const autoText = document.getElementById('preview-auto-text');
    const autoBtn = document.getElementById('btn-preview-toggle-auto');

    if (this._previewAutoPlaying) {
      if (autoIcon) autoIcon.setAttribute('data-lucide', 'pause');
      if (autoText) autoText.textContent = 'Auto (Playing)';
      if (autoBtn) autoBtn.className = 'flex-1 py-1.5 text-xs font-semibold rounded-lg bg-brand-600 hover:bg-brand-500 text-white transition flex items-center justify-center gap-1 shadow-sm cursor-pointer';
    } else {
      if (autoIcon) autoIcon.setAttribute('data-lucide', 'play');
      if (autoText) autoText.textContent = 'Auto (Paused)';
      if (autoBtn) autoBtn.className = 'flex-1 py-1.5 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition flex items-center justify-center gap-1 border border-slate-700 shadow-sm cursor-pointer';
    }
    if (window.lucide) window.lucide.createIcons();
  }

  _bindColorInput(inputId, hexId, callback) {
    const input = document.getElementById(inputId);
    const hex = document.getElementById(hexId);
    if (!input) return;

    input.addEventListener('input', (e) => {
      const val = e.target.value;
      if (hex) hex.textContent = val.toUpperCase();
      callback(val);
    });
  }

  _updateStyle(newProps) {
    this.renderer.updateStyle(newProps);
    this.stylePreviewRenderer.updateStyle(newProps);
  }

  _syncStylePreview() {
    this._advancePreviewCue(0);
  }

  // ==========================================
  // 5. LIVE RECORDING STUDIO
  // ==========================================
  _setupStudioControls() {
    // Big Tap / Advance Cue Button (Single mode)
    const fireBtn = document.getElementById('btn-fire-cue');
    fireBtn?.addEventListener('click', () => {
      this.advanceCue();
    });

    // Split Advance Buttons (Slideshow mode)
    document.getElementById('btn-split-advance-lyric')?.addEventListener('click', () => {
      this.advanceCue();
    });
    document.getElementById('btn-split-advance-both')?.addEventListener('click', () => {
      this.advanceCueAndSlide();
    });

    // Next Video Button
    document.getElementById('btn-studio-next-video')?.addEventListener('click', () => {
      this.advanceVideo();
    });

    // Prev Cue Button
    document.getElementById('btn-prev-cue')?.addEventListener('click', () => {
      this.previousCue();
    });

    // Blank Cue Button
    document.getElementById('btn-blank-cue')?.addEventListener('click', () => {
      this.toggleBlankCue();
    });

    // Toggle Record & Play Button
    const recBtn = document.getElementById('btn-toggle-record');
    recBtn?.addEventListener('click', () => {
      if (this.isStudioRecording) {
        this.stopStudioRecording();
      } else {
        this.startStudioRecording();
      }
    });

    // Audio Play/Pause Button inside studio
    const studioAudioBtn = document.getElementById('btn-studio-audio-toggle');
    studioAudioBtn?.addEventListener('click', async () => {
      if (this.audio.isPlaying) {
        this.audio.pause();
        this.mediaPool.pauseAllVideos();
      } else {
        await this.audio.play();
        this.mediaPool.playActiveVideo();
      }
    });

    // Audio Progress scrubber
    const progressContainer = document.getElementById('audio-progress-bar-container');
    progressContainer?.addEventListener('click', (e) => {
      const rect = progressContainer.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const fraction = Math.max(0, Math.min(1, clickX / rect.width));
      const targetTime = fraction * this.audio.duration;
      this.audio.seek(targetTime);
    });

    // Time update callback for studio bar
    this.audio.onTimeUpdateCallback = (current, total) => {
      const bar = document.getElementById('audio-progress-bar');
      const curText = document.getElementById('studio-time-current');
      const totText = document.getElementById('studio-time-total');

      if (bar) {
        const percent = total > 0 ? (current / total) * 100 : 0;
        bar.style.width = `${percent}%`;
      }
      if (curText) curText.textContent = this.audio.formatDuration(current);
      if (totText) totText.textContent = this.audio.formatDuration(total);
    };

    // Play state change callback
    this.audio.onPlayStateChangeCallback = (isPlaying) => {
      const icon = document.getElementById('studio-play-icon');
      if (icon) {
        icon.setAttribute('data-lucide', isPlaying ? 'pause' : 'play');
        if (window.lucide) window.lucide.createIcons();
      }
      if (!isPlaying && !this.isStudioRecording) {
        this.mediaPool.pauseAllVideos();
      }
    };

    // Auto-Stop Mode Setup
    const limitModeSelect = document.getElementById('recording-limit-mode');
    const customSecContainer = document.getElementById('recording-custom-sec-container');
    const customSecInput = document.getElementById('recording-custom-sec-input');

    const updateLimitMode = () => {
      const val = limitModeSelect?.value || 'audio_end';
      if (val === 'audio_end') {
        this.customMaxDuration = null;
        if (customSecContainer) {
          customSecContainer.classList.add('hidden');
          customSecContainer.classList.remove('flex');
        }
      } else if (val === 'custom') {
        if (customSecContainer) {
          customSecContainer.classList.remove('hidden');
          customSecContainer.classList.add('flex');
        }
        this.customMaxDuration = parseInt(customSecInput?.value, 10) || 30;
      } else {
        if (customSecContainer) {
          customSecContainer.classList.add('hidden');
          customSecContainer.classList.remove('flex');
        }
        this.customMaxDuration = parseInt(val, 10);
      }
    };

    limitModeSelect?.addEventListener('change', updateLimitMode);
    customSecInput?.addEventListener('input', updateLimitMode);

    // Audio ended
    this.audio.onEndedCallback = () => {
      this.mediaPool.pauseAllVideos();
      if (this.isStudioRecording) {
        this.stopStudioRecording();
      }
    };

    // Video Recorder timer callback
    this.recorder.onTimerUpdate = (elapsed) => {
      const timerDisplay = document.getElementById('recording-time-display');
      if (timerDisplay) {
        timerDisplay.textContent = this.audio.formatTime(elapsed);
      }
      // Check custom auto-stop limit
      if (this.isStudioRecording && this.customMaxDuration && elapsed >= this.customMaxDuration) {
        this.stopStudioRecording();
      }
    };

    // MP4 Encoding Progress callback
    this.recorder.onProgressUpdate = (ratio, statusText) => {
      const banner = document.getElementById('mp4-encoding-banner');
      const bar = document.getElementById('mp4-encoding-bar');
      const pct = document.getElementById('mp4-encoding-pct');
      const status = document.getElementById('mp4-encoding-status');

      if (banner) {
        banner.classList.remove('hidden');
        banner.classList.add('flex');
      }
      if (bar) bar.style.width = `${Math.min(100, Math.round(ratio * 100))}%`;
      if (pct) pct.textContent = `${Math.min(100, Math.round(ratio * 100))}%`;
      if (status) {
        status.innerHTML = `<i data-lucide="loader-2" class="w-4 h-4 animate-spin text-brand-400"></i> <span>${statusText}</span>`;
        if (window.lucide) window.lucide.createIcons();
      }
    };

    // Video Recorder complete callback
    this.recorder.onRecordingComplete = (metadata) => {
      this._showExportView(metadata);
    };
  }

  _setupStudioSession() {
    this.activeCueIndex = -1;
    this.renderer.setCue(null);
    this.audio.pause();
    this.audio.seek(0);
    this.mediaPool.pauseAllVideos();

    // Rewind active video background or slide to beginning ready for fresh re-recording
    const activeAsset = this.mediaPool.getActiveAsset();
    if (activeAsset && activeAsset.videoElement) {
      try {
        activeAsset.videoElement.currentTime = 0;
      } catch (e) {}
    }
    if (this.mediaPool.slideshowMode) {
      this.mediaPool.activeSlideIndex = 0;
      this._updateSlideTelemetryUI();
    }

    // Reset studio telemetry displays without touching loaded media assets
    const recTimeDisp = document.getElementById('recording-time-display');
    if (recTimeDisp) recTimeDisp.textContent = '00:00.0';

    const curTime = document.getElementById('studio-time-current');
    if (curTime) curTime.textContent = '0:00';

    const progBar = document.getElementById('audio-progress-bar');
    if (progBar) progBar.style.width = '0%';

    const playIcon = document.getElementById('studio-play-icon');
    if (playIcon) playIcon.setAttribute('data-lucide', 'play');

    this._updatePrompterUI();
    this._renderBgPool();

    const totText = document.getElementById('studio-time-total');
    if (totText) totText.textContent = this.audio.formatDuration(this.audio.duration);

    if (window.lucide) window.lucide.createIcons();
  }

  async startStudioRecording() {
    if (this.lyrics.cues.length === 0) {
      this.showToast('Please add some lyrics first before recording!', 'error');
      this.goToStep(2);
      return;
    }

    this.isStudioRecording = true;
    this.activeCueIndex = -1;
    this.renderer.setCue(null);

    // Release any previous exported preview video to free video decoder memory
    const prevExportPlayer = document.getElementById('export-video-player');
    if (prevExportPlayer) {
      try {
        prevExportPlayer.pause();
        prevExportPlayer.removeAttribute('src');
        prevExportPlayer.load();
      } catch (e) {}
    }

    // Audio start
    this.audio.seek(0);
    try {
      await this.audio.play();
      this.mediaPool.playActiveVideo();
    } catch (e) {
      console.warn('Audio play request:', e);
    }

    // Recorder start
    this.recorder.startRecording();

    // UI Updates
    const recBtn = document.getElementById('btn-toggle-record');
    const recText = document.getElementById('btn-toggle-record-text');
    const recDot = document.getElementById('rec-status-dot');
    const recBadge = document.getElementById('live-rec-badge');

    if (recBtn) {
      recBtn.classList.add('recording');
      if (recText) recText.textContent = 'Stop & Finalize Recording';
    }
    if (recDot) {
      recDot.className = 'w-3.5 h-3.5 rounded-full bg-red-500 animate-ping';
    }
    if (recBadge) {
      recBadge.classList.remove('hidden');
      recBadge.classList.add('flex');
    }

    this._updatePrompterUI();
    this.showToast('Recording started! Hit Spacebar to advance lyrics.', 'success');
  }

  stopStudioRecording() {
    if (!this.isStudioRecording) return;
    this.isStudioRecording = false;

    this.audio.pause();
    this.mediaPool.pauseAllVideos();
    this.recorder.stopRecording();

    const recBtn = document.getElementById('btn-toggle-record');
    const recText = document.getElementById('btn-toggle-record-text');
    const recDot = document.getElementById('rec-status-dot');
    const recBadge = document.getElementById('live-rec-badge');

    if (recBtn) {
      recBtn.classList.remove('recording');
      if (recText) recText.textContent = 'Start Recording & Play';
    }
    if (recDot) {
      recDot.className = 'w-3.5 h-3.5 rounded-full bg-slate-600';
    }
    if (recBadge) {
      recBadge.classList.add('hidden');
      recBadge.classList.remove('flex');
    }

    this.showToast('Recording finished! Finalizing video file...', 'info');
  }

  advanceCue() {
    const totalCues = this.lyrics.cues.length;
    if (totalCues === 0) return;

    if (this.activeCueIndex < totalCues - 1) {
      this.activeCueIndex++;
      const activeCue = this.lyrics.cues[this.activeCueIndex];
      this.renderer.setCue(activeCue, false);

      this._triggerCueMedia(activeCue);

      this._updatePrompterUI();
    } else {
      // Reached the end of lyrics
      this.showToast('Final lyric cue reached!', 'info');
    }
  }

  _triggerCueMedia(cue) {
    if (!cue) return;
    if (cue.autoSlide) {
      if (cue.slideTarget) {
        const slide = this.mediaPool.setSlideByNameOrIndex(cue.slideTarget);
        if (slide) this._updateSlideTelemetryUI();
      } else if (this.mediaPool.slideshowMode) {
        this.mediaPool.advanceSlide();
        this._updateSlideTelemetryUI();
      }
    }

    if (cue.autoVideo) {
      if (cue.videoTarget) {
        const vid = this.mediaPool.setVideoByNameOrIndex(cue.videoTarget);
        if (vid) {
          this._renderBgPool();
          this.showToast(`Switched to Video: ${vid.name}`, 'info', 1200);
        }
      } else {
        this.advanceVideo();
      }
    }
  }

  advanceVideo() {
    const nextVid = this.mediaPool.nextVideo();
    if (nextVid) {
      this._renderBgPool();
      this.showToast(`Switched to Video: ${nextVid.name}`, 'info', 1200);
    }
  }

  previousCue() {
    if (this.activeCueIndex > 0) {
      this.activeCueIndex--;
      const activeCue = this.lyrics.cues[this.activeCueIndex];
      this.renderer.setCue(activeCue, false);
      this._updatePrompterUI();
    } else if (this.activeCueIndex === 0) {
      this.activeCueIndex = -1;
      this.renderer.setCue(null, false);
      this._updatePrompterUI();
    }
  }

  toggleBlankCue() {
    this.renderer.isBlank = !this.renderer.isBlank;
    this.showToast(this.renderer.isBlank ? 'Screen blanked (Text hidden)' : 'Text unhidden', 'info');
    this._updatePrompterUI();
  }

  _updatePrompterUI() {
    const totalCues = this.lyrics.cues.length;
    const currentCue = this.activeCueIndex >= 0 ? this.lyrics.cues[this.activeCueIndex] : null;
    const nextCue = this.activeCueIndex + 1 < totalCues ? this.lyrics.cues[this.activeCueIndex + 1] : null;

    // HUD Counter
    const counterHud = document.getElementById('cue-counter-hud');
    if (counterHud) {
      counterHud.textContent = `Cue ${Math.max(0, this.activeCueIndex + 1)} / ${totalCues}`;
    }

    // HUD Next text
    const hudNext = document.getElementById('hud-next-cue-text');
    if (hudNext) {
      hudNext.textContent = nextCue ? nextCue.text.replace(/\n/g, ' ') : (currentCue ? '— End of Lyrics —' : 'Hit Spacebar for 1st Cue');
    }

    // Prompter Cards
    const prompterActive = document.getElementById('prompter-active-text');
    const prompterNext = document.getElementById('prompter-next-text');
    const prompterStatus = document.getElementById('prompter-status');

    if (prompterStatus) {
      prompterStatus.textContent = this.isStudioRecording ? 'LIVE ON AIR' : 'Ready';
    }

    if (prompterActive) {
      const slideBadge = currentCue && currentCue.autoSlide ? ` <span class="ml-1.5 px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-mono font-bold" title="${currentCue.slideTarget ? `Slide: ${currentCue.slideTarget}` : 'Slide'}">📸 ${currentCue.slideTarget || 'SLIDE'}</span>` : '';
      const videoBadge = currentCue && currentCue.autoVideo ? ` <span class="ml-1.5 px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-400 border border-purple-500/30 text-[10px] font-mono font-bold" title="${currentCue.videoTarget ? `Video: ${currentCue.videoTarget}` : 'Video'}">🎬 ${currentCue.videoTarget || 'VIDEO'}</span>` : '';
      prompterActive.innerHTML = currentCue ? `${currentCue.text}${slideBadge}${videoBadge}` : '(No cue active yet)';
    }

    if (prompterNext) {
      const slideLabel = nextCue && nextCue.autoSlide ? (nextCue.slideTarget ? `📸 ${nextCue.slideTarget}` : '📸') : '';
      const slideIcon = slideLabel ? ` <span class="ml-1 px-1 rounded bg-emerald-500/20 text-emerald-400 text-[10px] font-mono font-bold" title="${nextCue.slideTarget ? `Slide: ${nextCue.slideTarget}` : 'Slide'}">${slideLabel}</span>` : '';
      const videoLabel = nextCue && nextCue.autoVideo ? (nextCue.videoTarget ? `🎬 ${nextCue.videoTarget}` : '🎬') : '';
      const videoIcon = videoLabel ? ` <span class="ml-1 px-1 rounded bg-purple-500/20 text-purple-400 text-[10px] font-mono font-bold" title="${nextCue.videoTarget ? `Video: ${nextCue.videoTarget}` : 'Video'}">${videoLabel}</span>` : '';
      prompterNext.innerHTML = nextCue ? `${nextCue.text.replace(/\n/g, ' ')}${slideIcon}${videoIcon}` : '— End of Lyrics —';
    }

    // Mini Cue List
    const prompterList = document.getElementById('prompter-cue-list');
    if (prompterList) {
      prompterList.innerHTML = '';
      this.lyrics.cues.forEach((cue, idx) => {
        const item = document.createElement('div');
        const isActive = idx === this.activeCueIndex;
        const isPast = idx < this.activeCueIndex;
        item.className = `p-1.5 px-2.5 rounded-lg text-xs flex items-center justify-between transition cursor-pointer ${isActive ? 'bg-brand-500/20 border border-brand-500/40 text-white font-semibold' : isPast ? 'text-slate-500 opacity-60' : 'text-slate-400 hover:bg-slate-800'}`;
        const sTag = cue.autoSlide ? ` <span class="text-[9px] text-emerald-400 font-bold ml-1 font-mono" title="${cue.slideTarget ? `Slide: ${cue.slideTarget}` : 'Slide'}">📸${cue.slideTarget ? ' ' + cue.slideTarget : ''}</span>` : '';
        const vTag = cue.autoVideo ? ` <span class="text-[9px] text-purple-400 font-bold ml-1 font-mono" title="${cue.videoTarget ? `Video: ${cue.videoTarget}` : 'Video'}">🎬${cue.videoTarget ? ' ' + cue.videoTarget : ''}</span>` : '';
        item.innerHTML = `
          <span class="truncate mr-2">${idx + 1}. ${cue.text.replace(/\n/g, ' ')}${sTag}${vTag}</span>
          ${isActive ? '<span class="w-2 h-2 rounded-full bg-brand-400 flex-shrink-0 animate-pulse"></span>' : ''}
        `;
        item.addEventListener('click', () => {
          this.activeCueIndex = idx;
          this.renderer.setCue(cue, false);
          this._triggerCueMedia(cue);
          this._updatePrompterUI();
        });
        prompterList.appendChild(item);
      });
    }
  }

  advanceCueAndSlide() {
    this.advanceCue();
    if (this.mediaPool.slideshowMode) {
      const slide = this.mediaPool.advanceSlide();
      if (slide) {
        this._updateSlideTelemetryUI();
      }
    }
  }

  _updateSlideTelemetryUI() {
    const indicator = document.getElementById('studio-slide-indicator');
    const container = document.getElementById('studio-slide-telemetry');
    const singleBtn = document.getElementById('btn-fire-cue');
    const splitContainer = document.getElementById('studio-slideshow-trigger-split');

    if (this.mediaPool.slideshowMode && this.mediaPool.slides.length > 0) {
      if (container) {
        container.classList.remove('hidden');
        container.classList.add('flex');
      }
      if (singleBtn) singleBtn.classList.add('hidden');
      if (splitContainer) {
        splitContainer.classList.remove('hidden');
        splitContainer.classList.add('grid');
      }
      if (indicator) {
        indicator.textContent = `Slide ${this.mediaPool.currentSlideIndex + 1} / ${this.mediaPool.slides.length}`;
      }
    } else {
      if (container) {
        container.classList.add('hidden');
        container.classList.remove('flex');
      }
      if (singleBtn) singleBtn.classList.remove('hidden');
      if (splitContainer) {
        splitContainer.classList.add('hidden');
        splitContainer.classList.remove('grid');
      }
    }
  }

  // ==========================================
  // 6. GLOBAL SHORTCUTS
  // ==========================================
  _setupGlobalShortcuts() {
    window.addEventListener('keydown', (e) => {
      // Ignore if user is currently typing in an input or textarea
      const target = e.target;
      // Ctrl+S or Cmd+S: Quick Save Project to Disk
      if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        this.exportProjectJSON();
        return;
      }

      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }

      // Spacebar: Advance Cue (or Advance Cue & Slide if Left Shift is held)
      if (e.code === 'Space') {
        e.preventDefault();
        if (this.currentStep === 4) {
          if (e.shiftKey && this.mediaPool.slideshowMode) {
            this.advanceCueAndSlide();
          } else {
            this.advanceCue();
          }
        }
      }

      // Right Arrow: Next Cue
      if (e.code === 'ArrowRight') {
        if (this.currentStep === 4) {
          e.preventDefault();
          this.advanceCue();
        }
      }

      // Left Arrow: Prev Cue
      if (e.code === 'ArrowLeft') {
        if (this.currentStep === 4) {
          e.preventDefault();
          this.previousCue();
        }
      }

      // 'B' Key: Toggle Blank Cue
      if (e.key === 'b' || e.key === 'B') {
        if (this.currentStep === 4) {
          e.preventDefault();
          this.toggleBlankCue();
        }
      }

      // 'V' Key: Switch to Next Video
      if (e.key === 'v' || e.key === 'V') {
        if (this.currentStep === 4) {
          e.preventDefault();
          this.advanceVideo();
        }
      }

      // 1-9 Keys: Switch Background mid-recording
      if (e.key >= '1' && e.key <= '9') {
        const bgIdx = parseInt(e.key, 10) - 1;
        if (bgIdx < this.mediaPool.assets.length) {
          e.preventDefault();
          this.mediaPool.setActiveByIndex(bgIdx);
          this._renderBgPool();
          this.showToast(`Switched Background [${e.key}]`, 'info');
        }
      }
    });
  }

  // ==========================================
  // 7. EXPORT & REVIEW CONTROLS
  // ==========================================
  _setupExportControls() {
    const returnToStudio = () => {
      const videoPlayer = document.getElementById('export-video-player');
      if (videoPlayer) {
        try {
          videoPlayer.pause();
          videoPlayer.removeAttribute('src');
          videoPlayer.load();
        } catch (e) {}
      }
      this.goToStep(4);
      this.showToast('Ready to re-record! All lyrics, audio, and background assets preserved.', 'info', 3000);
    };

    document.getElementById('btn-re-record')?.addEventListener('click', returnToStudio);
    document.getElementById('btn-export-to-studio')?.addEventListener('click', returnToStudio);
  }

  _showExportView(metadata) {
    this.audio.pause();
    this.mediaPool.pauseAllVideos();
    this.goToStep(5);

    const banner = document.getElementById('mp4-encoding-banner');
    if (banner) {
      banner.classList.remove('flex');
      banner.classList.add('hidden');
    }

    const videoPlayer = document.getElementById('export-video-player');
    const dlBtn1 = document.getElementById('btn-download-video');
    const dlBtn2 = document.getElementById('btn-download-video-secondary');

    const statDuration = document.getElementById('export-stat-duration');
    const statRes = document.getElementById('export-stat-res');
    const statFormat = document.getElementById('export-stat-format');
    const statSize = document.getElementById('export-stat-size');

    if (videoPlayer) {
      videoPlayer.src = metadata.url;
      try {
        videoPlayer.pause();
        videoPlayer.currentTime = 0;
      } catch (e) {}
    }

    const extLabel = metadata.extension.toUpperCase();

    if (dlBtn1) {
      dlBtn1.href = metadata.url;
      dlBtn1.download = metadata.filename;
      const span1 = dlBtn1.querySelector('span');
      if (span1) span1.textContent = `Download ${extLabel}`;
    }

    if (dlBtn2) {
      dlBtn2.href = metadata.url;
      dlBtn2.download = metadata.filename;
      const span2 = dlBtn2.querySelector('span');
      if (span2) span2.textContent = `Download ${extLabel} File`;
    }

    if (statDuration) statDuration.textContent = metadata.formattedDuration;
    if (statRes) statRes.textContent = `${metadata.width} x ${metadata.height}`;
    if (statFormat) statFormat.textContent = metadata.mimeType;
    if (statSize) statSize.textContent = `${metadata.sizeMB} MB`;

    this.showToast(`Video (${extLabel}) Ready for Download!`, 'success');
  }

  // ==========================================
  // 8. PROJECT RESET CONTROLS
  // ==========================================
  _setupResetControls() {
    document.getElementById('btn-reset-all')?.addEventListener('click', async () => {
      const confirmed = await this.showAppConfirm({
        title: 'Reset Entire Project?',
        message: 'This will reset all audio, background assets, and lyrics cues. Are you sure you want to start fresh?',
        confirmText: 'Reset Project',
        cancelText: 'Keep Working',
        isDanger: true
      });
      if (confirmed) {
        location.reload();
      }
    });
  }

  // ==========================================
  // 9. PWA INSTALLATION WORKFLOW
  // ==========================================
  _setupPwaInstall() {
    const installBtn = document.getElementById('btn-pwa-install');
    const settingsInstallBtn = document.getElementById('btn-settings-install');

    const handleInstallPrompt = async () => {
      if (this.deferredInstallPrompt) {
        this.deferredInstallPrompt.prompt();
        const { outcome } = await this.deferredInstallPrompt.userChoice;
        if (outcome === 'accepted') {
          this.showToast('Installing LyricFlow Studio PWA...', 'success');
        }
        this.deferredInstallPrompt = null;
        if (installBtn) installBtn.classList.add('hidden');
      } else {
        await this.showAppAlert({
          title: 'Install LyricFlow Studio',
          message: 'To install LyricFlow Studio as a desktop or mobile application:\n\n• On Chrome/Edge/Brave: Look for the Install icon (🖥️ or 📥) on the right side of the browser address bar.\n• On iOS Safari: Tap the Share button (⎋) and choose "Add to Home Screen".\n• On Android Chrome: Tap the 3-dot menu and select "Install app".',
          type: 'info'
        });
      }
    };

    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      this.deferredInstallPrompt = e;
      if (installBtn) {
        installBtn.classList.remove('hidden');
      }
    });

    installBtn?.addEventListener('click', handleInstallPrompt);
    settingsInstallBtn?.addEventListener('click', handleInstallPrompt);

    window.addEventListener('appinstalled', () => {
      this.deferredInstallPrompt = null;
      if (installBtn) installBtn.classList.add('hidden');
      this.showToast('LyricFlow Studio was installed successfully!', 'success');
    });
  }

  // ==========================================
  // 10. SETTINGS MENU & UPDATE / RELOAD SYSTEM
  // ==========================================
  _setupSettingsMenu() {
    const settingsModal = document.getElementById('settings-modal');
    const openBtn = document.getElementById('btn-open-settings');
    const closeBtn = document.getElementById('btn-close-settings');
    const closeFooterBtn = document.getElementById('btn-close-settings-footer');
    const backdrop = settingsModal?.querySelector('.app-dialog-backdrop');
    const reloadBtn = document.getElementById('btn-settings-reload');
    const clearCacheBtn = document.getElementById('btn-settings-clear-cache');
    const envBadge = document.getElementById('settings-env-badge');
    const versionBadge = document.getElementById('settings-version-badge');

    // Update Environment status in settings
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
    if (envBadge) {
      envBadge.textContent = isStandalone ? 'PWA Installed (Standalone Mode)' : 'Web Browser / Online Mode';
    }
    if (versionBadge) {
      versionBadge.textContent = `v${APP_VERSION}`;
    }

    const openSettings = () => {
      if (!settingsModal) return;
      settingsModal.classList.remove('hidden');
      requestAnimationFrame(() => settingsModal.classList.remove('opacity-0'));
    };

    const closeSettings = () => {
      if (!settingsModal) return;
      settingsModal.classList.add('opacity-0');
      setTimeout(() => settingsModal.classList.add('hidden'), 200);
    };

    openBtn?.addEventListener('click', openSettings);
    closeBtn?.addEventListener('click', closeSettings);
    closeFooterBtn?.addEventListener('click', closeSettings);
    backdrop?.addEventListener('click', closeSettings);

    // Reload button: checks service worker, clears PWA cache, reloads, and flags popup
    reloadBtn?.addEventListener('click', async () => {
      const originalHTML = reloadBtn.innerHTML;
      reloadBtn.innerHTML = `
        <div class="flex items-center gap-3 text-left">
          <div class="w-8 h-8 rounded-lg bg-brand-500/20 flex items-center justify-center text-brand-400 animate-spin">
            <i data-lucide="refresh-cw" class="w-4 h-4"></i>
          </div>
          <div>
            <div class="text-sm font-semibold text-white">Checking & Updating...</div>
            <div class="text-xs text-slate-400">Purging cache and synchronizing Service Worker...</div>
          </div>
        </div>
      `;
      if (window.lucide) window.lucide.createIcons();

      try {
        // 1. Service Worker update check & skip waiting
        if ('serviceWorker' in navigator) {
          const registrations = await navigator.serviceWorker.getRegistrations();
          for (const reg of registrations) {
            await reg.update();
            if (reg.waiting) {
              reg.waiting.postMessage({ type: 'SKIP_WAITING' });
            }
            if (reg.active) {
              reg.active.postMessage({ type: 'CLEAR_CACHE' });
            }
          }
        }

        // 2. Clear browser CacheStorage directly
        if ('caches' in window) {
          const keys = await caches.keys();
          await Promise.all(keys.map((key) => caches.delete(key)));
        }

        // 3. Mark update notice flag in sessionStorage
        sessionStorage.setItem('lyricflow_updated_popup', APP_VERSION);

        // 4. Force reload page
        window.location.reload(true);
      } catch (err) {
        console.error('Update check failed:', err);
        reloadBtn.innerHTML = originalHTML;
        if (window.lucide) window.lucide.createIcons();
        await this.showAppAlert({
          title: 'Update Notice',
          message: `Update check completed: ${err.message || 'Cache cleared.'}. Reloading...`,
          type: 'info'
        });
        window.location.reload(true);
      }
    });

    // Clear Cache & Reset Data
    clearCacheBtn?.addEventListener('click', async () => {
      const confirmed = await this.showAppConfirm({
        title: 'Empty PWA Cache & Storage?',
        message: 'This will purge all offline cached assets and reset application cache. The page will then reload immediately.',
        confirmText: 'Empty Cache & Reload',
        cancelText: 'Cancel',
        isDanger: true
      });

      if (confirmed) {
        if ('caches' in window) {
          const keys = await caches.keys();
          await Promise.all(keys.map((k) => caches.delete(k)));
        }
        sessionStorage.setItem('lyricflow_updated_popup', APP_VERSION);
        window.location.reload(true);
      }
    });

    // Toast Close Button
    document.getElementById('toast-close-btn')?.addEventListener('click', () => {
      const toast = document.getElementById('toast');
      if (toast) {
        toast.classList.remove('translate-y-0', 'opacity-100');
        toast.classList.add('translate-y-20', 'opacity-0');
      }
    });
  }

  // ==========================================
  // 10B. PIXABAY REST API SETTINGS
  // ==========================================
  _setupPixabaySettings() {
    const keyInput = document.getElementById('settings-pixabay-key-input');
    const toggleBtn = document.getElementById('btn-toggle-pixabay-key');
    const saveBtn = document.getElementById('btn-save-pixabay-key');
    const statusBadge = document.getElementById('pixabay-status-badge');
    const keyHint = document.getElementById('pixabay-key-hint');

    const updateStatusUI = (status, text) => {
      if (!statusBadge) return;
      if (status === 'connected') {
        statusBadge.className = 'px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1';
        statusBadge.innerHTML = '<span class="w-1.5 h-1.5 rounded-full bg-emerald-400"></span> Connected';
        if (keyHint) keyHint.textContent = text || 'Pixabay API Key is connected and ready to search.';
      } else if (status === 'invalid') {
        statusBadge.className = 'px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-red-500/20 text-red-300 border border-red-500/40';
        statusBadge.textContent = 'Invalid Key';
        if (keyHint) keyHint.textContent = text || 'Verification failed. Please check your Pixabay API key.';
      } else if (status === 'testing') {
        statusBadge.className = 'px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-brand-500/20 text-brand-300 border border-brand-500/40';
        statusBadge.textContent = 'Testing...';
      } else {
        statusBadge.className = 'px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-slate-800 text-slate-400 border border-slate-700';
        statusBadge.textContent = 'Not Configured';
        if (keyHint) keyHint.textContent = 'Saved in browser local storage.';
      }
    };

    // Load initial key from localStorage
    const savedKey = this.pixabay.getApiKey();
    if (keyInput) keyInput.value = savedKey;
    if (savedKey) {
      updateStatusUI('connected', 'Key loaded from browser storage.');
    } else {
      updateStatusUI('empty');
    }

    // Toggle show/hide password
    toggleBtn?.addEventListener('click', () => {
      if (!keyInput) return;
      const isPassword = keyInput.type === 'password';
      keyInput.type = isPassword ? 'text' : 'password';
      toggleBtn.innerHTML = isPassword ? '<i data-lucide="eye-off" class="w-3.5 h-3.5"></i>' : '<i data-lucide="eye" class="w-3.5 h-3.5"></i>';
      if (window.lucide) window.lucide.createIcons();
    });

    // Save & Test Key
    saveBtn?.addEventListener('click', async () => {
      const val = keyInput?.value?.trim() || '';
      if (!val) {
        this.pixabay.saveApiKey('');
        updateStatusUI('empty');
        this.showToast('Pixabay API Key cleared', 'info');
        return;
      }

      updateStatusUI('testing');
      saveBtn.disabled = true;
      try {
        const testRes = await this.pixabay.testApiKey(val);
        if (testRes.success) {
          this.pixabay.saveApiKey(val);
          updateStatusUI('connected', `Verified! (${testRes.totalHits.toLocaleString()} results accessible)`);
          this.showToast('✨ Pixabay API Key verified & saved!', 'success');
        } else {
          updateStatusUI('invalid', testRes.error);
          this.showToast(`Pixabay test failed: ${testRes.error}`, 'error');
        }
      } catch (err) {
        updateStatusUI('invalid', err.message);
        this.showToast(`Error testing key: ${err.message}`, 'error');
      } finally {
        saveBtn.disabled = false;
      }
    });
  }

  // ==========================================
  // 10C. PIXABAY MEDIA BROWSER MODAL
  // ==========================================
  _setupPixabayModal() {
    const modal = document.getElementById('pixabay-modal');
    const openBtn1 = document.getElementById('btn-open-pixabay-modal');
    const openBtn2 = document.getElementById('btn-quick-pixabay');
    const closeBtn = document.getElementById('btn-close-pixabay-modal');
    const closeFooterBtn = document.getElementById('btn-close-pixabay-modal-footer');
    const backdrop = document.getElementById('pixabay-backdrop');

    // Left Panel: Song Lyrics Container & Selection Facility
    const lyricsContainer = document.getElementById('pixabay-lyrics-container');
    const selectionBar = document.getElementById('pixabay-selection-bar');
    const selectedTextPreview = document.getElementById('pixabay-selected-text-preview');
    const searchSelectedBtn = document.getElementById('btn-search-selected-lyrics');

    // Right Panel: Search Form & Filters
    const searchForm = document.getElementById('pixabay-search-form');
    const searchInput = document.getElementById('pixabay-search-input');
    const clearSearchBtn = document.getElementById('btn-clear-pixabay-search');

    const btnTypeImages = document.getElementById('pixabay-type-images');
    const btnTypeVideos = document.getElementById('pixabay-type-videos');
    const orientationSelect = document.getElementById('pixabay-filter-orientation');
    const categorySelect = document.getElementById('pixabay-filter-category');
    const editorsChoiceCheckbox = document.getElementById('pixabay-filter-editors-choice');

    const resultsGrid = document.getElementById('pixabay-results-grid');
    const loadingSpinner = document.getElementById('pixabay-loading-spinner');
    const emptyState = document.getElementById('pixabay-empty-state');
    const emptyTitle = document.getElementById('pixabay-empty-title');
    const emptyDesc = document.getElementById('pixabay-empty-desc');

    const resultsCountLabel = document.getElementById('pixabay-results-count-label');
    const pagination = document.getElementById('pixabay-pagination');
    const prevPageBtn = document.getElementById('btn-pixabay-prev-page');
    const nextPageBtn = document.getElementById('btn-pixabay-next-page');
    const pageInfo = document.getElementById('pixabay-page-info');

    const addSelectedSlideshowBtn = document.getElementById('btn-pixabay-add-selected-slideshow');
    const selectedCountLabel = document.getElementById('pixabay-selected-count-label');
    const downloadSelectedDiskBtn = document.getElementById('btn-pixabay-download-selected-disk');
    const downloadCountLabel = document.getElementById('pixabay-download-count-label');

    let mediaType = 'images'; // 'images' or 'videos'
    let currentPage = 1;
    let totalHits = 0;
    const perPage = 24;
    const selectedImages = new Map(); // id -> hit

    const updateSelectedSlideshowUI = () => {
      const count = selectedImages.size;
      if (count > 0 && mediaType === 'images') {
        if (addSelectedSlideshowBtn) {
          addSelectedSlideshowBtn.classList.remove('hidden');
          if (selectedCountLabel) selectedCountLabel.textContent = `Add (${count}) to Slideshow`;
        }
        if (downloadSelectedDiskBtn) {
          downloadSelectedDiskBtn.classList.remove('hidden');
          if (downloadCountLabel) downloadCountLabel.textContent = `Save (${count}) to Computer`;
        }
      } else {
        if (addSelectedSlideshowBtn) addSelectedSlideshowBtn.classList.add('hidden');
        if (downloadSelectedDiskBtn) downloadSelectedDiskBtn.classList.add('hidden');
      }
    };

    const updateMediaTypeUI = (type) => {
      mediaType = type;
      if (type === 'images') {
        btnTypeImages?.classList.add('bg-brand-600', 'text-white');
        btnTypeImages?.classList.remove('text-slate-400');
        btnTypeVideos?.classList.remove('bg-brand-600', 'text-white');
        btnTypeVideos?.classList.add('text-slate-400');
      } else {
        btnTypeVideos?.classList.add('bg-brand-600', 'text-white');
        btnTypeVideos?.classList.remove('text-slate-400');
        btnTypeImages?.classList.remove('bg-brand-600', 'text-white');
        btnTypeImages?.classList.add('text-slate-400');
      }
      selectedImages.clear();
      updateSelectedSlideshowUI();
    };

    btnTypeImages?.addEventListener('click', () => {
      updateMediaTypeUI('images');
      executeSearch(1);
    });

    btnTypeVideos?.addEventListener('click', () => {
      updateMediaTypeUI('videos');
      executeSearch(1);
    });

    orientationSelect?.addEventListener('change', () => executeSearch(1));
    categorySelect?.addEventListener('change', () => executeSearch(1));
    editorsChoiceCheckbox?.addEventListener('change', () => executeSearch(1));

    // Clear search
    clearSearchBtn?.addEventListener('click', () => {
      if (searchInput) searchInput.value = '';
      clearSearchBtn.classList.add('hidden');
      searchInput?.focus();
    });

    searchInput?.addEventListener('input', () => {
      if (clearSearchBtn) {
        clearSearchBtn.classList.toggle('hidden', !searchInput.value);
      }
    });

    // Populate Lyrics in the Left Container
    const populateLyricsContainer = () => {
      if (!lyricsContainer) return;
      const lyricsText = (this.lyrics?.rawText || '').trim();
      if (lyricsText) {
        lyricsContainer.textContent = lyricsText;
        lyricsContainer.classList.remove('italic', 'text-slate-500');
      } else {
        lyricsContainer.textContent = 'No lyrics loaded yet. Go to Step 2 to add or load your song lyrics, or type a search query on the right.';
        lyricsContainer.classList.add('italic', 'text-slate-500');
      }
      if (selectionBar) {
        selectionBar.classList.add('hidden');
        selectionBar.classList.remove('flex');
      }
    };

    // Text Selection Event Handler for Lyrics
    const handleLyricsSelection = () => {
      const selection = window.getSelection();
      const selectedText = selection ? selection.toString().trim() : '';
      if (selectedText && selectedText.length > 0) {
        if (searchInput) {
          searchInput.value = selectedText;
          clearSearchBtn?.classList.remove('hidden');
        }
        if (selectedTextPreview) {
          selectedTextPreview.textContent = selectedText;
        }
        if (selectionBar) {
          selectionBar.classList.remove('hidden');
          selectionBar.classList.add('flex');
        }
      }
    };

    lyricsContainer?.addEventListener('mouseup', handleLyricsSelection);
    lyricsContainer?.addEventListener('keyup', handleLyricsSelection);
    lyricsContainer?.addEventListener('touchend', handleLyricsSelection);

    searchSelectedBtn?.addEventListener('click', () => {
      executeSearch(1);
    });

    // Auto-match project aspect ratio to orientation filter
    const syncOrientationWithAspectRatio = () => {
      if (!orientationSelect) return;
      const ratio = this.renderer?.aspectRatio || '16-9';
      if (ratio === '9-16') {
        orientationSelect.value = 'vertical';
      } else {
        orientationSelect.value = 'horizontal';
      }
    };

    // Execute Pixabay API search
    const executeSearch = async (page = 1) => {
      const query = (searchInput?.value || '').trim();

      if (!this.pixabay.hasApiKey()) {
        if (emptyState) emptyState.classList.remove('hidden');
        if (emptyTitle) emptyTitle.textContent = 'API Key Required';
        if (emptyDesc) emptyDesc.innerHTML = 'Please enter your free Pixabay API Key in <a href="#" id="pixabay-open-settings-link" class="text-brand-400 underline font-semibold">Settings</a> to start searching.';
        if (resultsGrid) resultsGrid.innerHTML = '';
        if (pagination) pagination.classList.add('hidden');
        if (resultsCountLabel) resultsCountLabel.textContent = '';
        document.getElementById('pixabay-open-settings-link')?.addEventListener('click', (e) => {
          e.preventDefault();
          closeModal();
          document.getElementById('btn-open-settings')?.click();
        });
        return;
      }

      currentPage = page;
      loadingSpinner?.classList.remove('hidden');

      try {
        const results = await this.pixabay.search({
          query,
          mediaType,
          orientation: orientationSelect?.value || 'horizontal',
          category: categorySelect?.value || '',
          page: currentPage,
          perPage,
          editorsChoice: editorsChoiceCheckbox?.checked || false
        });

        totalHits = results.totalHits;
        renderResults(results);
      } catch (err) {
        console.error('Pixabay search error:', err);
        if (resultsGrid) resultsGrid.innerHTML = '';
        if (emptyState) emptyState.classList.remove('hidden');
        if (emptyTitle) emptyTitle.textContent = 'Search Failed';
        if (emptyDesc) emptyDesc.textContent = err.message || 'Could not load Pixabay results.';
        if (pagination) pagination.classList.add('hidden');
        if (resultsCountLabel) resultsCountLabel.textContent = '';
        this.showToast(err.message, 'error');
      } finally {
        loadingSpinner?.classList.add('hidden');
      }
    };

    // Render search results cards
    const renderResults = (results) => {
      if (!resultsGrid) return;
      resultsGrid.innerHTML = '';

      if (!results.hits || results.hits.length === 0) {
        if (emptyState) emptyState.classList.remove('hidden');
        if (emptyTitle) emptyTitle.textContent = 'No Results Found';
        if (emptyDesc) emptyDesc.textContent = `No ${mediaType} matched "${searchInput?.value}". Try another keyword.`;
        if (pagination) pagination.classList.add('hidden');
        if (resultsCountLabel) resultsCountLabel.textContent = '0 results';
        return;
      }

      if (emptyState) emptyState.classList.add('hidden');

      // Update count & pagination
      const totalPages = Math.ceil(Math.min(totalHits, 500) / perPage);
      if (resultsCountLabel) {
        resultsCountLabel.textContent = `${totalHits.toLocaleString()} results found`;
      }
      if (pagination) {
        pagination.classList.toggle('hidden', totalPages <= 1);
        pagination.classList.toggle('flex', totalPages > 1);
        if (pageInfo) pageInfo.textContent = `Page ${currentPage} of ${totalPages}`;
        if (prevPageBtn) prevPageBtn.disabled = currentPage <= 1;
        if (nextPageBtn) nextPageBtn.disabled = currentPage >= totalPages;
      }

      // Populate cards
      results.hits.forEach((hit) => {
        const card = document.createElement('div');
        card.className = 'group relative rounded-xl overflow-hidden bg-slate-900 border border-slate-800 hover:border-brand-500/60 transition shadow-md flex flex-col justify-between';

        const isVideo = results.isVideo;
        const thumbUrl = isVideo ? (hit.videos?.tiny?.thumbnail || hit.userImageURL) : hit.webformatURL;
        const durationSec = isVideo ? hit.duration : null;

        // Card Image & Overlays
        const imgContainer = document.createElement('div');
        imgContainer.className = 'relative aspect-video bg-slate-950 overflow-hidden';

        const img = document.createElement('img');
        img.src = thumbUrl;
        img.alt = hit.tags || 'Pixabay media';
        img.className = 'w-full h-full object-cover transition duration-300 group-hover:scale-105';
        img.loading = 'lazy';
        imgContainer.appendChild(img);

        // Selection checkbox for Images (for batch slideshow or download)
        if (!isVideo) {
          const selectCheck = document.createElement('button');
          selectCheck.type = 'button';
          const isSelected = selectedImages.has(hit.id);
          selectCheck.className = `absolute top-1.5 left-1.5 w-5 h-5 rounded-md flex items-center justify-center transition border ${isSelected ? 'bg-brand-600 border-brand-400 text-white' : 'bg-slate-950/70 border-slate-600 text-transparent hover:border-white'}`;
          selectCheck.innerHTML = '<i data-lucide="check" class="w-3 h-3"></i>';
          selectCheck.title = 'Select image for batch slideshow';
          selectCheck.addEventListener('click', (e) => {
            e.stopPropagation();
            if (selectedImages.has(hit.id)) {
              selectedImages.delete(hit.id);
              selectCheck.className = 'absolute top-1.5 left-1.5 w-5 h-5 rounded-md flex items-center justify-center transition border bg-slate-950/70 border-slate-600 text-transparent hover:border-white';
            } else {
              selectedImages.set(hit.id, hit);
              selectCheck.className = 'absolute top-1.5 left-1.5 w-5 h-5 rounded-md flex items-center justify-center transition border bg-brand-600 border-brand-400 text-white';
            }
            updateSelectedSlideshowUI();
          });
          imgContainer.appendChild(selectCheck);
        }

        // Video Duration Badge
        if (isVideo && durationSec) {
          const durationBadge = document.createElement('span');
          durationBadge.className = 'absolute bottom-1.5 right-1.5 px-1.5 py-0.5 rounded bg-black/80 text-[10px] font-mono text-white font-bold flex items-center gap-1';
          durationBadge.innerHTML = `<i data-lucide="video" class="w-2.5 h-2.5 text-brand-400"></i> ${durationSec}s`;
          imgContainer.appendChild(durationBadge);
        }

        card.appendChild(imgContainer);

        // Info / Tag bar & Quick Add Action
        const infoBar = document.createElement('div');
        infoBar.className = 'p-2 flex items-center justify-between gap-1.5 bg-slate-900 border-t border-slate-800/80';

        const tagsSpan = document.createElement('span');
        tagsSpan.className = 'text-[10px] text-slate-400 truncate flex-1 font-medium';
        tagsSpan.textContent = hit.tags ? hit.tags.split(',').slice(0, 2).join(', ') : (isVideo ? 'Video' : 'Photo');
        tagsSpan.title = hit.tags;

        // Action Buttons Container
        const actionsBox = document.createElement('div');
        actionsBox.className = 'flex items-center gap-1 shrink-0';

        // 1. Download to Computer Disk Button
        const diskBtn = document.createElement('button');
        diskBtn.type = 'button';
        diskBtn.className = 'px-1.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-cyan-400 text-[10px] font-medium transition cursor-pointer flex items-center gap-1';
        diskBtn.title = 'Save to computer disk (keep in song folder)';
        diskBtn.innerHTML = '<i data-lucide="download" class="w-3 h-3"></i>';
        diskBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          handleDownloadAsset(hit, isVideo);
        });
        actionsBox.appendChild(diskBtn);

        // 2. Add to Media Pool Button
        const addBtn = document.createElement('button');
        addBtn.type = 'button';
        addBtn.className = 'px-2 py-1 rounded bg-brand-600/90 hover:bg-brand-500 text-white text-[10px] font-semibold transition cursor-pointer flex items-center gap-1';
        addBtn.title = isVideo ? 'Add video to Media Pool' : 'Add image as active background';
        addBtn.innerHTML = '<i data-lucide="plus" class="w-3 h-3"></i> Add';
        addBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          handleAddAsset(hit, isVideo);
        });
        actionsBox.appendChild(addBtn);

        // 3. For images: Add Single to Slideshow
        if (!isVideo) {
          const slideBtn = document.createElement('button');
          slideBtn.type = 'button';
          slideBtn.className = 'px-1.5 py-1 rounded bg-indigo-600/80 hover:bg-indigo-500 text-white text-[10px] font-semibold transition cursor-pointer flex items-center gap-1';
          slideBtn.title = 'Append directly to Image Slideshow';
          slideBtn.innerHTML = '<i data-lucide="layers" class="w-3 h-3"></i>';
          slideBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            handleAddSingleSlide(hit);
          });
          actionsBox.appendChild(slideBtn);
        }

        infoBar.appendChild(tagsSpan);
        infoBar.appendChild(actionsBox);
        card.appendChild(infoBar);

        resultsGrid.appendChild(card);
      });

      if (window.lucide) window.lucide.createIcons();
    };

    // Asset Import: single image or video into mediaPool assets
    const handleAddAsset = async (hit, isVideo) => {
      this.showToast(`Importing ${isVideo ? 'video' : 'image'} from Pixabay...`, 'info', 2000);
      try {
        const targetUrl = isVideo ? (hit.videos?.large?.url || hit.videos?.medium?.url || hit.videos?.small?.url) : hit.largeImageURL || hit.webformatURL;
        const blob = await this.pixabay.fetchAsBlob(targetUrl);
        const ext = isVideo ? 'mp4' : 'jpg';
        const file = new File([blob], `pixabay_${hit.id}.${ext}`, { type: blob.type || (isVideo ? 'video/mp4' : 'image/jpeg') });
        const asset = await this.mediaPool.addFile(file);
        this.mediaPool.setActiveAsset(asset.id);
        this._renderBgPool();
        this._syncStylePreview();
        this.showToast(`✨ Added "${asset.name}" to Media Pool!`, 'success');
      } catch (err) {
        console.error('Import error:', err);
        this.showToast(`Failed to load media: ${err.message}`, 'error');
      }
    };

    // Asset Import: add single image to slideshow
    const handleAddSingleSlide = async (hit) => {
      this.showToast('Adding slide to slideshow...', 'info', 1500);
      try {
        const blob = await this.pixabay.fetchAsBlob(hit.largeImageURL || hit.webformatURL);
        const file = new File([blob], `slide_${hit.id}.jpg`, { type: blob.type || 'image/jpeg' });
        await this.mediaPool.addSlideshowFiles([file]);
        this.mediaPool.setSlideshowMode(true);
        this._updateSlideshowUI();
        this._renderBgPool();
        this._syncStylePreview();
        this.showToast('✨ Added to Image Slideshow!', 'success');
      } catch (err) {
        this.showToast(`Failed to add slide: ${err.message}`, 'error');
      }
    };

    // Download asset directly to user's computer disk
    const handleDownloadAsset = async (hit, isVideo) => {
      this.showToast(`Downloading ${isVideo ? 'video' : 'image'} to your computer...`, 'info', 2000);
      try {
        const targetUrl = isVideo ? (hit.videos?.large?.url || hit.videos?.medium?.url || hit.videos?.small?.url) : hit.largeImageURL || hit.webformatURL;
        const blob = await this.pixabay.fetchAsBlob(targetUrl);
        const ext = isVideo ? 'mp4' : 'jpg';
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `pixabay_${hit.id}.${ext}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        this.showToast(`✨ Saved pixabay_${hit.id}.${ext} to your computer! Move to your song folder anytime.`, 'success', 3500);
      } catch (err) {
        console.error('Download error:', err);
        this.showToast(`Download failed: ${err.message}`, 'error');
      }
    };

    // Asset Import: batch selected images into slideshow
    addSelectedSlideshowBtn?.addEventListener('click', async () => {
      const items = Array.from(selectedImages.values());
      if (items.length === 0) return;

      this.showToast(`Downloading ${items.length} images for slideshow...`, 'info', 3000);
      try {
        const files = [];
        for (let i = 0; i < items.length; i++) {
          const hit = items[i];
          const blob = await this.pixabay.fetchAsBlob(hit.largeImageURL || hit.webformatURL);
          const file = new File([blob], `slide_${String(i + 1).padStart(2, '0')}_${hit.id}.jpg`, { type: blob.type || 'image/jpeg' });
          files.push(file);
        }

        await this.mediaPool.addSlideshowFiles(files);
        this.mediaPool.setSlideshowMode(true);
        this._updateSlideshowUI();
        this._renderBgPool();
        this._syncStylePreview();

        selectedImages.clear();
        updateSelectedSlideshowUI();
        closeModal();
        this.showToast(`🎉 Imported ${files.length} slides from Pixabay! Slideshow is active.`, 'success', 3500);
      } catch (err) {
        console.error('Batch import error:', err);
        this.showToast(`Batch import failed: ${err.message}`, 'error');
      }
    });

    // Batch download selected images directly to user's computer disk
    downloadSelectedDiskBtn?.addEventListener('click', async () => {
      const items = Array.from(selectedImages.values());
      if (items.length === 0) return;

      this.showToast(`Downloading ${items.length} images to your computer...`, 'info', 2500);
      try {
        for (let i = 0; i < items.length; i++) {
          const hit = items[i];
          const blob = await this.pixabay.fetchAsBlob(hit.largeImageURL || hit.webformatURL);
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `slide_${String(i + 1).padStart(2, '0')}_pixabay_${hit.id}.jpg`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
          await new Promise(r => setTimeout(r, 200));
        }
        this.showToast(`🎉 Downloaded ${items.length} images! You can now place them in a folder and load with "Select Folder".`, 'success', 4000);
      } catch (err) {
        console.error('Batch download error:', err);
        this.showToast(`Batch download failed: ${err.message}`, 'error');
      }
    });

    // Pagination handlers
    prevPageBtn?.addEventListener('click', () => {
      if (currentPage > 1) executeSearch(currentPage - 1);
    });

    nextPageBtn?.addEventListener('click', () => {
      executeSearch(currentPage + 1);
    });

    // Form submit
    searchForm?.addEventListener('submit', (e) => {
      e.preventDefault();
      executeSearch(1);
    });

    // Open Modal
    const openModal = () => {
      if (!modal) return;
      populateLyricsContainer();
      syncOrientationWithAspectRatio();
      modal.classList.remove('hidden');
      requestAnimationFrame(() => modal.classList.remove('opacity-0'));

      // If search input is empty, pick first theme keyword
      if (!searchInput?.value.trim()) {
        const audioName = this.audio?.audioFile?.name || '';
        const keywords = this.pixabay.extractSongKeywords(audioName, this.lyrics?.rawText || '');
        if (keywords.length > 0) {
          searchInput.value = keywords[0];
          clearSearchBtn?.classList.remove('hidden');
        }
      }

      // If user has key and hasn't searched yet, auto-run search
      if (this.pixabay.hasApiKey() && resultsGrid?.children.length === 0) {
        executeSearch(1);
      } else if (!this.pixabay.hasApiKey()) {
        executeSearch(1);
      }
    };

    // Close Modal
    const closeModal = () => {
      if (!modal) return;
      modal.classList.add('opacity-0');
      setTimeout(() => modal.classList.add('hidden'), 200);
    };

    openBtn1?.addEventListener('click', openModal);
    openBtn2?.addEventListener('click', openModal);
    closeBtn?.addEventListener('click', closeModal);
    closeFooterBtn?.addEventListener('click', closeModal);
    backdrop?.addEventListener('click', closeModal);

    // Escape listener
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !modal?.classList.contains('hidden')) {
        closeModal();
      }
    });
  }

  // ==========================================
  // 12. VERSION UPDATE NOTIFICATION POPUP
  // ==========================================
  _checkAppVersionUpdate() {
    // Dynamically update on-screen version badges
    const headerBadge = document.getElementById('app-version-badge');
    if (headerBadge) headerBadge.textContent = `v${APP_VERSION}`;
    const settingsBadge = document.getElementById('settings-version-badge');
    if (settingsBadge) settingsBadge.textContent = `v${APP_VERSION}`;

    const updatedPopupFlag = sessionStorage.getItem('lyricflow_updated_popup');
    const storedVersion = localStorage.getItem('lyricflow_app_version');

    if (updatedPopupFlag) {
      sessionStorage.removeItem('lyricflow_updated_popup');
      localStorage.setItem('lyricflow_app_version', APP_VERSION);
      setTimeout(() => {
        this.showAppAlert({
          title: 'Application Updated',
          message: `✨ LyricFlow Studio has successfully loaded the newest version (v${APP_VERSION}) with refreshed caches!`,
          type: 'success',
          confirmText: 'Awesome'
        });
      }, 350);
    } else if (storedVersion && storedVersion !== APP_VERSION) {
      localStorage.setItem('lyricflow_app_version', APP_VERSION);
      setTimeout(() => {
        this.showAppAlert({
          title: 'LyricFlow Studio Updated',
          message: `🎉 Updated to version v${APP_VERSION}! You are now enjoying the latest performance enhancements and features.`,
          type: 'success',
          confirmText: 'Got it'
        });
      }, 350);
    } else {
      localStorage.setItem('lyricflow_app_version', APP_VERSION);
    }
  }

  // ==========================================
  // 12. VIDEO & VISUALIZER SPEED CONTROLS
  // ==========================================
  _syncStudioSpeedUI(speed) {
    const studioSlider = document.getElementById('studio-video-speed-slider');
    const studioVal = document.getElementById('studio-video-speed-val');
    const presetBtns = document.querySelectorAll('.btn-studio-speed-preset');

    const formatSpeed = (s) => {
      if (Math.abs(s - 0.05) < 0.01) return '0.05x (Zen Ultra Slow)';
      if (Math.abs(s - 0.10) < 0.02) return '0.10x (Very Slow)';
      if (Math.abs(s - 0.125) < 0.005) return '0.125x (1/8 speed)';
      if (Math.abs(s - 0.25) < 0.02) return '0.25x (1/4 speed)';
      if (Math.abs(s - 0.5) < 0.02) return '0.50x (1/2 speed)';
      if (Math.abs(s - 0.75) < 0.02) return '0.75x (3/4 speed)';
      if (Math.abs(s - 1.0) < 0.02) return '1.00x (Normal speed)';
      if (Math.abs(s - 1.5) < 0.02) return '1.50x';
      if (Math.abs(s - 2.0) < 0.02) return '2.00x';
      return `${s.toFixed(2)}x`;
    };

    const applied = this.mediaPool.setVideoSpeed(speed);
    if (studioSlider) studioSlider.value = applied;
    if (studioVal) studioVal.textContent = formatSpeed(applied);

    presetBtns.forEach((btn) => {
      const btnSpeed = parseFloat(btn.dataset.speed);
      if (Math.abs(btnSpeed - applied) < 0.02) {
        btn.classList.add('active', 'bg-brand-600', 'text-white', 'border-brand-500');
        btn.classList.remove('bg-slate-800', 'text-slate-300', 'border-slate-700');
      } else {
        btn.classList.remove('active', 'bg-brand-600', 'text-white', 'border-brand-500');
        btn.classList.add('bg-slate-800', 'text-slate-300', 'border-slate-700');
      }
    });
  }

  _setupVideoSpeedControls() {
    const studioSlider = document.getElementById('studio-video-speed-slider');
    const presetBtns = document.querySelectorAll('.btn-studio-speed-preset');

    const updateSpeedUI = (speed, showFeedback = false) => {
      const parsedSpeed = Number(speed) || 1.0;
      this._syncStudioSpeedUI(parsedSpeed);

      if (showFeedback) {
        const studioVal = document.getElementById('studio-video-speed-val');
        this.showToast(`Background speed: ${studioVal?.textContent || parsedSpeed + 'x'}`, 'info', 1500);
      }
    };

    studioSlider?.addEventListener('input', (e) => {
      updateSpeedUI(parseFloat(e.target.value));
    });
    studioSlider?.addEventListener('change', (e) => {
      updateSpeedUI(parseFloat(e.target.value), true);
    });

    presetBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        const speed = parseFloat(btn.dataset.speed);
        updateSpeedUI(speed, true);
      });
    });
  }

  _updateTapPointsOverlayUI() {
    const tapOverlay = document.getElementById('tap-points-overlay');
    const tapPointsCount = document.getElementById('tap-points-count');
    const tapPointsList = document.getElementById('tap-points-list');
    const points = this.stylePreviewRenderer ? this.stylePreviewRenderer.getTapPoints() : [];

    if (tapPointsCount) tapPointsCount.textContent = `${points.length} / 6`;

    if (tapOverlay) {
      tapOverlay.innerHTML = '';
      points.forEach((pt, idx) => {
        const pin = document.createElement('div');
        pin.className = 'tap-point-marker';
        pin.style.left = `${pt.x * 100}%`;
        pin.style.top = `${pt.y * 100}%`;
        pin.textContent = `${idx + 1}`;
        tapOverlay.appendChild(pin);
      });
    }

    if (tapPointsList) {
      if (points.length === 0) {
        tapPointsList.innerHTML = `<span class="text-[11px] text-slate-500 italic">No tap points set yet. Click preview screen.</span>`;
      } else {
        tapPointsList.innerHTML = points.map((pt, idx) => `
          <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-brand-500/20 text-brand-300 border border-brand-500/30 text-[10px] font-mono font-bold">
            <span class="w-3.5 h-3.5 rounded-full bg-brand-500 text-white flex items-center justify-center text-[9px]">${idx + 1}</span>
            ${Math.round(pt.x * 100)}%, ${Math.round(pt.y * 100)}%
          </span>
        `).join('');
      }
    }
  }

  // ==========================================
  // 14. PROJECT & RECORDING SESSION PERSISTENCE
  // ==========================================
  _setupProjectPersistenceControls() {
    // Header Buttons -> Direct to Disk
    document.getElementById('btn-save-project')?.addEventListener('click', () => {
      this.exportProjectJSON();
    });

    document.getElementById('btn-load-project')?.addEventListener('click', () => {
      this.triggerLoadFromDisk();
    });

    // Step 4 Live Studio Toolbar Buttons -> Direct to Disk
    document.getElementById('btn-studio-save-session')?.addEventListener('click', () => {
      this.exportProjectJSON();
    });

    document.getElementById('btn-studio-reload-session')?.addEventListener('click', () => {
      this.triggerLoadFromDisk();
    });

    // Settings Modal Buttons -> Direct to Disk
    document.getElementById('btn-settings-save-project')?.addEventListener('click', () => {
      this.exportProjectJSON();
      document.getElementById('settings-modal')?.classList.add('hidden');
    });

    document.getElementById('btn-settings-load-project')?.addEventListener('click', () => {
      this.triggerLoadFromDisk();
      document.getElementById('settings-modal')?.classList.add('hidden');
    });

    const fileInput = document.getElementById('project-file-input');
    fileInput?.addEventListener('change', (e) => {
      const file = e.target.files && e.target.files[0];
      if (file) {
        this.importProjectJSON(file);
      }
    });
  }

  triggerLoadFromDisk() {
    const fileInput = document.getElementById('project-file-input');
    if (fileInput) {
      fileInput.value = '';
      fileInput.click();
    }
  }

  saveProjectState(showNotification = true) {
    const limitMode = document.getElementById('recording-limit-mode')?.value || 'audio_end';
    const customSec = parseInt(document.getElementById('recording-custom-sec-input')?.value, 10) || 30;

    const projectData = {
      app: 'LyricFlow Studio',
      version: APP_VERSION,
      savedAt: new Date().toISOString(),
      lyrics: {
        rawText: this.lyrics.rawText || '',
        delimitationMode: this.lyrics.delimitationMode || 'line-by-line',
        cues: this.lyrics.cues || []
      },
      style: {
        aspectRatio: this.renderer.aspectRatio,
        fontFamily: this.renderer.style.fontFamily,
        fontWeight: this.renderer.style.fontWeight,
        isItalic: this.renderer.style.isItalic,
        isUppercase: this.renderer.style.isUppercase,
        fontSize: this.renderer.style.fontSize,
        maxWidthPercent: this.renderer.style.maxWidthPercent,
        textColor: this.renderer.style.textColor,
        strokeColor: this.renderer.style.strokeColor,
        strokeWidth: this.renderer.style.strokeWidth,
        shadowColor: this.renderer.style.shadowColor,
        shadowBlur: this.renderer.style.shadowBlur,
        boxColor: this.renderer.style.boxColor,
        boxOpacity: this.renderer.style.boxOpacity,
        positionMode: this.renderer.style.positionMode,
        verticalAlign: this.renderer.style.verticalAlign,
        textAlign: this.renderer.style.textAlign,
        transitionType: this.renderer.style.transitionType || 'crossfade',
        transitionSpeed: this.renderer.style.transitionSpeed || 0.4,
        tapPoints: this.renderer.getTapPoints()
      },
      studio: {
        videoSpeed: this.mediaPool.getVideoSpeed(),
        recordingLimitMode: limitMode,
        recordingCustomSec: customSec,
        customMaxDuration: this.customMaxDuration,
        activeBgId: this.mediaPool.activeAssetId
      }
    };

    try {
      localStorage.setItem('lyricflow_saved_project', JSON.stringify(projectData));
      if (showNotification) {
        this.showToast('Recording session & project settings saved!', 'success', 2500);
      }
      return projectData;
    } catch (e) {
      console.error('Error saving project state:', e);
      this.showToast('Could not save project state to storage', 'error');
      return null;
    }
  }

  loadProjectState(projectData = null, showNotification = true) {
    let data = projectData;
    if (!data) {
      try {
        const raw = localStorage.getItem('lyricflow_saved_project');
        if (raw) data = JSON.parse(raw);
      } catch (e) {
        console.error('Error loading project state:', e);
      }
    }

    if (!data) {
      this.showToast('No saved project found. Click "Save" first to save your recording settings.', 'warning', 3500);
      return false;
    }

    // 1. Restore Lyrics
    if (data.lyrics) {
      const rawInput = document.getElementById('raw-lyrics-input');
      if (rawInput) rawInput.value = data.lyrics.rawText || '';
      
      this.lyrics.rawText = data.lyrics.rawText || '';
      this.lyrics.delimitationMode = data.lyrics.delimitationMode || 'line-by-line';
      if (data.lyrics.cues && Array.isArray(data.lyrics.cues) && data.lyrics.cues.length > 0) {
        this.lyrics.cues = data.lyrics.cues;
      } else {
        this.lyrics.setRawText(data.lyrics.rawText || '', true);
      }

      document.querySelectorAll('.btn-chunk-rule').forEach((btn) => {
        btn.classList.toggle('active-chunk-rule', btn.getAttribute('data-mode') === this.lyrics.delimitationMode);
      });

      this._updateCueListUI();
      this._updateLyricsSummary();
    }

    // 2. Restore Style & Tap Points
    if (data.style) {
      this._applyStyleToUI(data.style);
    }

    // 3. Restore Studio Settings
    if (data.studio) {
      // Background speed
      if (data.studio.videoSpeed !== undefined) {
        const speed = parseFloat(data.studio.videoSpeed);
        this.mediaPool.setVideoSpeed(speed);
        const studioSlider = document.getElementById('studio-video-speed-slider');
        const studioVal = document.getElementById('studio-video-speed-val');
        if (studioSlider) studioSlider.value = speed;
        if (studioVal) {
          if (Math.abs(speed - 0.125) < 0.005) studioVal.textContent = '0.125x (1/8 speed)';
          else if (Math.abs(speed - 0.25) < 0.005) studioVal.textContent = '0.25x (1/4 speed)';
          else if (Math.abs(speed - 0.5) < 0.005) studioVal.textContent = '0.50x (1/2 speed)';
          else if (Math.abs(speed - 0.75) < 0.005) studioVal.textContent = '0.75x (3/4 speed)';
          else if (Math.abs(speed - 1.0) < 0.005) studioVal.textContent = '1.00x (Normal speed)';
          else studioVal.textContent = `${speed.toFixed(2)}x`;
        }

        document.querySelectorAll('.btn-studio-speed-preset').forEach((btn) => {
          const btnSpeed = parseFloat(btn.dataset.speed);
          if (Math.abs(btnSpeed - speed) < 0.02) {
            btn.classList.add('active', 'bg-brand-600', 'text-white', 'border-brand-500');
            btn.classList.remove('bg-slate-800', 'text-slate-300', 'border-slate-700');
          } else {
            btn.classList.remove('active', 'bg-brand-600', 'text-white', 'border-brand-500');
            btn.classList.add('bg-slate-800', 'text-slate-300', 'border-slate-700');
          }
        });
      }

      // Auto-stop limit
      const limitSelect = document.getElementById('recording-limit-mode');
      const customSecContainer = document.getElementById('recording-custom-sec-container');
      const customSecInput = document.getElementById('recording-custom-sec-input');
      
      if (limitSelect && data.studio.recordingLimitMode) {
        limitSelect.value = data.studio.recordingLimitMode;
        if (data.studio.recordingLimitMode === 'custom') {
          if (customSecContainer) {
            customSecContainer.classList.remove('hidden');
            customSecContainer.classList.add('flex');
          }
          if (customSecInput && data.studio.recordingCustomSec) {
            customSecInput.value = data.studio.recordingCustomSec;
          }
          this.customMaxDuration = data.studio.recordingCustomSec || 30;
        } else if (data.studio.recordingLimitMode === 'audio_end') {
          if (customSecContainer) {
            customSecContainer.classList.add('hidden');
            customSecContainer.classList.remove('flex');
          }
          this.customMaxDuration = null;
        } else {
          if (customSecContainer) {
            customSecContainer.classList.add('hidden');
            customSecContainer.classList.remove('flex');
          }
          this.customMaxDuration = parseInt(data.studio.recordingLimitMode, 10);
        }
      }

      // Active Background
      if (data.studio.activeBgId) {
        this.mediaPool.setActiveAsset(data.studio.activeBgId);
      }
    }

    // 4. Reset studio session to fresh starting point
    this.activeCueIndex = -1;
    this.renderer.setCue(null);
    this._updatePrompterUI();
    this.audio.seek(0);
    this.audio.pause();

    const timeDisplay = document.getElementById('recording-time-display');
    if (timeDisplay) timeDisplay.textContent = '00:00.0';

    // Transition smoothly to Live Studio (Step 4) ready to record
    this.goToStep(4);

    if (showNotification) {
      this.showToast('✨ Settings reloaded fresh! Ready for your live studio session.', 'success', 3000);
    }
    return true;
  }

  _applyStyleToUI(style) {
    if (!style) return;

    // 1. Aspect ratio
    if (style.aspectRatio) {
      document.querySelectorAll('.aspect-ratio-btn').forEach((b) => {
        b.classList.toggle('active', b.getAttribute('data-ratio') === style.aspectRatio);
      });
      this.renderer.setAspectRatio(style.aspectRatio);
      this.stylePreviewRenderer.setAspectRatio(style.aspectRatio);

      const stageWrapper = document.getElementById('master-stage-wrapper');
      const previewWrapper = document.getElementById('style-preview-wrapper');
      [stageWrapper, previewWrapper].forEach((el) => {
        if (!el) return;
        el.className = el.className.replace(/aspect-(video|square|\[9\/16\])/g, '');
        if (style.aspectRatio === '16-9') el.classList.add('aspect-video');
        else if (style.aspectRatio === '9-16') el.classList.add('aspect-[9/16]');
        else if (style.aspectRatio === '1-1') el.classList.add('aspect-square');
      });
    }

    // 2. Typography
    const fontSelect = document.getElementById('font-family-select');
    if (fontSelect && style.fontFamily) fontSelect.value = style.fontFamily;

    const weightSelect = document.getElementById('font-weight-select');
    if (weightSelect && style.fontWeight) weightSelect.value = style.fontWeight;

    const italicBtn = document.getElementById('btn-toggle-italic');
    if (italicBtn && style.isItalic !== undefined) {
      italicBtn.classList.toggle('active-chunk-rule', !!style.isItalic);
    }

    const upperBtn = document.getElementById('btn-toggle-uppercase');
    if (upperBtn && style.isUppercase !== undefined) {
      upperBtn.classList.toggle('active-chunk-rule', !!style.isUppercase);
    }

    const fontSizeSlider = document.getElementById('font-size-slider');
    const fontSizeVal = document.getElementById('font-size-val');
    if (fontSizeSlider && style.fontSize) {
      fontSizeSlider.value = style.fontSize;
      if (fontSizeVal) fontSizeVal.textContent = `${style.fontSize}px`;
    }

    const maxWidthSlider = document.getElementById('max-width-slider');
    const maxWidthVal = document.getElementById('max-width-val');
    if (maxWidthSlider && style.maxWidthPercent) {
      maxWidthSlider.value = style.maxWidthPercent;
      if (maxWidthVal) maxWidthVal.textContent = `${style.maxWidthPercent}%`;
    }

    // 3. Colors
    const setPicker = (pickerId, hexId, color) => {
      const picker = document.getElementById(pickerId);
      const hex = document.getElementById(hexId);
      if (picker && color) picker.value = color;
      if (hex && color) hex.textContent = color.toUpperCase();
    };
    if (style.textColor) setPicker('text-color-picker', 'text-color-hex', style.textColor);
    if (style.strokeColor) setPicker('stroke-color-picker', 'stroke-color-hex', style.strokeColor);
    if (style.shadowColor) setPicker('shadow-color-picker', 'shadow-color-hex', style.shadowColor);
    if (style.boxColor) setPicker('box-color-picker', 'box-color-hex', style.boxColor);

    const strokeWidthSlider = document.getElementById('stroke-width-slider');
    const strokeWidthVal = document.getElementById('stroke-width-val');
    if (strokeWidthSlider && style.strokeWidth !== undefined) {
      strokeWidthSlider.value = style.strokeWidth;
      if (strokeWidthVal) strokeWidthVal.textContent = `${style.strokeWidth}px`;
    }

    const boxOpacitySlider = document.getElementById('box-opacity-slider');
    const boxOpacityVal = document.getElementById('box-opacity-val');
    if (boxOpacitySlider && style.boxOpacity !== undefined) {
      boxOpacitySlider.value = style.boxOpacity;
      if (boxOpacityVal) boxOpacityVal.textContent = `${style.boxOpacity}%`;
    }

    // 4. Alignment & Position Mode
    const posFixedBtn = document.getElementById('pos-mode-fixed');
    const posTapBtn = document.getElementById('pos-mode-tap');
    const fixedControls = document.getElementById('fixed-pos-controls');
    const tapControls = document.getElementById('tap-pos-controls');
    const tapHint = document.getElementById('preview-tap-hint');

    if (style.positionMode === 'custom_tap') {
      posTapBtn?.classList.add('bg-brand-600', 'text-white');
      posTapBtn?.classList.remove('text-slate-400');
      posFixedBtn?.classList.remove('bg-brand-600', 'text-white');
      posFixedBtn?.classList.add('text-slate-400');
      fixedControls?.classList.add('hidden');
      tapControls?.classList.remove('hidden');
      tapHint?.classList.remove('hidden');
    } else {
      posFixedBtn?.classList.add('bg-brand-600', 'text-white');
      posFixedBtn?.classList.remove('text-slate-400');
      posTapBtn?.classList.remove('bg-brand-600', 'text-white');
      posTapBtn?.classList.add('text-slate-400');
      fixedControls?.classList.remove('hidden');
      tapControls?.classList.add('hidden');
      tapHint?.classList.add('hidden');
    }

    if (style.verticalAlign) {
      document.querySelectorAll('.fixed-preset-btn').forEach((btn) => {
        btn.classList.toggle('active', btn.getAttribute('data-align') === style.verticalAlign);
      });
    }

    if (style.textAlign) {
      document.querySelectorAll('.text-align-btn').forEach((btn) => {
        btn.classList.toggle('active', btn.getAttribute('data-align') === style.textAlign);
      });
    }

    // 5. Transitions
    if (style.transitionType) {
      document.querySelectorAll('.transition-type-btn').forEach((btn) => {
        btn.classList.toggle('active', btn.getAttribute('data-transition') === style.transitionType);
      });
    }

    const transSpeedSlider = document.getElementById('transition-speed-slider');
    const transSpeedVal = document.getElementById('transition-speed-val');
    if (transSpeedSlider && style.transitionSpeed !== undefined) {
      transSpeedSlider.value = style.transitionSpeed;
      if (transSpeedVal) {
        let desc = 'Standard';
        if (style.transitionSpeed <= 0.2) desc = 'Fast';
        else if (style.transitionSpeed <= 0.5) desc = 'Smooth';
        else if (style.transitionSpeed <= 0.9) desc = 'Cinematic';
        else desc = 'Slow';
        transSpeedVal.textContent = `${style.transitionSpeed.toFixed(2)}s (${desc})`;
      }
    }

    // 6. Tap Points
    if (style.tapPoints && Array.isArray(style.tapPoints)) {
      this.renderer.setTapPoints(style.tapPoints);
      this.stylePreviewRenderer.setTapPoints(style.tapPoints);
      this._updateTapPointsOverlayUI();
    }

    this._updateStyle(style);
    this._syncStylePreview();
  }

  async exportProjectJSON() {
    const data = this.saveProjectState(false);
    if (!data) return;

    const jsonStr = JSON.stringify(data, null, 2);
    const dateStr = new Date().toISOString().slice(0, 10);
    const defaultFilename = `lyricflow-project-${dateStr}.json`;

    // Modern direct file picker if supported
    if (window.showSaveFilePicker) {
      try {
        const handle = await window.showSaveFilePicker({
          suggestedName: defaultFilename,
          types: [{
            description: 'LyricFlow Project JSON',
            accept: { 'application/json': ['.json'] }
          }]
        });
        const writable = await handle.createWritable();
        await writable.write(jsonStr);
        await writable.close();
        this.showToast('Project file saved directly to disk!', 'success', 3000);
        return;
      } catch (err) {
        if (err.name === 'AbortError') return; // User cancelled
        console.warn('showSaveFilePicker fallback to download:', err);
      }
    }

    // Standard download to disk fallback
    try {
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = defaultFilename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      this.showToast('Project file saved directly to disk!', 'success', 3000);
    } catch (e) {
      console.error('Export JSON error:', e);
      this.showToast('Failed to save project to disk', 'error');
    }
  }

  importProjectJSON(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        const success = this.loadProjectState(data, false);
        if (success) {
          this.showToast(`✨ Successfully loaded project from disk: ${file.name}! Ready to record.`, 'success', 3500);
        }
      } catch (err) {
        console.error('Error importing project file:', err);
        this.showToast('Invalid project file format', 'error');
      }
    };
    reader.readAsText(file);
  }

  // ==========================================
  // 12. COMPREHENSIVE HELP GUIDE MODAL
  // ==========================================
  _setupHelpModal() {
    const modal = document.getElementById('help-modal');
    const openBtn = document.getElementById('btn-open-help');
    const closeBtn = document.getElementById('btn-close-help');
    const footerBtn = document.getElementById('btn-close-help-footer');

    const openHelp = () => {
      if (!modal) return;
      modal.classList.remove('hidden');
      requestAnimationFrame(() => {
        modal.classList.remove('opacity-0');
      });
    };

    const closeHelp = () => {
      if (!modal) return;
      modal.classList.add('opacity-0');
      setTimeout(() => {
        modal.classList.add('hidden');
      }, 200);
    };

    openBtn?.addEventListener('click', openHelp);
    closeBtn?.addEventListener('click', closeHelp);
    footerBtn?.addEventListener('click', closeHelp);

    modal?.querySelector('.app-dialog-backdrop')?.addEventListener('click', closeHelp);

    // Help tab switching
    document.querySelectorAll('.help-tab-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const targetId = btn.getAttribute('data-target');
        
        document.querySelectorAll('.help-tab-btn').forEach(b => {
          b.classList.remove('active', 'bg-brand-600', 'text-white');
          b.classList.add('text-slate-400');
        });
        btn.classList.add('active', 'bg-brand-600', 'text-white');
        btn.classList.remove('text-slate-400');

        document.querySelectorAll('.help-tab-content').forEach(content => {
          content.classList.add('hidden');
        });
        const targetContent = document.getElementById(targetId);
        if (targetContent) {
          targetContent.classList.remove('hidden');
        }
      });
    });
  }

  // ==========================================
  // 13. SERVICE WORKER REGISTRATION (PWA)
  // ==========================================
  _setupServiceWorker() {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js?v=1.0.37').catch((err) => {
          console.warn('SW registration info:', err);
        });
      });
    }
  }
}

// Instantiate app when DOM is ready
window.addEventListener('DOMContentLoaded', () => {
  window.app = new App();
});
