/**
 * Lyrics Parser - Handles text parsing, delimitation modes (empty lines, single lines,
 * 2-lines, sentences), chunk editing, and cue management.
 */
export class LyricsParser {
  constructor() {
    this.rawText = '';
    this.delimitationMode = 'empty-line'; // 'empty-line', 'single-line', 'two-lines', 'sentence'
    this.cues = []; // Array of { id, index, text, lines: string[] }
    this.onCuesUpdatedCallback = null;
  }

  setRawText(text, autoParse = true) {
    this.rawText = text || '';
    if (autoParse) {
      this.parseCues();
    }
  }

  setDelimitationMode(mode) {
    this.delimitationMode = mode;
    this.parseCues();
  }

  parseCues() {
    if (!this.rawText.trim()) {
      this.cues = [];
      if (this.onCuesUpdatedCallback) this.onCuesUpdatedCallback(this.cues);
      return this.cues;
    }

    const raw = this.rawText;
    let chunks = [];

    switch (this.delimitationMode) {
      case 'empty-line': {
        // Split by 2 or more newlines
        chunks = raw
          .split(/\n\s*\n+/)
          .map(c => c.trim())
          .filter(c => c.length > 0);
        break;
      }
      case 'single-line': {
        chunks = raw
          .split(/\r?\n/)
          .map(c => c.trim())
          .filter(c => c.length > 0);
        break;
      }
      case 'two-lines': {
        const lines = raw
          .split(/\r?\n/)
          .map(c => c.trim())
          .filter(c => c.length > 0);
        
        for (let i = 0; i < lines.length; i += 2) {
          if (i + 1 < lines.length) {
            chunks.push(`${lines[i]}\n${lines[i + 1]}`);
          } else {
            chunks.push(lines[i]);
          }
        }
        break;
      }
      case 'sentence': {
        // Split by periods, exclamation marks, question marks
        chunks = raw
          .split(/([.!?]+["']?\s+)/g)
          .reduce((acc, part, idx, arr) => {
            if (idx % 2 === 0 && part.trim()) {
              const punct = arr[idx + 1] ? arr[idx + 1].trim() : '';
              acc.push((part + (punct ? ' ' + punct : '')).trim());
            }
            return acc;
          }, [])
          .filter(c => c.length > 0);
        break;
      }
      default:
        chunks = raw.split(/\n\s*\n+/).map(c => c.trim()).filter(c => c.length > 0);
    }

    this.cues = chunks.map((chunkText, idx) => ({
      id: 'cue_' + idx + '_' + Math.random().toString(36).substr(2, 4),
      index: idx,
      text: chunkText,
      lines: chunkText.split(/\r?\n/).map(l => l.trim()).filter(Boolean)
    }));

    if (this.onCuesUpdatedCallback) {
      this.onCuesUpdatedCallback(this.cues);
    }

    return this.cues;
  }

  updateCueText(index, newText) {
    if (index >= 0 && index < this.cues.length) {
      this.cues[index].text = newText;
      this.cues[index].lines = newText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
      if (this.onCuesUpdatedCallback) this.onCuesUpdatedCallback(this.cues);
    }
  }

  deleteCue(index) {
    if (index >= 0 && index < this.cues.length) {
      this.cues.splice(index, 1);
      // Re-index
      this.cues.forEach((c, idx) => c.index = idx);
      if (this.onCuesUpdatedCallback) this.onCuesUpdatedCallback(this.cues);
    }
  }

  trimAll() {
    this.rawText = this.rawText
      .split('\n')
      .map(line => line.trim())
      .filter((line, i, arr) => line !== '' || (arr[i - 1] !== ''))
      .join('\n')
      .trim();
    this.parseCues();
  }

  toUpperCase() {
    this.rawText = this.rawText.toUpperCase();
    this.parseCues();
  }

  getDemoLyrics() {
    return `[Verse 1]
Walking through the neon city lights
Chasing echoes in the middle of the night
Every heartbeat syncs with the bassline low
We find the places only dreamers know

[Chorus]
'Cause you were the sky and I was the ocean
Drowning in colors and endless emotion
Turn the music high, let the shadows ignite
We are alive in the rhythm of tonight

[Verse 2]
Electric sparks across the midnight sky
No yesterday and no goodbyes
Just you and me inside the sonic sound
Floating higher than the solid ground

[Outro]
We are alive in the rhythm of tonight
Let the music take us to the morning light`;
  }
}
