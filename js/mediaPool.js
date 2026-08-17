export const ABSTRACT_PALETTES = {
  cyber_neon: { name: 'Cyber Neon', colors: ['#070712', '#4f46e5', '#ec4899', '#06b6d4', '#8b5cf6'] },
  synthwave: { name: 'Synthwave Sunset', colors: ['#0d0417', '#d946ef', '#f59e0b', '#3b82f6', '#ec4899'] },
  emerald_matrix: { name: 'Emerald Matrix', colors: ['#02120a', '#10b981', '#064e3b', '#34d399', '#059669'] },
  oceanic_abyss: { name: 'Oceanic Abyss', colors: ['#030a1c', '#0284c7', '#38bdf8', '#1e1b4b', '#2dd4bf'] },
  solar_flare: { name: 'Solar Flare', colors: ['#170605', '#ea580c', '#dc2626', '#f59e0b', '#fbbf24'] },
  monochrome: { name: 'Monochrome Luxe', colors: ['#050507', '#71717a', '#27272a', '#e4e4e7', '#a1a1aa'] }
};

export const ABSTRACT_STYLES = [
  { id: 'cyber_aurora', name: 'Cyber Liquid Aurora', desc: 'Morphing glowing orbs and fluid liquid mesh pulsating on bass' },
  { id: 'waveform_ribbons', name: 'Fluid Waveform Ribbons', desc: 'Layered silky sine waves oscillating with live audio time-domain data' },
  { id: 'ethereal_silk', name: 'Ethereal Silk Streams', desc: 'Translucent flowing silk ribbons drifting gracefully with harmonic audio' },
  { id: 'plasma_nebula', name: 'Deep Ambient Nebula', desc: 'Velvety glowing ambient cloud fields and chromatic plasma breathing with music' },
  { id: 'harmonic_tides', name: 'Harmonic Tidal Swells', desc: 'Cascading luminous fluid swells undulating with acoustic depth and bass' }
];

export class MediaPool {
  constructor() {
    this.assets = []; // Array of { id, type: 'image'|'video'|'procedural'|'audio_reactive', name, url, element, thumbnail, isCustom }
    this.activeAssetId = null;
    this.onAssetChangeCallback = null;
    this.onActiveChangeCallback = null;

    // Image Slideshow Mode State
    this.slideshowMode = false;
    this.slides = []; // Array of { id, name, url, element, thumbnail }
    this.currentSlideIndex = 0;
    this.onSlideChangeCallback = null;

    // Procedural animation time counter
    this.animTime = 0;

    // Background playback speed rate (0.125x [1/8 speed] - 3.0x)
    this.videoSpeed = 1.0;
    this.isPlaying = false;
  }

  setVideoSpeed(speed) {
    const val = Math.max(0.02, Math.min(3.0, parseFloat(speed) || 1.0));
    this.videoSpeed = Number(val.toFixed(3));
    this.assets.forEach((asset) => {
      if (asset.type === 'video' && asset.element) {
        asset.element.playbackRate = this.videoSpeed;
        asset.element.defaultPlaybackRate = this.videoSpeed;
      }
      if (asset.type === 'audio_reactive') {
        asset.speed = this.videoSpeed;
      }
    });
    return this.videoSpeed;
  }

  getVideoSpeed() {
    return this.videoSpeed;
  }

  async addFile(file) {
    const isVideo = file.type.startsWith('video/');
    const isImage = file.type.startsWith('image/');

    if (!isVideo && !isImage) {
      throw new Error('Unsupported file format. Please upload an image or video.');
    }

    const id = 'asset_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
    const url = URL.createObjectURL(file);

    let element = null;
    let thumbnail = null;

    if (isVideo) {
      const video = document.createElement('video');
      video.src = url;
      video.crossOrigin = 'anonymous';
      video.loop = true;
      video.muted = true;
      video.playsInline = true;
      video.autoplay = true;
      video.playbackRate = this.videoSpeed;

      await new Promise((resolve) => {
        video.onloadeddata = () => {
          video.play().catch(() => {});
          resolve();
        };
        video.onerror = () => resolve();
      });

      element = video;
      thumbnail = await this._generateVideoThumbnail(video);
    } else {
      const img = new Image();
      img.src = url;
      img.crossOrigin = 'anonymous';

      await new Promise((resolve) => {
        img.onload = () => resolve();
        img.onerror = () => resolve();
      });

      element = img;
      thumbnail = url;
    }

    const asset = {
      id,
      type: isVideo ? 'video' : 'image',
      name: file.name,
      url,
      element,
      thumbnail: thumbnail || url,
      isCustom: true
    };

    this.assets.push(asset);

    if (!this.activeAssetId) {
      this.setActiveAsset(asset.id);
    }

    if (this.onAssetChangeCallback) {
      this.onAssetChangeCallback(this.assets);
    }

    return asset;
  }

