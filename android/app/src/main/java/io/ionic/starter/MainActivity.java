package io.ionic.starter;

import android.os.Bundle;
import android.view.WindowManager;
import com.getcapacitor.BridgeActivity;
import io.ionic.starter.plugins.AutofillPlugin;
import io.ionic.starter.plugins.WireguardVpnPlugin;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        registerPlugin(AutofillPlugin.class);
        registerPlugin(WireguardVpnPlugin.class);
        super.onCreate(savedInstanceState);
        // Hardening nativo: bloqueia captura e gravação de tela (FLAG_SECURE)
        getWindow().setFlags(
            WindowManager.LayoutParams.FLAG_SECURE,
            WindowManager.LayoutParams.FLAG_SECURE
        );
    }
}

