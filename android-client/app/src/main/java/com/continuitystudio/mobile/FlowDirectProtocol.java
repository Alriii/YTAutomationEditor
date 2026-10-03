package com.continuitystudio.mobile;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.Locale;

/**
 * Versioned protocol constants observed in Google Flow Android 1.570.2.
 *
 * This class intentionally contains no Google private API key, OAuth client
 * secret, cookies, reCAPTCHA site identity, or extracted account credential.
 */
public final class FlowDirectProtocol {
    public static final String SOURCE_VERSION = "1.570.2";
    public static final String PRODUCTION_HOST = "aisandbox-pa.googleapis.com";
    public static final String CLIENTS6_HOST = "aisandbox-pa.clients6.google.com";
    public static final String OAUTH_SCOPE =
        "https://www.googleapis.com/auth/aisandbox";

    public static final String PATH_APP_CONFIG = "v1/flow/appConfig";
    public static final String PATH_MODELS = "v1/flow/models";
    public static final String PATH_MODEL_STATUSES = "v1/flow/models/statuses";
    public static final String PATH_USER_WORKFLOWS = "v1/flow/userWorkflows";
    public static final String PATH_UPLOAD_IMAGE = "v1/flow/uploadImage";
    public static final String PATH_UPSAMPLE_IMAGE = "v1/flow/upsampleImage";
    public static final String PATH_BATCH_GET_MEDIA = "v1/flowMedia:batchGet";
    public static final String PATH_CANCEL_GENERATION =
        "v1/flowMedia:cancelGeneration";

    public static final String HEADER_AUTHORIZATION = "Authorization";
    public static final String HEADER_GOOG_API_KEY = "X-Goog-Api-Key";
    public static final String HEADER_GOOG_AUTH_USER = "X-Goog-AuthUser";
    public static final String HEADER_UPLOAD_PROTOCOL =
        "X-Goog-Upload-Protocol";
    public static final String HEADER_UPLOAD_COMMAND =
        "X-Goog-Upload-Command";
    public static final String HEADER_UPLOAD_OFFSET =
        "X-Goog-Upload-Offset";
    public static final String HEADER_UPLOAD_CONTENT_LENGTH =
        "X-Goog-Upload-Content-Length";
    public static final String HEADER_UPLOAD_CONTENT_TYPE =
        "X-Goog-Upload-Content-Type";

    private FlowDirectProtocol() {}

    public enum ImageAspectRatio {
        LANDSCAPE_16_9("16:9", "IMAGE_ASPECT_RATIO_LANDSCAPE"),
        PORTRAIT_9_16("9:16", "IMAGE_ASPECT_RATIO_PORTRAIT"),
        SQUARE_1_1("1:1", "IMAGE_ASPECT_RATIO_SQUARE"),
        LANDSCAPE_4_3("4:3", "IMAGE_ASPECT_RATIO_LANDSCAPE_FOUR_THREE"),
        PORTRAIT_3_4("3:4", "IMAGE_ASPECT_RATIO_PORTRAIT_THREE_FOUR");

        public final String uiValue;
        public final String protoValue;

        ImageAspectRatio(String uiValue, String protoValue) {
            this.uiValue = uiValue;
            this.protoValue = protoValue;
        }

        public static ImageAspectRatio fromUiValue(String value) {
            for (ImageAspectRatio ratio : values()) {
                if (ratio.uiValue.equals(value)) return ratio;
            }
            return LANDSCAPE_16_9;
        }
    }

    public static String batchGenerateImagesPath(String parent) {
        if (parent == null || parent.trim().isEmpty()) {
            throw new IllegalArgumentException("Flow parent is required.");
        }

        // The route uses a Google {+parent} path expansion, so embedded '/'
        // characters belong to the resource name and are intentionally kept.
        String normalized = parent.trim();
        return "v1/" + normalized + "/flowMedia:batchGenerateImages";
    }

    public static String getProjectContentsPath(String name) {
        if (name == null || name.trim().isEmpty()) {
            throw new IllegalArgumentException("Flow project name is required.");
        }
        return "v1/" + name.trim() + ":getProjectContents";
    }

    public static String baseUrl() {
        return "https://" + PRODUCTION_HOST + "/";
    }
}
