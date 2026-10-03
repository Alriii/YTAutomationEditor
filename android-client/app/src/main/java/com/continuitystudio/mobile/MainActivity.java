package com.continuitystudio.mobile;

import android.app.Activity;
import android.app.AlertDialog;
import android.app.DownloadManager;
import android.content.ActivityNotFoundException;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.os.Environment;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.CookieManager;
import android.webkit.DownloadListener;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.webkit.URLUtil;
import android.widget.Button;
import android.widget.EditText;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.TextView;
import android.widget.Toast;

import java.net.URI;
import java.net.URISyntaxException;
import java.util.Locale;

public class MainActivity extends Activity {
    private static final String PREFS = "continuity_mobile";
    private static final String PREF_SERVER_URL = "server_url";
    private static final int FILE_CHOOSER_REQUEST = 9042;

    private SharedPreferences preferences;
    private WebView webView;
    private ProgressBar progress;
    private TextView connectionLabel;
    private ValueCallback<Uri[]> filePathCallback;
    private String serverUrl;
    private boolean showingConnectionDialog = false;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        getWindow().setStatusBarColor(Color.rgb(13, 17, 26));
        getWindow().setNavigationBarColor(Color.rgb(13, 17, 26));

        preferences = getSharedPreferences(PREFS, MODE_PRIVATE);
        serverUrl = preferences.getString(PREF_SERVER_URL, "");

        buildUi();
        configureWebView();

