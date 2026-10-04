package com.continuitystudio.mobile;

import android.app.AlertDialog;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.net.Uri;
import android.os.Bundle;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.ArrayAdapter;
import android.widget.EditText;
import android.widget.ImageView;
import android.widget.Spinner;
import android.widget.TextView;
import android.widget.Toast;

import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.fragment.app.Fragment;

import com.google.android.material.button.MaterialButton;

import java.io.File;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class GenerateFragment extends Fragment {
    private static final String ARG_SCENE_ID = "scene_id";

    private static final String[] MODELS = {
        "Nano Banana 2",
        "Nano Banana 2 Lite",
        "Nano Banana Pro"
    };

    private static final String[] ASPECTS = {
        "16:9",
        "9:16",
        "1:1",
        "4:3",
        "3:4"
    };

    private final ExecutorService executor =
        Executors.newSingleThreadExecutor();

    private ProjectStore store;
    private ProjectStore.Project project;
    private int sceneIndex = 0;

    private TextView projectTitle;
    private TextView sceneInfo;
    private TextView refCount;
    private TextView status;
    private EditText narration;
    private Spinner model;
    private Spinner aspect;
    private ImageView preview;
    private MaterialButton openFlow;
    private MaterialButton importResult;

    private ActivityResultLauncher<String[]> resultPicker;
    private ActivityResultLauncher<String[]> referencePicker;

    public static GenerateFragment newInstance(String sceneId) {
        GenerateFragment fragment = new GenerateFragment();
        if (sceneId != null && !sceneId.isEmpty()) {
            Bundle args = new Bundle();
            args.putString(ARG_SCENE_ID, sceneId);
            fragment.setArguments(args);
        }
        return fragment;
    }

    @Override
    public void onCreate(@Nullable Bundle state) {
        super.onCreate(state);

        resultPicker =
            registerForActivityResult(
                new ActivityResultContracts.OpenDocument(),
                uri -> {
                    if (uri != null) importFlowResult(uri);
                }
            );

        referencePicker =
            registerForActivityResult(
                new ActivityResultContracts.OpenMultipleDocuments(),
                uris -> {
                    if (uris != null && !uris.isEmpty()) {
                        importReferences(uris);
                    }
                }
            );
    }

    @Nullable
    @Override
    public View onCreateView(
        @NonNull LayoutInflater inflater,
        @Nullable ViewGroup container,
        @Nullable Bundle state
    ) {
        return inflater.inflate(
            R.layout.fragment_generate,
            container,
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

        projectTitle =
            view.findViewById(R.id.generate_project_title);
        sceneInfo = view.findViewById(R.id.scene_info);
        refCount = view.findViewById(R.id.ref_count);
        status = view.findViewById(R.id.generate_status);
        narration = view.findViewById(R.id.narration_edit);
        model = view.findViewById(R.id.model_spinner);
        aspect = view.findViewById(R.id.aspect_spinner);
        preview = view.findViewById(R.id.scene_preview);
        openFlow = view.findViewById(R.id.btn_open_flow);
        importResult = view.findViewById(R.id.btn_import_result);

        model.setAdapter(
            new ArrayAdapter<>(
                requireContext(),
                android.R.layout.simple_spinner_dropdown_item,
                MODELS
            )
        );

        aspect.setAdapter(
            new ArrayAdapter<>(
                requireContext(),
                android.R.layout.simple_spinner_dropdown_item,
                ASPECTS
            )
        );

        view.findViewById(R.id.btn_prev_scene)
            .setOnClickListener(v -> navigate(-1));
        view.findViewById(R.id.btn_next_scene)
            .setOnClickListener(v -> navigate(1));
        view.findViewById(R.id.btn_add_scene)
            .setOnClickListener(v -> addScene());
        view.findViewById(R.id.btn_import_script)
            .setOnClickListener(v -> showScriptDialog());
        view.findViewById(R.id.btn_add_refs)
            .setOnClickListener(v ->
                referencePicker.launch(new String[] { "image/*" })
            );
        view.findViewById(R.id.btn_clear_refs)
            .setOnClickListener(v -> clearReferences());

        openFlow.setOnClickListener(v -> openCurrentInFlow());
        importResult.setOnClickListener(v ->
            resultPicker.launch(new String[] { "image/*" })
        );

        refresh();

        if (getArguments() != null) {
            String sceneId =
                getArguments().getString(ARG_SCENE_ID, "");
            if (!sceneId.isEmpty()) {
                selectScene(sceneId);
            }
        }
    }

    @Override
    public void onResume() {
        super.onResume();
        if (store != null) refresh();
    }

    private void refresh() {
        project = store.current(MainActivity.DEFAULT_MASTER);
        projectTitle.setText(project.title);

        setSpinner(model, project.model, MODELS);
        setSpinner(aspect, project.aspectRatio, ASPECTS);

        int count = project.scenes.size();

        if (count == 0) {
            sceneIndex = 0;
            sceneInfo.setText(
                "No scenes yet · add one or import a script"
            );
            narration.setText("");
            preview.setImageDrawable(null);
            openFlow.setEnabled(false);
            importResult.setEnabled(false);
        } else {
            sceneIndex =
                Math.max(0, Math.min(sceneIndex, count - 1));

            ProjectStore.Scene scene =
                project.scenes.get(sceneIndex);

            sceneInfo.setText(
                String.format(
                    Locale.US,
                    "Scene %d / %d · %.1fs · %s",
                    sceneIndex + 1,
                    count,
                    scene.durationMs / 1000d,
                    scene.locked
                        ? "Locked"
                        : scene.imagePath == null ||
                          scene.imagePath.isEmpty()
                            ? "Pending"
                            : "Image ready"
                )
            );

            narration.setText(scene.narration);
            openFlow.setEnabled(!scene.locked);
            importResult.setEnabled(!scene.locked);
            openFlow.setText(
                scene.imagePath == null || scene.imagePath.isEmpty()
                    ? R.string.open_in_google_flow
                    : R.string.regenerate_in_google_flow
            );

            showPreview(scene.imagePath);
        }

        int references = project.references.size();
        refCount.setText(
            references +
            " continuity reference" +
            (references == 1 ? "" : "s")
        );

        ((StudioActivity) requireActivity()).refreshHeader();
    }

    private void selectScene(String sceneId) {
        if (project == null || sceneId == null) return;

        for (int i = 0; i < project.scenes.size(); i++) {
            if (sceneId.equals(project.scenes.get(i).id)) {
                sceneIndex = i;
                refresh();
                return;
            }
        }
    }

    private void navigate(int delta) {
        if (project == null || project.scenes.isEmpty()) return;
        saveCurrentScene();
        sceneIndex =
            Math.max(
                0,
                Math.min(
                    project.scenes.size() - 1,
                    sceneIndex + delta
                )
            );
        refresh();
    }

    private void saveCurrentScene() {
        if (project == null ||
            project.scenes.isEmpty() ||
            sceneIndex >= project.scenes.size()) {
            return;
        }

        ProjectStore.Scene scene =
            project.scenes.get(sceneIndex);

        String previous =
            scene.narration == null ? "" : scene.narration;
        String text =
            narration.getText().toString().trim();

        scene.narration = text;

        if (scene.subtitle == null ||
            scene.subtitle.trim().isEmpty() ||
            scene.subtitle.equals(previous)) {
            scene.subtitle = text;
        }

        if (!text.isEmpty()) {
            int words = text.split("\\s+").length;
            scene.durationMs =
                Math.max(
                    2500,
                    Math.min(
                        16000,
                        Math.round(words / 2.5f * 1000f)
                    )
                );
        }

        project.model =
            String.valueOf(model.getSelectedItem());
        project.aspectRatio =
            String.valueOf(aspect.getSelectedItem());

        store.save(project);
    }

    private void openCurrentInFlow() {
        if (project == null || project.scenes.isEmpty()) {
            toast("Add a scene first.");
            return;
        }

        saveCurrentScene();

        ProjectStore.Scene scene =
            project.scenes.get(sceneIndex);

        if (scene.locked) {
            toast("Unlock this scene in Storyboard first.");
            return;
        }

        if (scene.narration == null ||
            scene.narration.trim().isEmpty()) {
            narration.setError("Enter scene narration first.");
            return;
        }

        String compiled =
            compilePrompt(project, scene.narration);

        FlowHandoff.open(
            requireContext(),
            project,
            scene,
            compiled
        );

        status.setText(
            "Flow opened · prompt copied · return here and tap Import Flow Result."
        );
    }

    private String compilePrompt(
        ProjectStore.Project project,
        String sceneNarration
    ) {
        return project.masterPrompt +
            "\n\nSCENE NARRATION / FACTUAL INTENT:\n" +
            sceneNarration +
            "\n\nCOMPOSITION RULES:\n" +
            "Represent the narration literally and clearly.\n" +
            "Favor one strong focal subject.\n" +
            "Do not add explanatory on-image text unless specifically requested.\n" +
            "If the scene names a real product, device, company, person, era, or environment, make that subject visually recognizable and historically grounded.";
    }

    private void importFlowResult(Uri uri) {
        String pendingProject =
            FlowHandoff.pendingProject(requireContext());
        String pendingScene =
            FlowHandoff.pendingScene(requireContext());

        ProjectStore.Project target =
            resolveProject(
                pendingProject == null || pendingProject.isEmpty()
                    ? project.id
                    : pendingProject
            );

        if (target == null) {
            toast("The originating project could not be found.");
            return;
        }

        String sceneId =
            pendingScene == null || pendingScene.isEmpty()
                ? currentSceneId()
                : pendingScene;

        ProjectStore.Scene targetScene =
            findScene(target, sceneId);

        if (targetScene == null) {
            toast("The originating scene could not be found.");
            return;
        }

        if (targetScene.locked) {
            toast("Unlock this scene before replacing its image.");
            return;
        }

        status.setText("Importing Flow result…");

        executor.execute(() -> {
            try {
                String path =
                    MediaFiles.copyUriToProject(
                        requireContext(),
                        uri,
                        target.id,
                        "flow-" + targetScene.id
                    );

                targetScene.imagePath = path;
                store.save(target);
                store.setCurrent(target.id);
                FlowHandoff.clearPending(requireContext());

                requireActivity().runOnUiThread(() -> {
                    project = target;
                    selectScene(targetScene.id);
                    status.setText(
                        "Flow result attached to the exact storyboard scene."
                    );
                    toast("Flow result imported.");
                });
            } catch (Exception error) {
                requireActivity().runOnUiThread(() -> {
                    status.setText(
                        "Flow result could not be imported."
                    );
                    toast(
                        error.getMessage() == null
                            ? "Import failed."
                            : error.getMessage()
                    );
                });
            }
        });
    }

    private void importReferences(List<Uri> uris) {
        status.setText("Importing references…");

        executor.execute(() -> {
            try {
                ArrayList<String> imported = new ArrayList<>();

                int limit = Math.min(8, uris.size());
                for (int i = 0; i < limit; i++) {
                    imported.add(
                        MediaFiles.copyUriToProject(
                            requireContext(),
                            uris.get(i),
                            project.id,
                            "reference"
                        )
                    );
                }

                project.references.clear();
                project.references.addAll(imported);
                store.save(project);

                requireActivity().runOnUiThread(() -> {
                    status.setText(
                        "References saved to this project."
                    );
                    refresh();
                });
            } catch (Exception error) {
                requireActivity().runOnUiThread(() ->
                    toast("Could not import references.")
                );
            }
        });
    }

    private void clearReferences() {
        project.references.clear();
        store.save(project);
        refresh();
    }

    private void addScene() {
        saveCurrentScene();

        ProjectStore.Scene scene =
            new ProjectStore.Scene();

        project.scenes.add(scene);
        sceneIndex = project.scenes.size() - 1;
        store.save(project);
        refresh();
        narration.requestFocus();
    }

    private void showScriptDialog() {
        EditText input = new EditText(requireContext());
        input.setHint("Paste full narration/script here…");
        input.setMinLines(10);

        AlertDialog dialog =
            new AlertDialog.Builder(requireContext())
                .setTitle("Import Script")
                .setMessage(
                    "Exact narration is preserved and split at natural sentence boundaries."
                )
                .setView(input)
                .setPositiveButton("Replace scenes", null)
                .setNeutralButton("Append scenes", null)
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

                    project.scenes.clear();
                    project.scenes.addAll(scenes);
                    sceneIndex = 0;
                    store.save(project);
                    dialog.dismiss();
                    refresh();
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

                    project.scenes.addAll(scenes);
                    store.save(project);
                    dialog.dismiss();
                    refresh();
                });
        });

        dialog.show();
    }

    private void showPreview(String path) {
        preview.setImageDrawable(null);

        if (path == null || path.isEmpty()) return;

        File file = new File(path);
        if (!file.exists()) return;

        BitmapFactory.Options bounds =
            new BitmapFactory.Options();
        bounds.inJustDecodeBounds = true;
        BitmapFactory.decodeFile(path, bounds);

        int sample = 1;
        while (
            bounds.outWidth / sample > 1600 ||
            bounds.outHeight / sample > 1600
        ) {
            sample *= 2;
        }

        BitmapFactory.Options options =
            new BitmapFactory.Options();
        options.inSampleSize = sample;

        Bitmap bitmap =
            BitmapFactory.decodeFile(path, options);

        if (bitmap != null) {
            preview.setImageBitmap(bitmap);
        }
    }

    private String currentSceneId() {
        if (project == null ||
            project.scenes.isEmpty() ||
            sceneIndex >= project.scenes.size()) {
            return "";
        }
        return project.scenes.get(sceneIndex).id;
    }

    private ProjectStore.Project resolveProject(String id) {
        if (id == null || id.isEmpty()) return project;

        for (ProjectStore.Project candidate : store.all()) {
            if (id.equals(candidate.id)) return candidate;
        }

        return null;
    }

    private ProjectStore.Scene findScene(
        ProjectStore.Project target,
        String id
    ) {
        if (target == null || id == null) return null;

        for (ProjectStore.Scene scene : target.scenes) {
            if (id.equals(scene.id)) return scene;
        }

        return null;
    }

    private void setSpinner(
        Spinner spinner,
        String value,
        String[] options
    ) {
        for (int i = 0; i < options.length; i++) {
            if (options[i].equals(value)) {
                spinner.setSelection(i);
                return;
            }
        }
        spinner.setSelection(0);
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
