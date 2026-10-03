# Google Flow Android protocol map

Source inspected: official Google Flow Android bundle, package `com.google.android.apps.labs.whisk`, version **1.570.2**.

This document records interoperability findings from static inspection of the user-supplied APKM. It intentionally does not record or reuse Google private API keys, OAuth client credentials, session cookies, reCAPTCHA site identities, or account tokens.

## Confidence labels

- **Observed**: literal string/type/route present in the shipped binary.
- **High-confidence inference**: strongly implied by generated protobuf/RPC names and Flow runtime strings.
- **Unresolved**: must be verified before a direct connector sends generation traffic.

## Architecture

**Observed**

- Flutter application.
- Primary AOT logic: `libwhisk_prod_android_library_flutter_artifacts.so`.
- RPC/protobuf namespaces include:
  - `google.internal.labs.aisandbox.v1`
  - `google.internal.labs.aisandbox.proto.flow.v1`
  - `google.internal.labs.aisandbox.proto.project.v1`
- OAuth scope:
  - `https://www.googleapis.com/auth/aisandbox`

Observed backend hosts:

- `aisandbox-pa.googleapis.com`
- `aisandbox-pa.clients6.google.com`
- sandbox/staging variants are also present.

Continuity Studio must use production only when/if a supported authentication path is available.

## Flow REST-transcoded routes

### Configuration and model discovery

Observed:

- `v1/flow/appConfig`
- `v1/flow/models`
- `v1/flow/models/statuses`
- `v1/flow/userWorkflows`

Important: model selection is **server driven**. The APK contains model repository code and a `GenerationModel` protobuf, but does not expose a stable hard-coded API key named "Nano Banana 2". Continuity Studio should resolve the Flow model from the model/config response instead of assuming a permanent model id.

### Image upload

Observed:

- `v1/flow/uploadImage`
- `v1/flow/upsampleImage`

Observed resumable upload headers:

- `X-Goog-Upload-Protocol`
- `X-Goog-Upload-Command`
- `X-Goog-Upload-Offset`
- `X-Goog-Upload-Content-Length`
- `X-Goog-Upload-Content-Type`

Runtime logging contains `Parsed upload response: mediaKey=`, which strongly indicates that successful image upload resolves to a Flow media key used by later generation requests.

### Image generation

Observed route:

- `v1/{+parent}/flowMedia:batchGenerateImages`

Observed generated types:

- `BatchGenerateImagesRequest`
- `BatchGenerateImagesResponse`
- `GenerateImageRequest`
- `ImageGenerationRequestData`
- `WhiskInputSpec`
- `WhiskOutputSpec`
- `GenerationModel`
- `ClientContext`
- `RecaptchaContext`

Observed field/accessor names relevant to generation:

- `parent`
- `requests`
- `prompt`
- `structuredPrompt`
- `inputSpec`
- `outputSpec`
- `aspectRatio`
- `imageAspectRatio`
- `imageCount`
- `imageGenerationRequestData`
- `imageGenerationImageInputs`
- `imageGenerationEntityInputs`
- `imageGenerationLikenessInputs`
- `clientContext`
- `recaptchaContext`
- `projectId`
- `workflowId`
- `requestId`
- `serviceTier`

These names are present in the binary, but **the exact nesting and protobuf field numbers are not yet verified**. A direct connector must not assume a final JSON body until that nesting is confirmed.

### Media polling and lifecycle

Observed:

- `v1/flowMedia:batchGet`
- `v1/flowMedia:cancelGeneration`
- `v1/flowMedia/{name}:shareMedia`
- `v1/flowMedia/{name}:getSharedMedia`
- `v1/flowMedia/{name}:import`
- `v1/{+name}:getProjectContents`

Observed runtime identifiers include:

- `mediaKey`
- `mediaGenerationId`
- `mediaGenerationStatus`

High-confidence generation lifecycle:

1. Resolve app config/models.
2. Resolve/create project/parent context.
3. Upload reference images and receive media keys.
4. Build one or more `GenerateImageRequest` messages.
5. Submit `BatchGenerateImagesRequest`.
6. Poll returned media/generation identifiers through `flowMedia:batchGet`.
7. Persist successful media into the Continuity Studio scene.
8. Optionally cancel through `flowMedia:cancelGeneration`.

## Reference-image input

Observed generated type:

- `ImageGenerationImageInput`

Observed accessors:

- `mediaKey`
- `imageInputType`

Observed enum values:

- `IMAGE_INPUT_TYPE_UNKNOWN`
- `IMAGE_INPUT_TYPE_REFERENCE`
- `IMAGE_INPUT_TYPE_BASE_IMAGE`

The app contains `GenerationMediaInputAssetIdExtension|toReferenceImageInput` and runtime errors such as `Could not resolve media key for reference image`, strongly confirming that an uploaded reference is converted into an image input keyed by the uploaded Flow `mediaKey`.

