/**
 * Pixabay Service - Handles REST API communication with Pixabay
 * https://pixabay.com/api/docs/
 */

const STOP_WORDS = new Set([
  'a', 'about', 'above', 'after', 'again', 'against', 'all', 'am', 'an', 'and', 'any', 'are', 'aren\'t',
  'as', 'at', 'be', 'because', 'been', 'before', 'being', 'below', 'between', 'both', 'but', 'by', 'can\'t',
  'cannot', 'could', 'couldn\'t', 'did', 'didn\'t', 'do', 'does', 'doesn\'t', 'doing', 'don\'t', 'down',
  'during', 'each', 'few', 'for', 'from', 'further', 'had', 'hadn\'t', 'has', 'hasn\'t', 'have', 'haven\'t',
  'having', 'he', 'he\'d', 'he\'ll', 'he\'s', 'her', 'here', 'here\'s', 'hers', 'herself', 'him', 'himself',
  'his', 'how', 'how\'s', 'i', 'i\'d', 'i\'ll', 'i\'m', 'i\'ve', 'if', 'in', 'into', 'is', 'isn\'t', 'it',
  'it\'s', 'its', 'itself', 'let\'s', 'me', 'more', 'most', 'mustn\'t', 'my', 'myself', 'no', 'nor', 'not',
  'of', 'off', 'on', 'once', 'only', 'or', 'other', 'ought', 'our', 'ours', 'ourselves', 'out', 'over', 'own',
  'same', 'shan\'t', 'she', 'she\'d', 'she\'ll', 'she\'s', 'should', 'shouldn\'t', 'so', 'some', 'such',
  'than', 'that', 'that\'s', 'the', 'their', 'theirs', 'them', 'themselves', 'then', 'there', 'there\'s',
  'these', 'they', 'they\'d', 'they\'ll', 'they\'re', 'they\'ve', 'this', 'those', 'through', 'to', 'too',
  'under', 'until', 'up', 'very', 'was', 'wasn\'t', 'we', 'we\'d', 'we\'ll', 'we\'re', 'we\'ve', 'were',
  'weren\'t', 'what', 'what\'s', 'when', 'when\'s', 'where', 'where\'s', 'which', 'while', 'who', 'who\'s',
  'whom', 'why', 'why\'s', 'with', 'won\'t', 'would', 'wouldn\'t', 'you', 'you\'d', 'you\'ll', 'you\'re',
  'you\'ve', 'your', 'yours', 'yourself', 'yourselves', 'verse', 'chorus', 'intro', 'outro', 'bridge',
  'hook', 'like', 'just', 'get', 'got', 'oh', 'yeah', 'ooh', 'baby', 'la', 'na', 'hey'
]);

export class PixabayService {
  constructor() {
    this.storageKey = 'pixabay_api_key';
    this.baseUrl = 'https://pixabay.com/api/';
    this.videosUrl = 'https://pixabay.com/api/videos/';
  }

  getApiKey() {
    try {
      return (localStorage.getItem(this.storageKey) || '').trim();
    } catch (e) {
      return '';
    }
  }

  saveApiKey(key) {
    const cleanKey = (key || '').trim();
    try {
      if (cleanKey) {
        localStorage.setItem(this.storageKey, cleanKey);
      } else {
        localStorage.removeItem(this.storageKey);
      }
      return true;
    } catch (e) {
      console.error('Error saving Pixabay API key:', e);
      return false;
    }
  }

  hasApiKey() {
    return Boolean(this.getApiKey());
  }

  /**
   * Test API key by performing a 3-result search
   */
  async testApiKey(apiKey = null) {
    const key = apiKey !== null ? (apiKey || '').trim() : this.getApiKey();
    if (!key) {
      return { success: false, error: 'API key is empty' };
    }

    try {
      const url = `${this.baseUrl}?key=${encodeURIComponent(key)}&q=music&per_page=3&safesearch=true`;
      const response = await fetch(url);
      
      if (!response.ok) {
        const errorText = await response.text();
        return { success: false, error: errorText || `HTTP ${response.status}` };
      }

      const data = await response.json();
      if (typeof data.totalHits === 'number') {
        return { success: true, totalHits: data.totalHits };
      }
      return { success: false, error: 'Unexpected API response' };
    } catch (err) {
      return { success: false, error: err.message || 'Network request failed' };
    }
  }

