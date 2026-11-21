package com.primegram.app;

import android.content.ComponentName;
import android.content.pm.PackageManager;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/** Switches the launcher icon by enabling exactly one of the manifest activity-aliases. */
@CapacitorPlugin(name = "AppIcon")
public class AppIconPlugin extends Plugin {
    private static final String[] ALIASES = {"Default", "Gold", "Midnight", "Violet", "Emerald", "Rose", "Sky"};

    @PluginMethod
    public void set(PluginCall call) {
        String name = call.getString("name", "Default");
        boolean known = false;
        for (String a : ALIASES) if (a.equalsIgnoreCase(name)) { known = true; name = a; }
        if (!known) { call.reject("Unknown icon"); return; }
        PackageManager pm = getContext().getPackageManager();
        String pkg = getContext().getPackageName();
        for (String a : ALIASES) {
            int state = a.equals(name) ? PackageManager.COMPONENT_ENABLED_STATE_ENABLED : PackageManager.COMPONENT_ENABLED_STATE_DISABLED;
            pm.setComponentEnabledSetting(new ComponentName(pkg, "com.primegram.app.Icon" + a), state, PackageManager.DONT_KILL_APP);
        }
        call.resolve();
    }

    @PluginMethod
    public void get(PluginCall call) {
        PackageManager pm = getContext().getPackageManager();
        String pkg = getContext().getPackageName();
        String current = "Default";
        for (String a : ALIASES) {
            if (pm.getComponentEnabledSetting(new ComponentName(pkg, "com.primegram.app.Icon" + a)) == PackageManager.COMPONENT_ENABLED_STATE_ENABLED) current = a;
        }
        JSObject r = new JSObject();
        r.put("name", current);
        call.resolve(r);
    }
}
