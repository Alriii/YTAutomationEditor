package com.continuitystudio.mobile;

import android.app.AlertDialog;
import android.os.Bundle;
import android.text.InputType;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.EditText;
import android.widget.TextView;
import android.widget.Toast;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.fragment.app.Fragment;
import androidx.recyclerview.widget.LinearLayoutManager;
import androidx.recyclerview.widget.RecyclerView;

import com.google.android.material.button.MaterialButton;
import com.google.android.material.card.MaterialCardView;

import java.util.List;
import java.util.Locale;

public class HomeFragment extends Fragment {
    private ProjectStore store;
    private TextView currentTitle;
    private TextView currentMeta;
    private RecyclerView projectList;
    private ProjectAdapter adapter;

    @Nullable
    @Override
    public View onCreateView(
        @NonNull LayoutInflater inflater,
        @Nullable ViewGroup container,
        @Nullable Bundle savedInstanceState
    ) {
        return inflater.inflate(
            R.layout.fragment_home,
            container,
            false
        );
    }

    @Override
    public void onViewCreated(
        @NonNull View view,
        @Nullable Bundle savedInstanceState
    ) {
        super.onViewCreated(view, savedInstanceState);

        store = new ProjectStore(requireContext());
        currentTitle = view.findViewById(R.id.current_project_title);
        currentMeta = view.findViewById(R.id.current_project_meta);
        projectList = view.findViewById(R.id.recent_projects_list);

        MaterialButton newProject =
            view.findViewById(R.id.btn_new_project);
        MaterialButton generate =
            view.findViewById(R.id.btn_quick_generate);
        MaterialButton storyboard =
            view.findViewById(R.id.btn_quick_storyboard);
        MaterialButton export =
            view.findViewById(R.id.btn_quick_export);

        newProject.setOnClickListener(v -> showNewProjectDialog());

        generate.setOnClickListener(v ->
            activity().navigateToGenerate()
        );

        storyboard.setOnClickListener(v ->
            activity().navigateToStoryboard()
        );

        export.setOnClickListener(v ->
            activity().navigateToExport()
        );

        projectList.setLayoutManager(
            new LinearLayoutManager(requireContext())
        );

        adapter = new ProjectAdapter(project -> {
            store.setCurrent(project.id);
            activity().refreshHeader();
            refreshProjects();
            Toast.makeText(
                requireContext(),
                "Opened: " + project.title,
                Toast.LENGTH_SHORT
            ).show();
        });

        projectList.setAdapter(adapter);
        refreshProjects();
    }

    @Override
    public void onResume() {
        super.onResume();
        if (store != null) refreshProjects();
    }

    StudioActivity activity() {
        return (StudioActivity) requireActivity();
    }

    public void refreshProjects() {
        ProjectStore.Project project =
            store.current(MainActivity.DEFAULT_MASTER);

        currentTitle.setText(project.title);
        currentMeta.setText(
            String.format(
                Locale.US,
                "%d scenes · %d rendered · %s · %s",
                project.scenes.size(),
                project.renderedSceneCount(),
                duration(project.totalDurationMs()),
                project.aspectRatio
            )
        );

        adapter.submit(store.all());
    }

    private String duration(long ms) {
        long seconds = Math.max(0, Math.round(ms / 1000d));
        long minutes = seconds / 60;
        seconds %= 60;

        if (minutes > 0) {
            return String.format(
                Locale.US,
                "%dm %02ds",
                minutes,
                seconds
            );
        }

        return String.format(Locale.US, "%ds", seconds);
    }

    private void showNewProjectDialog() {
        EditText input = new EditText(requireContext());
        input.setInputType(
            InputType.TYPE_CLASS_TEXT |
            InputType.TYPE_TEXT_FLAG_CAP_WORDS
        );
        input.setHint("Project title");

        new AlertDialog.Builder(requireContext())
            .setTitle("New Project")
            .setMessage(
                "Starts with cinematic tech-history defaults, 16:9 and Nano Banana 2."
            )
            .setView(input)
            .setPositiveButton("Create", (dialog, which) -> {
                String title =
                    input.getText().toString().trim();

                ProjectStore.Project project =
                    store.create(
                        title.isEmpty()
                            ? "Untitled Project"
                            : title,
                        MainActivity.DEFAULT_MASTER
                    );

                activity().refreshHeader();
                refreshProjects();

                Toast.makeText(
                    requireContext(),
                    "Created: " + project.title,
                    Toast.LENGTH_SHORT
                ).show();
            })
            .setNegativeButton("Cancel", null)
            .show();
    }

    private static final class ProjectAdapter
        extends RecyclerView.Adapter<ProjectAdapter.Holder> {

        interface Listener {
            void onClick(ProjectStore.Project project);
        }

        private final Listener listener;
        private List<ProjectStore.Project> items =
            java.util.Collections.emptyList();

        ProjectAdapter(Listener listener) {
            this.listener = listener;
        }

        void submit(List<ProjectStore.Project> projects) {
            items =
                projects == null
                    ? java.util.Collections.emptyList()
                    : projects;
            notifyDataSetChanged();
        }

        @NonNull
        @Override
        public Holder onCreateViewHolder(
            @NonNull ViewGroup parent,
            int viewType
        ) {
            View view =
                LayoutInflater.from(parent.getContext())
                    .inflate(
                        R.layout.item_project_card,
                        parent,
                        false
                    );
            return new Holder(view);
        }

        @Override
        public void onBindViewHolder(
            @NonNull Holder holder,
            int position
        ) {
            ProjectStore.Project project = items.get(position);

            holder.title.setText(project.title);
            holder.meta.setText(
                project.scenes.size() +
                " scenes · " +
                project.renderedSceneCount() +
                " rendered · " +
                project.aspectRatio
            );

            holder.card.setOnClickListener(
                v -> listener.onClick(project)
            );
        }

        @Override
        public int getItemCount() {
            return items.size();
        }

        static final class Holder
            extends RecyclerView.ViewHolder {

            final MaterialCardView card;
            final TextView title;
            final TextView meta;

            Holder(View view) {
                super(view);
                card = (MaterialCardView) view;
                title = view.findViewById(R.id.project_title);
                meta = view.findViewById(R.id.project_meta);
            }
        }
    }
}
