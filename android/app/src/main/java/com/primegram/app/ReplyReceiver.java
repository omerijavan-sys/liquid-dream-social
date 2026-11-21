package com.primegram.app;

import android.app.NotificationManager;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Bundle;
import androidx.core.app.NotificationCompat;
import androidx.core.app.RemoteInput;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import org.json.JSONObject;

/** Sends a reply typed (or tapped) in a notification, even when the app is closed. */
public class ReplyReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(final Context ctx, final Intent in) {
        String text = in.getStringExtra("text");
        Bundle r = RemoteInput.getResultsFromIntent(in);
        if (r != null && r.getCharSequence("reply_text") != null) text = r.getCharSequence("reply_text").toString();
        if (text == null || text.trim().isEmpty()) return;
        final String msg = text.trim();
        final int nid = in.getIntExtra("nid", 0);
        final String kind = in.getStringExtra("kind"), to = in.getStringExtra("to"), group = in.getStringExtra("group");
        final String title = in.getStringExtra("title"), body = in.getStringExtra("body");
        final PendingResult pr = goAsync();
        new Thread(() -> {
            boolean ok = false;
            try {
                android.content.SharedPreferences p = NotifyConfigPlugin.prefs(ctx);
                String base = p.getString("url", null), key = p.getString("key", null), token = p.getString("token", null);
                if (base != null && token != null) {
                    HttpURLConnection c = (HttpURLConnection) new URL(base + "/functions/v1/quick-reply").openConnection();
                    c.setRequestMethod("POST"); c.setDoOutput(true); c.setConnectTimeout(15000); c.setReadTimeout(20000);
                    c.setRequestProperty("Content-Type", "application/json");
                    if (key != null) { c.setRequestProperty("apikey", key); }
                    JSONObject j = new JSONObject();
                    j.put("token", token); j.put("to", to); j.put("group", group); j.put("text", msg);
                    try (OutputStream o = c.getOutputStream()) { o.write(j.toString().getBytes("UTF-8")); }
                    ok = c.getResponseCode() == 200;
                }
            } catch (Exception ignored) { }
            NotificationManager nm = (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
            NotificationCompat.Builder b = new NotificationCompat.Builder(ctx, "messages")
                .setSmallIcon(R.drawable.ic_stat_primegram)
                .setContentTitle(title)
                .setContentText(ok ? "You: " + msg : "Couldn't send — open Primegram to reply")
                .setOnlyAlertOnce(true).setTimeoutAfter(ok ? 2500 : 15000).setAutoCancel(true);
            nm.notify(nid, b.build());
            pr.finish();
        }).start();
    }
}
