package com.primegram.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import androidx.core.content.ContextCompat;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/** Bridges the music foreground service (notification buttons) and the web player. */
@CapacitorPlugin(name = "MusicService")
public class MusicServicePlugin extends Plugin {
    private BroadcastReceiver receiver;

    @Override public void load() {
        receiver = new BroadcastReceiver() {
            @Override public void onReceive(Context c, Intent i) {
                JSObject o = new JSObject();
                o.put("action", i.getStringExtra("a"));
                notifyListeners("action", o, true);
            }
        };
        ContextCompat.registerReceiver(getContext(), receiver, new IntentFilter(MusicService.ACTION), ContextCompat.RECEIVER_NOT_EXPORTED);
    }

    @PluginMethod public void update(PluginCall call) {
        String title = call.getString("title", "Primegram");
        String artist = call.getString("artist", "");
        boolean playing = Boolean.TRUE.equals(call.getBoolean("playing", true));
        try {
            if (MusicService.instance != null) MusicService.instance.show(title, artist, playing);
            else {
                Intent i = new Intent(getContext(), MusicService.class).putExtra("title", title).putExtra("artist", artist).putExtra("playing", playing);
                ContextCompat.startForegroundService(getContext(), i);
            }
            call.resolve();
        } catch (Exception e) {
            call.reject("Could not start background playback: " + e.getMessage());
        }
    }

    @PluginMethod public void stop(PluginCall call) {
        getContext().stopService(new Intent(getContext(), MusicService.class));
        call.resolve();
    }

    @Override protected void handleOnDestroy() {
        try { if (receiver != null) getContext().unregisterReceiver(receiver); } catch (Exception ignored) { }
    }
}
