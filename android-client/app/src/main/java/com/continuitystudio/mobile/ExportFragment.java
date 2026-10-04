package com.continuitystudio.mobile;

import android.net.Uri;
import android.os.Bundle;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.ArrayAdapter;
import android.widget.MediaController;
import android.widget.ProgressBar;
import android.widget.Spinner;
import android.widget.TextView;
import android.widget.Toast;
import android.widget.VideoView;

import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.fragment.app.Fragment;

import com.google.android.material.button.MaterialButton;
import com.google.android.material.materialswitch.MaterialSwitch;

import java.io.File;
import java.util.Locale;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class ExportFragment extends Fragment {
    private final ExecutorService executor =
        Executors.newSingleThreadExecutor();

    private ProjectStore store;
    private ProjectStore.Project project;

    private TextView summary;
    private TextView voiceoverName;
    private TextView status;
    private VideoView video;
    private MaterialSwitch subtitles;
    private Spinner quality;
    private ProgressBar progress;

    private ActivityResultLauncher<String[]> voiceoverPicker;

    @Override
    public void onCreate(@Nullable Bundle state) {
        super.onCreate(state);

        voiceoverPicker =
            registerForActivityResult(
                new ActivityResultContracts.OpenDocument(),
                uri -> {
                    if (uri != null) importVoiceover(uri);
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
            R.layout.fragment_export,
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

        summary = view.findViewById(R.id.export_summary);
        voiceoverName = view.findViewById(R.id.voiceover_name);
        status = view.findViewById(R.id.export_status);
        video = view.findViewById(R.id.export_video);
        subtitles = view.findViewById(R.id.switch_subtitles);
        quality = view.findViewById(R.id.export_quality);
        progress = view.findViewById(R.id.export_progress);

        quality.setAdapter(
            new ArrayAdapter<>(
                requireContext(),
                android.R.layout.simple_spinner_dropdown_item,
                new String[] { "1080p", "720p" }
            )
        );

        MaterialButton chooseVoiceover =
            view.findViewById(R.id.btn_voiceover);
        MaterialButton saveSrt =
            view.findViewById(R.id.btn_save_srt);
        MaterialButton export =
            view.findViewById(R.id.btn_export_mp4);

        chooseVoiceover.setOnClickListener(v ->
            voiceoverPicker.launch(new String[] { "audio/*" })
        );

        saveSrt.setOnClickListener(v -> saveSrt());
        export.setOnClickListener(v -> render());

        subtitles.setOnCheckedChangeListener(
            (button, checked) -> {
                if (project == null) return;
                project.subtitlesEnabled = checked;
                store.save(project);
            }
        );

        refresh();
    }

    @Override
    public void onResume() {
        super.onResume();
        if (store != null) refresh();
    }

    private void refresh() {
        project = store.current(MainActivity.DEFAULT_MASTER);

        summary.setText(
            project.title +
            "\n" +
            project.scenes.size() +
            " scenes · " +
            project.renderedSceneCount() +
            " rendered · " +
            duration(project.totalDurationMs()) +
            " · " +
            project.aspectRatio
        );

        if (project.voiceoverPath == null ||
            project.voiceoverPath.isEmpty()) {
            voiceoverName.setText("No voiceover selected");
        } else {
            voiceoverName.setText(
                new File(project.voiceoverPath).getName()
            );
        }

        subtitles.setChecked(project.subtitlesEnabled);

        if (project.lastExportPath != null &&
            !project.lastExportPath.isEmpty()) {
            File file = new File(project.lastExportPath);

            if (file.exists()) {
                video.setVisibility(View.VISIBLE);
                video.setVideoPath(file.getAbsolutePath());

                MediaController controller =
                    new MediaController(requireContext());
                controller.setAnchorView(video);
                video.setMediaController(controller);
            } else {
                video.setVisibility(View.GONE);
            }
        } else {
            video.setVisibility(View.GONE);
        }

        ((StudioActivity) requireActivity()).refreshHeader();
    }

    private void importVoiceover(Uri uri) {
        status.setText("Importing voiceover…");

        executor.execute(() -> {
            try {
                String path =
                    MediaFiles.copyUriToProject(
                        requireContext(),
                        uri,
                        project.id,
                        "voiceover"
                    );

                project.voiceoverPath = path;
                store.save(project);

                requireActivity().runOnUiThread(() -> {
                    status.setText(
                        "Voiceover saved inside this project."
                    );
                    refresh();
                });
            } catch (Exception error) {
                requireActivity().runOnUiThread(() -> {
                    status.setText("Voiceover import failed.");
                    toast("Could not import voiceover.");
                });
            }
        });
    }

    private void saveSrt() {
        try {
            String location =
                MediaFiles.publishText(
                    requireContext(),
                    VideoRenderer.buildSrt(project),
                    "application/x-subrip",
                    "Continuity Studio/Exports",
                    safeName(project.title) + ".srt"
                );

            status.setText("SRT saved · " + location);
            toast("Subtitles saved to Downloads.");
        } catch (Exception error) {
            status.setText("Could not save SRT.");
            toast(
                error.getMessage() == null
                    ? "SRT export failed."
                    : error.getMessage()
            );
        }
    }

    private void render() {
        if (project.renderedSceneCount() == 0) {
            toast("Generate at least one storyboard image first.");
            return;
        }

        progress.setVisibility(View.VISIBLE);
        status.setText("Rendering locally on your phone…");

        String selectedQuality =
            String.valueOf(quality.getSelectedItem());

        VideoRenderer.render(
            requireContext(),
            project,
            selectedQuality,
            new VideoRenderer.Callback() {
                @Override
                public void onSuccess(
                    String publicLocation,
                    String internalPath
                ) {
                    requireActivity().runOnUiThread(() -> {
                        project.lastExportPath = internalPath;
                        store.save(project);

                        progress.setVisibility(View.GONE);
                        status.setText(
                            "Ready · " + publicLocation
                        );

                        refresh();
                        toast("Video exported to Downloads.");
                    });
                }

                @Override
                public void onError(String message) {
                    requireActivity().runOnUiThread(() -> {
                        progress.setVisibility(View.GONE);
                        status.setText(
                            "Export failed · " + message
                        );
                    });
                }
            }
        );
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

    private String safeName(String value) {
        String title =
            value == null || value.trim().isEmpty()
                ? "Continuity-Subtitles"
                : value.trim();

        return title
            .replaceAll("[\\\\/:*?\"<>|]", "_")
            .replaceAll("\\s+", "-");
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
