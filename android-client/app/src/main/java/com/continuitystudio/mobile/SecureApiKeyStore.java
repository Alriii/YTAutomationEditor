package com.continuitystudio.mobile;

import android.content.Context;
import android.content.SharedPreferences;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;

import java.nio.charset.StandardCharsets;
import java.security.KeyStore;

import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

public final class SecureApiKeyStore {
    private static final String KEY_ALIAS = "continuity_gemini_api_key";
    private static final String PREFS = "continuity_secure";
    private static final String PREF_IV = "iv";
    private static final String PREF_DATA = "ciphertext";

    private final SharedPreferences preferences;

    public SecureApiKeyStore(Context context) {
        preferences = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    private SecretKey key() throws Exception {
        KeyStore store = KeyStore.getInstance("AndroidKeyStore");
        store.load(null);

        if (store.containsAlias(KEY_ALIAS)) {
            KeyStore.SecretKeyEntry entry =
                (KeyStore.SecretKeyEntry) store.getEntry(KEY_ALIAS, null);
            return entry.getSecretKey();
        }

        KeyGenerator generator = KeyGenerator.getInstance(
            KeyProperties.KEY_ALGORITHM_AES,
            "AndroidKeyStore"
        );
        generator.init(
            new KeyGenParameterSpec.Builder(
                KEY_ALIAS,
                KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT
            )
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .build()
        );
        return generator.generateKey();
    }

    public void save(String apiKey) throws Exception {
        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(Cipher.ENCRYPT_MODE, key());

        byte[] encrypted = cipher.doFinal(
            apiKey.getBytes(StandardCharsets.UTF_8)
        );

        preferences.edit()
            .putString(PREF_IV, Base64.encodeToString(cipher.getIV(), Base64.NO_WRAP))
            .putString(PREF_DATA, Base64.encodeToString(encrypted, Base64.NO_WRAP))
            .apply();
    }

    public String get() throws Exception {
        String iv = preferences.getString(PREF_IV, null);
        String data = preferences.getString(PREF_DATA, null);
        if (iv == null || data == null) return "";

        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(
            Cipher.DECRYPT_MODE,
            key(),
            new GCMParameterSpec(128, Base64.decode(iv, Base64.NO_WRAP))
        );

        byte[] decrypted = cipher.doFinal(
            Base64.decode(data, Base64.NO_WRAP)
        );
        return new String(decrypted, StandardCharsets.UTF_8);
    }

    public boolean hasKey() {
        return preferences.contains(PREF_IV) &&
            preferences.contains(PREF_DATA);
    }

    public void clear() {
        preferences.edit()
            .remove(PREF_IV)
            .remove(PREF_DATA)
            .apply();
    }
}