  async addSlideshowFiles(fileList) {
    const files = Array.from(fileList || []).filter(f => f.type.startsWith('image/') || /\.(jpg|jpeg|png|webp|gif|avif)$/i.test(f.name));
    if (files.length === 0) {
      throw new Error('No valid image files found in the selection.');
    }

    // Sort naturally by filename (e.g. 1.jpg, 2.jpg, 10.jpg)
    files.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));

    const loadedSlides = [];
    for (const file of files) {
      const id = 'slide_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.src = url;
      img.crossOrigin = 'anonymous';

      await new Promise((resolve) => {
        img.onload = () => resolve();
        img.onerror = () => resolve();
      });

      const slideObj = {
        id,
        type: 'image',
        name: file.name,
        url,
        element: img,
        thumbnail: url,
        isCustom: true,
        isSlide: true
      };

      loadedSlides.push(slideObj);
      this.assets.push(slideObj);
    }

    this.slides = loadedSlides;
    this.slideshowMode = true;
    this.currentSlideIndex = 0;

    if (this.onAssetChangeCallback) {
      this.onAssetChangeCallback(this.assets);
    }
    if (this.onSlideChangeCallback) {
      this.onSlideChangeCallback(this.getCurrentSlide(), this.currentSlideIndex, this.slides.length);
    }

    return loadedSlides;
  }

  setSlideshowMode(enabled) {
    this.slideshowMode = !!enabled;
    if (this.onSlideChangeCallback) {
      this.onSlideChangeCallback(this.getCurrentSlide(), this.currentSlideIndex, this.slides.length);
    }
  }

  advanceSlide() {
    if (!this.slideshowMode || this.slides.length === 0) return null;
    this.currentSlideIndex = (this.currentSlideIndex + 1) % this.slides.length;
    const current = this.getCurrentSlide();
    if (this.onSlideChangeCallback) {
      this.onSlideChangeCallback(current, this.currentSlideIndex, this.slides.length);
    }
    return current;
  }

  prevSlide() {
    if (!this.slideshowMode || this.slides.length === 0) return null;
    this.currentSlideIndex = (this.currentSlideIndex - 1 + this.slides.length) % this.slides.length;
    const current = this.getCurrentSlide();
    if (this.onSlideChangeCallback) {
      this.onSlideChangeCallback(current, this.currentSlideIndex, this.slides.length);
    }
    return current;
  }

  setSlideIndex(index) {
    if (!this.slideshowMode || this.slides.length === 0) return null;
    this.currentSlideIndex = Math.max(0, Math.min(this.slides.length - 1, index));
    const current = this.getCurrentSlide();
    if (this.onSlideChangeCallback) {
      this.onSlideChangeCallback(current, this.currentSlideIndex, this.slides.length);
    }
    return current;
  }

  setSlideByNameOrIndex(target) {
    if (!target) return this.advanceSlide();
    if (this.slides.length === 0) return null;

    const trimmed = String(target).trim();
    const cleanTarget = trimmed.toLowerCase();

    // Check if target is a 1-based number: e.g. "1", "2", "Slide 2"
    const numMatch = cleanTarget.match(/^(?:slide\s*)?#?(\d+)$/i);
    let matchedIndex = -1;

    if (numMatch) {
      const idx = parseInt(numMatch[1], 10) - 1;
      if (idx >= 0 && idx < this.slides.length) {
        matchedIndex = idx;
      }
    }

    if (matchedIndex === -1) {
      // 1. Exact name match (case-insensitive)
      matchedIndex = this.slides.findIndex(s => s.name.toLowerCase() === cleanTarget);
    }

    if (matchedIndex === -1) {
      // 2. Name without extension match (e.g. "chorus" matches "chorus.jpg")
      const targetNoExt = cleanTarget.replace(/\.[^/.]+$/, '');
      matchedIndex = this.slides.findIndex(s => {
        const slideNoExt = s.name.toLowerCase().replace(/\.[^/.]+$/, '');
        return slideNoExt === targetNoExt;
      });
    }

    if (matchedIndex === -1) {
      // 3. Substring match (e.g. "intro" matches "01_intro_slide.jpg")
      matchedIndex = this.slides.findIndex(s => s.name.toLowerCase().includes(cleanTarget));
    }

    if (matchedIndex !== -1) {
      this.slideshowMode = true;
      this.currentSlideIndex = matchedIndex;
      const current = this.getCurrentSlide();
      if (this.onSlideChangeCallback) {
        this.onSlideChangeCallback(current, this.currentSlideIndex, this.slides.length);
      }
      return current;
    }

    // Fallback if not found
    return this.advanceSlide();
  }

  getCurrentSlide() {
    if (!this.slideshowMode || this.slides.length === 0) return null;
    return this.slides[this.currentSlideIndex] || this.slides[0] || null;
  }

  async addVideoFiles(fileList) {
    const files = Array.from(fileList || []).filter(f => f.type.startsWith('video/') || /\.(mp4|webm|mov|m4v|ogg)$/i.test(f.name));
    if (files.length === 0) {
      throw new Error('No valid video files found in the selection.');
    }

    // Sort naturally by filename (e.g. video1.mp4, video2.mp4, video10.mp4)
    files.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));

    const loadedVideos = [];
    for (const file of files) {
      const asset = await this.addFile(file);
      loadedVideos.push(asset);
    }

    this.slideshowMode = false;
    if (loadedVideos.length > 0) {
      this.setActiveAsset(loadedVideos[0].id);
    }

    return loadedVideos;
  }

  nextVideo() {
    const videos = this.assets.filter(a => a.type === 'video');
    if (videos.length === 0) return null;

    const currIdx = videos.findIndex(v => v.id === this.activeAssetId);
    const nextIdx = (currIdx + 1) % videos.length;
    const nextVid = videos[nextIdx];
    this.setActiveAsset(nextVid.id);
    return nextVid;
  }

  prevVideo() {
    const videos = this.assets.filter(a => a.type === 'video');
    if (videos.length === 0) return null;

    const currIdx = videos.findIndex(v => v.id === this.activeAssetId);
    const prevIdx = (currIdx - 1 + videos.length) % videos.length;
    const prevVid = videos[prevIdx];
    this.setActiveAsset(prevVid.id);
    return prevVid;
  }

  setVideoByNameOrIndex(target) {
    const videos = this.assets.filter(a => a.type === 'video');
    if (videos.length === 0) return null;
    if (!target) return this.nextVideo();

    const trimmed = String(target).trim();
    const cleanTarget = trimmed.toLowerCase();

    // Check if target is a 1-based number: e.g. "1", "2", "Video 2"
    const numMatch = cleanTarget.match(/^(?:video\s*|vid\s*)?#?(\d+)$/i);
    let matchedIndex = -1;

    if (numMatch) {
      const idx = parseInt(numMatch[1], 10) - 1;
      if (idx >= 0 && idx < videos.length) {
        matchedIndex = idx;
      }
    }

    if (matchedIndex === -1) {
      // 1. Exact name match (case-insensitive)
      matchedIndex = videos.findIndex(v => v.name.toLowerCase() === cleanTarget);
    }

    if (matchedIndex === -1) {
      // 2. Name without extension match (e.g. "bg_loop" matches "bg_loop.mp4")
      const targetNoExt = cleanTarget.replace(/\.[^/.]+$/, '');
      matchedIndex = videos.findIndex(v => {
        const vidNoExt = v.name.toLowerCase().replace(/\.[^/.]+$/, '');
        return vidNoExt === targetNoExt;
      });
    }

    if (matchedIndex === -1) {
      // 3. Substring match
      matchedIndex = videos.findIndex(v => v.name.toLowerCase().includes(cleanTarget));
    }

    if (matchedIndex !== -1) {
      const targetVid = videos[matchedIndex];
      this.slideshowMode = false;
      this.setActiveAsset(targetVid.id);
      return targetVid;
    }

    // Fallback if not found
    return this.nextVideo();
  }

  addAudioReactiveBackground(name, style = 'cyber_aurora', paletteName = 'cyber_neon', customColors = null, speed = null) {
    const id = 'ar_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
    const palette = customColors || (ABSTRACT_PALETTES[paletteName] ? ABSTRACT_PALETTES[paletteName].colors : ABSTRACT_PALETTES.cyber_neon.colors);

    const asset = {
      id,
      type: 'audio_reactive',
      style,
      paletteName,
      speed: (speed !== null && !isNaN(speed)) ? Number(speed) : this.videoSpeed,
      name: name || (ABSTRACT_STYLES.find(s => s.id === style)?.name || 'Audio Reactive Background'),
      colors: palette,
      url: null,
      element: null,
      thumbnail: this._generateAudioReactiveThumbnail(style, palette),
      isCustom: false
    };

    this.assets.push(asset);

    if (!this.activeAssetId) {
      this.setActiveAsset(asset.id);
    }

    if (this.onAssetChangeCallback) {
      this.onAssetChangeCallback(this.assets);
    }

    return asset;
  }

  addProceduralGradient(name = 'Neon Cyber Aurora', colors = ['#0f172a', '#312e81', '#4c1d95', '#064e3b']) {
    const id = 'proc_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);

    const asset = {
      id,
      type: 'procedural',
      name,
      colors,
      url: null,
      element: null,
      thumbnail: this._generateProceduralThumbnail(colors),
      isCustom: false
    };

    this.assets.push(asset);

    if (!this.activeAssetId) {
      this.setActiveAsset(asset.id);
    }

    if (this.onAssetChangeCallback) {
      this.onAssetChangeCallback(this.assets);
    }

    return asset;
  }

  async loadDefaultBackgrounds() {
    this.clear();

    // 1. Audio Reactive: Cyber Liquid Aurora (Cyber Neon)
    this.addAudioReactiveBackground('Cyber Liquid Aurora', 'cyber_aurora', 'cyber_neon');

    // 2. Audio Reactive: Fluid Waveform Ribbons (Oceanic Abyss)
    this.addAudioReactiveBackground('Fluid Waveform Ribbons', 'waveform_ribbons', 'oceanic_abyss');

    // 3. Audio Reactive: Ethereal Silk Streams (Synthwave Sunset)
    this.addAudioReactiveBackground('Ethereal Silk Streams', 'ethereal_silk', 'synthwave');

    // 4. Audio Reactive: Deep Ambient Nebula (Solar Flare)
    this.addAudioReactiveBackground('Deep Ambient Nebula', 'plasma_nebula', 'solar_flare');

    // 5. Audio Reactive: Harmonic Tidal Swells (Emerald Matrix)
    this.addAudioReactiveBackground('Harmonic Tidal Swells', 'harmonic_tides', 'emerald_matrix');

    if (this.assets.length > 0) {
      this.setActiveAsset(this.assets[0].id);
    }
  }

  async loadDemoAssets() {
    return this.loadDefaultBackgrounds();
  }

  _generateProceduralThumbnail(colors) {
    const canvas = document.createElement('canvas');
    canvas.width = 160;
    canvas.height = 90;
    const ctx = canvas.getContext('2d');
    const grad = ctx.createLinearGradient(0, 0, 160, 90);
    colors.forEach((c, idx) => grad.addColorStop(idx / (colors.length - 1), c));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 160, 90);
    return canvas.toDataURL();
  }

  _generateAudioReactiveThumbnail(style, colors) {
    const canvas = document.createElement('canvas');
    canvas.width = 160;
    canvas.height = 90;
    const ctx = canvas.getContext('2d');

    // Create a mock audio packet for vibrant thumbnail render
    const mockAudio = {
      isPlaying: true,
      bass: 0.6,
      mid: 0.5,
      treble: 0.7,
      volume: 0.65,
      beat: 0.4,
      frequencyData: new Uint8Array(64).map((_, i) => Math.floor(100 + Math.sin(i * 0.3) * 120)),
      timeDomainData: new Uint8Array(64).map((_, i) => Math.floor(128 + Math.sin(i * 0.5) * 60))
    };

    const prevAnim = this.animTime;
    this.animTime = 1.2;

    switch (style) {
      case 'synthwave_horizon':
        this._drawSynthwaveHorizon(ctx, 160, 90, colors, mockAudio);
        break;
      case 'radial_iris':
        this._drawRadialIris(ctx, 160, 90, colors, mockAudio);
        break;
      case 'particle_vortex':
        this._drawParticleVortex(ctx, 160, 90, colors, mockAudio);
        break;
      case 'geometric_prisms':
        this._drawGeometricPrisms(ctx, 160, 90, colors, mockAudio);
        break;
      case 'waveform_ribbons':
        this._drawWaveformRibbons(ctx, 160, 90, colors, mockAudio);
        break;
      case 'cyber_aurora':
      default:
        this._drawCyberAurora(ctx, 160, 90, colors, mockAudio);
        break;
    }

    this.animTime = prevAnim;

    // Small glowing EQ badge in corner
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(4, 4, 34, 14);
    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 8px sans-serif';
    ctx.fillText('⚡ EQ', 8, 14);

    return canvas.toDataURL();
  }

  async _generateVideoThumbnail(video) {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 160;
      canvas.height = 90;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0, 160, 90);
      return canvas.toDataURL();
    } catch (e) {
      return null;
    }
  }

  setActiveAsset(id) {
    const found = this.assets.find(a => a.id === id);
    if (found) {
      this.activeAssetId = id;
      if (found.type === 'video' && found.element) {
        found.element.playbackRate = this.videoSpeed;
        found.element.defaultPlaybackRate = this.videoSpeed;
        if (this.isPlaying) {
          found.element.play().catch(() => {});
        }
      }
      if (this.onActiveChangeCallback) {
        this.onActiveChangeCallback(found);
      }
    }
  }

  playActiveVideo() {
    this.isPlaying = true;
    const active = this.getActiveAsset();
    if (active && active.type === 'video' && active.element) {
      active.element.playbackRate = this.videoSpeed;
      active.element.defaultPlaybackRate = this.videoSpeed;
      active.element.play().catch(() => {});
    }
  }

  pauseAllVideos() {
    this.isPlaying = false;
    this.assets.forEach((asset) => {
      if (asset.type === 'video' && asset.element) {
        asset.element.pause();
      }
    });
  }

  setActiveByIndex(index) {
    if (index >= 0 && index < this.assets.length) {
      this.setActiveAsset(this.assets[index].id);
    }
  }

  getActiveAsset() {
    return this.assets.find(a => a.id === this.activeAssetId) || this.assets[0] || null;
  }

  removeAsset(id) {
    const index = this.assets.findIndex(a => a.id === id);
    if (index !== -1) {
      const removed = this.assets.splice(index, 1)[0];
      if (removed.url && removed.isCustom) {
        URL.revokeObjectURL(removed.url);
      }
      if (this.activeAssetId === id) {
        this.activeAssetId = this.assets.length > 0 ? this.assets[0].id : null;
      }
      if (this.onAssetChangeCallback) {
        this.onAssetChangeCallback(this.assets);
      }
      if (this.onActiveChangeCallback) {
        this.onActiveChangeCallback(this.getActiveAsset());
      }
    }
  }

  clear() {
    this.assets.forEach(a => {
      if (a.url && a.isCustom) URL.revokeObjectURL(a.url);
    });
    this.assets = [];
    this.slides = [];
    this.slideshowMode = false;
    this.currentSlideIndex = 0;
    this.activeAssetId = null;
    if (this.onAssetChangeCallback) this.onAssetChangeCallback(this.assets);
    if (this.onSlideChangeCallback) this.onSlideChangeCallback(null, 0, 0);
  }

  /**
   * Render background onto any canvas context with real-time audio telemetry
   */
  drawBackground(ctx, width, height, audioTelemetry = null) {
    // 1. Slideshow mode takes precedence if active and slides exist
    if (this.slideshowMode && this.slides.length > 0) {
      const activeSlide = this.getCurrentSlide();
      if (activeSlide && activeSlide.element) {
        this._drawImageCover(ctx, activeSlide.element, width, height);
        return;
      }
    }

    const active = this.getActiveAsset();
    const currentSpeed = (active && typeof active.speed === 'number' && !isNaN(active.speed)) ? active.speed : this.videoSpeed;
    this.animTime += 0.015 * currentSpeed;

    if (!active) {
      // Default dark backdrop
      ctx.fillStyle = '#090d16';
      ctx.fillRect(0, 0, width, height);
      return;
    }

    if (active.type === 'image' && active.element) {
      this._drawImageCover(ctx, active.element, width, height);
    } else if (active.type === 'video' && active.element) {
      if (Math.abs(active.element.playbackRate - this.videoSpeed) > 0.001) {
        active.element.playbackRate = this.videoSpeed;
      }
      if (this.isPlaying && active.element.paused) {
        active.element.play().catch(() => {});
      }
      this._drawImageCover(ctx, active.element, width, height);
    } else if (active.type === 'audio_reactive') {
      this._drawAudioReactive(ctx, width, height, active, audioTelemetry);
    } else if (active.type === 'procedural') {
      this._drawProceduralMotion(ctx, width, height, active.colors);
    }
  }

  _drawAudioReactive(ctx, width, height, asset, audio) {
    const style = asset.style || 'cyber_aurora';
    const colors = asset.colors || ABSTRACT_PALETTES.cyber_neon.colors;

    switch (style) {
      case 'waveform_ribbons':
        this._drawWaveformRibbons(ctx, width, height, colors, audio);
        break;
      case 'ethereal_silk':
        this._drawEtherealSilk(ctx, width, height, colors, audio);
        break;
      case 'plasma_nebula':
        this._drawPlasmaNebula(ctx, width, height, colors, audio);
        break;
      case 'harmonic_tides':
        this._drawHarmonicTides(ctx, width, height, colors, audio);
        break;
      case 'cyber_aurora':
      default:
        this._drawCyberAurora(ctx, width, height, colors, audio);
        break;
    }
  }

  _drawImageCover(ctx, media, targetW, targetH) {
    const mediaW = media.videoWidth || media.naturalWidth || media.width || targetW;
    const mediaH = media.videoHeight || media.naturalHeight || media.height || targetH;

    const targetRatio = targetW / targetH;
    const mediaRatio = mediaW / mediaH;

    let drawW, drawH, drawX, drawY;

    if (mediaRatio > targetRatio) {
      drawH = targetH;
      drawW = targetH * mediaRatio;
      drawX = (targetW - drawW) / 2;
      drawY = 0;
    } else {
      drawW = targetW;
      drawH = targetW / mediaRatio;
      drawX = 0;
      drawY = (targetH - drawH) / 2;
    }

    try {
      ctx.drawImage(media, drawX, drawY, drawW, drawH);
    } catch (e) {
      ctx.fillStyle = '#090d16';
      ctx.fillRect(0, 0, targetW, targetH);
    }
  }

  // 1. Cyber Liquid Aurora Visualizer
  _drawCyberAurora(ctx, width, height, colors, audio) {
    const bass = audio ? audio.bass : 0;
    const mid = audio ? audio.mid : 0;
    const treble = audio ? audio.treble : 0;
    const beat = audio ? audio.beat : 0;

    const t = this.animTime + bass * 0.8;
    const maxDim = Math.max(width, height);

    // Base background
    ctx.fillStyle = colors[0] || '#050711';
    ctx.fillRect(0, 0, width, height);

    // Dynamic morphing liquid blobs
    // Blob 1 (Bass pulse)
    const x1 = width * (0.5 + 0.32 * Math.sin(t * 0.65));
    const y1 = height * (0.5 + 0.28 * Math.cos(t * 0.45));
    const r1 = maxDim * (0.55 + bass * 0.35 + beat * 0.15);
    const grad1 = ctx.createRadialGradient(x1, y1, 0, x1, y1, r1);
    grad1.addColorStop(0, colors[1] || '#4f46e5');
    grad1.addColorStop(1, 'transparent');
    ctx.fillStyle = grad1;
    ctx.fillRect(0, 0, width, height);

    // Blob 2 (Mid-range resonance)
    const x2 = width * (0.5 + 0.35 * Math.cos(t * 0.55 + 1.8));
    const y2 = height * (0.5 + 0.32 * Math.sin(t * 0.75 + 1.2));
    const r2 = maxDim * (0.50 + mid * 0.30);
    const grad2 = ctx.createRadialGradient(x2, y2, 0, x2, y2, r2);
    grad2.addColorStop(0, colors[2] || '#ec4899');
    grad2.addColorStop(1, 'transparent');
    ctx.fillStyle = grad2;
    ctx.fillRect(0, 0, width, height);

    // Blob 3 (Treble shimmer)
    if (colors[3]) {
      const x3 = width * (0.5 + 0.28 * Math.sin(t * 1.1 + 3.2));
      const y3 = height * (0.5 + 0.26 * Math.cos(t * 0.9 + 4.1));
      const r3 = maxDim * (0.44 + treble * 0.28);
      const grad3 = ctx.createRadialGradient(x3, y3, 0, x3, y3, r3);
      grad3.addColorStop(0, colors[3]);
      grad3.addColorStop(1, 'transparent');
      ctx.fillStyle = grad3;
      ctx.fillRect(0, 0, width, height);
    }

    // Blob 4 (Beat Core Flash)
    if (beat > 0.05 && colors[4]) {
      const grad4 = ctx.createRadialGradient(width / 2, height / 2, 0, width / 2, height / 2, maxDim * (0.35 + beat * 0.3));
      grad4.addColorStop(0, colors[4]);
      grad4.addColorStop(1, 'transparent');
      ctx.fillStyle = grad4;
      ctx.fillRect(0, 0, width, height);
    }

    // Contrast Vignette
    const vig = ctx.createRadialGradient(width / 2, height / 2, Math.min(width, height) * 0.3, width / 2, height / 2, maxDim * 0.75);
    vig.addColorStop(0, 'rgba(0,0,0,0)');
    vig.addColorStop(1, 'rgba(0,0,0,0.65)');
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, width, height);
  }

  // 2. Fluid Waveform Ribbons Visualizer
  _drawWaveformRibbons(ctx, width, height, colors, audio) {
    const bass = audio ? audio.bass : 0;
    const mid = audio ? audio.mid : 0;
    const vol = audio ? audio.volume : 0;
    const timeData = audio ? audio.timeDomainData : null;

    ctx.fillStyle = colors[0];
    ctx.fillRect(0, 0, width, height);

    const layerCount = 5;
    for (let layer = 0; layer < layerCount; layer++) {
      const centerY = height * (0.42 + layer * 0.05);
      const waveFreq = 0.002 + layer * 0.0006;
      const timeOffset = this.animTime * (0.7 + layer * 0.35);
      const baseAmp = (height * 0.07 + bass * (height * 0.14)) * (1 + (layer % 2) * 0.25);

      ctx.save();
      ctx.beginPath();
      ctx.moveTo(0, height);
      ctx.lineTo(0, centerY);

      const step = 20;
      for (let x = 0; x <= width; x += step) {
        let timeWarp = 0;
        if (timeData && timeData.length > 0) {
          const sampleIdx = Math.floor((x / width) * timeData.length);
          timeWarp = ((timeData[sampleIdx % timeData.length] - 128) / 128) * (height * 0.08);
        }

        const y = centerY + Math.sin(x * waveFreq + timeOffset) * baseAmp + Math.cos(x * waveFreq * 1.5 - timeOffset * 0.8) * (baseAmp * 0.4) + timeWarp;
        ctx.lineTo(x, y);
      }

      ctx.lineTo(width, height);
      ctx.closePath();

      const grad = ctx.createLinearGradient(0, centerY - baseAmp, 0, height);
      const color = colors[(layer % (colors.length - 1)) + 1] || '#4f46e5';
      grad.addColorStop(0, color);
      grad.addColorStop(1, 'transparent');

      ctx.globalAlpha = 0.32 + mid * 0.25;
      ctx.fillStyle = grad;
      ctx.fill();

      // Sharp glowing top wave line
      ctx.strokeStyle = color;
      ctx.lineWidth = 2 + vol * 2;
      ctx.globalAlpha = 0.75;
      ctx.stroke();

      ctx.restore();
    }

    // Vignette
    const vig = ctx.createRadialGradient(width / 2, height / 2, Math.min(width, height) * 0.35, width / 2, height / 2, Math.max(width, height) * 0.75);
    vig.addColorStop(0, 'rgba(0,0,0,0)');
    vig.addColorStop(1, 'rgba(0,0,0,0.6)');
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, width, height);
  }

  // 3. Ethereal Silk Streams Visualizer
  _drawEtherealSilk(ctx, width, height, colors, audio) {
    const bass = audio ? audio.bass : 0;
    const mid = audio ? audio.mid : 0;
    const treble = audio ? audio.treble : 0;
    const vol = audio ? audio.volume : 0;

    // Dark base
    ctx.fillStyle = colors[0] || '#050711';
    ctx.fillRect(0, 0, width, height);

    const ribbonCount = 4;
    const t = this.animTime;

    for (let r = 0; r < ribbonCount; r++) {
      const baseY = height * (0.35 + r * 0.12);
      const amp = (height * 0.08 + bass * (height * 0.12)) * (1 + r * 0.2);
      const freq = 0.0018 + r * 0.0005;
      const speed = t * (0.5 + r * 0.25);

      ctx.save();
      ctx.beginPath();
      ctx.moveTo(0, height);
      ctx.lineTo(0, baseY);

      const step = 25;
      for (let x = 0; x <= width; x += step) {
        const yOffset = Math.sin(x * freq + speed) * amp +
                        Math.cos(x * freq * 1.7 - speed * 0.7) * (amp * 0.45) +
                        Math.sin(x * 0.004 + speed * 1.3) * (amp * (0.15 + treble * 0.2));
        ctx.lineTo(x, baseY + yOffset);
      }

      ctx.lineTo(width, height);
      ctx.closePath();

      const color = colors[(r % (colors.length - 1)) + 1] || '#ec4899';
      const grad = ctx.createLinearGradient(0, baseY - amp, width * 0.7, height);
      grad.addColorStop(0, color);
      grad.addColorStop(0.6, colors[((r + 1) % (colors.length - 1)) + 1] || color);
      grad.addColorStop(1, 'transparent');

      ctx.globalAlpha = 0.28 + mid * 0.22;
      ctx.fillStyle = grad;
      ctx.fill();

      // Glowing silk edge highlight
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.8 + vol * 1.8;
      ctx.globalAlpha = 0.65;
      ctx.stroke();

      ctx.restore();
    }

    // Contrast Vignette
    const vig = ctx.createRadialGradient(width / 2, height / 2, Math.min(width, height) * 0.35, width / 2, height / 2, Math.max(width, height) * 0.75);
    vig.addColorStop(0, 'rgba(0,0,0,0)');
    vig.addColorStop(1, 'rgba(0,0,0,0.65)');
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, width, height);
  }

  // 4. Deep Ambient Nebula Visualizer
  _drawPlasmaNebula(ctx, width, height, colors, audio) {
    const bass = audio ? audio.bass : 0;
    const mid = audio ? audio.mid : 0;
    const treble = audio ? audio.treble : 0;
    const beat = audio ? audio.beat : 0;

    const t = this.animTime;
    const maxDim = Math.max(width, height);

    ctx.fillStyle = colors[0] || '#050711';
    ctx.fillRect(0, 0, width, height);

    // Drifting chromatic nebula centroids
    const nodes = [
      { x: 0.35 + 0.22 * Math.sin(t * 0.42), y: 0.40 + 0.20 * Math.cos(t * 0.35), c: colors[1], r: 0.55 + bass * 0.3 },
      { x: 0.68 + 0.20 * Math.cos(t * 0.38 + 1.2), y: 0.60 + 0.22 * Math.sin(t * 0.48 + 1.0), c: colors[2], r: 0.50 + mid * 0.28 },
      { x: 0.50 + 0.25 * Math.sin(t * 0.55 + 2.4), y: 0.30 + 0.22 * Math.cos(t * 0.40 + 2.0), c: colors[3] || colors[1], r: 0.45 + treble * 0.25 },
      { x: 0.42 + 0.18 * Math.cos(t * 0.60 + 3.5), y: 0.72 + 0.18 * Math.sin(t * 0.52 + 3.0), c: colors[4] || colors[2], r: 0.48 + bass * 0.25 }
    ];

    nodes.forEach((node) => {
      if (!node.c) return;
      const nx = width * node.x;
      const ny = height * node.y;
      const nr = maxDim * node.r;

      const grad = ctx.createRadialGradient(nx, ny, 0, nx, ny, nr);
      grad.addColorStop(0, node.c);
      grad.addColorStop(1, 'transparent');

      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);
    });

    // Center pulsating harmonic core
    if (beat > 0.05 || bass > 0.3) {
      const coreR = maxDim * (0.35 + beat * 0.25 + bass * 0.15);
      const coreGrad = ctx.createRadialGradient(width / 2, height / 2, 0, width / 2, height / 2, coreR);
      coreGrad.addColorStop(0, colors[1] || '#4f46e5');
      coreGrad.addColorStop(1, 'transparent');
      ctx.globalAlpha = 0.45;
      ctx.fillStyle = coreGrad;
      ctx.fillRect(0, 0, width, height);
      ctx.globalAlpha = 1.0;
    }

    // Contrast Vignette
    const vig = ctx.createRadialGradient(width / 2, height / 2, Math.min(width, height) * 0.3, width / 2, height / 2, maxDim * 0.75);
    vig.addColorStop(0, 'rgba(0,0,0,0)');
    vig.addColorStop(1, 'rgba(0,0,0,0.65)');
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, width, height);
  }

  // 5. Harmonic Tidal Swells Visualizer
  _drawHarmonicTides(ctx, width, height, colors, audio) {
    const bass = audio ? audio.bass : 0;
    const mid = audio ? audio.mid : 0;
    const treble = audio ? audio.treble : 0;
    const vol = audio ? audio.volume : 0;
    const timeData = audio ? audio.timeDomainData : null;

    ctx.fillStyle = colors[0] || '#050711';
    ctx.fillRect(0, 0, width, height);

    const swellCount = 4;
    const t = this.animTime;

    for (let s = 0; s < swellCount; s++) {
      const baseY = height * (0.48 + s * 0.10);
      const waveFreq = 0.0015 + s * 0.0004;
      const speed = t * (0.6 + s * 0.28);
      const baseAmp = (height * 0.06 + bass * (height * 0.12)) * (1 + (s % 2) * 0.3);

      ctx.save();
      ctx.beginPath();
      ctx.moveTo(0, height);
      ctx.lineTo(0, baseY);

      const step = 20;
      for (let x = 0; x <= width; x += step) {
        let liveWarp = 0;
        if (timeData && timeData.length > 0) {
          const sIdx = Math.floor((x / width) * timeData.length);
          liveWarp = ((timeData[sIdx % timeData.length] - 128) / 128) * (height * 0.05);
        }

        const y = baseY +
                  Math.sin(x * waveFreq + speed) * baseAmp +
                  Math.cos(x * waveFreq * 1.4 - speed * 0.8) * (baseAmp * 0.35) +
                  Math.sin(x * 0.003 - speed * 1.1) * (baseAmp * (0.15 + treble * 0.15)) +
                  liveWarp;
        ctx.lineTo(x, y);
      }

      ctx.lineTo(width, height);
      ctx.closePath();

      const color = colors[(s % (colors.length - 1)) + 1] || '#06b6d4';
      const grad = ctx.createLinearGradient(0, baseY - baseAmp, 0, height);
      grad.addColorStop(0, color);
      grad.addColorStop(0.7, colors[((s + 2) % (colors.length - 1)) + 1] || color);
      grad.addColorStop(1, 'transparent');

      ctx.globalAlpha = 0.30 + mid * 0.20;
      ctx.fillStyle = grad;
      ctx.fill();

      // Glowing swell crest
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.8 + vol * 2;
      ctx.globalAlpha = 0.70;
      ctx.stroke();

      ctx.restore();
    }

    // Contrast Vignette
    const vig = ctx.createRadialGradient(width / 2, height / 2, Math.min(width, height) * 0.35, width / 2, height / 2, Math.max(width, height) * 0.75);
    vig.addColorStop(0, 'rgba(0,0,0,0)');
    vig.addColorStop(1, 'rgba(0,0,0,0.65)');
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, width, height);
  }

  _drawProceduralMotion(ctx, width, height, colors) {
    const t = this.animTime;
    
    // Background base
    ctx.fillStyle = colors[0] || '#050711';
    ctx.fillRect(0, 0, width, height);

    // Glowing motion orb 1
    const x1 = width * (0.5 + 0.35 * Math.sin(t * 0.7));
    const y1 = height * (0.5 + 0.3 * Math.cos(t * 0.5));
    const r1 = Math.max(width, height) * 0.6;
    const grad1 = ctx.createRadialGradient(x1, y1, 0, x1, y1, r1);
    grad1.addColorStop(0, colors[1] || '#4f46e5');
    grad1.addColorStop(1, 'transparent');
    ctx.fillStyle = grad1;
    ctx.fillRect(0, 0, width, height);

    // Glowing motion orb 2
    const x2 = width * (0.5 + 0.3 * Math.cos(t * 0.6 + 1.5));
    const y2 = height * (0.5 + 0.35 * Math.sin(t * 0.8 + 2.0));
    const r2 = Math.max(width, height) * 0.55;
    const grad2 = ctx.createRadialGradient(x2, y2, 0, x2, y2, r2);
    grad2.addColorStop(0, colors[2] || '#ec4899');
    grad2.addColorStop(1, 'transparent');
    ctx.fillStyle = grad2;
    ctx.fillRect(0, 0, width, height);

    // Glowing motion orb 3
    if (colors[3]) {
      const x3 = width * (0.5 + 0.25 * Math.sin(t * 1.1 + 3.0));
      const y3 = height * (0.5 + 0.25 * Math.cos(t * 0.9 + 4.0));
      const r3 = Math.max(width, height) * 0.5;
      const grad3 = ctx.createRadialGradient(x3, y3, 0, x3, y3, r3);
      grad3.addColorStop(0, colors[3]);
      grad3.addColorStop(1, 'transparent');
      ctx.fillStyle = grad3;
      ctx.fillRect(0, 0, width, height);
    }

    // Subtle dark vignette on edges
    const vig = ctx.createRadialGradient(width / 2, height / 2, Math.min(width, height) * 0.3, width / 2, height / 2, Math.max(width, height) * 0.7);
    vig.addColorStop(0, 'rgba(0,0,0,0)');
    vig.addColorStop(1, 'rgba(0,0,0,0.65)');
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, width, height);
  }
}
