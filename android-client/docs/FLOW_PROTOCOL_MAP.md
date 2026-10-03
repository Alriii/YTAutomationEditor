# Google Flow Android 1.570.2 protocol map

This document records interoperability research against the exact Google Flow
Android APKM supplied for Continuity Studio.

Package: com.google.android.apps.labs.whisk
Version: 1.570.2

The goal is to understand Flow's integration surface without copying private
Google credentials, session material, attestation tokens, or bypassing
quota/access controls.

## Architecture

The app is primarily Flutter. Its AOT application logic is in:

libwhisk_prod_android_library_flutter_artifacts.so

Observed production hosts:

- aisandbox-pa.googleapis.com
- aisandbox-pa.clients6.google.com

## Observed authentication surface

The official client contains:

- OAuth scope: https://www.googleapis.com/auth/aisandbox
- Authorization: Bearer ...
- X-Goog-Api-Key
- X-Goog-AuthUser
- clientContext
- recaptchaContext
- getOAuthToken
- createClientContextWithRecaptcha

Conclusion: Flow's backend is not an unauthenticated public API.

## Bootstrap and model discovery

Observed routes:

- v1/flow/appConfig
- v1/flow/models
- v1/flow/models/statuses
- v1/flow/userSettings
- v1/flow/userWorkflows

The client contains dynamic model state such as:

- defaultImageModelKey
- selectedImageModelKey
- stickyImageModelKey
- imageModels
- findImageModelByUsageKey

Design rule: Continuity Studio must not hard-code a guessed backend enum for
"Nano Banana 2". A future supported connector should resolve the server model
catalog dynamically.

## Reference-image upload

Observed route:

v1/flow/uploadImage

Observed upload headers:

- X-Goog-Upload-Protocol
- X-Goog-Upload-Command
- X-Goog-Upload-Offset
- X-Goog-Upload-Content-Length
- X-Goog-Upload-Content-Type

The binary also contains the log string:

Parsed upload response: mediaKey=

This strongly suggests uploaded references become media keys consumed by later
generation requests.

## Image generation

Observed REST-transcoded route:

v1/{+parent}/flowMedia:batchGenerateImages

Observed protobuf/Dart symbols:

- BatchGenerateImagesRequest
- BatchGenerateImagesResponse
- GenerateImageRequest
- ImageGenerationRequestData
- ImageGenerationImageInput
- ImageGenerationEntityInput
- WhiskInputSpec
- WhiskOutputSpec
- GenerationModel

Observed relevant field/property strings:

- parent
- requests
- requestId
- projectId
- workflowId
- prompt
- structuredPrompt
- model
- imageModelName
- aspectRatio
- imageCount
- inputAssetKeys
- inputMedia
- imageGenerationImageInputs
- imageGenerationLikenessInputs
- generationConfiguration
- clientContext
- recaptchaContext
- serviceTier

These are observed symbols, not a claim that every field is at the top level
of the REST JSON payload.

## Result retrieval

Observed routes:

- v1/flowMedia:batchGet
- v1/{+name}:getProjectContents
- v1/flowMedia:cancelGeneration
- v1/flow/upsampleImage

Observed result-side symbols include:

- BatchGetMediaRequest
- GeneratedImage
- mediaKey
- batchGetMedia

## Aspect-ratio enums observed

- IMAGE_ASPECT_RATIO_UNSPECIFIED
- IMAGE_ASPECT_RATIO_LANDSCAPE
- IMAGE_ASPECT_RATIO_LANDSCAPE_FOUR_THREE
- IMAGE_ASPECT_RATIO_PORTRAIT
- IMAGE_ASPECT_RATIO_PORTRAIT_THREE_FOUR
- IMAGE_ASPECT_RATIO_SQUARE

Current UI mapping:

- 16:9 -> LANDSCAPE
- 9:16 -> PORTRAIT
- 4:3 -> LANDSCAPE_FOUR_THREE
- 3:4 -> PORTRAIT_THREE_FOUR
- 1:1 -> SQUARE

## Image input usage enums observed

- IMAGE_USAGE_TYPE_REFERENCE_IMAGE
- IMAGE_USAGE_TYPE_ASSET
- IMAGE_USAGE_TYPE_ASSET_IMAGE
- IMAGE_USAGE_TYPE_STYLE
- IMAGE_USAGE_TYPE_STYLE_IMAGE
- IMAGE_USAGE_TYPE_START_IMAGE
- IMAGE_USAGE_TYPE_END_IMAGE
- IMAGE_USAGE_TYPE_MASK
- IMAGE_USAGE_TYPE_MASK_IMAGE
- IMAGE_USAGE_TYPE_REMOVAL_MASK_IMAGE

For Continuity Studio continuity references, REFERENCE_IMAGE is the most likely
semantic match, but this remains an inference until a legitimate live request
can be observed through supported debugging/logging.

## Generation-type enums observed

- WHISK_GENERATION_TYPE_TEXT_TO_IMAGE
- WHISK_GENERATION_TYPE_IMAGE_TO_IMAGE
- WHISK_GENERATION_TYPE_IMAGE_TO_VIDEO
- WHISK_GENERATION_TYPE_TEXT_TO_VIDEO
- WHISK_GENERATION_TYPE_REFERENCE_TO_VIDEO
- WHISK_GENERATION_TYPE_VIDEO_TO_VIDEO
- WHISK_GENERATION_TYPE_UNKNOWN

The binary also includes telemetry/action shorthand such as GENERATE_T2I,
GENERATE_I2I, GENERATE_T2V, GENERATE_I2V, GENERATE_R2V and GENERATE_V2V.

## Legacy model enums

The binary still contains old identifiers such as IMAGEN_2, IMAGEN_3,
IMAGEN_3_FAST, IMAGEN_3_1, IMAGEN_3_5 and IMAGEN_3_5_FAST.

These must not be assumed to be the current Nano Banana model identifiers.

## Deep links

Observed:

flowapp://creation/<mediaKey>

The binary also references Flow shared-image/shared-video URLs.

## Continuity Studio states

### Stable: Flow App Handoff

Enabled. Continuity Studio compiles the prompt, shares/copies references and
prompt, opens official Flow, and imports the downloaded result into the exact
storyboard scene.

### Experimental: Flow Direct protocol model

FlowProtocol.java contains typed constants and research DTOs.

It intentionally has no HTTP transport and no copied Google credentials.

## Next research targets

1. Determine exact protobuf field numbers/types for BatchGenerateImagesRequest.
2. Determine how uploaded mediaKey values are wrapped by
   ImageGenerationImageInput / WhiskInputSpec.
3. Determine whether batchGet returns generation state directly or another
   operation/resource identifier.
4. Prefer an official supported Google API/SDK if one appears.
