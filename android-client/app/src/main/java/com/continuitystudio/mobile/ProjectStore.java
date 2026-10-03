package com.continuitystudio.mobile;

import android.content.Context;
import android.content.SharedPreferences;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;

public final class ProjectStore {
    private static final String PREFS = "continuity_projects_v3";
    private static final String KEY_PROJECTS = "projects";
    private static final String KEY_CURRENT = "current_project";

    private final SharedPreferences preferences;

    public ProjectStore(Context context) {
        preferences = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    public static final class Scene {
        public String id = UUID.randomUUID().toString();
        public String narration = "";
        public String subtitle = "";
        public String imagePath = "";
        public long durationMs = 4500;
        public long createdAt = System.currentTimeMillis();
        public boolean locked = false;

        JSONObject toJson() throws Exception {
            return new JSONObject()
                .put("id", id)
                .put("narration", narration)
                .put("subtitle", subtitle)
                .put("imagePath", imagePath)
                .put("durationMs", durationMs)
                .put("createdAt", createdAt)
                .put("locked", locked);
        }

        static Scene fromJson(JSONObject value) {
            Scene scene = new Scene();
            scene.id = value.optString("id", scene.id);
            scene.narration = value.optString("narration", "");
            scene.subtitle = value.optString("subtitle", "");
            scene.imagePath = value.optString("imagePath", "");
            scene.durationMs = Math.max(500, value.optLong("durationMs", 4500));
            scene.createdAt = value.optLong("createdAt", System.currentTimeMillis());
            scene.locked = value.optBoolean("locked", false);
            return scene;
        }
    }

    public static final class Project {
        public String id = UUID.randomUUID().toString();
        public String title = "Untitled Project";
        public String masterPrompt = "";
        public String model = "Nano Banana 2";
        public String aspectRatio = "16:9";
        public String voiceoverPath = "";
        public String lastExportPath = "";
        public boolean subtitlesEnabled = true;
        public long createdAt = System.currentTimeMillis();
        public long updatedAt = System.currentTimeMillis();
        public final ArrayList<String> references = new ArrayList<>();
        public final ArrayList<Scene> scenes = new ArrayList<>();

        JSONObject toJson() throws Exception {
            JSONArray refArray = new JSONArray();
            for (String path : references) refArray.put(path);

            JSONArray sceneArray = new JSONArray();
            for (Scene scene : scenes) sceneArray.put(scene.toJson());

            return new JSONObject()
                .put("id", id)
                .put("title", title)
                .put("masterPrompt", masterPrompt)
                .put("model", model)
                .put("aspectRatio", aspectRatio)
                .put("voiceoverPath", voiceoverPath)
                .put("lastExportPath", lastExportPath)
                .put("subtitlesEnabled", subtitlesEnabled)
                .put("createdAt", createdAt)
                .put("updatedAt", updatedAt)
                .put("references", refArray)
                .put("scenes", sceneArray);
        }

        static Project fromJson(JSONObject value) {
            Project project = new Project();
            project.id = value.optString("id", project.id);
            project.title = value.optString("title", "Untitled Project");
            project.masterPrompt = value.optString("masterPrompt", "");
            project.model = value.optString("model", "Nano Banana 2");
            project.aspectRatio = value.optString("aspectRatio", "16:9");
            project.voiceoverPath = value.optString("voiceoverPath", "");
            project.lastExportPath = value.optString("lastExportPath", "");
            project.subtitlesEnabled = value.optBoolean("subtitlesEnabled", true);
            project.createdAt = value.optLong("createdAt", System.currentTimeMillis());
            project.updatedAt = value.optLong("updatedAt", project.createdAt);

            JSONArray refs = value.optJSONArray("references");
            if (refs != null) {
                for (int i = 0; i < refs.length(); i++) {
                    String path = refs.optString(i, "");
                    if (!path.isEmpty()) project.references.add(path);
                }
            }

            JSONArray scenes = value.optJSONArray("scenes");
            if (scenes != null) {
                for (int i = 0; i < scenes.length(); i++) {
                    JSONObject scene = scenes.optJSONObject(i);
                    if (scene != null) project.scenes.add(Scene.fromJson(scene));
                }
            }

            return project;
        }

        public long totalDurationMs() {
            long total = 0;
            for (Scene scene : scenes) total += Math.max(500, scene.durationMs);
            return total;
        }

        public int renderedSceneCount() {
            int count = 0;
            for (Scene scene : scenes) {
                if (scene.imagePath != null && !scene.imagePath.isEmpty()) count++;
            }
            return count;
        }
    }

    public synchronized List<Project> all() {
        ArrayList<Project> result = new ArrayList<>();
        String raw = preferences.getString(KEY_PROJECTS, "[]");

        try {
            JSONArray array = new JSONArray(raw == null ? "[]" : raw);
            for (int i = 0; i < array.length(); i++) {
                JSONObject item = array.optJSONObject(i);
                if (item != null) result.add(Project.fromJson(item));
            }
        } catch (Exception ignored) {
        }

        Collections.sort(
            result,
            (a, b) -> Long.compare(b.updatedAt, a.updatedAt)
        );
        return result;
    }

    public synchronized Project current(String defaultMasterPrompt) {
        List<Project> projects = all();
        String currentId = preferences.getString(KEY_CURRENT, "");

        if (currentId != null && !currentId.isEmpty()) {
            for (Project project : projects) {
                if (currentId.equals(project.id)) return project;
            }
        }

        if (!projects.isEmpty()) {
            Project project = projects.get(0);
            setCurrent(project.id);
            return project;
        }

        Project project = new Project();
        project.title = "The Rise of NVIDIA's NV1";
        project.masterPrompt = defaultMasterPrompt;
        save(project);
        setCurrent(project.id);
        return project;
    }

    public synchronized void setCurrent(String projectId) {
        preferences.edit().putString(KEY_CURRENT, projectId).apply();
    }

    public synchronized void save(Project project) {
        project.updatedAt = System.currentTimeMillis();
        List<Project> projects = all();

        boolean found = false;
        for (int i = 0; i < projects.size(); i++) {
            if (projects.get(i).id.equals(project.id)) {
                projects.set(i, project);
                found = true;
                break;
            }
        }
        if (!found) projects.add(project);

        JSONArray array = new JSONArray();
        try {
            for (Project item : projects) array.put(item.toJson());
            preferences.edit().putString(KEY_PROJECTS, array.toString()).apply();
        } catch (Exception ignored) {
        }
    }

    public synchronized Project create(String title, String defaultMasterPrompt) {
        Project project = new Project();
        project.title =
            title == null || title.trim().isEmpty()
                ? "Untitled Project"
                : title.trim();
        project.masterPrompt = defaultMasterPrompt;
        save(project);
        setCurrent(project.id);
        return project;
    }

    public synchronized void delete(String projectId) {
        List<Project> projects = all();
        JSONArray array = new JSONArray();

        try {
            for (Project project : projects) {
                if (!project.id.equals(projectId)) array.put(project.toJson());
            }
            preferences.edit().putString(KEY_PROJECTS, array.toString()).apply();
        } catch (Exception ignored) {
        }

        String currentId = preferences.getString(KEY_CURRENT, "");
        if (projectId.equals(currentId)) {
            preferences.edit().remove(KEY_CURRENT).apply();
        }
    }

    public static ArrayList<Scene> splitScript(String script) {
        ArrayList<Scene> scenes = new ArrayList<>();
        if (script == null) return scenes;

        String normalized = script.replace("\r", "").trim();
        if (normalized.isEmpty()) return scenes;

        String[] paragraphs = normalized.split("\n\s*\n");
        for (String paragraph : paragraphs) {
            String clean = paragraph.replaceAll("\\s+", " ").trim();
            if (clean.isEmpty()) continue;

            String[] sentences = clean.split("(?<=[.!?])\\s+");
            StringBuilder current = new StringBuilder();
            int words = 0;

            for (String sentence : sentences) {
                int sentenceWords =
                    sentence.trim().isEmpty()
                        ? 0
                        : sentence.trim().split("\\s+").length;

                if (current.length() > 0 && words + sentenceWords > 38) {
                    Scene scene = new Scene();
                    scene.narration = current.toString().trim();
                    scene.subtitle = scene.narration;
                    scene.durationMs = estimateDuration(scene.narration);
                    scenes.add(scene);
                    current.setLength(0);
                    words = 0;
                }

                if (current.length() > 0) current.append(' ');
                current.append(sentence.trim());
                words += sentenceWords;
            }

            if (current.length() > 0) {
                Scene scene = new Scene();
                scene.narration = current.toString().trim();
                scene.subtitle = scene.narration;
                scene.durationMs = estimateDuration(scene.narration);
                scenes.add(scene);
            }
        }

        return scenes;
    }

    private static long estimateDuration(String text) {
        if (text == null || text.trim().isEmpty()) return 4500;
        int words = text.trim().split("\\s+").length;
        return Math.max(2500, Math.min(16000, Math.round(words / 2.5f * 1000f)));
    }
}
