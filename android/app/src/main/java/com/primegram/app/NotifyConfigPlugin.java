package com.primegram.app;

import android.content.Context;
import android.content.SharedPreferences;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/** Gives the native notification code what it needs to send a reply while the app is closed. */
@CapacitorPlugin(name = "NotifyConfig")
public class NotifyConfigPlugin extends Plugin {
    static SharedPreferences prefs(Context c) { return c.getSharedPreferences("primegram_notify", Context.MODE_PRIVATE); }

    @PluginMethod
    public void set(PluginCall call) {
        SharedPreferences.Editor e = prefs(getContext()).edit();
        if (call.getString("token") != null) e.putString("token", call.getString("token"));
        if (call.getString("url") != null) e.putString("url", call.getString("url"));
        if (call.getString("key") != null) e.putString("key", call.getString("key"));
        e.apply();
        call.resolve();
    }

    @PluginMethod
    public void clear(PluginCall call) { prefs(getContext()).edit().clear().apply(); call.resolve(); }
}