  /**
   * Search Pixabay Images or Videos
   */
  async search({
    query = '',
    mediaType = 'images', // 'images' or 'videos'
    orientation = 'horizontal', // 'all', 'horizontal', 'vertical'
    category = '',
    page = 1,
    perPage = 24,
    editorsChoice = false,
    safesearch = true
  } = {}) {
    const key = this.getApiKey();
    if (!key) {
      throw new Error('Pixabay API Key is not configured. Please add your key in Settings.');
    }

    const isVideo = mediaType === 'videos';
    const endpoint = isVideo ? this.videosUrl : this.baseUrl;

    const params = new URLSearchParams({
      key: key,
      q: (query || '').trim().slice(0, 100),
      page: String(page),
      per_page: String(Math.max(3, Math.min(200, perPage))),
      safesearch: safesearch ? 'true' : 'false'
    });

    if (orientation && orientation !== 'all') {
      params.append('orientation', orientation);
    }

    if (category) {
      params.append('category', category);
    }

    if (editorsChoice) {
      params.append('editors_choice', 'true');
    }

    if (!isVideo) {
      params.append('image_type', 'all');
    }

    const response = await fetch(`${endpoint}?${params.toString()}`);
    if (!response.ok) {
      const errText = await response.text();
      if (response.status === 429) {
        throw new Error('Pixabay API rate limit exceeded (100 requests / min). Please wait a moment.');
      }
      throw new Error(errText || `Pixabay API error (HTTP ${response.status})`);
    }

    const data = await response.json();
    return {
      total: data.total || 0,
      totalHits: data.totalHits || 0,
      page,
      perPage,
      isVideo,
      hits: data.hits || []
    };
  }

  /**
   * Download image or video URL as a local Blob to prevent canvas CORS / tainting issues
   */
  async fetchAsBlob(url) {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to download media asset (HTTP ${response.status})`);
    }
    const blob = await response.blob();
    return blob;
  }

  /**
   * Extract suggestive search themes and keywords from audio title and parsed lyrics
   */
  extractSongKeywords(audioFileName = '', lyricsText = '') {
    const suggestions = new Set();

    // 1. Audio filename cleanup
    if (audioFileName) {
      const cleanName = audioFileName
        .replace(/\.[a-z0-9]+$/i, '') // remove extension
        .replace(/[-_.]+/g, ' ') // replace dashes/underscores with spaces
        .replace(/\b(mp3|wav|ogg|audio|track|master|mix|final|edit|v\d+|remix|demo|instrumental|ft|feat)\b/gi, '')
        .trim();

      if (cleanName.length > 2) {
        suggestions.add(cleanName);
        // Also add individual words if cleanName has multiple
        const words = cleanName.split(/\s+/).filter(w => w.length > 3 && !STOP_WORDS.has(w.toLowerCase()));
        words.slice(0, 3).forEach(w => suggestions.add(w));
      }
    }

    // 2. Lyrics word frequency & mood extraction
    if (lyricsText) {
      const words = lyricsText
        .toLowerCase()
        .replace(/[^\w\s]/g, ' ')
        .split(/\s+/)
        .filter(w => w.length > 3 && !STOP_WORDS.has(w));

      const freqMap = new Map();
      words.forEach(w => {
        freqMap.set(w, (freqMap.get(w) || 0) + 1);
      });

      // Sort by frequency
      const sortedWords = Array.from(freqMap.entries())
        .sort((a, b) => b[1] - a[1])
        .map(entry => entry[0]);

      sortedWords.slice(0, 6).forEach(w => suggestions.add(w));
    }

    // 3. Fallback generic evocative visual themes if empty
    if (suggestions.size === 0) {
      return ['cyberpunk neon', 'sunset ocean', 'starry galaxy', 'rainy city', 'abstract lights'];
    }

    return Array.from(suggestions).slice(0, 8);
  }
}
