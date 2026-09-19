package com.groovyshelves.twa;

import android.Manifest;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.BitmapFactory;
import android.net.Uri;
import android.os.Build;
import android.util.Log;

import androidx.annotation.NonNull;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;

import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;

import java.util.Map;

public class GroovyFirebaseMessagingService extends FirebaseMessagingService {
    private static final String TAG = "GroovyFCM";
    private static final String DEFAULT_URL = "https://groovyshelves.com/price-alerts";

    @Override
    public void onMessageReceived(@NonNull RemoteMessage remoteMessage) {
        Map<String, String> data = remoteMessage.getData();
        String title = nonEmpty(data.get("title"), "Groovy · Price Alert");
        String body = nonEmpty(data.get("body"), "A new vinyl listing matches one of your alerts.");
        String url = trustedUrl(data.get("url"));
        String tag = nonEmpty(data.get("tag"), "groovy-price-alert");

        createNotificationChannel();

        if (Build.VERSION.SDK_INT >= 33 &&
            checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            Log.w(TAG, "Notification permission is not granted.");
            return;
        }

        Intent openIntent = new Intent(this, LauncherActivity.class)
            .setAction(Intent.ACTION_VIEW)
            .setData(Uri.parse(url))
            .addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);

        PendingIntent pendingIntent = PendingIntent.getActivity(
            this,
            tag.hashCode(),
            openIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        NotificationCompat.Builder builder = new NotificationCompat.Builder(
            this,
            getString(R.string.price_alert_channel_id)
        )
            .setSmallIcon(R.drawable.ic_notification)
            .setLargeIcon(BitmapFactory.decodeResource(getResources(), R.drawable.app_icon))
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(new NotificationCompat.BigTextStyle().bigText(body))
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setCategory(NotificationCompat.CATEGORY_RECOMMENDATION)
            .setAutoCancel(true)
            .setContentIntent(pendingIntent);

        NotificationManagerCompat.from(this).notify(tag, tag.hashCode(), builder.build());
    }

    @Override
    public void onNewToken(@NonNull String token) {
        super.onNewToken(token);
        getSharedPreferences("groovy_native_push", MODE_PRIVATE)
            .edit()
            .putString("last_fcm_token", token)
            .apply();
        Log.d(TAG, "FCM token refreshed; it will be registered on the next app launch.");
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            return;
        }
        NotificationManager manager = getSystemService(NotificationManager.class);
        if (manager == null) {
            return;
        }
        NotificationChannel channel = new NotificationChannel(
            getString(R.string.price_alert_channel_id),
            getString(R.string.price_alert_channel_name),
            NotificationManager.IMPORTANCE_HIGH
        );
        channel.setDescription(getString(R.string.price_alert_channel_description));
        manager.createNotificationChannel(channel);
    }

    private String trustedUrl(String value) {
        if (value == null || value.trim().isEmpty()) {
            return DEFAULT_URL;
        }
        try {
            Uri uri = Uri.parse(value.trim());
            if ("https".equalsIgnoreCase(uri.getScheme()) &&
                "groovyshelves.com".equalsIgnoreCase(uri.getHost())) {
                return uri.toString();
            }
        } catch (Exception ignored) {
        }
        return DEFAULT_URL;
    }

    private String nonEmpty(String value, String fallback) {
        return value == null || value.trim().isEmpty() ? fallback : value.trim();
    }
}
