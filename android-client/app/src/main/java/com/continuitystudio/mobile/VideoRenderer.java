package com.continuitystudio.mobile;

import android.content.Context;

import com.arthenica.ffmpegkit.FFmpegKit;
import com.arthenica.ffmpegkit.ReturnCode;

import java.io.File;
import java.io.FileOutputStream;
import java.nio.charset.StandardCharsets;
import java.util.Locale;

public final class VideoRenderer {
    public interface Callback {
        void onSuccess(String publicLocation, String internalPath);
        void onError(String message);
    }

    private VideoRenderer() {}

    public static void render(
        Context context,
        ProjectStore.Project project,
        String quality,
        Callback callback
    ) {
        try {
            File renderDir = new File(
                context.getCacheDir(),
                "renders/" + project.id
            );
            if (!renderDir.exists() && !renderDir.mkdirs()) {
                callback.onError("Could not create render workspace.");
                return;
            }

            int rendered = project.renderedSceneCount();
            if (rendered == 0) {
                callback.onError("Generate at least one storyboard image first.");
                return;
            }

            File concat = new File(renderDir, "timeline.txt");
            StringBuilder list = new StringBuilder();
            ProjectStore.Scene last = null;

            for (ProjectStore.Scene scene : project.scenes) {
                if (scene.imagePath == null || scene.imagePath.isEmpty()) continue;
                File image = new File(scene.imagePath);
                if (!image.exists()) continue;

                list.append("file ")
                    .append(shellQuote(image.getAbsolutePath()))
                    .append("\n");
                list.append("duration ")
                    .append(String.format(
                        Locale.US,
                        "%.3f",
                        Math.max(500, scene.durationMs) / 1000d
                    ))
                    .append("\n");
                last = scene;
            }

            if (last != null) {
                list.append("file ")
                    .append(shellQuote(last.imagePath))
                    .append("\n");
            }

            try (FileOutputStream output = new FileOutputStream(concat)) {
                output.write(
                    list.toString().getBytes(StandardCharsets.UTF_8)
                );
            }

            File subtitles = new File(renderDir, "captions.srt");
            if (project.subtitlesEnabled) {
                writeSrt(project, subtitles);
            }

            int width = "720p".equals(quality) ? 1280 : 1920;
            int height = "720p".equals(quality) ? 720 : 1080;

            if ("9:16".equals(project.aspectRatio)) {
                width = "720p".equals(quality) ? 720 : 1080;
                height = "720p".equals(quality) ? 1280 : 1920;
            } else if ("1:1".equals(project.aspectRatio)) {
                width = "720p".equals(quality) ? 720 : 1080;
                height = width;
            } else if ("4:3".equals(project.aspectRatio)) {
                width = "720p".equals(quality) ? 960 : 1440;
                height = "720p".equals(quality) ? 720 : 1080;
            } else if ("3:4".equals(project.aspectRatio)) {
                width = "720p".equals(quality) ? 720 : 1080;
                height = "720p".equals(quality) ? 960 : 1440;
            }

            File output = new File(
                renderDir,
                "Continuity-" + System.currentTimeMillis() + ".mp4"
            );

            String vf =
                "scale=" + width + ":" + height +
                ":force_original_aspect_ratio=decrease," +
                "pad=" + width + ":" + height +
                ":(ow-iw)/2:(oh-ih)/2:black,setsar=1";

            if (project.subtitlesEnabled && subtitles.exists()) {
                vf +=
                    ",subtitles=" +
                    filterPath(subtitles.getAbsolutePath()) +
                    ":force_style='FontName=Sans,FontSize=28," +
                    "PrimaryColour=&H00FFFFFF,BackColour=&H80000000," +
                    "BorderStyle=3,Outline=1,Alignment=2,MarginV=44'";
            }

            String common =
                "-y -f concat -safe 0 -i " +
                shellQuote(concat.getAbsolutePath()) + " ";

            boolean hasVoiceover =
                project.voiceoverPath != null &&
                !project.voiceoverPath.isEmpty() &&
                new File(project.voiceoverPath).exists();

            if (hasVoiceover) {
                common +=
                    "-i " +
                    shellQuote(project.voiceoverPath) +
                    " ";
            }

            String mappings =
                "-map 0:v:0 " +
                (hasVoiceover ? "-map 1:a:0 -c:a aac -b:a 160k -shortest " : "-an ");

            final String finalCommon = common;
            final String finalTail =
                "-vf " + shellQuote(vf) +
                " -r 30 -pix_fmt yuv420p " +
                mappings +
                "-movflags +faststart " +
                shellQuote(output.getAbsolutePath());

            String hardware =
                finalCommon +
                "-c:v h264_mediacodec -b:v " +
                ("720p".equals(quality) ? "5M " : "10M ") +
                finalTail;

            FFmpegKit.executeAsync(hardware, session -> {
                if (ReturnCode.isSuccess(session.getReturnCode())) {
                    publish(context, project, output, callback);
                    return;
                }

                String fallback =
                    finalCommon +
                    "-c:v mpeg4 -q:v 3 " +
                    finalTail;

                FFmpegKit.executeAsync(fallback, fallbackSession -> {
                    if (ReturnCode.isSuccess(fallbackSession.getReturnCode())) {
                        publish(context, project, output, callback);
                    } else {
                        String logs =
                            fallbackSession.getAllLogsAsString();
                        callback.onError(
                            logs == null || logs.trim().isEmpty()
                                ? "FFmpeg could not render the video."
                                : shortError(logs)
                        );
                    }
                });
            });
        } catch (Exception error) {
            callback.onError(
                error.getMessage() == null
                    ? "Video export failed."
                    : error.getMessage()
            );
        }
    }