        if (serverUrl == null || serverUrl.isBlank()) {
            showServerDialog(true);
        } else {
            loadStudio();
        }
    }

    private int dp(int value) {
        float density = getResources().getDisplayMetrics().density;
        return Math.round(value * density);
    }

    private void buildUi() {
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setBackgroundColor(Color.rgb(13, 17, 26));

        LinearLayout bar = new LinearLayout(this);
        bar.setOrientation(LinearLayout.HORIZONTAL);
        bar.setGravity(Gravity.CENTER_VERTICAL);
        bar.setPadding(dp(14), dp(7), dp(8), dp(7));
        bar.setBackgroundColor(Color.rgb(13, 17, 26));

        LinearLayout titles = new LinearLayout(this);
        titles.setOrientation(LinearLayout.VERTICAL);

        TextView title = new TextView(this);
        title.setText("Continuity Studio");
        title.setTextColor(Color.rgb(248, 250, 252));
        title.setTextSize(16);
        title.setTypeface(null, android.graphics.Typeface.BOLD);

        connectionLabel = new TextView(this);
        connectionLabel.setTextColor(Color.rgb(148, 163, 184));
        connectionLabel.setTextSize(10);
        connectionLabel.setSingleLine(true);

        titles.addView(title);
        titles.addView(connectionLabel);

        bar.addView(
            titles,
            new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f)
        );

        Button refresh = new Button(this);
        refresh.setText("↻");
        refresh.setTextSize(18);
        refresh.setTextColor(Color.WHITE);
        refresh.setBackgroundColor(Color.TRANSPARENT);
        refresh.setMinWidth(dp(46));
        refresh.setOnClickListener(v -> webView.reload());

        Button settings = new Button(this);
        settings.setText("⋮");
        settings.setTextSize(22);
        settings.setTextColor(Color.WHITE);
        settings.setBackgroundColor(Color.TRANSPARENT);
        settings.setMinWidth(dp(46));
        settings.setOnClickListener(v -> showServerDialog(false));

        bar.addView(refresh, new LinearLayout.LayoutParams(dp(48), dp(44)));
        bar.addView(settings, new LinearLayout.LayoutParams(dp(48), dp(44)));

        progress = new ProgressBar(
            this,
            null,
            android.R.attr.progressBarStyleHorizontal
        );
        progress.setMax(100);
        progress.setProgress(0);
        progress.setVisibility(View.GONE);

        webView = new WebView(this);
        webView.setBackgroundColor(Color.rgb(13, 17, 26));

        root.addView(
            bar,
            new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                dp(58)
            )
        );
        root.addView(
            progress,
            new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                dp(2)
            )
        );
        root.addView(
            webView,
            new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                0,
                1f
            )
        );

        setContentView(root);
    }

    private void configureWebView() {
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setAllowContentAccess(true);
        settings.setAllowFileAccess(true);
        settings.setLoadsImagesAutomatically(true);
        settings.setUseWideViewPort(true);
        settings.setLoadWithOverviewMode(false);
        settings.setTextZoom(100);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);

        CookieManager.getInstance().setAcceptCookie(true);
        CookieManager.getInstance().setAcceptThirdPartyCookies(webView, true);

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onProgressChanged(WebView view, int newProgress) {
                progress.setProgress(newProgress);
                progress.setVisibility(
                    newProgress >= 100 ? View.GONE : View.VISIBLE
                );
            }

            @Override
            public boolean onShowFileChooser(
                WebView webView,
                ValueCallback<Uri[]> filePath,
                FileChooserParams fileChooserParams
            ) {
                if (filePathCallback != null) {
                    filePathCallback.onReceiveValue(null);
                }
                filePathCallback = filePath;

                Intent intent;
                try {
                    intent = fileChooserParams.createIntent();
                } catch (Exception error) {
                    filePathCallback = null;
                    Toast.makeText(
                        MainActivity.this,
                        "Could not open Android file picker.",
                        Toast.LENGTH_LONG
                    ).show();
                    return false;
                }

                try {
                    startActivityForResult(intent, FILE_CHOOSER_REQUEST);
                    return true;
                } catch (ActivityNotFoundException error) {
                    filePathCallback = null;
                    Toast.makeText(
                        MainActivity.this,
                        "No file picker is available.",
                        Toast.LENGTH_LONG
                    ).show();
                    return false;
                }
            }
        });

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(
                WebView view,
                WebResourceRequest request
            ) {
                Uri uri = request.getUrl();
                String scheme = uri.getScheme();

                if (!"http".equalsIgnoreCase(scheme) &&
                    !"https".equalsIgnoreCase(scheme)) {
                    return true;
                }

                Uri configured = Uri.parse(serverUrl);
                if (configured.getHost() != null &&
                    configured.getHost().equalsIgnoreCase(uri.getHost())) {
                    return false;
                }

                try {
                    startActivity(new Intent(Intent.ACTION_VIEW, uri));
                } catch (Exception ignored) {
                    Toast.makeText(
                        MainActivity.this,
                        "Could not open external link.",
                        Toast.LENGTH_SHORT
                    ).show();
                }
                return true;
            }

            @Override
            public void onPageStarted(WebView view, String url, android.graphics.Bitmap favicon) {
                connectionLabel.setText(displayServer());
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                progress.setVisibility(View.GONE);
                connectionLabel.setText(displayServer());
            }

            @Override
            public void onReceivedError(
                WebView view,
                WebResourceRequest request,
                WebResourceError error
            ) {
                if (request.isForMainFrame() && !showingConnectionDialog) {
                    Toast.makeText(
                        MainActivity.this,
                        "Cannot reach the PC. Make sure Continuity Studio is running and both devices are on the same Wi-Fi.",
                        Toast.LENGTH_LONG
                    ).show();
                }
            }
        });

        webView.setDownloadListener(new DownloadListener() {
            @Override
            public void onDownloadStart(
                String url,
                String userAgent,
                String contentDisposition,
                String mimeType,
                long contentLength
            ) {
                downloadToPublicDownloads(
                    url,
                    userAgent,
                    contentDisposition,
                    mimeType
                );
            }
        });
    }

    private String displayServer() {
        try {
            Uri uri = Uri.parse(serverUrl);
            if (uri.getHost() == null) return "Not connected";
            int port = uri.getPort();
            return port > 0
                ? uri.getHost() + ":" + port
                : uri.getHost();
        } catch (Exception ignored) {
            return "Not connected";
        }
    }

    private String normalizeServerUrl(String raw) throws URISyntaxException {
        String value = raw == null ? "" : raw.trim();
        if (value.isEmpty()) {
            throw new URISyntaxException(value, "Server address is empty");
        }

        if (!value.contains("://")) {
            value = "http://" + value;
        }

        URI parsed = new URI(value);
        String scheme = parsed.getScheme();
        if (!"http".equalsIgnoreCase(scheme) &&
            !"https".equalsIgnoreCase(scheme)) {
            throw new URISyntaxException(value, "Only http:// or https:// is supported");
        }

        if (parsed.getHost() == null || parsed.getHost().isBlank()) {
            throw new URISyntaxException(value, "Missing host");
        }

        int port = parsed.getPort();
        if (port < 0 && "http".equalsIgnoreCase(scheme)) {
            port = 3000;
        }

        URI normalized = new URI(
            scheme.toLowerCase(Locale.US),
            null,
            parsed.getHost(),
            port,
            null,
            null,
            null
        );

        return normalized.toString().replaceAll("/$", "");
    }

    private void showServerDialog(boolean required) {
        if (showingConnectionDialog) return;
        showingConnectionDialog = true;

        LinearLayout content = new LinearLayout(this);
        content.setOrientation(LinearLayout.VERTICAL);
        content.setPadding(dp(20), dp(8), dp(20), 0);

        TextView help = new TextView(this);
        help.setText(
            "On your PC run START_CONTINUITY.cmd. In the terminal, copy the Phone/APK URL shown under Ready. Your S23 and PC must be on the same Wi-Fi."
        );
        help.setTextSize(13);
        help.setTextColor(Color.rgb(55, 65, 81));
        help.setPadding(0, 0, 0, dp(12));

        EditText input = new EditText(this);
        input.setSingleLine(true);
        input.setHint("http://192.168.1.100:3000");
        input.setText(serverUrl == null ? "" : serverUrl);
        input.setSelectAllOnFocus(true);

        content.addView(help);
        content.addView(input);

        AlertDialog dialog = new AlertDialog.Builder(this)
            .setTitle("Connect to your PC")
            .setView(content)
            .setPositiveButton("Connect", null)
            .setNegativeButton(required ? null : "Cancel", (d, which) -> {
                showingConnectionDialog = false;
            })
            .create();

        dialog.setOnCancelListener(d -> showingConnectionDialog = false);
        dialog.setOnShowListener(d -> {
            dialog.getButton(AlertDialog.BUTTON_POSITIVE).setOnClickListener(v -> {
                try {
                    String normalized = normalizeServerUrl(input.getText().toString());
                    serverUrl = normalized;
                    preferences
                        .edit()
                        .putString(PREF_SERVER_URL, normalized)
                        .apply();
                    showingConnectionDialog = false;
                    dialog.dismiss();
                    loadStudio();
                } catch (Exception error) {
                    input.setError("Use the Phone/APK URL from your PC, for example http://192.168.1.100:3000");
                }
            });
        });

        dialog.show();
    }

    private void loadStudio() {
        connectionLabel.setText(displayServer());
        String target = serverUrl + "/app";
        webView.loadUrl(target);
    }

    private String safeFileName(String value) {
        String cleaned = value
            .replaceAll("[\\\\/:*?\"<>|]", "_")
            .replaceAll("\\s+", " ")
            .trim();

        if (cleaned.isEmpty()) cleaned = "continuity-export";

        if (cleaned.length() > 120) {
            int dot = cleaned.lastIndexOf('.');
            String extension =
                dot > 0 && cleaned.length() - dot <= 12
                    ? cleaned.substring(dot)
                    : "";
            String base = extension.isEmpty()
                ? cleaned
                : cleaned.substring(0, dot);
            cleaned =
                base.substring(
                    0,
                    Math.min(base.length(), 120 - extension.length())
                ) + extension;
        }

        return cleaned;
    }

    private void downloadToPublicDownloads(
        String url,
        String userAgent,
        String contentDisposition,
        String mimeType
    ) {
        try {
            String guessed = URLUtil.guessFileName(
                url,
                contentDisposition,
                mimeType
            );
            String fileName = safeFileName(guessed);

            DownloadManager.Request request =
                new DownloadManager.Request(Uri.parse(url));

            if (mimeType != null && !mimeType.isBlank()) {
                request.setMimeType(mimeType);
            }

            String cookies = CookieManager.getInstance().getCookie(url);
            if (cookies != null && !cookies.isBlank()) {
                request.addRequestHeader("Cookie", cookies);
            }
            if (userAgent != null && !userAgent.isBlank()) {
                request.addRequestHeader("User-Agent", userAgent);
            }

            request.setTitle(fileName);
            request.setDescription("Continuity Studio export");
            request.setNotificationVisibility(
                DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED
            );
            request.setAllowedOverMetered(true);
            request.setAllowedOverRoaming(false);
            request.setDestinationInExternalPublicDir(
                Environment.DIRECTORY_DOWNLOADS,
                "Continuity Studio/" + fileName
            );

            DownloadManager manager =
                (DownloadManager) getSystemService(Context.DOWNLOAD_SERVICE);
            manager.enqueue(request);

            Toast.makeText(
                this,
                "Saving to Downloads/Continuity Studio/" + fileName,
                Toast.LENGTH_LONG
            ).show();
        } catch (Exception error) {
            Toast.makeText(
                this,
                "Download failed: " + error.getMessage(),
                Toast.LENGTH_LONG
            ).show();
        }
    }

    @Override
    protected void onActivityResult(
        int requestCode,
        int resultCode,
        Intent data
    ) {
        super.onActivityResult(requestCode, resultCode, data);

        if (requestCode == FILE_CHOOSER_REQUEST && filePathCallback != null) {
            Uri[] result =
                WebChromeClient.FileChooserParams.parseResult(
                    resultCode,
                    data
                );
            filePathCallback.onReceiveValue(result);
            filePathCallback = null;
        }
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) {
            webView.goBack();
            return;
        }
        super.onBackPressed();
    }

    @Override
    protected void onDestroy() {
        if (webView != null) {
            webView.stopLoading();
            webView.destroy();
        }

        if (filePathCallback != null) {
            filePathCallback.onReceiveValue(null);
            filePathCallback = null;
        }

        super.onDestroy();
    }
}
