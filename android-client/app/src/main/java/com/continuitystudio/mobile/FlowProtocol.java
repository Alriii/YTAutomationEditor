package com.continuitystudio.mobile;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.List;

/**
 * Typed interoperability map reconstructed from Google Flow Android 1.570.2.
 *
 * No private Google credentials are included and this class performs no
 * network requests. It exists so Continuity Studio can model the observed
 * protocol without pretending Flow's internal endpoint is a public API.
 */
public final class FlowProtocol {
    private FlowProtocol() {}

    public static final String HOST_PRODUCTION =
        "https://aisandbox-pa.googleapis.com";
    public static final String HOST_PRODUCTION_ALT =
        "https://aisandbox-pa.clients6.google.com";
    public static final String OAUTH_SCOPE =
        "https://www.googleapis.com/auth/aisandbox";

    public static final String APP_CONFIG = "v1/flow/appConfig";
    public static final String MODELS = "v1/flow/models";
    public static final String MODEL_STATUSES = "v1/flow/models/statuses";
    public static final String USER_WORKFLOWS = "v1/flow/userWorkflows";
    public static final String UPLOAD_IMAGE = "v1/flow/uploadImage";
    public static final String BATCH_GENERATE_IMAGES =
        "v1/{+parent}/flowMedia:batchGenerateImages";
    public static final String BATCH_GET_MEDIA =
        "v1/flowMedia:batchGet";
    public static final String CANCEL_GENERATION =
        "v1/flowMedia:cancelGeneration";
    public static final String GET_PROJECT_CONTENTS =
        "v1/{+name}:getProjectContents";
    public static final String UPSAMPLE_IMAGE =
        "v1/flow/upsampleImage";

    public enum ImageAspectRatio {
        UNSPECIFIED("IMAGE_ASPECT_RATIO_UNSPECIFIED"),
        LANDSCAPE("IMAGE_ASPECT_RATIO_LANDSCAPE"),
        LANDSCAPE_FOUR_THREE(
            "IMAGE_ASPECT_RATIO_LANDSCAPE_FOUR_THREE"
        ),
        PORTRAIT("IMAGE_ASPECT_RATIO_PORTRAIT"),
        PORTRAIT_THREE_FOUR(
            "IMAGE_ASPECT_RATIO_PORTRAIT_THREE_FOUR"
        ),
        SQUARE("IMAGE_ASPECT_RATIO_SQUARE");

        public final String wireName;

        ImageAspectRatio(String wireName) {
            this.wireName = wireName;
        }

        public static ImageAspectRatio fromUi(String value) {
            if ("9:16".equals(value)) return PORTRAIT;
            if ("4:3".equals(value)) return LANDSCAPE_FOUR_THREE;
            if ("3:4".equals(value)) return PORTRAIT_THREE_FOUR;
            if ("1:1".equals(value)) return SQUARE;
            return LANDSCAPE;
        }
    }

    public enum ImageUsageType {
        UNSPECIFIED("IMAGE_USAGE_TYPE_UNSPECIFIED"),
        REFERENCE_IMAGE("IMAGE_USAGE_TYPE_REFERENCE_IMAGE"),
        ASSET("IMAGE_USAGE_TYPE_ASSET"),
        ASSET_IMAGE("IMAGE_USAGE_TYPE_ASSET_IMAGE"),
        STYLE("IMAGE_USAGE_TYPE_STYLE"),
        STYLE_IMAGE("IMAGE_USAGE_TYPE_STYLE_IMAGE"),
        START_IMAGE("IMAGE_USAGE_TYPE_START_IMAGE"),
        END_IMAGE("IMAGE_USAGE_TYPE_END_IMAGE"),
        MASK("IMAGE_USAGE_TYPE_MASK"),
        MASK_IMAGE("IMAGE_USAGE_TYPE_MASK_IMAGE"),
        REMOVAL_MASK_IMAGE(
            "IMAGE_USAGE_TYPE_REMOVAL_MASK_IMAGE"
        );

        public final String wireName;

        ImageUsageType(String wireName) {
            this.wireName = wireName;
        }
    }

    public enum GenerationType {
        TEXT_TO_IMAGE("WHISK_GENERATION_TYPE_TEXT_TO_IMAGE"),
        IMAGE_TO_IMAGE("WHISK_GENERATION_TYPE_IMAGE_TO_IMAGE"),
        UNKNOWN("WHISK_GENERATION_TYPE_UNKNOWN");

        public final String wireName;

        GenerationType(String wireName) {
            this.wireName = wireName;
        }
    }

    public static final class GenerateImageDraft {
        public String requestId = "";
        public String projectId = "";
        public String workflowId = "";
        public String prompt = "";
        public String modelKey = "";
        public ImageAspectRatio aspectRatio =
            ImageAspectRatio.LANDSCAPE;
        public int imageCount = 1;
        public final ArrayList<String> inputAssetKeys =
            new ArrayList<>();

        public JSONObject toResearchJson() throws Exception {
            JSONArray assets = new JSONArray();
            for (String key : inputAssetKeys) assets.put(key);

            return new JSONObject()
                .put("requestId", requestId)
                .put("projectId", projectId)
                .put("workflowId", workflowId)
                .put("prompt", prompt)
                .put("model", modelKey)
                .put("aspectRatio", aspectRatio.wireName)
                .put("imageCount", imageCount)
                .put("inputAssetKeys", assets);
        }
    }

    public static final class BatchGenerateImagesDraft {
        public String parent = "";
        public final List<GenerateImageDraft> requests =
            new ArrayList<>();

        public JSONObject toResearchJson() throws Exception {
            JSONArray items = new JSONArray();
            for (GenerateImageDraft request : requests) {
                items.put(request.toResearchJson());
            }

            return new JSONObject()
                .put("parent", parent)
                .put("requests", items);
        }
    }

    public static final class ObservedAuthRequirements {
        public static final String AUTHORIZATION =
            "Authorization: Bearer <user OAuth token>";
        public static final String API_KEY = "X-Goog-Api-Key";
        public static final String AUTH_USER = "X-Goog-AuthUser";
        public static final String CLIENT_CONTEXT = "clientContext";
        public static final String RECAPTCHA_CONTEXT =
            "recaptchaContext";

        private ObservedAuthRequirements() {}
    }
}
