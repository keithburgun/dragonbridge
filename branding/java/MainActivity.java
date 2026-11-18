package com.dragonbridge.game;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

/**
 * Dragon Bridge's Android activity: the standard Capacitor app, plus the in-app updater plugin.
 * The build copies this file over the one Capacitor generates (see .github/workflows/build.yml).
 */
public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        registerPlugin(UpdaterPlugin.class);   // in-app updates (see UpdaterPlugin.java)
        super.onCreate(savedInstanceState);
    }
}
