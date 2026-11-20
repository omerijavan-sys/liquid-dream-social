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

/** Foreground service that keeps Primegram's music playing when the app is minimised or the screen is off. */
public class MusicService extends Service {
    public static final String ACTION = "com.primegram.app.MUSIC_ACTION";
    static final String CHANNEL = "music_playback";
    static final int ID = 4107;
    public static MusicService instance;
    private PowerManager.WakeLock lock;

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
        String title = intent != null ? intent.getStringExtra("title") : null;
        String artist = intent != null ? intent.getStringExtra("artist") : null;
        boolean playing = intent == null || intent.getBooleanExtra("playing", true);
        show(title == null ? "Primegram" : title, artist == null ? "" : artist, playing);
        return START_NOT_STICKY;
    }

    private PendingIntent action(String a, int code) {
        Intent i = new Intent(ACTION).setPackage(getPackageName()).putExtra("a", a);
        return PendingIntent.getBroadcast(this, code, i, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
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

    /** Swiping the app away from recents ends playback (the player lives inside the app screen). */
    @Override public void onTaskRemoved(Intent rootIntent) { stopSelf(); super.onTaskRemoved(rootIntent); }

    @Override public void onDestroy() {
        if (lock != null && lock.isHeld()) lock.release();
        instance = null;
        super.onDestroy();
    }

    @Override public IBinder onBind(Intent intent) { return null; }
}
