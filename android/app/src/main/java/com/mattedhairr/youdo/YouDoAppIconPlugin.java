package com.mattedhairr.youdo;

import android.content.ComponentName;
import android.content.Context;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Lets the user pick the home-screen icon. Each icon is an activity-alias of
 * YouDoActivity (AndroidManifest.xml); exactly one is enabled. The choice is
 * stored as pending and applied from YouDoActivity.onStop, because switching
 * the enabled entry while the app is in front can close it on some phones.
 * Keep IDS / ALIASES in sync with src/lib/appIconVariants.json.
 */
@CapacitorPlugin(name = "YouDoAppIcon")
public class YouDoAppIconPlugin extends Plugin {
    private static final String PREFS = "youdo_app_icon";
    private static final String KEY_PENDING = "pending";
    static final String[] IDS = { "signature", "ivory", "sand", "onyx", "linen" };
    static final String[] ALIASES = { "MainActivity", "IconIvory", "IconSand", "IconOnyx", "IconLinen" };

    @PluginMethod
    public void getIcon(PluginCall call) {
        Context ctx = getContext();
        JSObject result = new JSObject();
        result.put("current", currentId(ctx));
        String pending = prefs(ctx).getString(KEY_PENDING, null);
        if (pending != null) result.put("pending", pending);
        call.resolve(result);
    }

    @PluginMethod
    public void setIcon(PluginCall call) {
        String id = call.getString("id");
        if (indexOf(id) < 0) {
            call.reject("Unknown icon: " + id);
            return;
        }
        Context ctx = getContext();
        SharedPreferences.Editor editor = prefs(ctx).edit();
        if (id.equals(currentId(ctx))) editor.remove(KEY_PENDING);
        else editor.putString(KEY_PENDING, id);
        editor.apply();
        JSObject result = new JSObject();
        result.put("current", currentId(ctx));
        if (!id.equals(currentId(ctx))) result.put("pending", id);
        call.resolve(result);
    }

    /** Enables the chosen launcher entry, then disables the rest. */
    static void applyPending(Context ctx) {
        SharedPreferences prefs = prefs(ctx);
        String pending = prefs.getString(KEY_PENDING, null);
        if (pending == null) return;
        int target = indexOf(pending);
        prefs.edit().remove(KEY_PENDING).apply();
        if (target < 0 || pending.equals(currentId(ctx))) return;
        PackageManager pm = ctx.getPackageManager();
        try {
            // Enable first so the app is never left without a home-screen entry.
            pm.setComponentEnabledSetting(component(ctx, target),
                PackageManager.COMPONENT_ENABLED_STATE_ENABLED, PackageManager.DONT_KILL_APP);
            for (int i = 0; i < ALIASES.length; i++) {
                if (i == target) continue;
                pm.setComponentEnabledSetting(component(ctx, i),
                    PackageManager.COMPONENT_ENABLED_STATE_DISABLED, PackageManager.DONT_KILL_APP);
            }
        } catch (RuntimeException ignored) {
            // A launcher entry missing from this build: keep the current icon.
        }
    }

    /** The enabled entry; the default (".MainActivity") is enabled in the manifest. */
    static String currentId(Context ctx) {
        PackageManager pm = ctx.getPackageManager();
        for (int i = 1; i < ALIASES.length; i++) {
            if (pm.getComponentEnabledSetting(component(ctx, i)) == PackageManager.COMPONENT_ENABLED_STATE_ENABLED) {
                return IDS[i];
            }
        }
        return IDS[0];
    }

    private static ComponentName component(Context ctx, int index) {
        return new ComponentName(ctx.getPackageName(), YouDoActivity.class.getPackage().getName() + "." + ALIASES[index]);
    }

    private static int indexOf(String id) {
        if (id == null) return -1;
        for (int i = 0; i < IDS.length; i++) if (IDS[i].equals(id)) return i;
        return -1;
    }

    private static SharedPreferences prefs(Context ctx) {
        return ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }
}