    private static void publish(
        Context context,
        ProjectStore.Project project,
        File output,
        Callback callback
    ) {
        try {
            String title = sanitize(project.title);
            String publicLocation = MediaFiles.publishFile(
                context,
                output,
                "video/mp4",
                "Continuity Studio/Exports",
                title + "-" + System.currentTimeMillis() + ".mp4"
            );
            callback.onSuccess(publicLocation, output.getAbsolutePath());
        } catch (Exception error) {
            callback.onError(
                "Video rendered, but Android could not copy it to Downloads: " +
                error.getMessage()
            );
        }
    }

    public static String buildSrt(ProjectStore.Project project) {
        StringBuilder output = new StringBuilder();
        long cursor = 0;
        int index = 1;

        for (ProjectStore.Scene scene : project.scenes) {
            long duration = Math.max(500, scene.durationMs);
            String text =
                scene.subtitle == null || scene.subtitle.trim().isEmpty()
                    ? scene.narration
                    : scene.subtitle;

            if (text != null && !text.trim().isEmpty()) {
                output.append(index++).append("\n");
                output.append(time(cursor))
                    .append(" --> ")
                    .append(time(cursor + duration))
                    .append("\n");
                output.append(text.trim()).append("\n\n");
            }
            cursor += duration;
        }

        return output.toString();
    }

    private static void writeSrt(
        ProjectStore.Project project,
        File output
    ) throws Exception {
        try (FileOutputStream stream = new FileOutputStream(output)) {
            stream.write(
                buildSrt(project).getBytes(StandardCharsets.UTF_8)
            );
        }
    }

    private static String time(long ms) {
        long hours = ms / 3_600_000;
        ms %= 3_600_000;
        long minutes = ms / 60_000;
        ms %= 60_000;
        long seconds = ms / 1000;
        long millis = ms % 1000;
        return String.format(
            Locale.US,
            "%02d:%02d:%02d,%03d",
            hours,
            minutes,
            seconds,
            millis
        );
    }

    private static String shellQuote(String value) {
        return "'" + value.replace("'", "'\\''") + "'";
    }

    private static String filterPath(String value) {
        return value
            .replace("\\", "/")
            .replace(":", "\\:")
            .replace("'", "\\'");
    }

    private static String sanitize(String value) {
        String result =
            value == null || value.trim().isEmpty()
                ? "Continuity-Video"
                : value.trim();
        result = result.replaceAll("[\\\\/:*?\"<>|]", "_");
        return result.length() > 70 ? result.substring(0, 70) : result;
    }

    private static String shortError(String logs) {
        String clean = logs.replaceAll("\\s+", " ").trim();
        if (clean.length() <= 450) return clean;
        return clean.substring(clean.length() - 450);
    }
}
