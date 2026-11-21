package com.primegram.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.os.Build;
import android.os.IBinder;
import android.os.PowerManager;
import android.os.Handler;
import android.os.Looper;
import android.net.Uri;
import android.media.AudioAttributes;
import android.media.MediaPlayer;
import java.util.ArrayList;

/** Foreground service that keeps Primegram's music playing when the app is minimised or the screen is off. */
public class MusicService extends Service {
    public static final String ACTION = "com.primegram.app.MUSIC_ACTION";
    static final String CHANNEL = "music_playback";
    static final int ID = 4107;
    public static MusicService instance;
    private PowerManager.WakeLock lock;

    /** Reports native playback to the web layer (only when the app screen is alive). */
    public interface Listener { void onState(int index, int posMs, int durMs, boolean playing, boolean ended, boolean error); }
    public static Listener listener;
    public static ArrayList<String[]> pendingItems; public static int pendingIndex, pendingStart;
    private final ArrayList<String[]> q = new ArrayList<>(); // {url, title, artist}
    private int idx = -1; private MediaPlayer mp; private boolean ready;
    private final Handler h = new Handler(Looper.getMainLooper());
    private final Runnable tick = new Runnable() { @Override public void run() { emit(false, false); if (mp != null) h.postDelayed(this, 500); } };

