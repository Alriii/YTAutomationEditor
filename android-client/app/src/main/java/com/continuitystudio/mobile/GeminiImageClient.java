package com.continuitystudio.mobile;

import android.util.Base64;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.List;

public final class GeminiImageClient {
    private static final String ENDPOINT =
        "https://generativelanguage.googleapis.com/v1beta/interactions";

    public static final class ReferenceImage {
        public final byte[] bytes;
        public final String mimeType;

        public ReferenceImage(byte[] bytes, String mimeType) {
            this.bytes = bytes;
            this.mimeType = mimeType;
        }
    }

    public static final class Result {
        public final byte[] bytes;
        public final String mimeType;

        public Result(byte[] bytes, String mimeType) {
            this.bytes = bytes;
            this.mimeType = mimeType;
        }
    }

    private static String modelId(String label) {
        if ("Nano Banana 2 Lite".equals(label)) {
            return "gemini-3.1-flash-lite-image";
        }
        if ("Nano Banana Pro".equals(label)) {
            return "gemini-3-pro-image";
        }
        return "gemini-3.1-flash-image";
    }

    public Result generate(
        String apiKey,
        String modelLabel,
        String prompt,
        String aspectRatio,
        List<ReferenceImage> references
    ) throws Exception {
        JSONObject payload = new JSONObject();
        payload.put("model", modelId(modelLabel));

        if (references.isEmpty()) {
            payload.put("input", prompt);
        } else {
            JSONArray input = new JSONArray();
            input.put(
                new JSONObject()
                    .put("type", "text")
                    .put("text", prompt)
            );

            int limit = Math.min(8, references.size());
            for (int i = 0; i < limit; i++) {
                ReferenceImage reference = references.get(i);
                input.put(
                    new JSONObject()
                        .put("type", "image")
                        .put("mime_type", reference.mimeType)
                        .put(
                            "data",
                            Base64.encodeToString(
                                reference.bytes,
                                Base64.NO_WRAP
                            )
                        )
                );
            }
            payload.put("input", input);
        }

        payload.put(
            "response_format",
            new JSONObject()
                .put("type", "image")
                .put("mime_type", "image/jpeg")
                .put("aspect_ratio", aspectRatio)
                .put("image_size", "1K")
        );

        HttpURLConnection connection =
            (HttpURLConnection) new URL(ENDPOINT).openConnection();
        connection.setRequestMethod("POST");
        connection.setConnectTimeout(30_000);
        connection.setReadTimeout(240_000);
        connection.setDoOutput(true);
        connection.setRequestProperty(
            "Content-Type",
            "application/json"
        );
        connection.setRequestProperty("x-goog-api-key", apiKey);

        try (OutputStream output = connection.getOutputStream()) {
            output.write(
                payload.toString().getBytes(StandardCharsets.UTF_8)
            );
        }

        int status = connection.getResponseCode();
        InputStream stream =
            status >= 200 && status < 300
                ? connection.getInputStream()
                : connection.getErrorStream();

        String response = new String(
            readAll(stream),
            StandardCharsets.UTF_8
        );

        if (status < 200 || status >= 300) {
            throw new Exception(errorMessage(status, response));
        }

        JSONObject body = new JSONObject(response);
        JSONArray steps = body.optJSONArray("steps");

        if (steps != null) {
            for (int i = 0; i < steps.length(); i++) {
                JSONObject step = steps.optJSONObject(i);
                if (step == null ||
                    !"model_output".equals(step.optString("type"))) {
                    continue;
                }

                JSONArray content = step.optJSONArray("content");
                if (content == null) continue;

                for (int j = 0; j < content.length(); j++) {
                    JSONObject block = content.optJSONObject(j);
                    if (block == null ||
                        !"image".equals(block.optString("type"))) {
                        continue;
                    }

                    String data = block.optString("data", "");
                    if (data.isEmpty()) continue;

                    return new Result(
                        Base64.decode(data, Base64.DEFAULT),
                        block.optString("mime_type", "image/jpeg")
                    );
                }
            }
        }

        throw new Exception(
            "Google returned no image. Try Generate again."
        );
    }

    private String errorMessage(int status, String response) {
        try {
            JSONObject root = new JSONObject(response);
            JSONObject error = root.optJSONObject("error");
            if (error != null) {
                String message = error.optString("message", "");
                if (!message.isEmpty()) return message;
            }
        } catch (Exception ignored) {
        }

        if (status == 401 || status == 403) {
            return "API key rejected. Check your Gemini API key and billing.";
        }
        if (status == 429) {
            return "Google quota/rate limit reached. Try again later.";
        }

        return "Google generation failed (HTTP " + status + ").";
    }

    private byte[] readAll(InputStream stream) throws Exception {
        if (stream == null) return new byte[0];

        try (InputStream input = stream;
             ByteArrayOutputStream output =
                 new ByteArrayOutputStream()) {
            byte[] buffer = new byte[16 * 1024];
            int read;
            while ((read = input.read(buffer)) >= 0) {
                output.write(buffer, 0, read);
            }
            return output.toByteArray();
        }
    }
}
