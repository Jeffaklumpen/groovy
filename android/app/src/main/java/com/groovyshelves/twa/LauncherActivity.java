package com.groovyshelves.twa;

import android.Manifest;
import android.app.Activity;
import android.content.ComponentName;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.browser.customtabs.CustomTabsCallback;
import androidx.browser.customtabs.CustomTabsClient;
import androidx.browser.customtabs.CustomTabsService;
import androidx.browser.customtabs.CustomTabsServiceConnection;
import androidx.browser.customtabs.CustomTabsSession;
import androidx.browser.trusted.TrustedWebActivityIntentBuilder;

import com.google.firebase.messaging.FirebaseMessaging;

import org.json.JSONException;
import org.json.JSONObject;

public class LauncherActivity extends Activity {
    private static final String TAG = "GroovyTWA";
    private static final Uri APP_ORIGIN = Uri.parse("https://groovyshelves.com");
    private static final Uri DEFAULT_URL = Uri.parse("https://groovyshelves.com/");
    private static final int NOTIFICATION_PERMISSION_REQUEST = 1201;

    private CustomTabsClient client;
    private CustomTabsSession session;
    private boolean originValidated = false;
    private boolean navigationFinished = false;
    private boolean channelRequested = false;
    private boolean channelReady = false;
    private int channelRequestAttempts = 0;
    private final Handler handler = new Handler(Looper.getMainLooper());
    private String currentFcmToken = "";
    private boolean initialLaunchStarted = false;

    @Override
    protected void onCreate(@Nullable Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        requestNotificationPermissionIfNeeded();
        bindCustomTabsService();
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        if (session != null) {
            launchTrustedWebActivity(withCurrentNativePushToken(resolveLaunchUrl(intent)));
        }
    }

    private void requestNotificationPermissionIfNeeded() {
        if (Build.VERSION.SDK_INT >= 33 &&
            checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(
                new String[]{Manifest.permission.POST_NOTIFICATIONS},
                NOTIFICATION_PERMISSION_REQUEST
            );
        }
    }

    private void bindCustomTabsService() {
        String browserPackage = CustomTabsClient.getPackageName(this, null);
        if (browserPackage == null) {
            openFallback(resolveLaunchUrl(getIntent()));
            return;
        }

        boolean binding = CustomTabsClient.bindCustomTabsService(
            this,
            browserPackage,
            new CustomTabsServiceConnection() {
                @Override
                public void onCustomTabsServiceConnected(
                    @NonNull ComponentName name,
                    @NonNull CustomTabsClient connectedClient
                ) {
                    client = connectedClient;
                    client.warmup(0L);
                    session = client.newSession(customTabsCallback);
                    if (session == null) {
                        openFallback(resolveLaunchUrl(getIntent()));
                        return;
                    }

                    boolean validationRequested = session.validateRelationship(
                        CustomTabsService.RELATION_USE_AS_ORIGIN,
                        APP_ORIGIN,
                        null
                    );
                    Log.d(TAG, "PostMessage origin validation requested: " + validationRequested);

                    launchInitialTrustedWebActivity();
                }

                @Override
                public void onServiceDisconnected(ComponentName name) {
                    client = null;
                    session = null;
                }
            }
        );

        if (!binding) {
            openFallback(resolveLaunchUrl(getIntent()));
        }
    }

    private final CustomTabsCallback customTabsCallback = new CustomTabsCallback() {
        @Override
        public void onRelationshipValidationResult(
            int relation,
            @NonNull Uri requestedOrigin,
            boolean result,
            @Nullable Bundle extras
        ) {
            if (relation == CustomTabsService.RELATION_USE_AS_ORIGIN &&
                APP_ORIGIN.equals(requestedOrigin)) {
                originValidated = result;
                Log.d(TAG, "PostMessage origin validation: " + result);
                maybeRequestPostMessageChannel();
            }
        }

        @Override
        public void onNavigationEvent(int navigationEvent, @Nullable Bundle extras) {
            if (navigationEvent == NAVIGATION_FINISHED) {
                navigationFinished = true;
                maybeRequestPostMessageChannel();
            }
        }

        @Override
        public void onMessageChannelReady(@Nullable Bundle extras) {
            channelReady = true;
            Log.d(TAG, "PostMessage channel ready");
            sendFcmTokenToWeb();
            handler.postDelayed(LauncherActivity.this::sendFcmTokenToWeb, 1000L);
            handler.postDelayed(LauncherActivity.this::sendFcmTokenToWeb, 3000L);
        }

        @Override
        public void onPostMessage(@NonNull String message, @Nullable Bundle extras) {
            Log.d(TAG, "Web bridge message: " + message);
        }
    };