Reference limits are model-driven. Observed model fields include:

- `modelKey`
- `displayName`
- `maxInputReferences`
- `supportedAspectRatios`
- `serviceTier`
- `generationConfiguration`

Runtime text `Resolved maxInputReferences for modelKey:` confirms the limit should be read from model configuration rather than hard-coded.

## Polling result shape

Observed generated type:

- `BatchGetMediaResponse.MediaResult`

Observed response/accessor concepts:

- `results`
- `media`
- `error`
- `mediaGenerationStatus`
- `mediaGenerationId`

The client also logs `Polling timed out after` and contains status parsing helpers. Continuity Studio should therefore treat polling as a per-result state machine: pending → terminal media or terminal error.

## Parent resource

The binary contains the resource pattern `flowProjects/*` alongside `projectId` and the route `v1/{+parent}/flowMedia:batchGenerateImages`.

**High-confidence inference:** generation parent resources are likely shaped as `flowProjects/<project-id>`. This must still be confirmed before Flow Direct is enabled.

## Aspect-ratio enums

Observed image enum strings:

- `IMAGE_ASPECT_RATIO_UNSPECIFIED`
- `IMAGE_ASPECT_RATIO_LANDSCAPE`
- `IMAGE_ASPECT_RATIO_PORTRAIT`
- `IMAGE_ASPECT_RATIO_SQUARE`
- `IMAGE_ASPECT_RATIO_LANDSCAPE_FOUR_THREE`
- `IMAGE_ASPECT_RATIO_PORTRAIT_THREE_FOUR`

Flow's UI separately exposes 16:9 / 9:16 / 1:1 / 4:3 / 3:4 labels. The mapping used by the experimental protocol layer is:

- 16:9 → `IMAGE_ASPECT_RATIO_LANDSCAPE`
- 9:16 → `IMAGE_ASPECT_RATIO_PORTRAIT`
- 1:1 → `IMAGE_ASPECT_RATIO_SQUARE`
- 4:3 → `IMAGE_ASPECT_RATIO_LANDSCAPE_FOUR_THREE`
- 3:4 → `IMAGE_ASPECT_RATIO_PORTRAIT_THREE_FOUR`

## Authentication and request context

Observed auth/client strings:

- `Authorization: Bearer ...`
- `X-Goog-Api-Key`
- `X-Goog-AuthUser`
- `getOAuthToken`
- `getRecaptchaContext`
- `createClientContextWithRecaptcha`
- `androidRecaptchaSiteKey`

This is the current blocker for direct use.

The experimental Continuity Studio client therefore accepts authentication only through an injected `AuthContext`. It contains **no extracted Google secrets** and no code for harvesting Flow cookies/tokens.

A supported direct integration would need Google to accept authorization obtained for Continuity Studio's own client identity and the `aisandbox` scope. If Google restricts that scope/client context to first-party Flow, the direct provider remains unavailable and the official Flow app handoff remains the stable path.

## Deep links and app integration

Observed:

- `flowapp://creation/(.+)`
- `/creation/:mediaKey`
- shared Flow image/video URL handling

These are useful for opening already-created Flow media, but they do not replace generation authentication.

## Experimental request shape

Do **not** treat this as a final wire schema. It is a working representation of observed concepts:

```json
{
  "parent": "<Flow project/parent resource>",
  "requests": [
    {
      "prompt": "<compiled Continuity prompt>",
      "inputSpec": {
        "references": ["<uploaded media key>"]
      },
      "outputSpec": {
        "aspectRatio": "IMAGE_ASPECT_RATIO_LANDSCAPE",
        "imageCount": 1
      },
      "model": "<server-resolved GenerationModel>",
      "imageGenerationRequestData": {}
    }
  ],
  "clientContext": {},
  "recaptchaContext": {}
}
```

The names above are observed, but their exact nesting can differ from this draft.

## Next verification work

Before enabling Flow Direct in the UI:

1. Verify HTTP methods for config/models/generation from the generated RPC descriptors.
2. Recover exact protobuf field nesting for:
   - `BatchGenerateImagesRequest`
   - `GenerateImageRequest`
   - `ImageGenerationRequestData`
   - `WhiskInputSpec`
   - `WhiskOutputSpec`
3. Verify the project `parent` resource format.
4. Verify model-list response fields used for display-name → model-key resolution.
5. Verify upload-init request/response and media-key extraction.
6. Verify `batchGet` request shape and terminal media status values.
7. Determine whether Continuity Studio's own OAuth client can be granted the `aisandbox` scope and accepted by the backend.
8. Only then enable direct generation.

## Current product policy

- **Stable provider:** official Google Flow Android handoff + result import.
- **Optional fallback:** Gemini API, billed separately.
- **Experimental provider:** Flow Direct protocol implementation, disabled until authentication and wire schema are verified.
