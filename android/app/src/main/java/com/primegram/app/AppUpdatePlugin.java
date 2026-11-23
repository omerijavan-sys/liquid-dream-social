package com.primegram.app;

import android.webkit.WebView;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Web updates only. The app loads Primegram over HTTPS, so a new web version is picked up by dropping the
 * WebView's HTTP cache and reloading. This plugin never downloads or installs an APK.
 * Signed-in sessions are kept: only the cache is cleared, not cookies or localStorage.
 */
@CapacitorPlugin(name = "AppUpdate")
public class AppUpdatePlugin extends Plugin {
    @PluginMethod
    public void clearCacheAndReload(final PluginCall call) {
        getActivity().runOnUiThread(() -> {
            try {
                WebView wv = getBridge().getWebView();
                wv.clearCache(true);
                wv.clearHistory();
                wv.reload();
                JSObject r = new JSObject(); r.put("ok", true);
                call.resolve(r);
            } catch (Exception e) {
                call.reject(e.getMessage() == null ? "Couldn't reload" : e.getMessage());
            }
        });
    }
}
