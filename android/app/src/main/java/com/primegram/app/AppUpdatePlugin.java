package com.primegram.app;

import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import androidx.core.content.FileProvider;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;

/**
 * In-app updater. Downloads the new APK inside the app (so the browser's "this file might be harmful"
 * warning never appears) and hands it to Android's own installer through a FileProvider.
 */
@CapacitorPlugin(name = "AppUpdate")
public class AppUpdatePlugin extends Plugin {
    private volatile boolean cancelled = false;
    private volatile boolean running = false;

    private File target() {
        File dir = new File(getContext().getCacheDir(), "updates");
        if (!dir.exists()) dir.mkdirs();
        return new File(dir, "primegram-update.apk");
    }

    @PluginMethod
    public void download(final PluginCall call) {
        final String url = call.getString("url");
        if (url == null || running) { call.reject(running ? "Already downloading" : "Missing url"); return; }
        running = true; cancelled = false;
        new Thread(() -> {
            File out = target();
            File part = new File(out.getParentFile(), "primegram-update.part");
            try {
                String current = url;
                HttpURLConnection c = null;
                for (int hops = 0; hops < 6; hops++) {
                    c = (HttpURLConnection) new URL(current).openConnection();
                    c.setInstanceFollowRedirects(false);
                    c.setConnectTimeout(20000); c.setReadTimeout(30000);
                    c.setRequestProperty("User-Agent", "Primegram-Updater");
                    int code = c.getResponseCode();
                    if (code >= 300 && code < 400 && c.getHeaderField("Location") != null) {
                        current = new URL(new URL(current), c.getHeaderField("Location")).toString();
                        c.disconnect();
                        continue;
                    }
                    if (code != 200) throw new Exception("Server answered " + code);
                    break;
                }
                long total = c.getContentLengthLong();
                long got = 0; long lastEmit = 0;
                try (InputStream in = c.getInputStream(); FileOutputStream fo = new FileOutputStream(part)) {
                    byte[] buf = new byte[64 * 1024];
                    int n;
                    while ((n = in.read(buf)) != -1) {
                        if (cancelled) throw new Exception("Cancelled");
                        fo.write(buf, 0, n);
                        got += n;
                        long now = System.currentTimeMillis();
                        if (now - lastEmit > 150) {
                            lastEmit = now;
                            JSObject ev = new JSObject();
                            ev.put("received", got); ev.put("total", total);
                            ev.put("pct", total > 0 ? Math.min(99, (int) (got * 100 / total)) : 0);
                            notifyListeners("progress", ev);
                        }
                    }
                }
                if (total > 0 && got < total) throw new Exception("Download was cut off");
                if (out.exists()) out.delete();
                if (!part.renameTo(out)) throw new Exception("Couldn't save the update");
                JSObject done = new JSObject();
                done.put("received", got); done.put("total", got); done.put("pct", 100);
                notifyListeners("progress", done);
                JSObject res = new JSObject(); res.put("size", got);
                call.resolve(res);
            } catch (Exception e) {
                part.delete();
                call.reject(e.getMessage() == null ? "Download failed" : e.getMessage());
            } finally {
                running = false;
            }
        }).start();
    }

    @PluginMethod
    public void cancel(PluginCall call) { cancelled = true; call.resolve(); }

    @PluginMethod
    public void hasDownload(PluginCall call) {
        JSObject r = new JSObject(); r.put("exists", target().exists()); call.resolve(r);
    }

    /** Opens Android's installer for the downloaded file. If installs from Primegram aren't allowed yet, opens that one switch. */
    @PluginMethod
    public void install(PluginCall call) {
        Context ctx = getContext();
        File apk = target();
        if (!apk.exists()) { call.reject("Nothing downloaded yet"); return; }
        JSObject r = new JSObject();
        if (Build.VERSION.SDK_INT >= 26 && !ctx.getPackageManager().canRequestPackageInstalls()) {
            Intent s = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:" + ctx.getPackageName()));
            s.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            ctx.startActivity(s);
            r.put("needsPermission", true);
            call.resolve(r);
            return;
        }
        Uri uri = FileProvider.getUriForFile(ctx, ctx.getPackageName() + ".fileprovider", apk);
        Intent i = new Intent(Intent.ACTION_VIEW);
        i.setDataAndType(uri, "application/vnd.android.package-archive");
        i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
        ctx.startActivity(i);
        r.put("needsPermission", false);
        call.resolve(r);
    }
}
