package com.primegram.app;

import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.NotificationChannel;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import androidx.annotation.NonNull;
import androidx.core.app.NotificationCompat;
import androidx.core.app.RemoteInput;
import com.capacitorjs.plugins.pushnotifications.MessagingService;
import com.google.firebase.messaging.RemoteMessage;
import java.util.Map;
import org.json.JSONArray;

/**
 * Message pushes arrive as data-only FCM messages. When the app is not on screen we draw the notification
 * ourselves so it can carry a Reply box and two AI-suggested one-tap replies.
 */
public class NotifyService extends MessagingService {
    @Override
    public void onMessageReceived(@NonNull RemoteMessage msg) {
        Map<String, String> d = msg.getData();
        String type = d.get("type");
        boolean ours = d.get("body") != null && d.get("title") != null && ("message".equals(type) || "group".equals(type) || "call".equals(type));
        if (!ours || MainActivity.isForeground()) { super.onMessageReceived(msg); return; }
        if ("call".equals(type)) showCall(this, d); else show(this, d);
    }

    static void ensureChannel(Context c) {
        if (Build.VERSION.SDK_INT >= 26) {
            NotificationManager nm = (NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm.getNotificationChannel("messages") == null) {
                NotificationChannel ch = new NotificationChannel("messages", "Messages", NotificationManager.IMPORTANCE_HIGH);
                ch.setDescription("New message alerts");
                nm.createNotificationChannel(ch);
            }
        }
    }

    static int idFor(Map<String, String> d) { return (d.get("tag") != null ? d.get("tag") : d.get("title")).hashCode(); }

    /** Incoming call: loud heads-up notification on the calls channel; tapping opens the app where the call rings. */
    static void showCall(Context c, Map<String, String> d) {
        if (Build.VERSION.SDK_INT >= 26) {
            NotificationManager nm = (NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm.getNotificationChannel("calls") == null) {
                NotificationChannel ch = new NotificationChannel("calls", "Incoming calls", NotificationManager.IMPORTANCE_HIGH);
                ch.enableVibration(true); ch.setLockscreenVisibility(android.app.Notification.VISIBILITY_PUBLIC);
                nm.createNotificationChannel(ch);
            }
        }
        int nid = idFor(d);
        Intent open = new Intent(c, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent pi = PendingIntent.getActivity(c, nid, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        NotificationCompat.Builder b = new NotificationCompat.Builder(c, "calls")
            .setSmallIcon(R.drawable.ic_stat_primegram).setContentTitle(d.get("title")).setContentText(d.get("body"))
            .setCategory(NotificationCompat.CATEGORY_CALL).setPriority(NotificationCompat.PRIORITY_MAX)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC).setDefaults(NotificationCompat.DEFAULT_ALL)
            .setContentIntent(pi).setFullScreenIntent(pi, true).setTimeoutAfter(45000).setAutoCancel(true);
        ((NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE)).notify(nid, b.build());
    }

    static PendingIntent replyIntent(Context c, Map<String, String> d, int nid, String fixedText, boolean mutable, int code) {
        Intent i = new Intent(c, ReplyReceiver.class);
        i.setAction("com.primegram.app.REPLY." + code + "." + nid);
        i.putExtra("nid", nid);
        i.putExtra("kind", "group".equals(d.get("type")) ? "group" : "dm");
        i.putExtra("to", d.get("sender"));
        i.putExtra("group", d.get("group"));
        i.putExtra("title", d.get("title"));
        i.putExtra("body", d.get("body"));
        if (fixedText != null) i.putExtra("text", fixedText);
        int flags = PendingIntent.FLAG_UPDATE_CURRENT | (mutable ? (Build.VERSION.SDK_INT >= 31 ? PendingIntent.FLAG_MUTABLE : 0) : PendingIntent.FLAG_IMMUTABLE);
        return PendingIntent.getBroadcast(c, nid + code, i, flags);
    }

    static void show(Context c, Map<String, String> d) {
        ensureChannel(c);
        int nid = idFor(d);
        NotificationCompat.Builder b = new NotificationCompat.Builder(c, "messages")
            .setSmallIcon(R.drawable.ic_stat_primegram)
            .setContentTitle(d.get("title"))
            .setContentText(d.get("body"))
            .setStyle(new NotificationCompat.BigTextStyle().bigText(d.get("body")))
            .setCategory(NotificationCompat.CATEGORY_MESSAGE)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setDefaults(NotificationCompat.DEFAULT_ALL)
            .setAutoCancel(true);
        Intent open = new Intent(c, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        b.setContentIntent(PendingIntent.getActivity(c, nid, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE));

        RemoteInput ri = new RemoteInput.Builder("reply_text").setLabel("Reply…").build();
        NotificationCompat.Action reply = new NotificationCompat.Action.Builder(0, "Reply", replyIntent(c, d, nid, null, true, 0))
            .addRemoteInput(ri).setAllowGeneratedReplies(true).setSemanticAction(NotificationCompat.Action.SEMANTIC_ACTION_REPLY).build();
        b.addAction(reply);
        try {
            JSONArray s = new JSONArray(d.get("suggestions") == null ? "[]" : d.get("suggestions"));
            for (int k = 0; k < Math.min(2, s.length()); k++) {
                String t = s.optString(k, "").trim();
                if (t.isEmpty()) continue;
                b.addAction(new NotificationCompat.Action.Builder(0, t, replyIntent(c, d, nid, t, false, k + 1)).build());
            }
        } catch (Exception ignored) { }
        ((NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE)).notify(nid, b.build());
    }
}