    @Override public void onCreate() {
        super.onCreate();
        instance = this;
        NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (Build.VERSION.SDK_INT >= 26 && nm.getNotificationChannel(CHANNEL) == null) {
            NotificationChannel ch = new NotificationChannel(CHANNEL, "Music playback", NotificationManager.IMPORTANCE_LOW);
            ch.setShowBadge(false);
            nm.createNotificationChannel(ch);
        }
        PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
        lock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "primegram:music");
        lock.setReferenceCounted(false);
    }

    @Override public int onStartCommand(Intent intent, int flags, int startId) {
        String act = intent != null ? intent.getAction() : null;
        if ("PLAY".equals(act) && pendingItems != null) {
            q.clear(); q.addAll(pendingItems); pendingItems = null;
            String[] f = q.get(Math.max(0, Math.min(pendingIndex, q.size() - 1)));
            show(f[1], f[2], true);
            playIdx(Math.max(0, Math.min(pendingIndex, q.size() - 1)), pendingStart);
            return START_NOT_STICKY;
        }
        if ("CTL".equals(act)) {
            String a = intent.getStringExtra("a");
            if (mp != null && !q.isEmpty()) control(a);
            else sendBroadcast(new Intent(ACTION).setPackage(getPackageName()).putExtra("a", a));
            return START_NOT_STICKY;
        }
        String title = intent != null ? intent.getStringExtra("title") : null;
        String artist = intent != null ? intent.getStringExtra("artist") : null;
        boolean playing = intent == null || intent.getBooleanExtra("playing", true);
        show(title == null ? "Primegram" : title, artist == null ? "" : artist, playing);
        return START_NOT_STICKY;
    }

    private PendingIntent action(String a, int code) {
        Intent i = new Intent(this, MusicService.class).setAction("CTL").putExtra("a", a);
        return PendingIntent.getService(this, code, i, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
    }

    public void show(String title, String artist, boolean playing) {
        Intent open = getPackageManager().getLaunchIntentForPackage(getPackageName());
        PendingIntent content = PendingIntent.getActivity(this, 0, open, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        Notification.Builder b = Build.VERSION.SDK_INT >= 26 ? new Notification.Builder(this, CHANNEL) : new Notification.Builder(this);
        b.setSmallIcon(android.R.drawable.ic_media_play)
            .setContentTitle(title).setContentText(artist)
            .setContentIntent(content).setOngoing(playing).setOnlyAlertOnce(true).setShowWhen(false)
            .setVisibility(Notification.VISIBILITY_PUBLIC)
            .addAction(android.R.drawable.ic_media_previous, "Previous", action("prev", 1))
            .addAction(playing ? android.R.drawable.ic_media_pause : android.R.drawable.ic_media_play, playing ? "Pause" : "Play", action("toggle", 2))
            .addAction(android.R.drawable.ic_media_next, "Next", action("next", 3))
            .addAction(android.R.drawable.ic_menu_close_clear_cancel, "Close", action("stop", 4))
            .setStyle(new Notification.MediaStyle().setShowActionsInCompactView(0, 1, 2));
        Notification n = b.build();
        if (Build.VERSION.SDK_INT >= 29) startForeground(ID, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK);
        else startForeground(ID, n);
        if (playing && !lock.isHeld()) lock.acquire(6 * 60 * 60 * 1000L);
        if (!playing && lock.isHeld()) lock.release();
    }

    // ---- native player: keeps playing with the app closed or the screen off ----
    public void append(ArrayList<String[]> more) { q.addAll(more); }
    private void playIdx(int i, int startMs) {
        if (i < 0 || i >= q.size()) return;
        idx = i; ready = false;
        String[] it = q.get(i);
        releasePlayer();
        try {
            mp = new MediaPlayer();
            mp.setAudioAttributes(new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_MEDIA).setContentType(AudioAttributes.CONTENT_TYPE_MUSIC).build());
            mp.setWakeMode(this, PowerManager.PARTIAL_WAKE_LOCK);
            mp.setDataSource(this, Uri.parse(it[0]));
            mp.setOnPreparedListener(m -> { ready = true; if (startMs > 0) m.seekTo(startMs); m.start(); show(it[1], it[2], true); emit(false, false); });
            mp.setOnCompletionListener(m -> {
                if (idx + 1 < q.size()) playIdx(idx + 1, 0);
                else { show(it[1], it[2], false); emit(true, false); }
            });
            mp.setOnErrorListener((m, w, e) -> {
                emit(false, true);
                if (idx + 1 < q.size()) playIdx(idx + 1, 0);
                return true;
            });
            mp.prepareAsync();
            h.removeCallbacks(tick); h.post(tick);
        } catch (Exception e) { emit(false, true); }
    }
    private void releasePlayer() { if (mp != null) { try { mp.release(); } catch (Exception ignored) { } mp = null; } ready = false; }
    private void emit(boolean ended, boolean error) {
        Listener l = listener; if (l == null) return;
        int pos = 0, dur = 0; boolean playing = false;
        try { if (mp != null && ready) { pos = mp.getCurrentPosition(); dur = mp.getDuration(); playing = mp.isPlaying(); } } catch (Exception ignored) { }
        l.onState(idx, pos, dur, playing, ended, error);
    }
    public void control(String a) {
        if ("toggle".equals(a)) {
            if (mp == null || !ready) return;
            String[] it = q.get(idx);
            if (mp.isPlaying()) { mp.pause(); show(it[1], it[2], false); } else { mp.start(); show(it[1], it[2], true); }
            emit(false, false);
        } else if ("next".equals(a)) { if (idx + 1 < q.size()) playIdx(idx + 1, 0); }
        else if ("prev".equals(a)) { if (mp != null && ready && mp.getCurrentPosition() > 4000) mp.seekTo(0); else if (idx > 0) playIdx(idx - 1, 0); }
        else if ("stop".equals(a)) { killPlayback(); }
    }
    public void seek(int ms, boolean play) {
        if (mp == null || !ready) return;
        mp.seekTo(ms);
        if (play && !mp.isPlaying()) { mp.start(); show(q.get(idx)[1], q.get(idx)[2], true); }
        emit(false, false);
    }
    public void killPlayback() {
        h.removeCallbacks(tick); releasePlayer(); q.clear(); idx = -1;
        stopForeground(true); stopSelf();
    }

    /** Swiping the app away keeps native songs playing; anything else ends with the app. */
    @Override public void onTaskRemoved(Intent rootIntent) {
        boolean playing = false;
        try { playing = mp != null && ready && mp.isPlaying(); } catch (Exception ignored) { }
        if (!playing) stopSelf();
        super.onTaskRemoved(rootIntent);
    }

    @Override public void onDestroy() {
        h.removeCallbacks(tick); releasePlayer();
        if (lock != null && lock.isHeld()) lock.release();
        instance = null;
        super.onDestroy();
    }

    @Override public IBinder onBind(Intent intent) { return null; }
}
