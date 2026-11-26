package com.primegram.app;

import android.os.Bundle;
import android.view.KeyEvent;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    /** True while the app is on screen: pushes then stay inside the app instead of showing a system notification. */
    public static volatile int startedActivities = 0;
    public static boolean isForeground() { return startedActivities > 0; }

    @Override
    public void onStart() { super.onStart(); startedActivities++; }

    @Override
    public void onStop() { super.onStop(); startedActivities = Math.max(0, startedActivities - 1); }

    /** Volume up also unmutes videos: tell the web app, then let Android change the volume as usual. */
    @Override
    public boolean onKeyDown(int keyCode, KeyEvent event) {
        if (keyCode == KeyEvent.KEYCODE_VOLUME_UP && getBridge() != null && getBridge().getWebView() != null) {
            getBridge().getWebView().post(() -> getBridge().getWebView().evaluateJavascript(
                "window.dispatchEvent(new Event('primegram:volume-up'))", null));
        }
        return super.onKeyDown(keyCode, event);
    }

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(AppIconPlugin.class);
        registerPlugin(GalleryPlugin.class);
        registerPlugin(MusicServicePlugin.class);
        registerPlugin(AppUpdatePlugin.class);
        registerPlugin(NotifyConfigPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
