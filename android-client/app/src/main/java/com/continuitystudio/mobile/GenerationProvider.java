package com.continuitystudio.mobile;

/**
 * Shared generation-provider vocabulary.
 *
 * Stable Flow handoff and future Flow Direct can implement this abstraction
 * without changing project/storyboard storage.
 */
public interface GenerationProvider {
    enum Kind {
        FLOW_APP_HANDOFF,
        FLOW_DIRECT_EXPERIMENTAL,
        GEMINI_API
    }

    Kind kind();

    String displayName();

    boolean isReady();

    String readinessMessage();
}
