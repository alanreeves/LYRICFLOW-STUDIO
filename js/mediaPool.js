/**
 * Media Pool - Handles background asset pool (static images, looping video files, and animated gradients)
 * and seamless background switching during live recording.
 */
export class MediaPool {
  constructor() {
    this.assets = []; // Array of { id, type: 'image'|'video'|'procedural', name, url, element, thumbnail, isCustom }
    this.activeAssetId = null;
    this.onAssetChangeCallback = null;
    this.onActiveChangeCallback = null;

    // Image Slideshow Mode State
    this.slideshowMode = false;
    this.slides = []; // Array of { id, name, url, element, thumbnail }
    this.currentSlideIndex = 0;
    this.onSlideChangeCallback = null;

    // Procedural gradient animation time counter
    this.animTime = 0;

    // Background playback speed rate (0.125x [1/8 speed] - 3.0x)
    this.videoSpeed = 1.0;
    this.isPlaying = false;
  }

  setVideoSpeed(speed) {
    const val = Math.max(0.125, Math.min(3.0, parseFloat(speed) || 1.0));
    this.videoSpeed = Number(val.toFixed(3));
    this.assets.forEach((asset) => {
      if (asset.type === 'video' && asset.element) {
        asset.element.playbackRate = this.videoSpeed;
        asset.element.defaultPlaybackRate = this.videoSpeed;
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

  async loadDemoAssets() {
    this.clear();

    // 1. Neon Pulse Procedural
    this.addProceduralGradient('Neon Cyber Pulse', ['#09090b', '#3b0764', '#1e1b4b', '#0369a1']);
    
    // 2. Sunset Glow Procedural
    this.addProceduralGradient('Sunset Horizon', ['#18181b', '#831843', '#701a75', '#1e1b4b']);

    // 3. Dark Starfield Procedural
    this.addProceduralGradient('Deep Cosmos', ['#020617', '#0f172a', '#1e293b', '#082f49']);

    if (this.assets.length > 0) {
      this.setActiveAsset(this.assets[0].id);
    }
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
   * Render background onto any canvas context
   */
  drawBackground(ctx, width, height) {
    // 1. Slideshow mode takes precedence if active and slides exist
    if (this.slideshowMode && this.slides.length > 0) {
      const activeSlide = this.getCurrentSlide();
      if (activeSlide && activeSlide.element) {
        this._drawImageCover(ctx, activeSlide.element, width, height);
        return;
      }
    }

    const active = this.getActiveAsset();
    if (this.isPlaying) {
      this.animTime += 0.015 * this.videoSpeed;
    }

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
    } else if (active.type === 'procedural') {
      this._drawProceduralMotion(ctx, width, height, active.colors);
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
      // Fallback
      ctx.fillStyle = '#090d16';
      ctx.fillRect(0, 0, targetW, targetH);
    }
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
