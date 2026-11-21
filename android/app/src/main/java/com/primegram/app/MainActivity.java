package com.primegram.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    /** True while the app is on screen: pushes then stay inside the app instead of showing a system notification. */
    public static volatile int startedActivities = 0;
    public static boolean isForeground() { return startedActivities > 0; }

    @Override
    public void onStart() { super.onStart(); startedActivities++; }

    @Override
    public void onStop() { super.onStop(); startedActivities = Math.max(0, startedActivities - 1); }

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
