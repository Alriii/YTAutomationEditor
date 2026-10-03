package com.continuitystudio.mobile;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.ContentValues;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.os.Handler;
import android.os.Looper;
import android.provider.MediaStore;
import android.text.InputType;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.widget.ArrayAdapter;
import android.widget.Button;
import android.widget.EditText;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.ScrollView;
import android.widget.Spinner;
import android.widget.TextView;
import android.widget.Toast;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class MainActivity extends Activity {
    private static final int PICK_REFERENCES = 8101;
    private static final String PREFS = "continuity_standalone";
    private static final String PREF_SCENE = "scene";
    private static final String PREF_MODEL = "model";
    private static final String PREF_ASPECT = "aspect";
    private static final String PREF_MASTER = "master";

    private static final String DEFAULT_MASTER =
        "Create a polished continuity-first 2D cinematic documentary illustration for technology and business history. " +
        "Represent the supplied narration directly and accurately, never as a generic technology scene. " +
        "Use detailed editorial 2D artwork: expressive and premium, not photorealistic, not stick figures, not glossy plastic 3D, and not generic AI-looking art. " +
        "Preserve the correct historical era, hardware generation, industrial design, clothing, offices, CRT displays, components, architecture, and cultural details. " +
        "Use a strong focal subject, readable silhouettes, cinematic but believable lighting, subtle texture, and clear foreground/midground/background separation. " +
        "Treat attached references as canonical for identity, proportions, materials, colors, logos, product shape, and location design. " +
        "Do not invent visible labels, dates, model numbers, logos, UI text, or historical details that are not supported by the narration or references. " +
        "No watermark, no captions, no random typography, no distorted hands, no duplicate people, no broken hardware geometry. " +
        "Maintain continuity across scenes: same recurring character appearance, product geometry, location layout, palette, rendering style, and lighting logic.";

    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    private final ExecutorService executor = Executors.newSingleThreadExecutor();
    private final ArrayList<Uri> referenceUris = new ArrayList<>();

    private SharedPreferences preferences;
    private SecureApiKeyStore apiKeyStore;
    private EditText sceneInput;
    private Spinner modelSpinner;
    private Spinner aspectSpinner;
    private TextView keyStatus;
    private TextView referenceStatus;
    private TextView status;
    private ImageView preview;
    private ProgressBar progress;
    private Button generateButton;
    private String masterPrompt;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().setStatusBarColor(Color.rgb(13, 17, 26));
        getWindow().setNavigationBarColor(Color.rgb(13, 17, 26));

        preferences = getSharedPreferences(PREFS, MODE_PRIVATE);
        apiKeyStore = new SecureApiKeyStore(this);
        masterPrompt = preferences.getString(PREF_MASTER, DEFAULT_MASTER);

        buildUi();
        restoreDefaults();
        refreshKeyStatus();
    }

    private int dp(int value) {
        return Math.round(value * getResources().getDisplayMetrics().density);
    }

    private TextView text(String value, float size, int color) {
        TextView view = new TextView(this);
        view.setText(value);
        view.setTextSize(size);
        view.setTextColor(color);
        return view;
    }

    private Button button(String label) {
        Button view = new Button(this);
        view.setText(label);
        view.setAllCaps(false);
        return view;
    }

    private LinearLayout.LayoutParams full(int height) {
        return new LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            height
        );
    }

    private LinearLayout.LayoutParams weight() {
        return new LinearLayout.LayoutParams(
            0,
            ViewGroup.LayoutParams.WRAP_CONTENT,
            1f
        );
    }

    private LinearLayout row() {
        LinearLayout row = new LinearLayout(this);
        row.setOrientation(LinearLayout.HORIZONTAL);
        row.setGravity(Gravity.CENTER_VERTICAL);
        return row;
    }

    private LinearLayout card() {
        LinearLayout card = new LinearLayout(this);
        card.setOrientation(LinearLayout.VERTICAL);
        card.setPadding(dp(14), dp(14), dp(14), dp(14));
        card.setBackgroundColor(Color.rgb(21, 27, 39));

        LinearLayout.LayoutParams params =
            full(ViewGroup.LayoutParams.WRAP_CONTENT);
        params.bottomMargin = dp(14);
        card.setLayoutParams(params);
        return card;
    }

    private TextView label(String value) {
        TextView label = text(value, 11, Color.rgb(148, 163, 184));
        label.setPadding(0, dp(10), 0, dp(3));
        return label;
    }

    private void buildUi() {
        ScrollView scroll = new ScrollView(this);
        scroll.setFillViewport(true);
        scroll.setBackgroundColor(Color.rgb(13, 17, 26));

        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setPadding(dp(18), dp(22), dp(18), dp(34));

        TextView title = text(
            "Continuity Studio",
            27,
            Color.rgb(248, 250, 252)
        );
        title.setTypeface(null, android.graphics.Typeface.BOLD);
        root.addView(title);

        TextView subtitle = text(
            "Standalone · The Rise preset · no PC required",
            12,
            Color.rgb(167, 139, 250)
        );
        subtitle.setPadding(0, dp(4), 0, dp(18));
        root.addView(subtitle);

        LinearLayout sceneCard = card();
        sceneCard.addView(text("Scene", 17, Color.WHITE));

        TextView helper = text(
            "Only paste the narration / scene idea. Model, format, style and continuity rules are already filled.",
            12,
            Color.rgb(148, 163, 184)
        );
        helper.setPadding(0, dp(4), 0, dp(9));
        sceneCard.addView(helper);

        sceneInput = new EditText(this);
        sceneInput.setHint(
            "Example: Before GeForce and RTX, NVIDIA had the NV1. Released in 1995..."
        );
        sceneInput.setTextColor(Color.WHITE);
        sceneInput.setHintTextColor(Color.rgb(100, 116, 139));
        sceneInput.setGravity(Gravity.TOP);
        sceneInput.setMinLines(5);
        sceneInput.setInputType(
            InputType.TYPE_CLASS_TEXT |
            InputType.TYPE_TEXT_FLAG_MULTI_LINE |
            InputType.TYPE_TEXT_FLAG_CAP_SENTENCES
        );
        sceneCard.addView(sceneInput, full(dp(145)));

        sceneCard.addView(label("Model · already selected"));
        modelSpinner = new Spinner(this);
        modelSpinner.setAdapter(
            new ArrayAdapter<>(
                this,
                android.R.layout.simple_spinner_dropdown_item,
                new String[] {
                    "Nano Banana 2 Lite",
                    "Nano Banana 2",
                    "Nano Banana Pro"
                }
            )
        );
        sceneCard.addView(modelSpinner, full(dp(52)));

        sceneCard.addView(label("Format · already selected"));
        aspectSpinner = new Spinner(this);
        aspectSpinner.setAdapter(
            new ArrayAdapter<>(
                this,
                android.R.layout.simple_spinner_dropdown_item,
                new String[] { "16:9", "9:16", "1:1", "4:3", "3:4" }
            )
        );
        sceneCard.addView(aspectSpinner, full(dp(52)));

        LinearLayout refRow = row();
        Button refs = button("Add references (optional)");
        refs.setOnClickListener(v -> pickReferences());
        Button clearRefs = button("Clear refs");
        clearRefs.setOnClickListener(v -> {
            referenceUris.clear();
            refreshReferenceStatus();
        });
        refRow.addView(refs, weight());
        refRow.addView(clearRefs, weight());
        sceneCard.addView(refRow);

        referenceStatus = text(
            "No references · okay to generate",
            12,
            Color.rgb(148, 163, 184)
        );
        referenceStatus.setPadding(0, dp(6), 0, dp(8));
        sceneCard.addView(referenceStatus);

        generateButton = button("Generate image");
        generateButton.setOnClickListener(v -> generate());
        sceneCard.addView(generateButton, full(dp(56)));

        progress = new ProgressBar(this);
        progress.setIndeterminate(true);
        progress.setVisibility(View.GONE);
        sceneCard.addView(progress);

        status = text(
            "Ready · output auto-saves to Downloads",
            12,
            Color.rgb(148, 163, 184)
        );
        status.setPadding(0, dp(7), 0, 0);
        sceneCard.addView(status);
        root.addView(sceneCard);

        LinearLayout output = card();
        output.addView(text("Latest result", 17, Color.WHITE));

        preview = new ImageView(this);
        preview.setScaleType(ImageView.ScaleType.FIT_CENTER);
        preview.setBackgroundColor(Color.BLACK);
        LinearLayout.LayoutParams previewParams = full(dp(320));
        previewParams.topMargin = dp(10);
        output.addView(preview, previewParams);
        root.addView(output);

        LinearLayout setup = card();
        setup.addView(text("One-time setup", 17, Color.WHITE));

        keyStatus = text("", 12, Color.rgb(148, 163, 184));
        keyStatus.setPadding(0, dp(4), 0, dp(8));
        setup.addView(keyStatus);

        LinearLayout keyRow = row();
        Button setKey = button("Gemini API key");
        setKey.setOnClickListener(v -> showApiKeyDialog());
        Button getKey = button("Get key");
        getKey.setOnClickListener(v ->
            openExternal("https://aistudio.google.com/app/apikey")
        );
        Button advanced = button("Advanced");
        advanced.setOnClickListener(v -> showMasterPromptDialog());

        keyRow.addView(setKey, weight());
        keyRow.addView(getKey, weight());
        keyRow.addView(advanced, weight());
        setup.addView(keyRow);

        TextView note = text(
            "Enter the API key once. It is encrypted with Android Keystore and reused automatically.",
            11,
            Color.rgb(100, 116, 139)
        );
        note.setPadding(0, dp(8), 0, 0);
        setup.addView(note);
        root.addView(setup);

        LinearLayout desktopCard = card();
        desktopCard.addView(
            text("Optional desktop companion", 17, Color.WHITE)
        );
        TextView desktopCopy = text(
            "Standalone image generation does not need your PC. Open this only if you want to control the desktop app later.",
            12,
            Color.rgb(148, 163, 184)
        );
        desktopCopy.setPadding(0, dp(4), 0, dp(8));
        desktopCard.addView(desktopCopy);

        Button desktop = button("Desktop companion");
        desktop.setOnClickListener(v ->
            startActivity(
                new Intent(this, DesktopCompanionActivity.class)
            )
        );
        desktopCard.addView(desktop, full(dp(52)));
        root.addView(desktopCard);

        scroll.addView(root);
        setContentView(scroll);
    }

    private void restoreDefaults() {
        sceneInput.setText(preferences.getString(PREF_SCENE, ""));
        selectSpinner(
            modelSpinner,
            preferences.getString(PREF_MODEL, "Nano Banana 2")
        );
        selectSpinner(
            aspectSpinner,
            preferences.getString(PREF_ASPECT, "16:9")
        );
    }

    private void selectSpinner(Spinner spinner, String value) {
        for (int i = 0; i < spinner.getCount(); i++) {
            if (value.equals(spinner.getItemAtPosition(i).toString())) {
                spinner.setSelection(i);
                return;
            }
        }
    }

    private void saveDraft() {
        preferences.edit()
            .putString(PREF_SCENE, sceneInput.getText().toString())
            .putString(
                PREF_MODEL,
                modelSpinner.getSelectedItem().toString()
            )
            .putString(
                PREF_ASPECT,
                aspectSpinner.getSelectedItem().toString()
            )
            .putString(PREF_MASTER, masterPrompt)
            .apply();
    }

    private void refreshKeyStatus() {
        keyStatus.setText(
            apiKeyStore.hasKey()
                ? "API key saved securely · no need to enter it again"
                : "API key needed once before first generation"
        );
    }

    private void refreshReferenceStatus() {
        referenceStatus.setText(
            referenceUris.isEmpty()
                ? "No references · okay to generate"
                : referenceUris.size() +
                    " reference image" +
                    (referenceUris.size() == 1 ? "" : "s") +
                    " selected"
        );
    }

    private void showApiKeyDialog() {
        EditText input = new EditText(this);
        input.setHint("AIza...");
        input.setSingleLine(true);
        input.setInputType(
            InputType.TYPE_CLASS_TEXT |
            InputType.TYPE_TEXT_VARIATION_PASSWORD
        );

        AlertDialog dialog = new AlertDialog.Builder(this)
            .setTitle("One-time Gemini API key")
            .setMessage(
                "Saved encrypted with Android Keystore. You will not have to fill this again."
            )
            .setView(input)
            .setPositiveButton("Save", null)
            .setNegativeButton("Cancel", null)
            .create();

        dialog.setOnShowListener(ignored -> {
            dialog.getButton(AlertDialog.BUTTON_POSITIVE)
                .setOnClickListener(v -> {
                    String value = input.getText().toString().trim();
                    if (value.length() < 20) {
                        input.setError("Paste the full Gemini API key");
                        return;
                    }

                    try {
                        apiKeyStore.save(value);
                        refreshKeyStatus();
                        dialog.dismiss();
                    } catch (Exception error) {
                        Toast.makeText(
                            this,
                            "Could not save key: " + error.getMessage(),
                            Toast.LENGTH_LONG
                        ).show();
                    }
                });
        });

        dialog.show();
    }

    private void showMasterPromptDialog() {
        EditText input = new EditText(this);
        input.setText(masterPrompt);
        input.setMinLines(12);
        input.setGravity(Gravity.TOP);
        input.setInputType(
            InputType.TYPE_CLASS_TEXT |
            InputType.TYPE_TEXT_FLAG_MULTI_LINE
        );

        new AlertDialog.Builder(this)
            .setTitle("Master continuity prompt")
            .setMessage(
                "Already filled for cinematic technology-history. Change only if you want a different visual language."
            )
            .setView(input)
            .setPositiveButton("Save", (d, which) -> {
                masterPrompt = input.getText().toString().trim();
                if (masterPrompt.isEmpty()) {
                    masterPrompt = DEFAULT_MASTER;
                }
                saveDraft();
            })
            .setNeutralButton("Reset", (d, which) -> {
                masterPrompt = DEFAULT_MASTER;
                saveDraft();
            })
            .setNegativeButton("Cancel", null)
            .show();
    }

    private void pickReferences() {
        Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
        intent.setType("image/*");
        intent.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        startActivityForResult(intent, PICK_REFERENCES);
    }

    private String compiledPrompt(String narration) {
        return masterPrompt +
            "\n\nSCENE NARRATION / FACTUAL INTENT:\n" +
            narration +
            "\n\nCOMPOSITION RULES:\n" +
            "Represent the narration literally and clearly. Favor one strong focal subject. " +
            "Do not add explanatory on-image text. If the scene names a real product, device, company, person, era, or environment, make that exact subject visually recognizable while staying historically grounded.";
    }

    private void generate() {
        String narration = sceneInput.getText().toString().trim();
        if (narration.isEmpty()) {
            sceneInput.setError("Paste the narration or scene idea");
            return;
        }

        final String apiKey;
        try {
            apiKey = apiKeyStore.get();
        } catch (Exception error) {
            status.setText("Could not decrypt the saved API key.");
            return;
        }

        if (apiKey.isEmpty()) {
            showApiKeyDialog();
            return;
        }

        saveDraft();

        final String model =
            modelSpinner.getSelectedItem().toString();
        final String aspect =
            aspectSpinner.getSelectedItem().toString();
        final String prompt = compiledPrompt(narration);

        generateButton.setEnabled(false);
        progress.setVisibility(View.VISIBLE);
        status.setText("Generating with " + model + "…");

        executor.execute(() -> {
            try {
                GeminiImageClient.Result result =
                    new GeminiImageClient().generate(
                        apiKey,
                        model,
                        prompt,
                        aspect,
                        loadReferenceImages()
                    );

                String savedPath = saveToDownloads(
                    result.bytes,
                    result.mimeType
                );

                mainHandler.post(() -> {
                    Bitmap bitmap = BitmapFactory.decodeByteArray(
                        result.bytes,
                        0,
                        result.bytes.length
                    );
                    preview.setImageBitmap(bitmap);
                    progress.setVisibility(View.GONE);
                    generateButton.setEnabled(true);
                    status.setText(
                        "Done · auto-saved to " + savedPath
                    );
                });
            } catch (Exception error) {
                mainHandler.post(() -> {
                    progress.setVisibility(View.GONE);
                    generateButton.setEnabled(true);
                    status.setText(
                        "Generation failed: " + error.getMessage()
                    );
                });
            }
        });
    }

    private List<GeminiImageClient.ReferenceImage>
    loadReferenceImages() throws Exception {
        ArrayList<GeminiImageClient.ReferenceImage> output =
            new ArrayList<>();

        int count = Math.min(8, referenceUris.size());
        for (int i = 0; i < count; i++) {
            Uri uri = referenceUris.get(i);
            String mime = getContentResolver().getType(uri);
            if (mime == null || !mime.startsWith("image/")) {
                mime = "image/jpeg";
            }

            try (InputStream stream =
                     getContentResolver().openInputStream(uri)) {
                if (stream == null) continue;
                output.add(
                    new GeminiImageClient.ReferenceImage(
                        readLimited(stream, 12 * 1024 * 1024),
                        mime
                    )
                );
            }
        }
        return output;
    }

    private byte[] readLimited(
        InputStream input,
        int maxBytes
    ) throws Exception {
        try (ByteArrayOutputStream output =
                 new ByteArrayOutputStream()) {
            byte[] buffer = new byte[16 * 1024];
            int total = 0;
            int read;

            while ((read = input.read(buffer)) >= 0) {
                total += read;
                if (total > maxBytes) {
                    throw new Exception(
                        "Reference image too large. Use under 12 MB."
                    );
                }
                output.write(buffer, 0, read);
            }

            return output.toByteArray();
        }
    }

    private String saveToDownloads(
        byte[] bytes,
        String mime
    ) throws Exception {
        String extension =
            mime != null && mime.contains("png") ? ".png" : ".jpg";
        String fileName =
            "Continuity_" + System.currentTimeMillis() + extension;
        String folder = "Continuity Studio/Generated";

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            ContentValues values = new ContentValues();
            values.put(MediaStore.Downloads.DISPLAY_NAME, fileName);
            values.put(
                MediaStore.Downloads.MIME_TYPE,
                mime == null ? "image/jpeg" : mime
            );
            values.put(
                MediaStore.Downloads.RELATIVE_PATH,
                Environment.DIRECTORY_DOWNLOADS + "/" + folder
            );
            values.put(MediaStore.Downloads.IS_PENDING, 1);

            Uri destination = getContentResolver().insert(
                MediaStore.Downloads.EXTERNAL_CONTENT_URI,
                values
            );

            if (destination == null) {
                throw new Exception("Could not create Downloads file.");
            }

            try (OutputStream output =
                     getContentResolver()
                         .openOutputStream(destination)) {
                if (output == null) {
                    throw new Exception(
                        "Could not open Downloads file."
                    );
                }
                output.write(bytes);
            }

            values.clear();
            values.put(MediaStore.Downloads.IS_PENDING, 0);
            getContentResolver().update(
                destination,
                values,
                null,
                null
            );
        } else {
            File directory = new File(
                Environment.getExternalStoragePublicDirectory(
                    Environment.DIRECTORY_DOWNLOADS
                ),
                folder
            );

            if (!directory.exists() &&
                !directory.mkdirs()) {
                throw new Exception(
                    "Could not create Downloads folder."
                );
            }

            try (FileOutputStream output =
                     new FileOutputStream(
                         new File(directory, fileName)
                     )) {
                output.write(bytes);
            }
        }

        return "Downloads/" + folder + "/" + fileName;
    }

    private void openExternal(String url) {
        try {
            startActivity(
                new Intent(
                    Intent.ACTION_VIEW,
                    Uri.parse(url)
                )
            );
        } catch (Exception ignored) {
        }
    }

    @Override
    protected void onPause() {
        saveDraft();
        super.onPause();
    }

    @Override
    protected void onActivityResult(
        int requestCode,
        int resultCode,
        Intent data
    ) {
        super.onActivityResult(requestCode, resultCode, data);

        if (requestCode != PICK_REFERENCES ||
            resultCode != RESULT_OK ||
            data == null) {
            return;
        }

        referenceUris.clear();

        if (data.getClipData() != null) {
            int count = Math.min(
                8,
                data.getClipData().getItemCount()
            );

            for (int i = 0; i < count; i++) {
                Uri uri = data.getClipData()
                    .getItemAt(i)
                    .getUri();
                referenceUris.add(uri);

                try {
                    getContentResolver()
                        .takePersistableUriPermission(
                            uri,
                            Intent.FLAG_GRANT_READ_URI_PERMISSION
                        );
                } catch (Exception ignored) {
                }
            }
        } else if (data.getData() != null) {
            Uri uri = data.getData();
            referenceUris.add(uri);

            try {
                getContentResolver()
                    .takePersistableUriPermission(
                        uri,
                        Intent.FLAG_GRANT_READ_URI_PERMISSION
                    );
            } catch (Exception ignored) {
            }
        }

        refreshReferenceStatus();
    }

    @Override
    protected void onDestroy() {
        executor.shutdownNow();
        super.onDestroy();
    }
}
