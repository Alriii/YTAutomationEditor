package com.continuitystudio.mobile;

import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;

/**
 * Experimental Flow Direct transport.
 *
 * This is deliberately not exposed in the UI yet. The endpoint family is
 * observed in Flow 1.570.2, but generation must remain disabled until the
 * exact protobuf/JSON nesting and a supported auth path are verified.
 */
public final class FlowDirectExperimentalClient {
    public static final class AuthContext {
        public final String oauthBearerToken;
        public final String apiKey;
        public final String authUser;
        public final JSONObject clientContext;
        public final JSONObject recaptchaContext;

        public AuthContext(
            String oauthBearerToken,
            String apiKey,
            String authUser,
            JSONObject clientContext,
            JSONObject recaptchaContext
        ) {
            this.oauthBearerToken =
                oauthBearerToken == null ? "" : oauthBearerToken.trim();
            this.apiKey = apiKey == null ? "" : apiKey.trim();
            this.authUser =
                authUser == null || authUser.trim().isEmpty()
                    ? "0"
                    : authUser.trim();
            this.clientContext = clientContext;
            this.recaptchaContext = recaptchaContext;
        }

        public boolean hasBearerToken() {
            return !oauthBearerToken.isEmpty();
        }

        public boolean hasRequestContext() {
            return clientContext != null && recaptchaContext != null;
        }
    }

    public static final class TransportResponse {
        public final int statusCode;
        public final String body;

        TransportResponse(int statusCode, String body) {
            this.statusCode = statusCode;
            this.body = body == null ? "" : body;
        }

        public boolean isSuccess() {
            return statusCode >= 200 && statusCode < 300;
        }
    }

    public TransportResponse fetchAppConfig(AuthContext auth)
        throws Exception {
        return execute("GET", FlowDirectProtocol.PATH_APP_CONFIG, null, auth);
    }

    public TransportResponse fetchModels(AuthContext auth)
        throws Exception {
        return execute("GET", FlowDirectProtocol.PATH_MODELS, null, auth);
    }

    public TransportResponse fetchModelStatuses(AuthContext auth)
        throws Exception {
        return execute(
            "GET",
            FlowDirectProtocol.PATH_MODEL_STATUSES,
            null,
            auth
        );
    }

    /**
     * Generation is intentionally guarded.
     *
     * The APK proves the endpoint and message types exist, but not enough has
     * been verified to safely emit a production request without guessing.
     */
    public TransportResponse batchGenerateImages(
        String parent,
        JSONObject verifiedWireBody,
        AuthContext auth,
        boolean wireSchemaVerified
    ) throws Exception {
        if (!wireSchemaVerified) {
            throw new IllegalStateException(
                "Flow Direct generation is disabled until the " +
                "BatchGenerateImages wire schema is verified."
            );
        }
        if (verifiedWireBody == null) {
            throw new IllegalArgumentException(
                "Verified Flow generation body is required."
            );
        }
        if (auth == null ||
            !auth.hasBearerToken() ||
            !auth.hasRequestContext()) {
            throw new IllegalStateException(
                "Flow Direct requires a supported OAuth token plus " +
                "verified client and reCAPTCHA request contexts."
            );
        }

        return execute(
            "POST",
            FlowDirectProtocol.batchGenerateImagesPath(parent),
            verifiedWireBody,
            auth
        );
    }

    public TransportResponse batchGetMedia(
        JSONObject verifiedWireBody,
        AuthContext auth,
        boolean wireSchemaVerified
    ) throws Exception {
        if (!wireSchemaVerified) {
            throw new IllegalStateException(
                "Flow media polling schema has not been verified."
            );
        }
        return execute(
            "POST",
            FlowDirectProtocol.PATH_BATCH_GET_MEDIA,
            verifiedWireBody,
            auth
        );
    }

    private TransportResponse execute(
        String method,
        String path,
        JSONObject body,
        AuthContext auth
    ) throws Exception {
        if (auth == null || !auth.hasBearerToken()) {
            throw new IllegalStateException(
                "A supported user OAuth bearer token is required."
            );
        }

        URL url = new URL(FlowDirectProtocol.baseUrl() + path);
        HttpURLConnection connection =
            (HttpURLConnection) url.openConnection();

        connection.setRequestMethod(method);
        connection.setConnectTimeout(30_000);
        connection.setReadTimeout(120_000);
        connection.setRequestProperty(
            "Accept",
            "application/json"
        );
        connection.setRequestProperty(
            FlowDirectProtocol.HEADER_AUTHORIZATION,
            "Bearer " + auth.oauthBearerToken
        );
        connection.setRequestProperty(
            FlowDirectProtocol.HEADER_GOOG_AUTH_USER,
            auth.authUser
        );

        if (!auth.apiKey.isEmpty()) {
            connection.setRequestProperty(
                FlowDirectProtocol.HEADER_GOOG_API_KEY,
                auth.apiKey
            );
        }

        if (body != null) {
            connection.setDoOutput(true);
            connection.setRequestProperty(
                "Content-Type",
                "application/json; charset=utf-8"
            );

            try (OutputStream output = connection.getOutputStream()) {
                output.write(
                    body.toString().getBytes(StandardCharsets.UTF_8)
                );
            }
        }

        int status = connection.getResponseCode();
        InputStream stream =
            status >= 200 && status < 300
                ? connection.getInputStream()
                : connection.getErrorStream();

        return new TransportResponse(status, read(stream));
    }

    private String read(InputStream stream) throws Exception {
        if (stream == null) return "";

        try (
            InputStream input = stream;
            ByteArrayOutputStream output = new ByteArrayOutputStream()
        ) {
            byte[] buffer = new byte[16 * 1024];
            int read;
            while ((read = input.read(buffer)) >= 0) {
                output.write(buffer, 0, read);
            }
            return output.toString(StandardCharsets.UTF_8.name());
        }
    }
}
