package com.primegram.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import androidx.core.content.ContextCompat;
import com.getcapacitor.JSObject;
import com.getcapacitor.JSArray;
import java.util.ArrayList;
import org.json.JSONObject;
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
        MusicService.listener = (index, pos, dur, playing, ended, error) -> {
            JSObject o = new JSObject();
            o.put("index", index); o.put("pos", pos); o.put("dur", dur); o.put("playing", playing); o.put("ended", ended); o.put("error", error);
            notifyListeners("native", o);
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

    private ArrayList<String[]> items(PluginCall call) throws Exception {
        JSArray arr = call.getArray("items");
        ArrayList<String[]> out = new ArrayList<>();
        for (int i = 0; i < arr.length(); i++) {
            JSONObject o = arr.getJSONObject(i);
            out.add(new String[] { o.getString("url"), o.optString("title", "Primegram"), o.optString("artist", "") });
        }
        return out;
    }

    /** Plays a list of songs inside the service so they keep going with the app closed. */
    @PluginMethod public void playQueue(PluginCall call) {
        try {
            MusicService.pendingItems = items(call);
            MusicService.pendingIndex = call.getInt("index", 0);
            MusicService.pendingStart = call.getInt("start", 0);
            ContextCompat.startForegroundService(getContext(), new Intent(getContext(), MusicService.class).setAction("PLAY"));
            call.resolve();
        } catch (Exception e) { call.reject("Could not start playback: " + e.getMessage()); }
    }
    @PluginMethod public void appendQueue(PluginCall call) {
        try { if (MusicService.instance != null) MusicService.instance.append(items(call)); call.resolve(); }
        catch (Exception e) { call.reject(e.getMessage()); }
    }
    @PluginMethod public void control(PluginCall call) {
        if (MusicService.instance != null) MusicService.instance.control(call.getString("action", "toggle"));
        call.resolve();
    }
    @PluginMethod public void seek(PluginCall call) {
        if (MusicService.instance != null) MusicService.instance.seek(call.getInt("pos", 0), Boolean.TRUE.equals(call.getBoolean("play", false)));
        call.resolve();
    }

    @PluginMethod public void stop(PluginCall call) {
        if (MusicService.instance != null) MusicService.instance.killPlayback();
        else getContext().stopService(new Intent(getContext(), MusicService.class));
        call.resolve();
    }

    @Override protected void handleOnDestroy() {
        MusicService.listener = null;
        try { if (receiver != null) getContext().unregisterReceiver(receiver); } catch (Exception ignored) { }
    }
}