    private void maybeRequestPostMessageChannel() {
        if (!navigationFinished || channelRequested || session == null) {
            return;
        }

        channelRequestAttempts++;
        try {
            channelRequested = session.requestPostMessageChannel(APP_ORIGIN, APP_ORIGIN, new Bundle());
            Log.d(
                TAG,
                "PostMessage channel requested: " + channelRequested +
                " (attempt " + channelRequestAttempts + ", validation-result=" + originValidated + ")"
            );
        } catch (UnsupportedOperationException error) {
            Log.w(TAG, "Browser does not support TWA postMessage", error);
            channelRequested = false;
        }

        if (!channelRequested && channelRequestAttempts < 3) {
            handler.postDelayed(this::maybeRequestPostMessageChannel, 1000L);
        }
    }

    private void launchInitialTrustedWebActivity() {
        Uri launchUrl = resolveLaunchUrl(getIntent());
        String cachedToken = getSharedPreferences("groovy_native_push", MODE_PRIVATE)
            .getString("last_fcm_token", "");

        if (cachedToken != null && !cachedToken.isEmpty()) {
            currentFcmToken = cachedToken;
            initialLaunchStarted = true;
            launchTrustedWebActivity(withNativePushToken(launchUrl, cachedToken));
            loadCurrentFcmToken();
            return;
        }

        handler.postDelayed(() -> {
            if (initialLaunchStarted || session == null) {
                return;
            }
            initialLaunchStarted = true;
            Log.w(TAG, "FCM token was not ready before launch; opening Groovy without token fragment.");
            launchTrustedWebActivity(launchUrl);
        }, 3000L);

        FirebaseMessaging.getInstance().getToken().addOnCompleteListener(task -> {
            if (!task.isSuccessful() || task.getResult() == null || task.getResult().isEmpty()) {
                Log.w(TAG, "Could not get initial FCM token", task.getException());
                if (!initialLaunchStarted && session != null) {
                    initialLaunchStarted = true;
                    launchTrustedWebActivity(launchUrl);
                }
                return;
            }

            currentFcmToken = task.getResult();
            rememberFcmToken(currentFcmToken);

            if (!initialLaunchStarted && session != null) {
                initialLaunchStarted = true;
                launchTrustedWebActivity(withNativePushToken(launchUrl, currentFcmToken));
            } else {
                sendFcmTokenToWeb();
            }
        });
    }

    private Uri withCurrentNativePushToken(Uri url) {
        String token = currentFcmToken;
        if (token == null || token.isEmpty()) {
            token = getSharedPreferences("groovy_native_push", MODE_PRIVATE)
                .getString("last_fcm_token", "");
        }
        return withNativePushToken(url, token);
    }

    private Uri withNativePushToken(Uri url, String token) {
        if (token == null || token.isEmpty()) {
            return url;
        }
        String fragment =
            "groovyNativePush=" + Uri.encode(token) +
            "&groovyNativeVersion=" + Uri.encode(BuildConfig.VERSION_NAME);
        return url.buildUpon().encodedFragment(fragment).build();
    }

    private void rememberFcmToken(String token) {
        if (token == null || token.isEmpty()) {
            return;
        }
        getSharedPreferences("groovy_native_push", MODE_PRIVATE)
            .edit()
            .putString("last_fcm_token", token)
            .apply();
    }

    private void loadCurrentFcmToken() {
        FirebaseMessaging.getInstance().getToken().addOnCompleteListener(task -> {
            if (!task.isSuccessful() || task.getResult() == null) {
                Log.w(TAG, "Could not get FCM token", task.getException());
                return;
            }
            currentFcmToken = task.getResult();
            rememberFcmToken(currentFcmToken);
            sendFcmTokenToWeb();
        });
    }

    private void sendFcmTokenToWeb() {
        if (!channelReady || session == null || currentFcmToken == null || currentFcmToken.isEmpty()) {
            return;
        }

        try {
            JSONObject payload = new JSONObject();
            payload.put("type", "groovy:native-push-token");
            payload.put("platform", "android");
            payload.put("provider", "fcm");
            payload.put("token", currentFcmToken);
            payload.put("appId", getPackageName());
            payload.put("appVersion", BuildConfig.VERSION_NAME);
            int result = session.postMessage(payload.toString(), null);
            Log.d(TAG, "FCM token bridge result: " + result);
        } catch (JSONException error) {
            Log.w(TAG, "Could not build FCM bridge payload", error);
        }
    }

    private Uri resolveLaunchUrl(Intent intent) {
        Uri data = intent == null ? null : intent.getData();
        if (data == null) {
            return DEFAULT_URL;
        }
        if (!"https".equalsIgnoreCase(data.getScheme()) ||
            !"groovyshelves.com".equalsIgnoreCase(data.getHost())) {
            return DEFAULT_URL;
        }
        return data;
    }

    private void launchTrustedWebActivity(Uri url) {
        if (session == null) {
            openFallback(url);
            return;
        }
        navigationFinished = false;
        channelRequested = false;
        channelReady = false;
        channelRequestAttempts = 0;
        new TrustedWebActivityIntentBuilder(url)
            .build(session)
            .launchTrustedWebActivity(this);
    }

    private void openFallback(Uri url) {
        try {
            startActivity(new Intent(Intent.ACTION_VIEW, url));
        } finally {
            finish();
        }
    }
}
