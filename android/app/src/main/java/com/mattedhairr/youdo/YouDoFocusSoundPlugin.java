package com.mattedhairr.youdo;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/** "Keep playing" for focus sounds: runs FocusSoundService while a sound plays. */
@CapacitorPlugin(name = "YouDoFocusSound")
public class YouDoFocusSoundPlugin extends Plugin {
    @PluginMethod
    public void keepAlive(PluginCall call) {
        try {
            if (Boolean.TRUE.equals(call.getBoolean("on", false))) FocusSoundService.start(getContext());
            else FocusSoundService.stop(getContext());
            call.resolve();
        } catch (Exception e) {
            // Android 12+ refuses to start it from the background; the app retries next time it is open.
            call.reject("Could not keep the focus sound running", e);
        }
    }
}
