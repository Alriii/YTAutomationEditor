package com.continuitystudio.mobile;

import android.accounts.Account;
import android.accounts.AccountManager;
import android.app.AlertDialog;
import android.content.Intent;
import android.os.Bundle;
import android.widget.EditText;
import android.widget.TextView;
import android.widget.Toast;

import androidx.appcompat.app.AppCompatActivity;
import androidx.fragment.app.Fragment;

import com.google.android.gms.auth.GoogleAuthUtil;
import com.google.android.gms.auth.UserRecoverableAuthException;
import com.google.android.material.bottomnavigation.BottomNavigationView;

import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class StudioActivity extends AppCompatActivity {
    private static final int PICK_FLOW_ACCOUNT = 9201;
    private static final int RECOVER_FLOW_AUTH = 9202;

    private BottomNavigationView bottomNav;
    private TextView headerProject;
    private ProjectStore store;
    private String sceneToOpen;
    private Account pendingFlowProbeAccount;
    private final ExecutorService executor =
        Executors.newSingleThreadExecutor();

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_studio);

        store = new ProjectStore(this);
        bottomNav = findViewById(R.id.bottom_navigation);
        headerProject = findViewById(R.id.header_project);

        findViewById(R.id.btn_settings)
            .setOnClickListener(v -> showSettings());

        bottomNav.setOnItemSelectedListener(item -> {
            Fragment selected;
            int id = item.getItemId();

            if (id == R.id.nav_generate) {
                selected = GenerateFragment.newInstance(sceneToOpen);
                sceneToOpen = null;
            } else if (id == R.id.nav_storyboard) {
                selected = new StoryboardFragment();
            } else if (id == R.id.nav_export) {
                selected = new ExportFragment();
            } else {
                selected = new HomeFragment();
            }

            getSupportFragmentManager()
                .beginTransaction()
                .replace(R.id.fragment_container, selected)
                .commit();

            refreshHeader();
            return true;
        });

        if (savedInstanceState == null) {
            bottomNav.setSelectedItemId(R.id.nav_home);
        } else {
            refreshHeader();
        }
    }

    public ProjectStore store() {
        return store;
    }

    public void refreshHeader() {
        ProjectStore.Project project =
            store.current(MainActivity.DEFAULT_MASTER);
        headerProject.setText(project.title);
    }

    public void navigateToHome() {
        bottomNav.setSelectedItemId(R.id.nav_home);
    }

    public void navigateToGenerate() {
        navigateToGenerate(null);
    }

    public void navigateToGenerate(String sceneId) {
        sceneToOpen = sceneId;
        if (bottomNav.getSelectedItemId() == R.id.nav_generate) {
            getSupportFragmentManager()
                .beginTransaction()
                .replace(
                    R.id.fragment_container,
                    GenerateFragment.newInstance(sceneToOpen)
                )
                .commit();
            sceneToOpen = null;
        } else {
            bottomNav.setSelectedItemId(R.id.nav_generate);
        }
    }

    public void navigateToStoryboard() {
        bottomNav.setSelectedItemId(R.id.nav_storyboard);
    }

    public void navigateToExport() {
        bottomNav.setSelectedItemId(R.id.nav_export);
    }

    private void showSettings() {
        String[] items = {
            "Test Flow Direct access (experimental)",
            "Master continuity prompt",
            "Rename current project",
            "Advanced / legacy tools"
        };

        new AlertDialog.Builder(this)
            .setTitle("Settings")
            .setItems(items, (dialog, which) -> {
                if (which == 0) {
                    startFlowDirectAccessProbe();
                } else if (which == 1) {
                    showMasterPromptDialog();
                } else if (which == 2) {
                    showRenameDialog();
                } else {
                    startActivity(new Intent(this, MainActivity.class));
                }
            })
            .show();
    }

    private void showMasterPromptDialog() {
        ProjectStore.Project project =
            store.current(MainActivity.DEFAULT_MASTER);

        EditText input = new EditText(this);
        input.setMinLines(10);
        input.setText(project.masterPrompt);
        input.setSelectAllOnFocus(false);

        new AlertDialog.Builder(this)
            .setTitle("Master continuity prompt")
            .setView(input)
            .setPositiveButton("Save", (dialog, which) -> {
                String value = input.getText().toString().trim();
                project.masterPrompt =
                    value.isEmpty()
                        ? MainActivity.DEFAULT_MASTER
                        : value;
                store.save(project);
                Toast.makeText(
                    this,
                    "Continuity prompt saved.",
                    Toast.LENGTH_SHORT
                ).show();
            })
            .setNeutralButton("Reset", (dialog, which) -> {
                project.masterPrompt = MainActivity.DEFAULT_MASTER;
                store.save(project);
            })
            .setNegativeButton("Cancel", null)
            .show();
    }

    private void showRenameDialog() {
        ProjectStore.Project project =
            store.current(MainActivity.DEFAULT_MASTER);

        EditText input = new EditText(this);
        input.setSingleLine(true);
        input.setText(project.title);
        input.setSelectAllOnFocus(true);

        new AlertDialog.Builder(this)
            .setTitle("Rename project")
            .setView(input)
            .setPositiveButton("Save", (dialog, which) -> {
                String value = input.getText().toString().trim();
                if (!value.isEmpty()) {
                    project.title = value;
                    store.save(project);
                    refreshHeader();
                    Fragment current =
                        getSupportFragmentManager()
                            .findFragmentById(R.id.fragment_container);
                    if (current instanceof HomeFragment) {
                        ((HomeFragment) current).refreshProjects();
                    }
                }
            })
            .setNegativeButton("Cancel", null)
            .show();
    }

    private void startFlowDirectAccessProbe() {
        Intent chooser = AccountManager.newChooseAccountIntent(
            null,
            null,
            new String[] { "com.google" },
            "Choose the Google account you use with Flow",
            null,
            null,
            null
        );
        startActivityForResult(chooser, PICK_FLOW_ACCOUNT);
    }

    private void runFlowDirectAccessProbe(Account account) {
        if (account == null) {
            Toast.makeText(
                this,
                "No Google account selected.",
                Toast.LENGTH_SHORT
            ).show();
            return;
        }

        pendingFlowProbeAccount = account;

        AlertDialog progress =
            new AlertDialog.Builder(this)
                .setTitle("Testing Flow Direct")
                .setMessage(
                    "Testing Flow discovery under Continuity Studio's own app identity…"
                )
                .setCancelable(false)
                .create();
        progress.show();

        executor.execute(() -> {
            String token = null;

            try {
                token = GoogleAuthUtil.getToken(
                    getApplicationContext(),
                    account,
                    "oauth2:" + FlowDirectProtocol.OAUTH_SCOPE
                );

                FlowDirectExperimentalClient client =
                    new FlowDirectExperimentalClient();

                FlowDirectExperimentalClient.AuthContext auth =
                    new FlowDirectExperimentalClient.AuthContext(
                        token,
                        "",
                        "0",
                        null,
                        null
                    );

                FlowDirectExperimentalClient.TransportResponse config =
                    client.fetchAppConfig(auth);
                FlowDirectExperimentalClient.TransportResponse models =
                    client.fetchModels(auth);

                String result =
                    describeProbe(
                        config.statusCode,
                        models.statusCode
                    );

                runOnUiThread(() -> {
                    progress.dismiss();
                    new AlertDialog.Builder(this)
                        .setTitle("Flow Direct access test")
                        .setMessage(result)
                        .setPositiveButton("OK", null)
                        .show();
                });
            } catch (UserRecoverableAuthException recoverable) {
                runOnUiThread(() -> {
                    progress.dismiss();
                    startActivityForResult(
                        recoverable.getIntent(),
                        RECOVER_FLOW_AUTH
                    );
                });
            } catch (Exception error) {
                String message =
                    error.getMessage() == null
                        ? "Google did not grant Flow Direct access."
                        : error.getMessage();

                runOnUiThread(() -> {
                    progress.dismiss();
                    new AlertDialog.Builder(this)
                        .setTitle("Flow Direct access test")
                        .setMessage(
                            "The probe did not complete.\n\n" +
                            message +
                            "\n\nNo account token was stored."
                        )
                        .setPositiveButton("OK", null)
                        .show();
                });
            } finally {
                if (token != null && !token.isEmpty()) {
                    try {
                        GoogleAuthUtil.clearToken(
                            getApplicationContext(),
                            token
                        );
                    } catch (Exception ignored) {
                    }
                }
            }
        });
    }

    private String describeProbe(int config, int models) {
        if (config >= 200 && config < 300 &&
            models >= 200 && models < 300) {
            return
                "Google accepted Continuity Studio's own OAuth identity for Flow discovery." +
                "\n\nApp config: HTTP " + config +
                "\nModels: HTTP " + models +
                "\n\nDirect integration may be viable. Generation remains disabled until the request schema and required request context are legitimately verified.";
        }

        if (config == 401 || config == 403 ||
            models == 401 || models == 403) {
            return
                "The Flow backend rejected direct discovery under Continuity Studio's identity." +
                "\n\nApp config: HTTP " + config +
                "\nModels: HTTP " + models +
                "\n\nThe official Flow-app handoff remains the stable path.";
        }

        return
            "Flow was reached, but discovery returned an unexpected status." +
            "\n\nApp config: HTTP " + config +
            "\nModels: HTTP " + models;
    }

    @Override
    protected void onActivityResult(
        int requestCode,
        int resultCode,
        Intent data
    ) {
        super.onActivityResult(requestCode, resultCode, data);

        if (requestCode == PICK_FLOW_ACCOUNT &&
            resultCode == RESULT_OK &&
            data != null) {
            String name =
                data.getStringExtra(AccountManager.KEY_ACCOUNT_NAME);
            String type =
                data.getStringExtra(AccountManager.KEY_ACCOUNT_TYPE);

            if (name != null) {
                runFlowDirectAccessProbe(
                    new Account(
                        name,
                        type == null ? "com.google" : type
                    )
                );
            }
            return;
        }

        if (requestCode == RECOVER_FLOW_AUTH &&
            resultCode == RESULT_OK &&
            pendingFlowProbeAccount != null) {
            runFlowDirectAccessProbe(pendingFlowProbeAccount);
        }
    }

    @Override
    protected void onDestroy() {
        executor.shutdownNow();
        super.onDestroy();
    }
}
