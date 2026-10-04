package com.continuitystudio.mobile;

import android.content.ActivityNotFoundException;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.widget.Toast;

import androidx.core.content.FileProvider;

import java.io.File;
import java.util.ArrayList;

public final class FlowHandoff {
    public static final String FLOW_PACKAGE =
        "com.google.android.apps.labs.whisk";

    private static final String PREFS = "continuity_flow_handoff";
    private static final String KEY_PROJECT = "pending_project";
    private static final String KEY_SCENE = "pending_scene";

    private FlowHandoff() {}

    public static boolean isInstalled(Context context) {
        try {
            context.getPackageManager().getPackageInfo(FLOW_PACKAGE, 0);
            return true;
        } catch (PackageManager.NameNotFoundException error) {
            return false;
        }
    }

    public static void remember(
        Context context,
        String projectId,
        String sceneId
    ) {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .edit()
            .putString(KEY_PROJECT, projectId == null ? "" : projectId)
            .putString(KEY_SCENE, sceneId == null ? "" : sceneId)
            .apply();
    }

    public static String pendingScene(Context context) {
        return context
            .getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .getString(KEY_SCENE, "");
    }

    public static String pendingProject(Context context) {
        return context
            .getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .getString(KEY_PROJECT, "");
    }

    public static void clearPending(Context context) {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .edit()
            .remove(KEY_PROJECT)
            .remove(KEY_SCENE)
            .apply();
    }

    public static void open(
        Context context,
        ProjectStore.Project project,
        ProjectStore.Scene scene,
        String compiledPrompt
    ) {
        if (project == null || scene == null) return;

        ClipboardManager clipboard =
            (ClipboardManager)
                context.getSystemService(Context.CLIPBOARD_SERVICE);

        if (clipboard != null) {
            clipboard.setPrimaryClip(
                ClipData.newPlainText(
                    "Continuity Studio Flow Prompt",
                    compiledPrompt
                )
            );
        }

        remember(context, project.id, scene.id);

        if (!isInstalled(context)) {
            openStore(context);
            return;
        }

        ArrayList<Uri> references = new ArrayList<>();
        for (String path : project.references) {
            if (references.size() >= 8) break;
            if (path == null || path.isEmpty()) continue;

            File file = new File(path);
            if (!file.exists()) continue;

            try {
                references.add(
                    FileProvider.getUriForFile(
                        context,
                        context.getPackageName() + ".files",
                        file
                    )
                );
            } catch (Exception ignored) {
            }
        }

        boolean launched = false;

        if (!references.isEmpty()) {
            Intent intent = new Intent(Intent.ACTION_SEND_MULTIPLE);
            intent.setPackage(FLOW_PACKAGE);
            intent.setType("image/*");
            intent.putParcelableArrayListExtra(
                Intent.EXTRA_STREAM,
                references
            );
            intent.putExtra(Intent.EXTRA_TEXT, compiledPrompt);
            intent.putExtra(
                Intent.EXTRA_SUBJECT,
                "Continuity Studio Scene"
            );
            intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);

            ClipData clip = ClipData.newUri(
                context.getContentResolver(),
                "Continuity reference",
                references.get(0)
            );

            for (int i = 1; i < references.size(); i++) {
                clip.addItem(new ClipData.Item(references.get(i)));
            }

            intent.setClipData(clip);

            try {
                context.startActivity(intent);
                launched = true;
            } catch (Exception ignored) {
            }
        }

        if (!launched) {
            Intent text = new Intent(Intent.ACTION_SEND);
            text.setPackage(FLOW_PACKAGE);
            text.setType("text/plain");
            text.putExtra(Intent.EXTRA_TEXT, compiledPrompt);

            try {
                context.startActivity(text);
                launched = true;
            } catch (Exception ignored) {
            }
        }

        if (!launched) {
            Intent launcher =
                context.getPackageManager()
                    .getLaunchIntentForPackage(FLOW_PACKAGE);

            if (launcher != null) {
                try {
                    context.startActivity(launcher);
                    launched = true;
                } catch (Exception ignored) {
                }
            }
        }

        if (!launched) {
            openStore(context);
        } else {
            Toast.makeText(
                context,
                "Flow opened. Your full continuity prompt is copied.",
                Toast.LENGTH_LONG
            ).show();
        }
    }

    public static void openStore(Context context) {
        try {
            context.startActivity(
                new Intent(
                    Intent.ACTION_VIEW,
                    Uri.parse(
                        "market://details?id=" + FLOW_PACKAGE
                    )
                )
            );
        } catch (ActivityNotFoundException error) {
            context.startActivity(
                new Intent(
                    Intent.ACTION_VIEW,
                    Uri.parse(
                        "https://play.google.com/store/apps/details?id=" +
                        FLOW_PACKAGE
                    )
                )
            );
        }
    }
}
