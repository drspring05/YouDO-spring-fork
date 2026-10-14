package com.mattedhairr.youdo;

import android.Manifest;
import android.content.ContentUris;
import android.content.Intent;
import android.database.Cursor;
import android.net.Uri;
import android.provider.CalendarContract;
import android.provider.Settings;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import java.util.HashMap;
import java.util.Map;

/**
 * Reads the phone's calendar (which includes any Google account added to the phone).
 * Permissions are exposed as the aliases readCalendar / writeCalendar; Capacitor supplies
 * checkPermissions() and requestPermissions() for them.
 */
@CapacitorPlugin(
    name = "YouDoCalendar",
    permissions = {
        @Permission(strings = { Manifest.permission.READ_CALENDAR }, alias = "readCalendar"),
        @Permission(strings = { Manifest.permission.WRITE_CALENDAR }, alias = "writeCalendar")
    }
)
public class YouDoCalendarPlugin extends Plugin {
    private static final long MAX_RANGE_MS = 400L * 24L * 60L * 60L * 1000L;
    private static final int MAX_EVENTS = 5000;
    private static final String FALLBACK_COLOR = "#8B8B8B";

    private static final String[] CALENDAR_PROJECTION = {
        CalendarContract.Calendars._ID,
        CalendarContract.Calendars.CALENDAR_DISPLAY_NAME,
        CalendarContract.Calendars.ACCOUNT_NAME,
        CalendarContract.Calendars.CALENDAR_COLOR,
        CalendarContract.Calendars.CALENDAR_ACCESS_LEVEL,
        CalendarContract.Calendars.VISIBLE
    };

    private static final String[] INSTANCE_PROJECTION = {
        CalendarContract.Instances.EVENT_ID,
        CalendarContract.Instances.BEGIN,
        CalendarContract.Instances.END,
        CalendarContract.Instances.TITLE,
        CalendarContract.Instances.DESCRIPTION,
        CalendarContract.Instances.EVENT_LOCATION,
        CalendarContract.Instances.ALL_DAY,
        CalendarContract.Instances.CALENDAR_ID,
        CalendarContract.Instances.EVENT_COLOR,
        CalendarContract.Instances.STATUS
    };

    private boolean canRead() {
        return getPermissionState("readCalendar") == PermissionState.GRANTED;
    }

    private static String hexColor(int color) {
        return String.format("#%06X", 0xFFFFFF & color);
    }

    private static String text(Cursor cursor, int index) {
        return cursor.isNull(index) ? "" : cursor.getString(index);
    }

    /** One pass over the calendars table, keyed by calendar id. */
    private Map<Long, JSObject> loadCalendars() {
        Map<Long, JSObject> calendars = new HashMap<>();
        try (Cursor cursor = getContext().getContentResolver().query(
            CalendarContract.Calendars.CONTENT_URI,
            CALENDAR_PROJECTION,
            null,
            null,
            CalendarContract.Calendars.CALENDAR_DISPLAY_NAME + " ASC"
        )) {
            if (cursor == null) return calendars;
            while (cursor.moveToNext()) {
                long id = cursor.getLong(0);
                JSObject calendar = new JSObject();
                calendar.put("id", String.valueOf(id));
                calendar.put("name", text(cursor, 1));
                calendar.put("accountName", text(cursor, 2));
                calendar.put("color", cursor.isNull(3) ? FALLBACK_COLOR : hexColor(cursor.getInt(3)));
                calendar.put("writable", cursor.getInt(4) >= CalendarContract.Calendars.CAL_ACCESS_CONTRIBUTOR);
                calendar.put("visible", cursor.getInt(5) == 1);
                calendars.put(id, calendar);
            }
        }
        return calendars;
    }

    @PluginMethod
    public void listCalendars(PluginCall call) {
        if (!canRead()) {
            call.reject("Calendar permission is not granted.", "PERMISSION_DENIED");
            return;
        }
        try {
            JSArray list = new JSArray();
            for (JSObject calendar : loadCalendars().values()) list.put(calendar);
            JSObject result = new JSObject();
            result.put("calendars", list);
            call.resolve(result);
        } catch (Exception error) {
            call.reject("Could not read your calendars.");
        }
    }

    /**
     * Events overlapping [start, end) in epoch milliseconds. Uses the Instances table so repeating
     * events arrive already expanded into the individual occurrences inside the window.
     */
    @PluginMethod
    public void listEvents(PluginCall call) {
        if (!canRead()) {
            call.reject("Calendar permission is not granted.", "PERMISSION_DENIED");
            return;
        }
        long start = call.getData().optLong("start", -1);
        long end = call.getData().optLong("end", -1);
        if (start < 0 || end <= start || end - start > MAX_RANGE_MS) {
            call.reject("Invalid date range.");
            return;
        }
        try {
            Map<Long, JSObject> calendars = loadCalendars();
            Uri.Builder builder = CalendarContract.Instances.CONTENT_URI.buildUpon();
            ContentUris.appendId(builder, start);
            ContentUris.appendId(builder, end);

            JSArray events = new JSArray();
            boolean truncated = false;
            try (Cursor cursor = getContext().getContentResolver().query(
                builder.build(),
                INSTANCE_PROJECTION,
                null,
                null,
                CalendarContract.Instances.BEGIN + " ASC"
            )) {
                if (cursor != null) {
                    int count = 0;
                    while (cursor.moveToNext()) {
                        if (cursor.getInt(9) == CalendarContract.Events.STATUS_CANCELED) continue;
                        if (count >= MAX_EVENTS) {
                            truncated = true;
                            break;
                        }
                        long calendarId = cursor.getLong(7);
                        JSObject calendar = calendars.get(calendarId);

                        String color = FALLBACK_COLOR;
                        if (!cursor.isNull(8) && cursor.getInt(8) != 0) {
                            color = hexColor(cursor.getInt(8));
                        } else if (calendar != null) {
                            color = calendar.getString("color");
                        }

                        JSObject event = new JSObject();
                        event.put("id", String.valueOf(cursor.getLong(0)));
                        event.put("calendarId", String.valueOf(calendarId));
                        event.put("begin", cursor.getLong(1));
                        event.put("end", cursor.getLong(2));
                        event.put("title", text(cursor, 3));
                        event.put("description", text(cursor, 4));
                        event.put("location", text(cursor, 5));
                        event.put("allDay", cursor.getInt(6) == 1);
                        event.put("color", color);
                        event.put("writable", calendar != null && calendar.optBoolean("writable", false));
                        events.put(event);
                        count++;
                    }
                }
            }
            JSObject result = new JSObject();
            result.put("events", events);
            result.put("truncated", truncated);
            call.resolve(result);
        } catch (SecurityException error) {
            call.reject("Calendar permission is not granted.", "PERMISSION_DENIED");
        } catch (Exception error) {
            call.reject("Could not read your calendar events.");
        }
    }

    /** Opens this app's page in Android Settings so a permanently denied permission can be enabled. */
    @PluginMethod
    public void openAppSettings(PluginCall call) {
        try {
            Intent intent = new Intent(
                Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
                Uri.parse("package:" + getContext().getPackageName())
            );
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
            call.resolve();
        } catch (Exception error) {
            call.reject("Could not open Android settings.");
        }
    }
}
