package com.primegram.app;

import android.Manifest;
import android.content.ContentResolver;
import android.content.ContentUris;
import android.database.Cursor;
import android.graphics.Bitmap;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.provider.MediaStore;
import android.util.Base64;
import android.util.Size;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;

/** In-app gallery: lists the phone's photos/videos with thumbnails and copies a chosen one into app cache. */
@CapacitorPlugin(
    name = "Gallery",
    permissions = {
        @Permission(alias = "media", strings = { Manifest.permission.READ_MEDIA_IMAGES, Manifest.permission.READ_MEDIA_VIDEO }),
        @Permission(alias = "storage", strings = { Manifest.permission.READ_EXTERNAL_STORAGE })
    }
)
public class GalleryPlugin extends Plugin {
    private String alias() { return Build.VERSION.SDK_INT >= 33 ? "media" : "storage"; }

    @PluginMethod
    public void ensurePermission(PluginCall call) {
        if (getPermissionState(alias()) == PermissionState.GRANTED) {
            JSObject r = new JSObject(); r.put("granted", true); call.resolve(r);
        } else {
            requestPermissionForAlias(alias(), call, "permResult");
        }
    }

    @PermissionCallback
    private void permResult(PluginCall call) {
        JSObject r = new JSObject();
        r.put("granted", getPermissionState(alias()) == PermissionState.GRANTED);
        call.resolve(r);
    }

    @PluginMethod
    public void list(PluginCall call) {
        final String type = call.getString("type", "all");
        final int limit = call.getInt("limit", 60);
        final int offset = call.getInt("offset", 0);
        new Thread(() -> {
            try {
                ContentResolver cr = getContext().getContentResolver();
                Uri files = MediaStore.Files.getContentUri("external");
                String selection;
                if ("image".equals(type)) selection = MediaStore.Files.FileColumns.MEDIA_TYPE + "=" + MediaStore.Files.FileColumns.MEDIA_TYPE_IMAGE;
                else if ("video".equals(type)) selection = MediaStore.Files.FileColumns.MEDIA_TYPE + "=" + MediaStore.Files.FileColumns.MEDIA_TYPE_VIDEO;
                else selection = MediaStore.Files.FileColumns.MEDIA_TYPE + " IN (" + MediaStore.Files.FileColumns.MEDIA_TYPE_IMAGE + "," + MediaStore.Files.FileColumns.MEDIA_TYPE_VIDEO + ")";
                String[] proj = {
                    MediaStore.Files.FileColumns._ID, MediaStore.Files.FileColumns.MEDIA_TYPE, MediaStore.Files.FileColumns.DISPLAY_NAME,
                    MediaStore.Files.FileColumns.MIME_TYPE, MediaStore.Files.FileColumns.DATE_ADDED, MediaStore.Files.FileColumns.SIZE
                };
                Cursor c;
                if (Build.VERSION.SDK_INT >= 26) {
                    Bundle b = new Bundle();
                    b.putString(ContentResolver.QUERY_ARG_SQL_SELECTION, selection);
                    b.putStringArray(ContentResolver.QUERY_ARG_SORT_COLUMNS, new String[] { MediaStore.Files.FileColumns.DATE_ADDED });
                    b.putInt(ContentResolver.QUERY_ARG_SORT_DIRECTION, ContentResolver.QUERY_SORT_DIRECTION_DESCENDING);
                    b.putInt(ContentResolver.QUERY_ARG_LIMIT, limit);
                    b.putInt(ContentResolver.QUERY_ARG_OFFSET, offset);
                    c = cr.query(files, proj, b, null);
                } else {
                    c = cr.query(files, proj, selection, null, MediaStore.Files.FileColumns.DATE_ADDED + " DESC");
                }
                JSArray items = new JSArray();
                if (c != null) {
                    try {
                        if (Build.VERSION.SDK_INT < 26) c.moveToPosition(offset - 1);
                        int n = 0;
                        while (c.moveToNext() && n < limit) {
                            long id = c.getLong(0);
                            boolean video = c.getInt(1) == MediaStore.Files.FileColumns.MEDIA_TYPE_VIDEO;
                            Uri uri = ContentUris.withAppendedId(video ? MediaStore.Video.Media.EXTERNAL_CONTENT_URI : MediaStore.Images.Media.EXTERNAL_CONTENT_URI, id);
                            JSObject o = new JSObject();
                            o.put("uri", uri.toString());
                            o.put("type", video ? "video" : "image");
                            o.put("name", c.getString(2));
                            o.put("mime", c.getString(3));
                            o.put("date", c.getLong(4));
                            o.put("size", c.getLong(5));
                            o.put("thumb", thumb(cr, uri, id, video));
                            items.put(o);
                            n++;
                        }
                    } finally { c.close(); }
                }
                JSObject r = new JSObject();
                r.put("items", items);
                call.resolve(r);
            } catch (Exception e) {
                call.reject("Could not read the gallery: " + e.getMessage());
            }
        }).start();
    }

    private String thumb(ContentResolver cr, Uri uri, long id, boolean video) {
        try {
            Bitmap bmp = null;
            if (Build.VERSION.SDK_INT >= 29) {
                bmp = cr.loadThumbnail(uri, new Size(256, 256), null);
            } else if (video) {
                bmp = MediaStore.Video.Thumbnails.getThumbnail(cr, id, MediaStore.Video.Thumbnails.MINI_KIND, null);
            } else {
                bmp = MediaStore.Images.Thumbnails.getThumbnail(cr, id, MediaStore.Images.Thumbnails.MINI_KIND, null);
            }
            if (bmp == null) return "";
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            bmp.compress(Bitmap.CompressFormat.JPEG, 70, out);
            return "data:image/jpeg;base64," + Base64.encodeToString(out.toByteArray(), Base64.NO_WRAP);
        } catch (Exception e) {
            return "";
        }
    }

    /** Copies the chosen item into the app's cache so the web layer can read it as a normal file. */
    @PluginMethod
    public void copy(PluginCall call) {
        final String uriStr = call.getString("uri");
        final String name = call.getString("name", "media");
        if (uriStr == null) { call.reject("No file chosen"); return; }
        new Thread(() -> {
            try {
                File dir = new File(getContext().getCacheDir(), "picked");
                if (!dir.exists()) dir.mkdirs();
                String safe = name.replaceAll("[^A-Za-z0-9._-]", "_");
                File out = new File(dir, System.currentTimeMillis() + "_" + safe);
                try (InputStream in = getContext().getContentResolver().openInputStream(Uri.parse(uriStr)); OutputStream os = new FileOutputStream(out)) {
                    if (in == null) throw new Exception("Cannot open file");
                    byte[] buf = new byte[64 * 1024];
                    int r;
                    while ((r = in.read(buf)) > 0) os.write(buf, 0, r);
                }
                JSObject res = new JSObject();
                res.put("path", out.getAbsolutePath());
                res.put("size", out.length());
                call.resolve(res);
            } catch (Exception e) {
                call.reject("Could not open that file: " + e.getMessage());
            }
        }).start();
    }
}
