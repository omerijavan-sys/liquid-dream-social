import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ExternalLink, LoaderCircle, Music, Play, RefreshCw, Search } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { authHeader } from "@/utils/authFetch";

type SpotifyTrack = {
  id: string;
  name: string;
  artists: string[];
  album: string;
  albumImage: string | null;
  durationMs: number;
  spotifyUrl: string;
};

type SpotifySearchResponse = { tracks: SpotifyTrack[] };
type SpotifyStatusResponse = { connected: boolean };
type ApiErrorResponse = { error?: string };

async function readApiResponse<T>(response: Response): Promise<T> {
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    throw new Error("Spotify Connect API routes are available in the deployed Vercel app, not this local Vite preview.");
  }

  const payload = await response.json().catch(() => ({} as ApiErrorResponse));
  if (!response.ok) {
    throw new Error((payload as ApiErrorResponse).error || "Something went wrong. Try again.");
  }
  return payload as T;
}

function formatDuration(durationMs: number) {
  const totalSeconds = Math.floor(durationMs / 1000);
  return `${Math.floor(totalSeconds / 60)}:${String(totalSeconds % 60).padStart(2, "0")}`;
}

const SpotifySearch = () => {
  const { user } = useAuth();
  const [query, setQuery] = useState("");
  const [selectedTrack, setSelectedTrack] = useState<SpotifyTrack | null>(null);

  const connectionQuery = useQuery({
    queryKey: ["spotify-connection", user?.id],
    enabled: Boolean(user),
    retry: false,
    staleTime: 15_000,
    queryFn: async () => {
      const response = await fetch("/api/spotify/status", {
        headers: { Authorization: await authHeader() },
      });
      return readApiResponse<SpotifyStatusResponse>(response);
    },
  });

  const authorizeMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/spotify/authorize", {
        method: "POST",
        headers: { Authorization: await authHeader() },
      });
      const result = await readApiResponse<{ url?: unknown }>(response);
      if (typeof result.url !== "string" || !result.url.startsWith("https://")) {
        throw new Error("Spotify did not return a valid authorization link.");
      }
      return { url: result.url };
    },
    onSuccess: ({ url }) => {
      if (!url.startsWith("https://")) return;

      if (window.self !== window.top) {
        window.open(url, "_blank", "noopener,noreferrer");
      } else {
        window.location.href = url;
      }
    },
  });

  const searchMutation = useMutation({
    mutationFn: async (searchQuery: string) => {
      const params = new URLSearchParams({ q: searchQuery });
      const response = await fetch(`/api/spotify/search?${params}`, {
        headers: { Authorization: await authHeader() },
      });
      return readApiResponse<SpotifySearchResponse>(response);
    },
  });

  const connected = connectionQuery.data?.connected === true;
  const searchTracks = () => {
    const normalizedQuery = query.trim();
    if (!connected || normalizedQuery.length < 2 || normalizedQuery.length > 100) return;
    setSelectedTrack(null);
    searchMutation.mutate(normalizedQuery);
  };

  return (
    <section className="w-full pb-8" aria-labelledby="spotify-heading">
      <div className="liquid-glass-elevated rounded-2xl p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
            <Music aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 id="spotify-heading" className="text-base font-semibold text-foreground">Spotify</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Search the catalog, then start playback in Spotify&apos;s official embedded player.
            </p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <p className="text-xs text-muted-foreground" role="status" aria-live="polite">
            {!user
              ? "Sign in to connect your personal Spotify account."
              : connectionQuery.isLoading
                ? "Checking your Spotify connection…"
                : connectionQuery.isError
                  ? "Spotify connection status is unavailable."
                  : connected
                    ? "Spotify connected"
                    : "Spotify is not connected yet."}
          </p>
          {user && !connected && !connectionQuery.isLoading && !connectionQuery.isError && (
            <button
              type="button"
              onClick={() => authorizeMutation.mutate()}
              disabled={authorizeMutation.isPending}
              className="depth-press rounded-xl bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-60"
            >
              {authorizeMutation.isPending ? "Opening Spotify…" : "Connect Spotify"}
            </button>
          )}
          {user && (
            <button
              type="button"
              onClick={() => void connectionQuery.refetch()}
              disabled={connectionQuery.isFetching}
              className="depth-press inline-flex items-center gap-1 rounded-xl liquid-glass-subtle px-3 py-2 text-xs text-foreground disabled:opacity-60"
            >
              <RefreshCw className="size-3" aria-hidden="true" />
              Check connection
            </button>
          )}
        </div>

        {authorizeMutation.error && (
          <p className="mt-3 text-sm text-destructive" role="alert">
            {authorizeMutation.error.message}
          </p>
        )}
        {connectionQuery.isError && (
          <p className="mt-3 text-sm text-destructive" role="alert">
            {connectionQuery.error.message}
          </p>
        )}

        <div className="mt-4 flex items-center gap-2 rounded-xl liquid-glass-subtle px-3 py-2">
          <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <input
            aria-label="Search Spotify tracks"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== "Enter" || event.nativeEvent.isComposing || event.keyCode === 229) return;
              event.preventDefault();
              searchTracks();
            }}
            placeholder="Search songs or artists…"
            maxLength={100}
            className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
          />
          <button
            type="button"
            onClick={searchTracks}
            disabled={!connected || searchMutation.isPending || query.trim().length < 2}
            className="depth-press inline-flex shrink-0 items-center gap-2 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50"
          >
            {searchMutation.isPending ? <LoaderCircle className="size-3.5 animate-spin" aria-hidden="true" /> : null}
            {searchMutation.isPending ? "Searching" : "Search"}
          </button>
        </div>

        <p className="mt-3 text-xs text-muted-foreground">
          Spotify connections are private to each signed-in Primegram account.
        </p>

        {searchMutation.error && (
          <p className="mt-3 text-sm text-destructive" role="alert">
            {searchMutation.error.message}
          </p>
        )}

        {searchMutation.data?.tracks.length === 0 && !searchMutation.isPending && (
          <p className="mt-5 rounded-xl liquid-glass-subtle px-4 py-5 text-center text-sm text-muted-foreground">
            No Spotify tracks found. Try another song or artist.
          </p>
        )}

        {searchMutation.data && searchMutation.data.tracks.length > 0 && (
          <ul className="mt-3 flex flex-col gap-2" aria-label="Spotify search results">
            {searchMutation.data.tracks.map((track) => (
              <li
                key={track.id}
                className={`flex items-center gap-3 rounded-xl p-2.5 ${selectedTrack?.id === track.id ? "liquid-glass-elevated" : "liquid-glass-subtle"}`}
              >
                {track.albumImage ? (
                  <img src={track.albumImage} alt="" className="size-11 shrink-0 rounded-lg object-cover" loading="lazy" />
                ) : (
                  <div className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Music className="size-5" aria-hidden="true" />
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => setSelectedTrack(track)}
                  aria-label={`Load ${track.name} by ${track.artists.join(", ")} in the Spotify player`}
                  className="min-w-0 flex-1 text-left"
                >
                  <span className="block truncate text-sm font-medium text-foreground">{track.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {track.artists.join(", ")} · {track.album} · {formatDuration(track.durationMs)}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedTrack(track)}
                  aria-label={`Load ${track.name} in the Spotify player`}
                  className="depth-press flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary"
                >
                  <Play className="size-4" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        )}

        {selectedTrack && (
          <div className="mt-4 overflow-hidden rounded-xl" aria-label="Spotify player">
            <iframe
              title={`Spotify player for ${selectedTrack.name} by ${selectedTrack.artists.join(", ")}`}
              src={`https://open.spotify.com/embed/track/${encodeURIComponent(selectedTrack.id)}?utm_source=generator`}
              width="100%"
              height="152"
              loading="lazy"
              allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
              className="block border-0"
            />
            <div className="flex items-center justify-between gap-3 bg-background/60 px-3 py-2">
              <p className="truncate text-xs text-muted-foreground">Playback availability depends on your Spotify account and the track.</p>
              <a
                href={selectedTrack.spotifyUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-primary hover:underline"
              >
                Open in Spotify
                <ExternalLink className="size-3" aria-hidden="true" />
              </a>
            </div>
          </div>
        )}
      </div>
    </section>
  );
};

export default SpotifySearch;
