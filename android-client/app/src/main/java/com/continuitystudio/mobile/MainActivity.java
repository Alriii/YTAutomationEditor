package com.continuitystudio.mobile;

import android.app.Activity;
import android.app.AlertDialog;
import android.accounts.Account;
import android.accounts.AccountManager;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Context;
import android.content.Intent;
import android.content.res.ColorStateList;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.net.Uri;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.text.InputType;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.widget.ArrayAdapter;
import android.widget.Button;
import android.widget.EditText;
import android.widget.FrameLayout;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.MediaController;
import android.widget.ProgressBar;
import android.widget.ScrollView;
import android.widget.Spinner;
import android.widget.Switch;
import android.widget.TextView;
import android.widget.Toast;
import android.widget.VideoView;

import androidx.core.content.FileProvider;

import com.google.android.gms.auth.GoogleAuthUtil;
import com.google.android.gms.auth.UserRecoverableAuthException;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class MainActivity extends Activity {
    private static final int SCREEN_HOME = 0;
    private static final int SCREEN_GENERATE = 1;
    private static final int SCREEN_STORYBOARD = 2;
    private static final int SCREEN_EXPORT = 3;

    private static final int PICK_REFERENCES = 8101;
    private static final int PICK_VOICEOVER = 8102;
    private static final int PICK_SCENE_IMAGE = 8103;
    private static final int PICK_FLOW_RESULT = 8104;
    private static final int PICK_FLOW_ACCOUNT = 8105;
    private static final int RECOVER_FLOW_AUTH = 8106;

    private static final String FLOW_PACKAGE =
        "com.google.android.apps.labs.whisk";

    public static final String DEFAULT_MASTER =
        "Create a polished continuity-first 2D cinematic documentary illustration for technology and business history. " +
        "Represent the supplied narration directly and accurately, never as a generic technology scene. " +
        "Use detailed editorial 2D artwork: expressive and premium, not photorealistic, not stick figures, not glossy plastic 3D, and not generic AI-looking art. " +
        "Preserve the correct historical era, hardware generation, industrial design, clothing, offices, CRT displays, components, architecture, and cultural details. " +
        "Use a strong focal subject, readable silhouettes, cinematic but believable lighting, subtle texture, and clear foreground/midground/background separation. " +
        "Treat attached references as canonical for identity, proportions, materials, colors, logos, product shape, and location design. " +
        "Do not invent visible labels, dates, model numbers, logos, UI text, or historical details not supported by narration or references. " +
        "No watermark, no captions, no random typography, no distorted hands, no duplicate people, no broken hardware geometry. " +
        "Maintain continuity across scenes: same recurring character appearance, product geometry, location layout, palette, rendering style, and lighting logic.";

    private static final int BG = Color.rgb(8, 11, 20);
    private static final int PANEL = Color.rgb(21, 24, 42);
    private static final int PANEL_SOFT = Color.rgb(15, 19, 34);
    private static final int ACCENT = Color.rgb(167, 91, 255);
    private static final int ACCENT_2 = Color.rgb(124, 58, 237);
    private static final int TEXT = Color.rgb(248, 250, 252);
    private static final int MUTED = Color.rgb(148, 163, 184);
    private static final int FAINT = Color.rgb(100, 116, 139);
    private static final int SUCCESS = Color.rgb(110, 231, 183);
    private static final int DANGER = Color.rgb(251, 113, 133);

    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    private final ExecutorService executor = Executors.newSingleThreadExecutor();

    private ProjectStore store;
    private ProjectStore.Project project;
    private SecureApiKeyStore apiKeyStore;

    private FrameLayout content;
    private LinearLayout bottomNav;
    private TextView headerProject;
    private int currentScreen = SCREEN_HOME;

    private String activeSceneId;
    private String pendingSceneImageId;
    private String flowPendingSceneId;
    private Account pendingFlowProbeAccount;

    private EditText generateNarration;
    private Spinner generateModel;
    private Spinner generateAspect;
    private ImageView generatePreview;
    private TextView generateStatus;
    private TextView referenceStatus;
    private ProgressBar generateProgress;
    private Button generateButton;

    private ProgressBar exportProgress;
    private TextView exportStatus;
    private Spinner qualitySpinner;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        getWindow().setStatusBarColor(BG);
        getWindow().setNavigationBarColor(BG);

        store = new ProjectStore(this);
        apiKeyStore = new SecureApiKeyStore(this);
        project = store.current(DEFAULT_MASTER);

        buildShell();
        showScreen(SCREEN_HOME);
    }

    private int dp(int value) {
        return Math.round(value * getResources().getDisplayMetrics().density);
    }

    private GradientDrawable rounded(int color, float radius) {
        GradientDrawable drawable = new GradientDrawable();
        drawable.setColor(color);
        drawable.setCornerRadius(dp((int) radius));
        drawable.setStroke(dp(1), Color.rgb(44, 49, 80));
        return drawable;
    }

    private GradientDrawable accentDrawable() {
        GradientDrawable drawable = new GradientDrawable(
            GradientDrawable.Orientation.LEFT_RIGHT,
            new int[] { ACCENT_2, Color.rgb(190, 86, 255) }
        );
        drawable.setCornerRadius(dp(18));
        return drawable;
    }

    private TextView text(String value, float size, int color) {
        TextView view = new TextView(this);
        view.setText(value);
        view.setTextSize(size);
        view.setTextColor(color);
        return view;
    }

    private TextView heading(String value, float size) {
        TextView view = text(value, size, TEXT);
        view.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
        return view;
    }

    private LinearLayout vertical() {
        LinearLayout layout = new LinearLayout(this);
        layout.setOrientation(LinearLayout.VERTICAL);
        return layout;
    }

    private LinearLayout horizontal() {
        LinearLayout layout = new LinearLayout(this);
        layout.setOrientation(LinearLayout.HORIZONTAL);
        layout.setGravity(Gravity.CENTER_VERTICAL);
        return layout;
    }

    private LinearLayout card() {
        LinearLayout card = vertical();
        card.setPadding(dp(16), dp(16), dp(16), dp(16));
        card.setBackground(rounded(PANEL, 18));

        LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.WRAP_CONTENT
        );
        params.bottomMargin = dp(14);
        card.setLayoutParams(params);
        return card;
    }

    private Button primaryButton(String label) {
        Button button = new Button(this);
        button.setText(label);
        button.setAllCaps(false);
        button.setTextColor(Color.WHITE);
        button.setTextSize(14);
        button.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
        button.setBackground(accentDrawable());
        button.setPadding(dp(16), dp(6), dp(16), dp(6));
        return button;
    }

    private Button secondaryButton(String label) {
        Button button = new Button(this);
        button.setText(label);
        button.setAllCaps(false);
        button.setTextColor(TEXT);
        button.setTextSize(13);
        button.setBackground(rounded(PANEL_SOFT, 14));
        return button;
    }

    private EditText editor(String hint, int minLines) {
        EditText input = new EditText(this);
        input.setHint(hint);
        input.setHintTextColor(FAINT);
        input.setTextColor(TEXT);
        input.setTextSize(14);
        input.setGravity(Gravity.TOP | Gravity.START);
        input.setMinLines(minLines);
        input.setInputType(
            InputType.TYPE_CLASS_TEXT |
            InputType.TYPE_TEXT_FLAG_MULTI_LINE |
            InputType.TYPE_TEXT_FLAG_CAP_SENTENCES
        );
        input.setPadding(dp(12), dp(10), dp(12), dp(10));
        input.setBackground(rounded(PANEL_SOFT, 14));
        return input;
    }

    private LinearLayout.LayoutParams matchWrap() {
        return new LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.WRAP_CONTENT
        );
    }

    private LinearLayout.LayoutParams weighted() {
        return new LinearLayout.LayoutParams(
            0,
            ViewGroup.LayoutParams.WRAP_CONTENT,
            1f
        );
    }

    private void buildShell() {
        LinearLayout root = vertical();
        root.setBackgroundColor(BG);

        LinearLayout header = horizontal();
        header.setPadding(dp(16), dp(10), dp(10), dp(10));

        ImageView logo = new ImageView(this);
        logo.setImageResource(R.drawable.continuity_icon);
        logo.setScaleType(ImageView.ScaleType.CENTER_CROP);
        LinearLayout.LayoutParams logoParams =
            new LinearLayout.LayoutParams(dp(42), dp(42));
        logoParams.rightMargin = dp(10);
        header.addView(logo, logoParams);

        LinearLayout titles = vertical();
        TextView appName = heading("Continuity Studio", 16);
        headerProject = text(project.title, 10, MUTED);
        headerProject.setSingleLine(true);
        titles.addView(appName);
        titles.addView(headerProject);
        header.addView(titles, weighted());

        ImageView settings = new ImageView(this);
        settings.setImageResource(R.drawable.ic_settings);
        settings.setImageTintList(ColorStateList.valueOf(TEXT));
        settings.setPadding(dp(10), dp(10), dp(10), dp(10));
        settings.setOnClickListener(v -> showSettings());
        header.addView(
            settings,
            new LinearLayout.LayoutParams(dp(46), dp(46))
        );

        content = new FrameLayout(this);
        LinearLayout.LayoutParams contentParams =
            new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                0,
                1f
            );

        bottomNav = horizontal();
        bottomNav.setGravity(Gravity.CENTER);
        bottomNav.setPadding(dp(6), dp(5), dp(6), dp(7));
        bottomNav.setBackgroundColor(Color.rgb(10, 13, 25));

        root.addView(
            header,
            new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                dp(64)
            )
        );
        root.addView(content, contentParams);
        root.addView(
            bottomNav,
            new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                dp(70)
            )
        );

        setContentView(root);
        refreshBottomNav();
    }

    private void refreshBottomNav() {
        bottomNav.removeAllViews();
        bottomNav.addView(
            navItem("Home", R.drawable.ic_home, SCREEN_HOME),
            weighted()
        );
        bottomNav.addView(
            navItem("Generate", R.drawable.ic_generate, SCREEN_GENERATE),
            weighted()
        );
        bottomNav.addView(
            navItem("Storyboard", R.drawable.ic_storyboard, SCREEN_STORYBOARD),
            weighted()
        );
        bottomNav.addView(
            navItem("Export", R.drawable.ic_export, SCREEN_EXPORT),
            weighted()
        );
    }

    private View navItem(String label, int iconRes, int screen) {
        LinearLayout item = vertical();
        item.setGravity(Gravity.CENTER);
        item.setPadding(dp(4), dp(4), dp(4), dp(2));
        item.setOnClickListener(v -> showScreen(screen));

        boolean active = currentScreen == screen;
        ImageView icon = new ImageView(this);
        icon.setImageResource(iconRes);
        icon.setImageTintList(
            ColorStateList.valueOf(active ? ACCENT : MUTED)
        );

        TextView title = text(label, 10, active ? ACCENT : MUTED);
        title.setGravity(Gravity.CENTER);
        title.setPadding(0, dp(3), 0, 0);

        item.addView(
            icon,
            new LinearLayout.LayoutParams(dp(24), dp(24))
        );
        item.addView(title);
        return item;
    }

    private void showScreen(int screen) {
        currentScreen = screen;
        refreshBottomNav();
        content.removeAllViews();

        project = store.current(DEFAULT_MASTER);
        headerProject.setText(project.title);

        View view;
        if (screen == SCREEN_GENERATE) {
            view = buildGenerateScreen();
        } else if (screen == SCREEN_STORYBOARD) {
            view = buildStoryboardScreen();
        } else if (screen == SCREEN_EXPORT) {
            view = buildExportScreen();
        } else {
            view = buildHomeScreen();
        }

        content.addView(view);
    }

    private ScrollView scrollScreen() {
        ScrollView scroll = new ScrollView(this);
        scroll.setFillViewport(true);
        scroll.setBackgroundColor(BG);
        return scroll;
    }

    private LinearLayout screenBody() {
        LinearLayout body = vertical();
        body.setPadding(dp(16), dp(10), dp(16), dp(28));
        return body;
    }

    private View buildHomeScreen() {
        ScrollView scroll = scrollScreen();
        LinearLayout body = screenBody();

        LinearLayout hero = card();
        hero.setBackgroundResource(R.drawable.bg_card_selected);

        LinearLayout heroTop = horizontal();
        ImageView icon = new ImageView(this);
        icon.setImageResource(R.drawable.continuity_icon);
        icon.setScaleType(ImageView.ScaleType.CENTER_CROP);

        LinearLayout heroCopy = vertical();
        TextView eyebrow = text("CONTINUITY-FIRST CREATION", 10, Color.rgb(206, 181, 255));
        eyebrow.setLetterSpacing(0.12f);
        TextView heroTitle = heading("Turn ideas into\nvisual stories", 25);
        heroTitle.setPadding(0, dp(5), 0, dp(4));
        TextView heroSub = text(
            "Script · Generate · Storyboard · Voiceover · Subtitles · Export",
            12,
            MUTED
        );

        heroCopy.addView(eyebrow);
        heroCopy.addView(heroTitle);
        heroCopy.addView(heroSub);

        LinearLayout.LayoutParams iconParams =
            new LinearLayout.LayoutParams(dp(76), dp(76));
        iconParams.rightMargin = dp(14);
        heroTop.addView(icon, iconParams);
        heroTop.addView(heroCopy, weighted());
        hero.addView(heroTop);

        Button newProject = primaryButton("+  New Project");
        LinearLayout.LayoutParams newParams = matchWrap();
        newParams.topMargin = dp(14);
        newProject.setLayoutParams(newParams);
        newProject.setOnClickListener(v -> showNewProjectDialog());
        hero.addView(newProject);

        body.addView(hero);

        LinearLayout projectCard = card();
        projectCard.addView(text("CURRENT PROJECT", 10, MUTED));
        TextView projectTitle = heading(project.title, 20);
        projectTitle.setPadding(0, dp(5), 0, dp(6));
        projectCard.addView(projectTitle);

        TextView stats = text(
            project.scenes.size() + " scenes · " +
            project.renderedSceneCount() + " rendered · " +
            durationLabel(project.totalDurationMs()),
            12,
            MUTED
        );
        projectCard.addView(stats);

        LinearLayout openRow = horizontal();
        openRow.setPadding(0, dp(12), 0, 0);

        Button script = secondaryButton("Import Script");
        script.setOnClickListener(v -> showScriptImportDialog());
        Button storyboard = secondaryButton("Open Storyboard");
        storyboard.setOnClickListener(v -> showScreen(SCREEN_STORYBOARD));

        LinearLayout.LayoutParams left = weighted();
        left.rightMargin = dp(8);
        openRow.addView(script, left);
        openRow.addView(storyboard, weighted());
        projectCard.addView(openRow);

        body.addView(projectCard);

        TextView quick = heading("Quick actions", 17);
        quick.setPadding(0, dp(4), 0, dp(10));
        body.addView(quick);

        LinearLayout quickRow1 = horizontal();
        quickRow1.addView(
            actionTile(
                "Generate Image",
                "Nano Banana",
                R.drawable.ic_generate,
                () -> {
                    activeSceneId = null;
                    showScreen(SCREEN_GENERATE);
                }
            ),
            tileParams(true)
        );
        quickRow1.addView(
            actionTile(
                "Storyboard",
                project.scenes.size() + " scenes",
                R.drawable.ic_storyboard,
                () -> showScreen(SCREEN_STORYBOARD)
            ),
            tileParams(false)
        );
        body.addView(quickRow1);

        LinearLayout quickRow2 = horizontal();
        quickRow2.setPadding(0, dp(10), 0, 0);
        quickRow2.addView(
            actionTile(
                "Export Video",
                "MP4 + subtitles",
                R.drawable.ic_export,
                () -> showScreen(SCREEN_EXPORT)
            ),
            tileParams(true)
        );
        quickRow2.addView(
            actionTile(
                "References",
                project.references.size() + " saved",
                R.drawable.ic_generate,
                this::pickReferences
            ),
            tileParams(false)
        );
        body.addView(quickRow2);

        List<ProjectStore.Project> projects = store.all();
        TextView recent = heading("Projects", 17);
        recent.setPadding(0, dp(22), 0, dp(10));
        body.addView(recent);

        for (ProjectStore.Project item : projects) {
            LinearLayout p = card();
            if (item.id.equals(project.id)) {
                p.setBackgroundResource(R.drawable.bg_card_selected);
            }

            TextView title = heading(item.title, 15);
            TextView meta = text(
                item.scenes.size() + " scenes · " +
                item.renderedSceneCount() + " rendered",
                11,
                MUTED
            );
            meta.setPadding(0, dp(3), 0, 0);
            p.addView(title);
            p.addView(meta);
            p.setOnClickListener(v -> {
                store.setCurrent(item.id);
                project = store.current(DEFAULT_MASTER);
                activeSceneId = null;
                showScreen(SCREEN_HOME);
            });
            body.addView(p);
        }

        scroll.addView(body);
        return scroll;
    }

    private LinearLayout.LayoutParams tileParams(boolean left) {
        LinearLayout.LayoutParams params = weighted();
        if (left) params.rightMargin = dp(8);
        return params;
    }

    private View actionTile(
        String title,
        String subtitle,
        int iconRes,
        Runnable action
    ) {
        LinearLayout tile = vertical();
        tile.setPadding(dp(14), dp(14), dp(14), dp(14));
        tile.setBackground(rounded(PANEL, 16));
        tile.setOnClickListener(v -> action.run());

        ImageView icon = new ImageView(this);
        icon.setImageResource(iconRes);
        icon.setImageTintList(ColorStateList.valueOf(ACCENT));
        tile.addView(
            icon,
            new LinearLayout.LayoutParams(dp(26), dp(26))
        );

        TextView t = heading(title, 13);
        t.setPadding(0, dp(8), 0, dp(2));
        tile.addView(t);
        tile.addView(text(subtitle, 10, MUTED));
        return tile;
    }

    private View buildGenerateScreen() {
        ScrollView scroll = scrollScreen();
        LinearLayout body = screenBody();

        body.addView(heading("Google Flow Generation", 24));
        TextView lead = text(
            activeSceneId == null
                ? "Generate through your Google Flow account and credits."
                : "Send this storyboard scene to Flow without losing project continuity.",
            12,
            MUTED
        );
        lead.setPadding(0, dp(4), 0, dp(14));
        body.addView(lead);

        ProjectStore.Scene active = findScene(activeSceneId);

        LinearLayout flowCard = card();
        flowCard.setBackgroundResource(R.drawable.bg_card_selected);
        flowCard.addView(text("FLOW TARGET MODEL", 10, Color.rgb(206, 181, 255)));

        generateModel = new Spinner(this);
        generateModel.setAdapter(
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
        selectSpinner(generateModel, project.model);
        flowCard.addView(generateModel, matchWrap());

        flowCard.addView(text("FORMAT", 10, Color.rgb(206, 181, 255)));
        generateAspect = new Spinner(this);
        generateAspect.setAdapter(
            new ArrayAdapter<>(
                this,
                android.R.layout.simple_spinner_dropdown_item,
                new String[] { "16:9", "9:16", "1:1", "4:3", "3:4" }
            )
        );
        selectSpinner(generateAspect, project.aspectRatio);
        flowCard.addView(generateAspect, matchWrap());

        TextView note = text(
            "Continuity Studio prepares the prompt and references. Flow still owns the final model/format controls because Google does not expose Flow as a third-party generation API.",
            11,
            MUTED
        );
        note.setPadding(0, dp(8), 0, 0);
        flowCard.addView(note);
        body.addView(flowCard);

        LinearLayout promptCard = card();
        promptCard.addView(text("SCENE NARRATION", 10, MUTED));
        generateNarration = editor(
            "Example: Before GeForce and RTX, NVIDIA had the NV1. Released in 1995...",
            5
        );
        if (active != null) generateNarration.setText(active.narration);
        promptCard.addView(
            generateNarration,
            new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                dp(150)
            )
        );

        referenceStatus = text("", 11, MUTED);
        refreshReferenceStatus();
        referenceStatus.setPadding(0, dp(10), 0, dp(8));
        promptCard.addView(referenceStatus);

        LinearLayout refRow = horizontal();
        Button addRef = secondaryButton("＋ Add References");
        addRef.setOnClickListener(v -> pickReferences());
        Button clearRef = secondaryButton("Clear");
        clearRef.setOnClickListener(v -> {
            project.references.clear();
            store.save(project);
            refreshReferenceStatus();
        });
        LinearLayout.LayoutParams refLeft = weighted();
        refLeft.rightMargin = dp(8);
        refRow.addView(addRef, refLeft);
        refRow.addView(clearRef, weighted());
        promptCard.addView(refRow);

        generateButton = primaryButton(
            active == null
                ? "✦  Open in Google Flow"
                : "✦  Regenerate in Google Flow"
        );
        LinearLayout.LayoutParams genParams = matchWrap();
        genParams.topMargin = dp(12);
        generateButton.setLayoutParams(genParams);
        generateButton.setOnClickListener(v -> launchGoogleFlow());
        promptCard.addView(generateButton);

        LinearLayout returnRow = horizontal();
        returnRow.setPadding(0, dp(9), 0, 0);

        Button importResult = secondaryButton("Import Flow Result");
        importResult.setOnClickListener(v -> importFlowResult());

        Button apiFallback = secondaryButton("Direct API · billed");
        apiFallback.setOnClickListener(v -> generateImage());

        LinearLayout.LayoutParams resultParams = weighted();
        resultParams.rightMargin = dp(8);
        returnRow.addView(importResult, resultParams);
        returnRow.addView(apiFallback, weighted());
        promptCard.addView(returnRow);

        generateProgress = new ProgressBar(this);
        generateProgress.setIndeterminate(true);
        generateProgress.setVisibility(View.GONE);
        promptCard.addView(generateProgress);

        generateStatus = text(
            "Flow mode · your compiled prompt is copied automatically · no Gemini API key required",
            11,
            SUCCESS
        );
        generateStatus.setPadding(0, dp(8), 0, 0);
        promptCard.addView(generateStatus);
        body.addView(promptCard);

        LinearLayout previewCard = card();
        previewCard.addView(heading("Scene Preview", 17));

        generatePreview = new ImageView(this);
        generatePreview.setScaleType(ImageView.ScaleType.FIT_CENTER);
        generatePreview.setBackgroundColor(Color.BLACK);
        LinearLayout.LayoutParams previewParams =
            new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                dp(300)
            );
        previewParams.topMargin = dp(10);
        previewCard.addView(generatePreview, previewParams);

        if (active != null &&
            active.imagePath != null &&
            !active.imagePath.isEmpty()) {
            Bitmap bitmap = BitmapFactory.decodeFile(active.imagePath);
            if (bitmap != null) generatePreview.setImageBitmap(bitmap);
        }

        TextView returnHelp = text(
            "In Flow: choose Image → confirm model/aspect → Generate → Download. Then return here and tap Import Flow Result.",
            11,
            MUTED
        );
        returnHelp.setPadding(0, dp(10), 0, 0);
        previewCard.addView(returnHelp);

        body.addView(previewCard);

        scroll.addView(body);
        return scroll;
    }

    private View buildStoryboardScreen() {
        ScrollView scroll = scrollScreen();
        LinearLayout body = screenBody();

        LinearLayout titleRow = horizontal();
        LinearLayout copy = vertical();
        copy.addView(heading("Storyboard", 24));
        copy.addView(
            text(
                project.scenes.size() + " scenes · " +
                project.renderedSceneCount() + " rendered",
                11,
                MUTED
            )
        );
        titleRow.addView(copy, weighted());

        Button add = primaryButton("＋ Scene");
        add.setOnClickListener(v -> {
            activeSceneId = null;
            showScreen(SCREEN_GENERATE);
        });
        titleRow.addView(add);
        body.addView(titleRow);

        if (project.scenes.isEmpty()) {
            LinearLayout empty = card();
            TextView e = heading("Your storyboard is empty", 17);
            TextView d = text(
                "Import a script from Home or generate your first visual.",
                12,
                MUTED
            );
            d.setPadding(0, dp(5), 0, dp(12));
            empty.addView(e);
            empty.addView(d);
            Button go = primaryButton("Generate first scene");
            go.setOnClickListener(v -> showScreen(SCREEN_GENERATE));
            empty.addView(go);
            body.addView(empty);
        }

        for (int i = 0; i < project.scenes.size(); i++) {
            ProjectStore.Scene scene = project.scenes.get(i);
            LinearLayout sceneCard = card();

            LinearLayout row = horizontal();

            ImageView thumb = new ImageView(this);
            thumb.setScaleType(ImageView.ScaleType.CENTER_CROP);
            thumb.setBackgroundColor(Color.rgb(10, 13, 25));
            if (scene.imagePath != null && !scene.imagePath.isEmpty()) {
                Bitmap bitmap = BitmapFactory.decodeFile(scene.imagePath);
                if (bitmap != null) thumb.setImageBitmap(bitmap);
            }

            LinearLayout.LayoutParams thumbParams =
                new LinearLayout.LayoutParams(dp(110), dp(82));
            thumbParams.rightMargin = dp(12);
            row.addView(thumb, thumbParams);

            LinearLayout meta = vertical();
            TextView number = text(
                "SCENE " + String.format(Locale.US, "%02d", i + 1),
                9,
                ACCENT
            );
            number.setLetterSpacing(0.1f);
            meta.addView(number);

            String shortText =
                scene.narration == null || scene.narration.trim().isEmpty()
                    ? "Untitled scene"
                    : scene.narration.trim();
            if (shortText.length() > 95) {
                shortText = shortText.substring(0, 92) + "…";
            }

            TextView narration = heading(shortText, 13);
            narration.setMaxLines(3);
            narration.setPadding(0, dp(4), 0, dp(4));
            meta.addView(narration);

            meta.addView(
                text(
                    String.format(
                        Locale.US,
                        "%.1fs · %s",
                        scene.durationMs / 1000d,
                        scene.locked ? "Locked" : "Editable"
                    ),
                    10,
                    MUTED
                )
            );
            row.addView(meta, weighted());
            sceneCard.addView(row);

            LinearLayout actions = horizontal();
            actions.setPadding(0, dp(10), 0, 0);

            Button regenerate = secondaryButton(
                scene.imagePath == null || scene.imagePath.isEmpty()
                    ? "Generate"
                    : "Regenerate"
            );
            regenerate.setOnClickListener(v -> {
                if (scene.locked) {
                    toast("Unlock this scene before regenerating.");
                    return;
                }
                activeSceneId = scene.id;
                showScreen(SCREEN_GENERATE);
            });

            Button edit = secondaryButton("Edit");
            edit.setOnClickListener(v -> showSceneEditor(scene));

            Button lock = secondaryButton(scene.locked ? "Unlock" : "Lock");
            lock.setOnClickListener(v -> {
                scene.locked = !scene.locked;
                store.save(project);
                showScreen(SCREEN_STORYBOARD);
            });

            LinearLayout.LayoutParams a = weighted();
            a.rightMargin = dp(6);
            actions.addView(regenerate, a);
            LinearLayout.LayoutParams b = weighted();
            b.rightMargin = dp(6);
            actions.addView(edit, b);
            actions.addView(lock, weighted());
            sceneCard.addView(actions);

            LinearLayout secondActions = horizontal();
            secondActions.setPadding(0, dp(7), 0, 0);

            Button ownImage = secondaryButton("Use own image");
            ownImage.setOnClickListener(v -> {
                if (scene.locked) {
                    toast("Unlock this scene before replacing its image.");
                    return;
                }
                pendingSceneImageId = scene.id;
                Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
                intent.setType("image/*");
                intent.addCategory(Intent.CATEGORY_OPENABLE);
                startActivityForResult(intent, PICK_SCENE_IMAGE);
            });

            Button remove = secondaryButton("Delete");
            remove.setTextColor(DANGER);
            remove.setOnClickListener(v -> confirmDeleteScene(scene));

            LinearLayout.LayoutParams ownParams = weighted();
            ownParams.rightMargin = dp(6);
            secondActions.addView(ownImage, ownParams);
            secondActions.addView(remove, weighted());
            sceneCard.addView(secondActions);

            body.addView(sceneCard);
        }

        scroll.addView(body);
        return scroll;
    }

    private View buildExportScreen() {
        ScrollView scroll = scrollScreen();
        LinearLayout body = screenBody();

        body.addView(heading("Review & Export", 24));
        TextView lead = text(
            "Render your storyboard locally on the S23. No PC required.",
            12,
            MUTED
        );
        lead.setPadding(0, dp(4), 0, dp(14));
        body.addView(lead);

        if (project.lastExportPath != null &&
            !project.lastExportPath.isEmpty() &&
            new File(project.lastExportPath).exists()) {
            LinearLayout playerCard = card();
            playerCard.addView(heading("Latest video", 17));

            VideoView video = new VideoView(this);
            video.setVideoPath(project.lastExportPath);
            MediaController controller = new MediaController(this);
            controller.setAnchorView(video);
            video.setMediaController(controller);

            LinearLayout.LayoutParams videoParams =
                new LinearLayout.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT,
                    dp(240)
                );
            videoParams.topMargin = dp(10);
            playerCard.addView(video, videoParams);
            body.addView(playerCard);
        }

        LinearLayout summary = card();
        summary.addView(text("PROJECT", 10, MUTED));
        TextView title = heading(project.title, 19);
        title.setPadding(0, dp(4), 0, dp(6));
        summary.addView(title);
        summary.addView(
            text(
                project.renderedSceneCount() + "/" +
                project.scenes.size() + " scenes rendered · " +
                durationLabel(project.totalDurationMs()),
                12,
                MUTED
            )
        );
        body.addView(summary);

        LinearLayout audio = card();
        audio.addView(heading("Voiceover & subtitles", 17));

        TextView voice = text(
            project.voiceoverPath == null || project.voiceoverPath.isEmpty()
                ? "No voiceover selected"
                : new File(project.voiceoverPath).getName(),
            11,
            MUTED
        );
        voice.setPadding(0, dp(5), 0, dp(8));
        audio.addView(voice);

        Button chooseVoice = secondaryButton("Choose Voiceover");
        chooseVoice.setOnClickListener(v -> pickVoiceover());
        audio.addView(chooseVoice);

        Switch subtitles = new Switch(this);
        subtitles.setText("Burn subtitles into video");
        subtitles.setTextColor(TEXT);
        subtitles.setChecked(project.subtitlesEnabled);
        subtitles.setPadding(0, dp(8), 0, 0);
        subtitles.setOnCheckedChangeListener((button, checked) -> {
            project.subtitlesEnabled = checked;
            store.save(project);
        });
        audio.addView(subtitles);

        Button saveSrt = secondaryButton("Save SRT to Downloads");
        LinearLayout.LayoutParams srtParams = matchWrap();
        srtParams.topMargin = dp(8);
        saveSrt.setLayoutParams(srtParams);
        saveSrt.setOnClickListener(v -> saveSrt());
        audio.addView(saveSrt);
        body.addView(audio);

        LinearLayout settings = card();
        settings.addView(heading("Export settings", 17));
        settings.addView(text("Resolution", 10, MUTED));

        qualitySpinner = new Spinner(this);
        qualitySpinner.setAdapter(
            new ArrayAdapter<>(
                this,
                android.R.layout.simple_spinner_dropdown_item,
                new String[] { "1080p", "720p" }
            )
        );
        settings.addView(qualitySpinner, matchWrap());

        Button export = primaryButton("Export MP4");
        LinearLayout.LayoutParams exportParams = matchWrap();
        exportParams.topMargin = dp(12);
        export.setLayoutParams(exportParams);
        export.setOnClickListener(v -> renderVideo());
        settings.addView(export);

        exportProgress = new ProgressBar(this);
        exportProgress.setIndeterminate(true);
        exportProgress.setVisibility(View.GONE);
        settings.addView(exportProgress);

        exportStatus = text(
            "Exports save to Downloads/Continuity Studio/Exports",
            11,
            MUTED
        );
        exportStatus.setPadding(0, dp(8), 0, 0);
        settings.addView(exportStatus);
        body.addView(settings);

        scroll.addView(body);
        return scroll;
    }

    private void launchGoogleFlow() {
        String narration = generateNarration.getText().toString().trim();
        if (narration.isEmpty()) {
            generateNarration.setError("Paste narration or a scene idea.");
            return;
        }

        ProjectStore.Scene scene = findScene(activeSceneId);
        if (scene != null && scene.locked) {
            toast("Unlock this scene first.");
            return;
        }

        project.model = generateModel.getSelectedItem().toString();
        project.aspectRatio = generateAspect.getSelectedItem().toString();

        if (scene == null) {
            scene = new ProjectStore.Scene();
            project.scenes.add(scene);
            activeSceneId = scene.id;
        }

        scene.narration = narration;
        if (scene.subtitle == null || scene.subtitle.trim().isEmpty()) {
            scene.subtitle = narration;
        }

        flowPendingSceneId = scene.id;
        store.save(project);

        String prompt = compilePrompt(narration);

        ClipboardManager clipboard =
            (ClipboardManager) getSystemService(Context.CLIPBOARD_SERVICE);
        clipboard.setPrimaryClip(
            ClipData.newPlainText("Continuity Studio Flow Prompt", prompt)
        );

        ArrayList<Uri> streams = new ArrayList<>();
        for (String path : project.references) {
            if (streams.size() >= 8) break;
            File file = new File(path);
            if (!file.exists()) continue;

            try {
                streams.add(
                    FileProvider.getUriForFile(
                        this,
                        getPackageName() + ".files",
                        file
                    )
                );
            } catch (Exception ignored) {
            }
        }

        Intent handoff = new Intent(
            streams.isEmpty()
                ? Intent.ACTION_SEND
                : Intent.ACTION_SEND_MULTIPLE
        );
        handoff.setPackage(FLOW_PACKAGE);
        handoff.putExtra(Intent.EXTRA_TEXT, prompt);
        handoff.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);

        if (streams.isEmpty()) {
            handoff.setType("text/plain");
        } else {
            handoff.setType("image/*");
            handoff.putParcelableArrayListExtra(
                Intent.EXTRA_STREAM,
                streams
            );

            ClipData clip = ClipData.newUri(
                getContentResolver(),
                "Continuity reference",
                streams.get(0)
            );
            for (int i = 1; i < streams.size(); i++) {
                clip.addItem(new ClipData.Item(streams.get(i)));
            }
            handoff.setClipData(clip);
        }

        boolean launched = false;

        try {
            if (handoff.resolveActivity(getPackageManager()) != null) {
                startActivity(handoff);
                launched = true;
            }
        } catch (Exception ignored) {
        }

        if (!launched) {
            try {
                Intent launcher =
                    getPackageManager()
                        .getLaunchIntentForPackage(FLOW_PACKAGE);
                if (launcher != null) {
                    startActivity(launcher);
                    launched = true;
                }
            } catch (Exception ignored) {
            }
        }

        generateStatus.setTextColor(SUCCESS);

        if (launched) {
            generateStatus.setText(
                "Flow opened · prompt copied · " +
                streams.size() +
                " reference(s) shared when supported."
            );
            showFlowHandoffDialog();
            return;
        }

        generateStatus.setTextColor(Color.rgb(251, 191, 36));
        generateStatus.setText(
            "Google Flow app is not installed. Opening its Play Store page."
        );
        openFlowPlayStore();
    }

    private void showFlowHandoffDialog() {
        new AlertDialog.Builder(this)
            .setTitle("Continue in Google Flow")
            .setMessage(
                "Your continuity prompt is already copied. " +
                "If Flow accepted Android sharing, your reference images will arrive with the handoff.\n\n" +
                "In Flow choose Image, confirm the model and aspect ratio, generate, then Download the image. " +
                "Return to Continuity Studio and tap Import Flow Result to attach it to this exact scene."
            )
            .setPositiveButton("Got it", null)
            .setNeutralButton("Copy prompt again", (dialog, which) -> {
                String narration =
                    generateNarration == null
                        ? ""
                        : generateNarration.getText().toString().trim();
                if (!narration.isEmpty()) {
                    ClipboardManager clipboard =
                        (ClipboardManager)
                            getSystemService(Context.CLIPBOARD_SERVICE);
                    clipboard.setPrimaryClip(
                        ClipData.newPlainText(
                            "Continuity Studio Flow Prompt",
                            compilePrompt(narration)
                        )
                    );
                    toast("Prompt copied.");
                }
            })
            .show();
    }

    private void importFlowResult() {
        String target =
            flowPendingSceneId != null
                ? flowPendingSceneId
                : activeSceneId;

        if (target == null) {
            toast("Open a scene in Flow first so the result has a storyboard destination.");
            return;
        }

        pendingSceneImageId = target;

        Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
        intent.setType("image/*");
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        startActivityForResult(intent, PICK_FLOW_RESULT);
    }

    private void openFlowPlayStore() {
        try {
            startActivity(
                new Intent(
                    Intent.ACTION_VIEW,
                    Uri.parse(
                        "market://details?id=" + FLOW_PACKAGE
                    )
                )
            );
        } catch (Exception ignored) {
            openExternal(
                "https://play.google.com/store/apps/details?id=" +
                FLOW_PACKAGE
            );
        }
    }

    private void generateImage() {
        String narration = generateNarration.getText().toString().trim();
        if (narration.isEmpty()) {
            generateNarration.setError("Paste narration or a scene idea.");
            return;
        }

        final String apiKey;
        try {
            apiKey = apiKeyStore.get();
        } catch (Exception error) {
            generateStatus.setText("Could not read your saved API key.");
            return;
        }

        if (apiKey.isEmpty()) {
            showApiKeyDialog();
            return;
        }

        ProjectStore.Scene scene = findScene(activeSceneId);
        if (scene != null && scene.locked) {
            toast("Unlock this scene first.");
            return;
        }

        project.model = generateModel.getSelectedItem().toString();
        project.aspectRatio = generateAspect.getSelectedItem().toString();

        if (scene == null) {
            scene = new ProjectStore.Scene();
            project.scenes.add(scene);
            activeSceneId = scene.id;
        }

        scene.narration = narration;
        if (scene.subtitle == null || scene.subtitle.trim().isEmpty()) {
            scene.subtitle = narration;
        }
        store.save(project);

        ProjectStore.Scene target = scene;
        String prompt = compilePrompt(narration);

        generateButton.setEnabled(false);
        generateProgress.setVisibility(View.VISIBLE);
        generateStatus.setText("Generating with " + project.model + "…");
        generateStatus.setTextColor(MUTED);

        executor.execute(() -> {
            try {
                List<GeminiImageClient.ReferenceImage> refs =
                    loadReferenceImages();

                GeminiImageClient.Result result =
                    new GeminiImageClient().generate(
                        apiKey,
                        project.model,
                        prompt,
                        project.aspectRatio,
                        refs
                    );

                MediaFiles.SavedMedia saved =
                    MediaFiles.saveGeneratedImage(
                        this,
                        project.id,
                        result.bytes,
                        result.mimeType
                    );

                target.imagePath = saved.internalPath;
                store.save(project);

                Bitmap bitmap = BitmapFactory.decodeByteArray(
                    result.bytes,
                    0,
                    result.bytes.length
                );

                mainHandler.post(() -> {
                    generatePreview.setImageBitmap(bitmap);
                    generateProgress.setVisibility(View.GONE);
                    generateButton.setEnabled(true);
                    generateStatus.setTextColor(SUCCESS);
                    generateStatus.setText(
                        "Generated · saved to " + saved.publicLocation
                    );
                    headerProject.setText(project.title);
                });
            } catch (Exception error) {
                mainHandler.post(() -> {
                    generateProgress.setVisibility(View.GONE);
                    generateButton.setEnabled(true);

                    String message =
                        safeMessage(
                            error,
                            "Unknown generation error."
                        );

                    if ("FREE_TIER_IMAGE_DISABLED".equals(message)) {
                        generateStatus.setTextColor(
                            Color.rgb(251, 191, 36)
                        );
                        generateStatus.setText(
                            "Google API free tier has no image-generation quota."
                        );
                        showFreeTierImageDialog();
                        return;
                    }

                    generateStatus.setTextColor(DANGER);
                    generateStatus.setText(
                        "Generation failed: " + message
                    );
                });
            }
        });
    }

    private void showFreeTierImageDialog() {
        new AlertDialog.Builder(this)
            .setTitle("Google free tier cannot generate images")
            .setMessage(
                "Your API key is working, but Google currently gives Nano Banana image models a free-tier quota of 0. " +
                "Waiting or retrying will not fix this.\n\n" +
                "You can enable Gemini API billing, switch to the cheaper Nano Banana 2 Lite model after billing is active, " +
                "or open Google Flow in your browser and use your Flow credits manually."
            )
            .setPositiveButton("Enable API billing", (dialog, which) ->
                openExternal("https://aistudio.google.com/app/apikey")
            )
            .setNeutralButton("Use Nano Banana 2 Lite", (dialog, which) -> {
                if (generateModel != null) {
                    selectSpinner(generateModel, "Nano Banana 2 Lite");
                    project.model = "Nano Banana 2 Lite";
                    store.save(project);
                    generateStatus.setTextColor(MUTED);
                    generateStatus.setText(
                        "Nano Banana 2 Lite selected. Billing is still required for API image generation."
                    );
                }
            })
            .setNegativeButton("Open Flow", (dialog, which) ->
                openExternal("https://flow.google.com/")
            )
            .show();
    }

    private String compilePrompt(String narration) {
        return project.masterPrompt +
            "\n\nSCENE NARRATION / FACTUAL INTENT:\n" +
            narration +
            "\n\nCOMPOSITION RULES:\n" +
            "Represent the narration literally and clearly. Favor one strong focal subject. " +
            "Do not add explanatory on-image text. If the scene names a real product, device, company, person, era, or environment, make that exact subject recognizable and historically grounded.";
    }

    private List<GeminiImageClient.ReferenceImage>
    loadReferenceImages() throws Exception {
        ArrayList<GeminiImageClient.ReferenceImage> output =
            new ArrayList<>();

        int count = Math.min(8, project.references.size());
        for (int i = 0; i < count; i++) {
            File file = new File(project.references.get(i));
            if (!file.exists()) continue;

            try (
                FileInputStream input = new FileInputStream(file);
                ByteArrayOutputStream bytes = new ByteArrayOutputStream()
            ) {
                byte[] buffer = new byte[16 * 1024];
                int read;
                int total = 0;

                while ((read = input.read(buffer)) >= 0) {
                    total += read;
                    if (total > 12 * 1024 * 1024) {
                        throw new Exception(
                            "A reference image is over 12 MB."
                        );
                    }
                    bytes.write(buffer, 0, read);
                }

                output.add(
                    new GeminiImageClient.ReferenceImage(
                        bytes.toByteArray(),
                        mimeForPath(file.getName())
                    )
                );
            }
        }

        return output;
    }

    private void pickReferences() {
        Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
        intent.setType("image/*");
        intent.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        startActivityForResult(intent, PICK_REFERENCES);
    }

    private void pickVoiceover() {
        Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
        intent.setType("audio/*");
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        startActivityForResult(intent, PICK_VOICEOVER);
    }

    private void renderVideo() {
        if (project.renderedSceneCount() == 0) {
            toast("Generate at least one storyboard image first.");
            return;
        }

        exportProgress.setVisibility(View.VISIBLE);
        exportStatus.setTextColor(MUTED);
        exportStatus.setText("Rendering on your S23…");

        String quality =
            qualitySpinner == null
                ? "1080p"
                : qualitySpinner.getSelectedItem().toString();

        VideoRenderer.render(
            this,
            project,
            quality,
            new VideoRenderer.Callback() {
                @Override
                public void onSuccess(
                    String publicLocation,
                    String internalPath
                ) {
                    mainHandler.post(() -> {
                        project.lastExportPath = internalPath;
                        store.save(project);
                        exportProgress.setVisibility(View.GONE);
                        exportStatus.setTextColor(SUCCESS);
                        exportStatus.setText(
                            "Ready · " + publicLocation
                        );
                        toast("Video exported to Downloads.");
                        showScreen(SCREEN_EXPORT);
                    });
                }

                @Override
                public void onError(String message) {
                    mainHandler.post(() -> {
                        exportProgress.setVisibility(View.GONE);
                        exportStatus.setTextColor(DANGER);
                        exportStatus.setText(
                            "Export failed: " + message
                        );
                    });
                }
            }
        );
    }

    private void saveSrt() {
        try {
            String location = MediaFiles.publishText(
                this,
                VideoRenderer.buildSrt(project),
                "application/x-subrip",
                "Continuity Studio/Exports",
                sanitizeFile(project.title) + ".srt"
            );
            toast("Saved " + location);
        } catch (Exception error) {
            toast("Could not save SRT: " + safeMessage(error, "Unknown error"));
        }
    }

    private void showNewProjectDialog() {
        EditText input = new EditText(this);
        input.setHint("Project title");
        input.setSingleLine(true);

        new AlertDialog.Builder(this)
            .setTitle("New project")
            .setMessage(
                "Your continuity defaults are already filled. Just name the project."
            )
            .setView(input)
            .setPositiveButton("Create", (dialog, which) -> {
                project = store.create(
                    input.getText().toString(),
                    DEFAULT_MASTER
                );
                activeSceneId = null;
                showScreen(SCREEN_HOME);
            })
            .setNegativeButton("Cancel", null)
            .show();
    }

    private void showScriptImportDialog() {
        EditText input = editor(
            "Paste the full narration/script here. It will be split into editable storyboard scenes.",
            12
        );

        AlertDialog dialog = new AlertDialog.Builder(this)
            .setTitle("Import script")
            .setView(input)
            .setPositiveButton("Create scenes", null)
            .setNeutralButton("Replace scenes", null)
            .setNegativeButton("Cancel", null)
            .create();

        dialog.setOnShowListener(ignored -> {
            dialog.getButton(AlertDialog.BUTTON_POSITIVE)
                .setOnClickListener(v -> {
                    ArrayList<ProjectStore.Scene> scenes =
                        ProjectStore.splitScript(
                            input.getText().toString()
                        );
                    if (scenes.isEmpty()) {
                        input.setError("Paste a script first.");
                        return;
                    }
                    project.scenes.addAll(scenes);
                    store.save(project);
                    dialog.dismiss();
                    showScreen(SCREEN_STORYBOARD);
                });

            dialog.getButton(AlertDialog.BUTTON_NEUTRAL)
                .setOnClickListener(v -> {
                    ArrayList<ProjectStore.Scene> scenes =
                        ProjectStore.splitScript(
                            input.getText().toString()
                        );
                    if (scenes.isEmpty()) {
                        input.setError("Paste a script first.");
                        return;
                    }
                    project.scenes.clear();
                    project.scenes.addAll(scenes);
                    store.save(project);
                    dialog.dismiss();
                    showScreen(SCREEN_STORYBOARD);
                });
        });

        dialog.show();
    }

    private void showSceneEditor(ProjectStore.Scene scene) {
        LinearLayout layout = vertical();
        layout.setPadding(dp(18), 0, dp(18), 0);

        EditText narration = editor("Narration", 5);
        narration.setText(scene.narration);

        EditText subtitle = editor("Subtitle text", 3);
        subtitle.setText(scene.subtitle);

        EditText duration = new EditText(this);
        duration.setHint("Duration seconds");
        duration.setSingleLine(true);
        duration.setInputType(
            InputType.TYPE_CLASS_NUMBER |
            InputType.TYPE_NUMBER_FLAG_DECIMAL
        );
        duration.setText(
            String.format(Locale.US, "%.1f", scene.durationMs / 1000d)
        );

        layout.addView(text("Narration", 10, MUTED));
        layout.addView(narration);
        layout.addView(text("Subtitle", 10, MUTED));
        layout.addView(subtitle);
        layout.addView(text("Duration", 10, MUTED));
        layout.addView(duration);

        new AlertDialog.Builder(this)
            .setTitle("Edit scene")
            .setView(layout)
            .setPositiveButton("Save", (dialog, which) -> {
                scene.narration =
                    narration.getText().toString().trim();
                scene.subtitle =
                    subtitle.getText().toString().trim();

                try {
                    double seconds = Double.parseDouble(
                        duration.getText().toString().trim()
                    );
                    scene.durationMs = Math.max(
                        500,
                        Math.round(seconds * 1000d)
                    );
                } catch (Exception ignored) {
                }

                store.save(project);
                showScreen(SCREEN_STORYBOARD);
            })
            .setNegativeButton("Cancel", null)
            .show();
    }

    private void confirmDeleteScene(ProjectStore.Scene scene) {
        new AlertDialog.Builder(this)
            .setTitle("Delete scene?")
            .setMessage(
                "This removes the scene from this project. Exported files in Downloads are not touched."
            )
            .setPositiveButton("Delete", (dialog, which) -> {
                project.scenes.remove(scene);
                store.save(project);
                if (scene.id.equals(activeSceneId)) activeSceneId = null;
                showScreen(SCREEN_STORYBOARD);
            })
            .setNegativeButton("Cancel", null)
            .show();
    }

    private void showSettings() {
        String[] options = {
            "Test Flow Direct access (experimental)",
            apiKeyStore.hasKey()
                ? "Replace Gemini API key"
                : "Add Gemini API key",
            "Master continuity prompt",
            "Rename current project",
            "Clear Gemini API key",
            "Desktop companion"
        };

        new AlertDialog.Builder(this)
            .setTitle("Settings")
            .setItems(options, (dialog, which) -> {
                if (which == 0) {
                    startFlowDirectAccessProbe();
                } else if (which == 1) {
                    showApiKeyDialog();
                } else if (which == 2) {
                    showMasterPromptDialog();
                } else if (which == 3) {
                    showRenameDialog();
                } else if (which == 4) {
                    apiKeyStore.clear();
                    toast("Gemini API key cleared.");
                    if (currentScreen == SCREEN_GENERATE) {
                        showScreen(SCREEN_GENERATE);
                    }
                } else if (which == 5) {
                    startActivity(
                        new Intent(
                            this,
                            DesktopCompanionActivity.class
                        )
                    );
                }
            })
            .show();
    }

    private void startFlowDirectAccessProbe() {
        Intent chooser = AccountManager.newChooseAccountIntent(
            null,
            null,
            new String[] { "com.google" },
            "Choose the Google account you use with Flow",
            null,
            null,
            null
        );
        startActivityForResult(chooser, PICK_FLOW_ACCOUNT);
    }

    private void runFlowDirectAccessProbe(Account account) {
        if (account == null) {
            toast("No Google account selected.");
            return;
        }

        pendingFlowProbeAccount = account;

        AlertDialog progressDialog =
            new AlertDialog.Builder(this)
                .setTitle("Testing Flow Direct")
                .setMessage(
                    "Requesting the aisandbox scope under Continuity Studio's own app identity…"
                )
                .setCancelable(false)
                .create();
        progressDialog.show();

        executor.execute(() -> {
            String token = null;
            try {
                token = GoogleAuthUtil.getToken(
                    getApplicationContext(),
                    account,
                    "oauth2:" + FlowDirectProtocol.OAUTH_SCOPE
                );

                FlowDirectExperimentalClient client =
                    new FlowDirectExperimentalClient();

                FlowDirectExperimentalClient.AuthContext auth =
                    new FlowDirectExperimentalClient.AuthContext(
                        token,
                        "",
                        "0",
                        null,
                        null
                    );

                FlowDirectExperimentalClient.TransportResponse config =
                    client.fetchAppConfig(auth);

                FlowDirectExperimentalClient.TransportResponse models =
                    client.fetchModels(auth);

                String message =
                    describeFlowProbeResult(
                        config.statusCode,
                        models.statusCode
                    );

                mainHandler.post(() -> {
                    progressDialog.dismiss();
                    new AlertDialog.Builder(this)
                        .setTitle("Flow Direct access test")
                        .setMessage(message)
                        .setPositiveButton("OK", null)
                        .show();
                });
            } catch (UserRecoverableAuthException recoverable) {
                mainHandler.post(() -> {
                    progressDialog.dismiss();
                    try {
                        startActivityForResult(
                            recoverable.getIntent(),
                            RECOVER_FLOW_AUTH
                        );
                    } catch (Exception error) {
                        toast(
                            "Google authorization could not be opened."
                        );
                    }
                });
            } catch (Exception error) {
                String message =
                    safeMessage(
                        error,
                        "Google did not grant Flow Direct access."
                    );

                mainHandler.post(() -> {
                    progressDialog.dismiss();
                    new AlertDialog.Builder(this)
                        .setTitle("Flow Direct access test")
                        .setMessage(
                            "The direct-auth probe did not complete.\n\n" +
                            message +
                            "\n\nNo account token was stored."
                        )
                        .setPositiveButton("OK", null)
                        .show();
                });
            } finally {
                if (token != null && !token.isEmpty()) {
                    try {
                        GoogleAuthUtil.clearToken(
                            getApplicationContext(),
                            token
                        );
                    } catch (Exception ignored) {
                    }
                }
            }
        });
    }

    private String describeFlowProbeResult(
        int configStatus,
        int modelsStatus
    ) {
        if (configStatus >= 200 && configStatus < 300 &&
            modelsStatus >= 200 && modelsStatus < 300) {
            return
                "Success: Google accepted Continuity Studio's own OAuth identity for Flow discovery.\n\n" +
                "App config: HTTP " + configStatus +
                "\nModels: HTTP " + modelsStatus +
                "\n\nThis means direct Flow integration is technically viable. The next step is verifying the exact generation request schema and reCAPTCHA/client context.";
        }

        if (configStatus == 401 || configStatus == 403 ||
            modelsStatus == 401 || modelsStatus == 403) {
            return
                "Google issued/handled the account flow, but the Flow backend rejected direct discovery under Continuity Studio's identity.\n\n" +
                "App config: HTTP " + configStatus +
                "\nModels: HTTP " + modelsStatus +
                "\n\nThis usually indicates a first-party client/API-key/app-identity gate. The stable official Flow-app handoff remains available.";
        }

        return
            "The Flow backend was reached, but discovery did not return a normal success response.\n\n" +
            "App config: HTTP " + configStatus +
            "\nModels: HTTP " + modelsStatus +
            "\n\nThis can mean the HTTP method/schema still needs adjustment. No token was stored.";
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
            .setTitle("Gemini API key")
            .setMessage(
                "One-time setup. The key is encrypted with Android Keystore and is never bundled in the APK."
            )
            .setView(input)
            .setPositiveButton("Save", null)
            .setNegativeButton("Cancel", null)
            .create();

        dialog.setOnShowListener(ignored ->
            dialog.getButton(AlertDialog.BUTTON_POSITIVE)
                .setOnClickListener(v -> {
                    String value = input.getText().toString().trim();
                    if (value.length() < 20) {
                        input.setError("Paste the full API key.");
                        return;
                    }

                    try {
                        apiKeyStore.save(value);
                        toast("API key saved securely.");
                        dialog.dismiss();
                        if (currentScreen == SCREEN_GENERATE) {
                            showScreen(SCREEN_GENERATE);
                        }
                    } catch (Exception error) {
                        toast(
                            "Could not save key: " +
                            safeMessage(error, "Unknown error")
                        );
                    }
                })
        );
        dialog.show();
    }

    private void showMasterPromptDialog() {
        EditText input = editor(
            "Master continuity prompt",
            12
        );
        input.setText(project.masterPrompt);

        new AlertDialog.Builder(this)
            .setTitle("Continuity prompt")
            .setMessage(
                "Already filled for The Rise / cinematic tech-history."
            )
            .setView(input)
            .setPositiveButton("Save", (dialog, which) -> {
                String value = input.getText().toString().trim();
                project.masterPrompt =
                    value.isEmpty() ? DEFAULT_MASTER : value;
                store.save(project);
            })
            .setNeutralButton("Reset default", (dialog, which) -> {
                project.masterPrompt = DEFAULT_MASTER;
                store.save(project);
            })
            .setNegativeButton("Cancel", null)
            .show();
    }

    private void showRenameDialog() {
        EditText input = new EditText(this);
        input.setSingleLine(true);
        input.setText(project.title);
        input.setSelectAllOnFocus(true);

        new AlertDialog.Builder(this)
            .setTitle("Rename project")
            .setView(input)
            .setPositiveButton("Save", (dialog, which) -> {
                String value = input.getText().toString().trim();
                if (!value.isEmpty()) {
                    project.title = value;
                    store.save(project);
                    showScreen(currentScreen);
                }
            })
            .setNegativeButton("Cancel", null)
            .show();
    }

    private ProjectStore.Scene findScene(String id) {
        if (id == null || project == null) return null;
        for (ProjectStore.Scene scene : project.scenes) {
            if (id.equals(scene.id)) return scene;
        }
        return null;
    }

    private void refreshReferenceStatus() {
        if (referenceStatus == null) return;
        referenceStatus.setText(
            project.references.isEmpty()
                ? "No references · optional"
                : project.references.size() +
                    " continuity reference" +
                    (project.references.size() == 1 ? "" : "s") +
                    " saved"
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

    private String durationLabel(long ms) {
        long seconds = Math.max(0, Math.round(ms / 1000d));
        long minutes = seconds / 60;
        seconds %= 60;
        return String.format(Locale.US, "%d:%02d", minutes, seconds);
    }

    private String mimeForPath(String path) {
        String lower = path.toLowerCase(Locale.US);
        if (lower.endsWith(".png")) return "image/png";
        if (lower.endsWith(".webp")) return "image/webp";
        return "image/jpeg";
    }

    private String sanitizeFile(String value) {
        String output =
            value == null || value.trim().isEmpty()
                ? "Continuity-Subtitles"
                : value.trim();
        return output
            .replaceAll("[\\\\/:*?\"<>|]", "_")
            .replaceAll("\\s+", "-");
    }

    private String safeMessage(Throwable error, String fallback) {
        if (error == null || error.getMessage() == null ||
            error.getMessage().trim().isEmpty()) {
            return fallback;
        }
        return error.getMessage().trim();
    }

    private void openExternal(String url) {
        try {
            startActivity(
                new Intent(
                    Intent.ACTION_VIEW,
                    Uri.parse(url)
                )
            );
        } catch (Exception error) {
            toast("Could not open link.");
        }
    }

    private void toast(String message) {
        Toast.makeText(this, message, Toast.LENGTH_LONG).show();
    }

    @Override
    protected void onActivityResult(
        int requestCode,
        int resultCode,
        Intent data
    ) {
        super.onActivityResult(requestCode, resultCode, data);

        if (resultCode != RESULT_OK || data == null) return;

        if (requestCode == PICK_FLOW_ACCOUNT) {
            String name =
                data.getStringExtra(AccountManager.KEY_ACCOUNT_NAME);
            String type =
                data.getStringExtra(AccountManager.KEY_ACCOUNT_TYPE);

            if (name == null || name.trim().isEmpty()) {
                toast("No Google account selected.");
                return;
            }

            if (type == null || type.trim().isEmpty()) {
                type = "com.google";
            }

            runFlowDirectAccessProbe(
                new Account(name, type)
            );
            return;
        }

        if (requestCode == RECOVER_FLOW_AUTH) {
            Account account = pendingFlowProbeAccount;
            if (account != null) {
                runFlowDirectAccessProbe(account);
            } else {
                toast("Flow Direct authorization session expired.");
            }
            return;
        }

        if (requestCode == PICK_REFERENCES) {
            ArrayList<Uri> uris = new ArrayList<>();

            if (data.getClipData() != null) {
                int count = Math.min(
                    8,
                    data.getClipData().getItemCount()
                );
                for (int i = 0; i < count; i++) {
                    uris.add(
                        data.getClipData().getItemAt(i).getUri()
                    );
                }
            } else if (data.getData() != null) {
                uris.add(data.getData());
            }

            executor.execute(() -> {
                try {
                    project.references.clear();
                    for (Uri uri : uris) {
                        project.references.add(
                            MediaFiles.copyUriToProject(
                                this,
                                uri,
                                project.id,
                                "reference"
                            )
                        );
                    }
                    store.save(project);

                    mainHandler.post(() -> {
                        refreshReferenceStatus();
                        toast(
                            project.references.size() +
                            " reference image(s) saved."
                        );
                        if (currentScreen == SCREEN_HOME) {
                            showScreen(SCREEN_HOME);
                        }
                    });
                } catch (Exception error) {
                    mainHandler.post(() ->
                        toast(
                            "Could not import reference: " +
                            safeMessage(error, "Unknown error")
                        )
                    );
                }
            });
            return;
        }

        if (requestCode == PICK_VOICEOVER && data.getData() != null) {
            Uri uri = data.getData();
            executor.execute(() -> {
                try {
                    project.voiceoverPath =
                        MediaFiles.copyUriToProject(
                            this,
                            uri,
                            project.id,
                            "voiceover"
                        );
                    store.save(project);
                    mainHandler.post(() -> {
                        toast("Voiceover saved to project.");
                        showScreen(SCREEN_EXPORT);
                    });
                } catch (Exception error) {
                    mainHandler.post(() ->
                        toast(
                            "Could not import voiceover: " +
                            safeMessage(error, "Unknown error")
                        )
                    );
                }
            });
            return;
        }

        if ((requestCode == PICK_SCENE_IMAGE ||
             requestCode == PICK_FLOW_RESULT) &&
            data.getData() != null &&
            pendingSceneImageId != null) {
            Uri uri = data.getData();
            ProjectStore.Scene scene =
                findScene(pendingSceneImageId);
            String sceneId = pendingSceneImageId;
            pendingSceneImageId = null;

            if (scene == null) return;

            executor.execute(() -> {
                try {
                    scene.imagePath =
                        MediaFiles.copyUriToProject(
                            this,
                            uri,
                            project.id,
                            "scene-" + sceneId
                        );
                    store.save(project);
                    mainHandler.post(() -> {
                        if (requestCode == PICK_FLOW_RESULT) {
                            activeSceneId = scene.id;
                            flowPendingSceneId = null;
                            toast("Flow result attached to the storyboard scene.");
                            showScreen(SCREEN_GENERATE);
                        } else {
                            toast("Scene image replaced.");
                            showScreen(SCREEN_STORYBOARD);
                        }
                    });
                } catch (Exception error) {
                    mainHandler.post(() ->
                        toast(
                            "Could not import scene image: " +
                            safeMessage(error, "Unknown error")
                        )
                    );
                }
            });
        }
    }

    @Override
    protected void onDestroy() {
        executor.shutdownNow();
        super.onDestroy();
    }
}
