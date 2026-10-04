package com.continuitystudio.mobile;

import android.app.AlertDialog;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.net.Uri;
import android.os.Bundle;
import android.text.InputType;
import android.view.Gravity;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.EditText;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.widget.Toast;

import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.fragment.app.Fragment;

import com.google.android.material.button.MaterialButton;
import com.google.android.material.card.MaterialCardView;

import java.io.File;
import java.util.Locale;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class StoryboardFragment extends Fragment {
    private final ExecutorService executor =
        Executors.newSingleThreadExecutor();

    private ProjectStore store;
    private ProjectStore.Project project;
    private TextView meta;
    private LinearLayout container;
    private String pendingImageSceneId;

    private ActivityResultLauncher<String[]> imagePicker;

    @Override
    public void onCreate(@Nullable Bundle state) {
        super.onCreate(state);

        imagePicker =
            registerForActivityResult(
                new ActivityResultContracts.OpenDocument(),
                uri -> {
                    if (uri != null &&
                        pendingImageSceneId != null) {
                        replaceSceneImage(
                            pendingImageSceneId,
                            uri
                        );
                    }
                }
            );
    }

    @Nullable
    @Override
    public View onCreateView(
        @NonNull LayoutInflater inflater,
        @Nullable ViewGroup parent,
        @Nullable Bundle state
    ) {
        return inflater.inflate(
            R.layout.fragment_storyboard,
            parent,
            false
        );
    }

    @Override
    public void onViewCreated(
        @NonNull View view,
        @Nullable Bundle state
    ) {
        super.onViewCreated(view, state);

        store = new ProjectStore(requireContext());
        meta = view.findViewById(R.id.storyboard_meta);
        container =
            view.findViewById(R.id.storyboard_container);

        view.findViewById(R.id.btn_story_add)
            .setOnClickListener(v -> addScene());

        refresh();
    }

    @Override
    public void onResume() {
        super.onResume();
        if (store != null) refresh();
    }

    private int dp(int value) {
        return Math.round(
            value *
            getResources().getDisplayMetrics().density
        );
    }

    private void refresh() {
        project = store.current(MainActivity.DEFAULT_MASTER);
        container.removeAllViews();

        meta.setText(
            project.scenes.size() +
            " scenes · " +
            project.renderedSceneCount() +
            " rendered · " +
            duration(project.totalDurationMs())
        );

        if (project.scenes.isEmpty()) {
            TextView empty = new TextView(requireContext());
            empty.setText(
                "Your storyboard is empty. Add a scene or import a script from Generate."
            );
            empty.setTextColor(0xFF94A3B8);
            empty.setTextSize(14);
            empty.setPadding(0, dp(30), 0, dp(30));
            empty.setGravity(Gravity.CENTER);
            container.addView(empty);
            return;
        }

        for (int i = 0; i < project.scenes.size(); i++) {
            container.addView(
                buildSceneCard(
                    project.scenes.get(i),
                    i
                )
            );
        }

        ((StudioActivity) requireActivity()).refreshHeader();
    }

    private View buildSceneCard(
        ProjectStore.Scene scene,
        int index
    ) {
        MaterialCardView card =
            new MaterialCardView(requireContext());

        card.setCardBackgroundColor(0xFF1A1F2E);
        card.setRadius(dp(18));
        card.setCardElevation(dp(2));

        LinearLayout.LayoutParams cardParams =
            new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT
            );
        cardParams.bottomMargin = dp(12);
        card.setLayoutParams(cardParams);

        LinearLayout body = new LinearLayout(requireContext());
        body.setOrientation(LinearLayout.VERTICAL);
        body.setPadding(
            dp(14),
            dp(14),
            dp(14),
            dp(14)
        );

        LinearLayout top = new LinearLayout(requireContext());
        top.setOrientation(LinearLayout.HORIZONTAL);
        top.setGravity(Gravity.CENTER_VERTICAL);

        ImageView thumbnail = new ImageView(requireContext());
        thumbnail.setBackgroundColor(0xFF080B14);
        thumbnail.setScaleType(
            ImageView.ScaleType.CENTER_CROP
        );

        Bitmap bitmap = loadThumb(scene.imagePath);
        if (bitmap != null) {
            thumbnail.setImageBitmap(bitmap);
        }

        LinearLayout.LayoutParams thumbParams =
            new LinearLayout.LayoutParams(
                dp(108),
                dp(80)
            );
        thumbParams.rightMargin = dp(12);
        top.addView(thumbnail, thumbParams);

        LinearLayout copy = new LinearLayout(requireContext());
        copy.setOrientation(LinearLayout.VERTICAL);

        TextView number = new TextView(requireContext());
        number.setText(
            String.format(
                Locale.US,
                "SCENE %02d",
                index + 1
            )
        );
        number.setTextColor(0xFF8B5CF6);
        number.setTextSize(10);
        number.setLetterSpacing(0.1f);
        copy.addView(number);

        TextView narration = new TextView(requireContext());
        String preview =
            scene.narration == null ||
            scene.narration.trim().isEmpty()
                ? "Untitled scene"
                : scene.narration.trim();

        if (preview.length() > 110) {
            preview = preview.substring(0, 107) + "…";
        }

        narration.setText(preview);
        narration.setTextColor(0xFFF8FAFC);
        narration.setTextSize(14);
        narration.setMaxLines(3);
        narration.setPadding(0, dp(4), 0, dp(3));
        copy.addView(narration);

        TextView details = new TextView(requireContext());
        details.setText(
            String.format(
                Locale.US,
                "%.1fs · %s · %s",
                scene.durationMs / 1000d,
                scene.locked ? "Locked" : "Editable",
                scene.imagePath == null ||
                scene.imagePath.isEmpty()
                    ? "No image"
                    : "Image ready"
            )
        );
        details.setTextColor(0xFF94A3B8);
        details.setTextSize(11);
        copy.addView(details);

        top.addView(
            copy,
            new LinearLayout.LayoutParams(
                0,
                ViewGroup.LayoutParams.WRAP_CONTENT,
                1f
            )
        );

        body.addView(top);

        LinearLayout actions =
            new LinearLayout(requireContext());
        actions.setOrientation(LinearLayout.HORIZONTAL);
        actions.setPadding(0, dp(10), 0, 0);

        MaterialButton generate =
            smallButton(
                scene.imagePath == null ||
                scene.imagePath.isEmpty()
                    ? "Generate"
                    : "Regenerate"
            );

        generate.setOnClickListener(v -> {
            if (scene.locked) {
                toast("Unlock this scene first.");
                return;
            }
            ((StudioActivity) requireActivity())
                .navigateToGenerate(scene.id);
        });

        MaterialButton edit = smallButton("Edit");
        edit.setOnClickListener(v -> editScene(scene));

        MaterialButton lock =
            smallButton(scene.locked ? "Unlock" : "Lock");
        lock.setOnClickListener(v -> {
            scene.locked = !scene.locked;
            store.save(project);
            refresh();
        });

        addWeighted(actions, generate, true);
        addWeighted(actions, edit, true);
        addWeighted(actions, lock, false);
        body.addView(actions);

        LinearLayout actions2 =
            new LinearLayout(requireContext());
        actions2.setOrientation(LinearLayout.HORIZONTAL);
        actions2.setPadding(0, dp(7), 0, 0);

        MaterialButton own =
            smallButton("Use own image");
        own.setOnClickListener(v -> {
            if (scene.locked) {
                toast("Unlock this scene first.");
                return;
            }
            pendingImageSceneId = scene.id;
            imagePicker.launch(
                new String[] { "image/*" }
            );
        });

        MaterialButton delete = smallButton("Delete");
        delete.setTextColor(0xFFF87171);
        delete.setOnClickListener(v ->
            confirmDelete(scene)
        );

        addWeighted(actions2, own, true);
        addWeighted(actions2, delete, false);
        body.addView(actions2);

        card.addView(body);
        return card;
    }

    private MaterialButton smallButton(String label) {
        MaterialButton button =
            new MaterialButton(
                requireContext(),
                null,
                com.google.android.material.R.attr.materialButtonOutlinedStyle
            );
        button.setText(label);
        button.setTextSize(11);
        button.setAllCaps(false);
        button.setCornerRadius(dp(11));
        return button;
    }

    private void addWeighted(
        LinearLayout row,
        View view,
        boolean margin
    ) {
        LinearLayout.LayoutParams params =
            new LinearLayout.LayoutParams(
                0,
                ViewGroup.LayoutParams.WRAP_CONTENT,
                1f
            );

        if (margin) params.rightMargin = dp(6);
        row.addView(view, params);
    }

    private void addScene() {
        ProjectStore.Scene scene =
            new ProjectStore.Scene();
        project.scenes.add(scene);
        store.save(project);

        ((StudioActivity) requireActivity())
            .navigateToGenerate(scene.id);
    }

    private void editScene(ProjectStore.Scene scene) {
        LinearLayout form =
            new LinearLayout(requireContext());
        form.setOrientation(LinearLayout.VERTICAL);
        form.setPadding(dp(18), 0, dp(18), 0);

        EditText narration =
            new EditText(requireContext());
        narration.setHint("Narration");
        narration.setMinLines(4);
        narration.setText(scene.narration);

        EditText subtitle =
            new EditText(requireContext());
        subtitle.setHint("Subtitle");
        subtitle.setMinLines(2);
        subtitle.setText(scene.subtitle);

        EditText duration =
            new EditText(requireContext());
        duration.setHint("Duration in seconds");
        duration.setSingleLine(true);
        duration.setInputType(
            InputType.TYPE_CLASS_NUMBER |
            InputType.TYPE_NUMBER_FLAG_DECIMAL
        );
        duration.setText(
            String.format(
                Locale.US,
                "%.1f",
                scene.durationMs / 1000d
            )
        );

        form.addView(narration);
        form.addView(subtitle);
        form.addView(duration);

        new AlertDialog.Builder(requireContext())
            .setTitle("Edit Scene")
            .setView(form)
            .setPositiveButton("Save", (dialog, which) -> {
                scene.narration =
                    narration.getText().toString().trim();
                scene.subtitle =
                    subtitle.getText().toString().trim();

                try {
                    double seconds =
                        Double.parseDouble(
                            duration.getText()
                                .toString()
                                .trim()
                        );
                    scene.durationMs =
                        Math.max(
                            500,
                            Math.round(seconds * 1000d)
                        );
                } catch (Exception ignored) {
                }

                store.save(project);
                refresh();
            })
            .setNegativeButton("Cancel", null)
            .show();
    }

    private void confirmDelete(
        ProjectStore.Scene scene
    ) {
        new AlertDialog.Builder(requireContext())
            .setTitle("Delete scene?")
            .setMessage(
                "The scene is removed from this project. Existing files in Downloads are not deleted."
            )
            .setPositiveButton("Delete", (dialog, which) -> {
                project.scenes.remove(scene);
                store.save(project);
                refresh();
            })
            .setNegativeButton("Cancel", null)
            .show();
    }

    private void replaceSceneImage(
        String sceneId,
        Uri uri
    ) {
        ProjectStore.Scene scene = find(sceneId);

        if (scene == null) {
            toast("Scene not found.");
            return;
        }

        executor.execute(() -> {
            try {
                String path =
                    MediaFiles.copyUriToProject(
                        requireContext(),
                        uri,
                        project.id,
                        "scene-" + scene.id
                    );

                scene.imagePath = path;
                store.save(project);

                requireActivity().runOnUiThread(() -> {
                    pendingImageSceneId = null;
                    refresh();
                    toast("Scene image replaced.");
                });
            } catch (Exception error) {
                requireActivity().runOnUiThread(() ->
                    toast("Could not import image.")
                );
            }
        });
    }

    private ProjectStore.Scene find(String id) {
        for (ProjectStore.Scene scene : project.scenes) {
            if (scene.id.equals(id)) return scene;
        }
        return null;
    }

    private Bitmap loadThumb(String path) {
        if (path == null || path.isEmpty()) return null;

        File file = new File(path);
        if (!file.exists()) return null;

        BitmapFactory.Options bounds =
            new BitmapFactory.Options();
        bounds.inJustDecodeBounds = true;
        BitmapFactory.decodeFile(path, bounds);

        int sample = 1;
        while (
            bounds.outWidth / sample > 480 ||
            bounds.outHeight / sample > 480
        ) {
            sample *= 2;
        }

        BitmapFactory.Options options =
            new BitmapFactory.Options();
        options.inSampleSize = sample;

        return BitmapFactory.decodeFile(path, options);
    }

    private String duration(long ms) {
        long seconds = Math.max(0, Math.round(ms / 1000d));
        long minutes = seconds / 60;
        seconds %= 60;
        return String.format(
            Locale.US,
            "%d:%02d",
            minutes,
            seconds
        );
    }

    private void toast(String value) {
        Toast.makeText(
            requireContext(),
            value,
            Toast.LENGTH_LONG
        ).show();
    }

    @Override
    public void onDestroy() {
        executor.shutdownNow();
        super.onDestroy();
    }
}
