import { searchGlobalMusic, getGlobalTrendingMusic, GlobalMusicTrack } from "./GlobalMusicService";

interface YouTubeSearchResult {
  id: string;
  title: string;
  artist: string;
  duration: string;
  thumbnail: string;
  youtubeId: string;
  viewCount: string;
  publishedAt: string;
  streamUrl?: string;
}

interface DownloadProgress {
  trackId: string;
  progress: number;
  status: 'pending' | 'downloading' | 'completed' | 'error';
  error?: string;
}

class YouTubeService {
  // Audio-only catalogue (Audius): no API key and no video embeds required.
  private map(track: GlobalMusicTrack): YouTubeSearchResult {
    const secs = track.duration ?? 0;
    return {
      id: `audio-${track.id}`,
      title: track.title,
      artist: track.artist,
      duration: secs ? `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}` : '',
      thumbnail: track.artwork ?? '',
      youtubeId: track.id,
      viewCount: '',
      publishedAt: '',
      streamUrl: track.streamUrl,
    };
  }

  async searchMusic(query: string, maxResults: number = 30): Promise<YouTubeSearchResult[]> {
    try {
      return (await searchGlobalMusic(query, maxResults)).map(t => this.map(t));
    } catch {
      return [];
    }
  }

  async getTrendingMusic(_region: string = 'US', maxResults: number = 30): Promise<YouTubeSearchResult[]> {
    try {
      return (await getGlobalTrendingMusic(maxResults)).map(t => this.map(t));
    } catch {
      return [];
    }
  }

  async downloadAudio(streamUrl: string, onProgress?: (progress: number) => void): Promise<Blob> {
    const response = await fetch(streamUrl);
    if (!response.ok) throw new Error('Download failed');
    const total = Number(response.headers.get('Content-Length')) || 0;
    const reader = response.body?.getReader();
    if (!reader) return response.blob();
    const chunks: Uint8Array[] = [];
    let loaded = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      loaded += value.length;
      if (onProgress && total) onProgress(Math.round((loaded / total) * 100));
    }
    return new Blob(chunks as BlobPart[], { type: 'audio/mpeg' });
  }
}

export const youtubeService = new YouTubeService();
export type { YouTubeSearchResult, DownloadProgress };
