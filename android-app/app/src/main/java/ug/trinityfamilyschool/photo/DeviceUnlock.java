package ug.trinityfamilyschool.photo;

import android.app.KeyguardManager;
import android.content.Context;
import android.webkit.WebView;
import androidx.biometric.BiometricManager;
import androidx.biometric.BiometricPrompt;
import androidx.core.content.ContextCompat;
import androidx.fragment.app.FragmentActivity;
import androidx.webkit.JavaScriptReplyProxy;
import androidx.webkit.WebViewCompat;
import androidx.webkit.WebViewFeature;
import org.json.JSONObject;
import java.util.Collections;

/** Device verification for an existing privacy session; never creates a server session. */
final class DeviceUnlock {
    private static final int AUTHENTICATORS = BiometricManager.Authenticators.BIOMETRIC_WEAK
        | BiometricManager.Authenticators.DEVICE_CREDENTIAL;
    interface Completion { void finish(boolean success, String error); }
    private final FragmentActivity activity;
    private final WebView web;
    private BiometricPrompt prompt;
    private Completion pending;
    private long generation;

    DeviceUnlock(FragmentActivity activity, WebView web) {
        this.activity = activity; this.web = web;
        if (WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)) {
            WebViewCompat.addWebMessageListener(web, "TrinityDeviceUnlock", Collections.singleton(PhotoPolicy.ORIGIN),
                (view, message, origin, mainFrame, reply) -> {
                    if (!mainFrame || !PhotoPolicy.trusted(origin.toString()) || !PhotoPolicy.trusted(view.getUrl())) return;
                    try {
                        JSONObject request = new JSONObject(message.getData());
                        String id = request.optString("id");
                        if (!PhotoPolicy.validId(id)) return;
                        String action = request.optString("action");
                        if ("status".equals(action)) {
                            respond(reply, id, true, null, null, available());
                        } else if ("authenticate".equals(action)) {
                            String userId = request.optString("userId");
                            if (userId.isEmpty() || userId.length() > 128) return;
                            long document = generation;
                            authenticate((success, error) -> {
                                if (document == generation && PhotoPolicy.trusted(web.getUrl()))
                                    respond(reply, id, success, error, userId, available());
                            });
                        } else if ("cancel".equals(action)) {
                            cancel();
                            respond(reply, id, true, null, null, available());
                        }
                    } catch (Exception ignored) { /* Malformed messages cannot open an unlock prompt. */ }
                });
        }
    }

    boolean available() {
        KeyguardManager keyguard = (KeyguardManager) activity.getSystemService(Context.KEYGUARD_SERVICE);
        return keyguard != null && keyguard.isDeviceSecure()
            && BiometricManager.from(activity).canAuthenticate(AUTHENTICATORS) == BiometricManager.BIOMETRIC_SUCCESS;
    }

    void authenticate(Completion completion) {
        if (pending != null) { completion.finish(false, "An unlock is already in progress."); return; }
        if (activity.isDestroyed() || !available()) {
            completion.finish(false, "Set up a fingerprint, face unlock or screen PIN in Android settings first."); return;
        }
        pending = completion;
        prompt = new BiometricPrompt(activity, ContextCompat.getMainExecutor(activity), new BiometricPrompt.AuthenticationCallback() {
            @Override public void onAuthenticationSucceeded(BiometricPrompt.AuthenticationResult result) { if (pending == completion) finish(true, null); }
            @Override public void onAuthenticationError(int code, CharSequence message) { if (pending == completion) finish(false, message.toString()); }
            // An unsuccessful fingerprint attempt leaves the system prompt open to retry.
        });
        try {
            prompt.authenticate(new BiometricPrompt.PromptInfo.Builder()
                .setTitle("Unlock " + SchoolApp.NAME)
                .setSubtitle("Verify with your fingerprint, face or screen PIN")
                .setAllowedAuthenticators(AUTHENTICATORS).setConfirmationRequired(true).build());
        } catch (Exception error) { finish(false, "Device unlock could not start. Please try again."); }
    }

    private void finish(boolean success, String error) {
        Completion completion = pending; pending = null;
        if (completion != null) completion.finish(success, error);
    }
    private void respond(JavaScriptReplyProxy reply, String id, boolean ok, String error, String userId, boolean supported) {
        if (activity.isDestroyed() || !PhotoPolicy.trusted(web.getUrl())) return;
        try {
            JSONObject message = new JSONObject().put("id", id).put("ok", ok).put("supported", supported);
            if (userId != null) message.put("userId", userId);
            if (error != null) message.put("error", error);
            reply.postMessage(message.toString());
        } catch (Exception ignored) { /* Only the requesting document receives a reply. */ }
    }
    private void cancel() {
        if (prompt != null && pending != null) prompt.cancelAuthentication();
        finish(false, "Device unlock cancelled.");
    }
    void navigation() { generation++; cancel(); }
    void destroy() { generation++; cancel(); }
}
