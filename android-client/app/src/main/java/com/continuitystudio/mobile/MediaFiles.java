package com.continuitystudio.mobile;

import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Context;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.util.Locale;
import java.util.UUID;

public final class MediaFiles {
    private MediaFiles() {}

    public static final class SavedMedia {
        public final String internalPath;
        public final String publicLocation;

        public SavedMedia(String internalPath, String publicLocation) {
            this.internalPath = internalPath;
            this.publicLocation = publicLocation;
        }
    }

    public static String copyUriToProject(
        Context context,
        Uri uri,
        String projectId,
        String prefix
    ) throws Exception {
        ContentResolver resolver = context.getContentResolver();
        String mime = resolver.getType(uri);
        String extension = extensionFor(mime, uri.toString());

        File directory = new File(
            context.getFilesDir(),
            "projects/" + projectId + "/imports"
        );
        if (!directory.exists() && !directory.mkdirs()) {
            throw new Exception("Could not create project media folder.");
        }

        File target = new File(
            directory,
            prefix + "-" + UUID.randomUUID() + extension
        );

        try (
            InputStream input = resolver.openInputStream(uri);
            FileOutputStream output = new FileOutputStream(target)
        ) {
            if (input == null) {
                throw new Exception("Could not open selected file.");
            }

            byte[] buffer = new byte[32 * 1024];
            int read;
            while ((read = input.read(buffer)) >= 0) {
                output.write(buffer, 0, read);
            }
        }

        return target.getAbsolutePath();
    }

    public static SavedMedia saveGeneratedImage(
        Context context,
        String projectId,
        byte[] bytes,
        String mimeType
    ) throws Exception {
        String extension =
            mimeType != null && mimeType.toLowerCase(Locale.US).contains("png")
                ? ".png"
                : ".jpg";

        File directory = new File(
            context.getFilesDir(),
            "projects/" + projectId + "/images"
        );
        if (!directory.exists() && !directory.mkdirs()) {
            throw new Exception("Could not create generated image folder.");
        }

        String base = "scene-" + System.currentTimeMillis() + extension;
        File internal = new File(directory, base);

        try (FileOutputStream output = new FileOutputStream(internal)) {
            output.write(bytes);
        }

        String publicPath = publishBytes(
            context,
            bytes,
            mimeType == null ? "image/jpeg" : mimeType,
            "Continuity Studio/Generated",
            base
        );

        return new SavedMedia(internal.getAbsolutePath(), publicPath);
    }

    public static String publishFile(
        Context context,
        File source,
        String mimeType,
        String folder,
        String displayName
    ) throws Exception {
        try (FileInputStream input = new FileInputStream(source)) {
            return publishStream(
                context,
                input,
                mimeType,
                folder,
                displayName
            );
        }
    }

    public static String publishText(
        Context context,
        String content,
        String mimeType,
        String folder,
        String displayName
    ) throws Exception {
        byte[] bytes = content.getBytes(java.nio.charset.StandardCharsets.UTF_8);
        return publishBytes(context, bytes, mimeType, folder, displayName);
    }

    private static String publishBytes(
        Context context,
        byte[] bytes,
        String mimeType,
        String folder,
        String displayName
    ) throws Exception {
        return publishStream(
            context,
            new java.io.ByteArrayInputStream(bytes),
            mimeType,
            folder,
            displayName
        );
    }

    private static String publishStream(
        Context context,
        InputStream input,
        String mimeType,
        String folder,
        String displayName
    ) throws Exception {
        String safeName = sanitize(displayName);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            ContentValues values = new ContentValues();
            values.put(MediaStore.Downloads.DISPLAY_NAME, safeName);
            values.put(MediaStore.Downloads.MIME_TYPE, mimeType);
            values.put(
                MediaStore.Downloads.RELATIVE_PATH,
                Environment.DIRECTORY_DOWNLOADS + "/" + folder
            );
            values.put(MediaStore.Downloads.IS_PENDING, 1);

            Uri destination = context.getContentResolver().insert(
                MediaStore.Downloads.EXTERNAL_CONTENT_URI,
                values
            );

            if (destination == null) {
                throw new Exception("Could not create Downloads file.");
            }

            try (OutputStream output =
                     context.getContentResolver().openOutputStream(destination)) {
                if (output == null) {
                    throw new Exception("Could not write Downloads file.");
                }
                copy(input, output);
            }

            values.clear();
            values.put(MediaStore.Downloads.IS_PENDING, 0);
            context.getContentResolver().update(
                destination,
                values,
                null,
                null
            );

            return "Downloads/" + folder + "/" + safeName;
        }

        File directory = new File(
            Environment.getExternalStoragePublicDirectory(
                Environment.DIRECTORY_DOWNLOADS
            ),
            folder
        );

        if (!directory.exists() && !directory.mkdirs()) {
            throw new Exception("Could not create Downloads folder.");
        }

        File target = new File(directory, safeName);
        try (FileOutputStream output = new FileOutputStream(target)) {
            copy(input, output);
        }

        return target.getAbsolutePath();
    }

    private static void copy(InputStream input, OutputStream output)
        throws Exception {
        byte[] buffer = new byte[32 * 1024];
        int read;
        while ((read = input.read(buffer)) >= 0) {
            output.write(buffer, 0, read);
        }
    }

    private static String sanitize(String name) {
        String clean =
            name == null || name.trim().isEmpty()
                ? "continuity-export"
                : name.trim();

        clean = clean.replaceAll("[\\\\/:*?\"<>|]", "_");
        if (clean.length() > 120) {
            int dot = clean.lastIndexOf('.');
            String extension =
                dot > 0 && clean.length() - dot <= 12
                    ? clean.substring(dot)
                    : "";
            String base =
                extension.isEmpty()
                    ? clean
                    : clean.substring(0, dot);
            clean =
                base.substring(
                    0,
                    Math.min(base.length(), 120 - extension.length())
                ) + extension;
        }
        return clean;
    }

    private static String extensionFor(String mimeType, String fallback) {
        String lower =
            mimeType == null ? "" : mimeType.toLowerCase(Locale.US);

        if (lower.contains("png")) return ".png";
        if (lower.contains("webp")) return ".webp";
        if (lower.contains("jpeg") || lower.contains("jpg")) return ".jpg";
        if (lower.contains("mpeg")) return ".mp3";
        if (lower.contains("wav")) return ".wav";
        if (lower.contains("mp4")) return ".m4a";

        String source = fallback == null ? "" : fallback.toLowerCase(Locale.US);
        for (String ext :
            new String[] { ".png", ".webp", ".jpg", ".jpeg", ".mp3", ".wav", ".m4a", ".mp4" }) {
            if (source.endsWith(ext)) return ext;
        }

        return ".bin";
    }
}
