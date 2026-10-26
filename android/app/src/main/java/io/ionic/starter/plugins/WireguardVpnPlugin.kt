package io.ionic.starter.plugins

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.net.VpnService
import android.provider.Settings
import android.util.Log
import androidx.activity.result.ActivityResult
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.ActivityCallback
import com.getcapacitor.annotation.CapacitorPlugin
import com.wireguard.android.backend.Backend
import com.wireguard.android.backend.GoBackend
import com.wireguard.android.backend.Tunnel
import com.wireguard.config.Config
import com.wireguard.crypto.KeyPair
import java.io.ByteArrayInputStream
import java.nio.charset.StandardCharsets

/**
 * Implementação do túnel WireGuard para o SeguranApp.
 */
class SeguranAppTunnel(private val tunnelName: String = "seguranapp0") : Tunnel {
    private var stateChangeCallback: ((Tunnel.State) -> Unit)? = null

    fun setStateChangeCallback(cb: (Tunnel.State) -> Unit) {
        this.stateChangeCallback = cb
    }

    override fun getName(): String = tunnelName

    override fun onStateChange(newState: Tunnel.State) {
        stateChangeCallback?.invoke(newState)
    }
}

/**
 * Plugin Capacitor para o Módulo de VPN WireGuard Real do SeguranApp.
 * Fornece interface nativa direta com a engine WireGuard (GoBackend / VpnService)
 * gerenciando chaves Curve25519 no Android Keystore, telemetria real do kernel
 * e máquina de estados para a WebView.
 */
@CapacitorPlugin(name = "WireguardVpn")
class WireguardVpnPlugin : Plugin() {

    companion object {
        private const val TAG = "WireguardVpnPlugin"
        private const val SECURE_PREFS_NAME = "seguranapp_vpn_secure_prefs"
        private const val KEY_CLIENT_PRIVATE = "client_private_key"
        private const val KEY_CLIENT_PUBLIC = "client_public_key"
    }

    private var backend: Backend? = null
    private val tunnel = SeguranAppTunnel()
    private var currentState: String = "DISCONNECTED"
    private var killSwitchEnabled: Boolean = false

    override fun load() {
        super.load()
        try {
            val ctx = context.applicationContext
            backend = GoBackend(ctx)
            tunnel.setStateChangeCallback { newState ->
                val stateStr = when (newState) {
                    Tunnel.State.UP -> "CONNECTED"
                    Tunnel.State.DOWN -> "DISCONNECTED"
                    else -> "CONNECTING"
                }
                currentState = stateStr
                notifyStateChanged(stateStr)
            }
            Log.i(TAG, "WireGuard GoBackend inicializado com sucesso.")
        } catch (e: Exception) {
            Log.e(TAG, "Falha ao instanciar GoBackend: ${e.message}", e)
        }
    }

    private fun getSecurePrefs(): SharedPreferences {
        val masterKey = MasterKey.Builder(context.applicationContext)
            .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
            .build()
        return EncryptedSharedPreferences.create(
            context.applicationContext,
            SECURE_PREFS_NAME,
            masterKey,
            EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
            EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
        )
    }

    /**
     * Retorna a chave pública Curve25519 do cliente.
     * Caso o dispositivo ainda não possua chaves, gera um novo par local
     * e armazena a chave privada de forma cifrada no hardware/Keystore.
     */
    @PluginMethod
    fun getOrCreateClientKeys(call: PluginCall) {
        try {
            val prefs = getSecurePrefs()
            var privateKey = prefs.getString(KEY_CLIENT_PRIVATE, null)
            var publicKey = prefs.getString(KEY_CLIENT_PUBLIC, null)

            if (privateKey.isNullOrBlank() || publicKey.isNullOrBlank()) {
                val keyPair = KeyPair()
                privateKey = keyPair.privateKey.toBase64()
                publicKey = keyPair.publicKey.toBase64()

                prefs.edit()
                    .putString(KEY_CLIENT_PRIVATE, privateKey)
                    .putString(KEY_CLIENT_PUBLIC, publicKey)
                    .apply()
                Log.i(TAG, "Novo par de chaves Curve25519 gerado e protegido localmente.")
            }

            val res = JSObject().apply {
                put("publicKey", publicKey)
                put("hasPrivateKey", true)
            }
            call.resolve(res)
        } catch (e: Exception) {
            Log.e(TAG, "Erro ao gerenciar chaves do cliente: ${e.message}")
            call.reject("Erro no gerenciamento de chaves: ${e.message}")
        }
    }

    /**
     * Inicia o túnel WireGuard real com a configuração fornecida.
     * Verifica permissão de VpnService do Android antes de conectar.
     */
    @PluginMethod
    fun startVpn(call: PluginCall) {
        val configString = call.getString("configString")
        val killSwitch = call.getBoolean("killSwitch", false) ?: false
        this.killSwitchEnabled = killSwitch

        if (configString.isNullOrBlank()) {
            call.reject("Configuração WireGuard é obrigatória.")
            return
        }

        val b = backend
        if (b == null) {
            call.reject("GoBackend WireGuard não inicializado.")
            return
        }

        // Verifica se o Android requer o diálogo de permissão de VpnService
        val ctx = activity ?: context.applicationContext
        val prepareIntent = VpnService.prepare(ctx)
        if (prepareIntent != null) {
            Log.i(TAG, "Solicitando autorização do usuário via VpnService.prepare()")
            currentState = "CONNECTING"
            notifyStateChanged("CONNECTING")
            startActivityForResult(call, prepareIntent, "vpnPermissionCallback")
            return
        }

        // Permissão já concedida pelo sistema
        executeConnect(call, configString)
    }

    @ActivityCallback
    private fun vpnPermissionCallback(call: PluginCall, result: ActivityResult) {
        if (result.resultCode == Activity.RESULT_OK) {
            Log.i(TAG, "Permissão VpnService concedida pelo usuário.")
            val configString = call.getString("configString") ?: ""
            executeConnect(call, configString)
        } else {
            Log.w(TAG, "Permissão VpnService negada pelo usuário.")
            currentState = "ERROR"
            notifyStateChanged("ERROR", "Permissão de VPN não foi autorizada pelo usuário.")
            val res = JSObject().apply {
                put("success", false)
                put("isConnected", false)
                put("error", "PERMISSION_DENIED")
                put("message", "Permissão de VPN recusada no Android.")
            }
            call.resolve(res)
        }
    }

    private fun executeConnect(call: PluginCall, rawConfigString: String) {
        try {
            currentState = "CONNECTING"
            notifyStateChanged("CONNECTING")

            // Injeta a chave privada do cliente caso não esteja presente na string
            val finalConfigString = if (!rawConfigString.contains("PrivateKey = ")) {
                val prefs = getSecurePrefs()
                var privKey = prefs.getString(KEY_CLIENT_PRIVATE, null)
                if (privKey.isNullOrBlank()) {
                    val kp = KeyPair()
                    privKey = kp.privateKey.toBase64()
                    prefs.edit()
                        .putString(KEY_CLIENT_PRIVATE, privKey)
                        .putString(KEY_CLIENT_PUBLIC, kp.publicKey.toBase64())
                        .apply()
                }
                rawConfigString.replace("[Interface]", "[Interface]\nPrivateKey = $privKey")
            } else {
                rawConfigString
            }

            val parsedConfig = Config.parse(ByteArrayInputStream(finalConfigString.toByteArray(StandardCharsets.UTF_8)))
            val b = backend ?: throw IllegalStateException("Backend WireGuard indisponível")

            // Seta o estado para UP (cria interface tun real no Android)
            b.setState(tunnel, Tunnel.State.UP, parsedConfig)
            currentState = "CONNECTED"
            notifyStateChanged("CONNECTED")

            val res = JSObject().apply {
                put("success", true)
                put("isConnected", true)
                put("message", "Túnel WireGuard conectado com sucesso.")
            }
            Log.i(TAG, "Túnel WireGuard conectado.")
            call.resolve(res)
        } catch (e: Exception) {
            Log.e(TAG, "Erro ao conectar túnel WireGuard: ${e.message}", e)
            currentState = "ERROR"
            notifyStateChanged("ERROR", e.message)
            val res = JSObject().apply {
                put("success", false)
                put("isConnected", false)
                put("error", e.message)
            }
            call.resolve(res)
        }
    }

    /**
     * Encerra o túnel WireGuard ativo.
     */
    @PluginMethod
    fun stopVpn(call: PluginCall) {
        try {
            currentState = "DISCONNECTING"
            notifyStateChanged("DISCONNECTING")

            val b = backend
            if (b != null) {
                b.setState(tunnel, Tunnel.State.DOWN, null)
            }
            currentState = "DISCONNECTED"
            notifyStateChanged("DISCONNECTED")

            val res = JSObject().apply {
                put("success", true)
                put("isConnected", false)
                put("message", "Túnel WireGuard desconectado com sucesso.")
            }
            Log.i(TAG, "Túnel WireGuard desconectado.")
            call.resolve(res)
        } catch (e: Exception) {
            Log.e(TAG, "Erro ao desconectar túnel: ${e.message}", e)
            currentState = "ERROR"
            notifyStateChanged("ERROR", e.message)
            call.reject("Erro ao desconectar túnel: ${e.message}")
        }
    }

    /**
     * Consulta o estado real do túnel no Android.
     */
    @PluginMethod
    fun getVpnStatus(call: PluginCall) {
        try {
            val b = backend
            val state = if (b != null) b.getState(tunnel) else Tunnel.State.DOWN
            val isConn = state == Tunnel.State.UP
            currentState = if (isConn) "CONNECTED" else "DISCONNECTED"

            val res = JSObject().apply {
                put("isConnected", isConn)
                put("state", currentState)
            }
            call.resolve(res)
        } catch (e: Exception) {
            val res = JSObject().apply {
                put("isConnected", false)
                put("state", "DISCONNECTED")
            }
            call.resolve(res)
        }
    }

    /**
     * Obtém as estatísticas de tráfego reais do kernel/GoBackend.
     */
    @PluginMethod
    fun getTunnelStatistics(call: PluginCall) {
        try {
            val b = backend
            if (b != null && currentState == "CONNECTED") {
                val stats = b.getStatistics(tunnel)
                val rx = stats.totalRx()
                val tx = stats.totalTx()

                val res = JSObject().apply {
                    put("rxBytes", rx)
                    put("txBytes", tx)
                    put("state", currentState)
                }
                call.resolve(res)
            } else {
                val res = JSObject().apply {
                    put("rxBytes", 0)
                    put("txBytes", 0)
                    put("state", currentState)
                }
                call.resolve(res)
            }
        } catch (e: Exception) {
            val res = JSObject().apply {
                put("rxBytes", 0)
                put("txBytes", 0)
                put("state", currentState)
                put("error", e.message)
            }
            call.resolve(res)
        }
    }

    /**
     * Configura o Kill Switch.
     */
    @PluginMethod
    fun setKillSwitch(call: PluginCall) {
        this.killSwitchEnabled = call.getBoolean("enabled", false) ?: false
        val res = JSObject().apply {
            put("enabled", killSwitchEnabled)
        }
        call.resolve(res)
    }

    /**
     * Abre a tela nativa de configurações de VPN do Android
     * para que o usuário possa ativar o Always-On VPN e Bloquear Conexões sem VPN (Lockdown mode).
     */
    @PluginMethod
    fun openVpnSettings(call: PluginCall) {
        try {
            val intent = Intent(Settings.ACTION_VPN_SETTINGS).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK
            }
            context.startActivity(intent)
            call.resolve(JSObject().apply { put("success", true) })
        } catch (e: Exception) {
            Log.e(TAG, "Não foi possível abrir configurações de VPN do Android: ${e.message}")
            call.reject("Configurações de VPN não acessíveis")
        }
    }

    private fun notifyStateChanged(state: String, errorMessage: String? = null) {
        val eventData = JSObject().apply {
            put("state", state)
            put("isConnected", state == "CONNECTED")
            if (errorMessage != null) {
                put("errorMessage", errorMessage)
            }
        }
        notifyListeners("onVpnStateChanged", eventData)
    }

    override fun handleOnDestroy() {
        super.handleOnDestroy()
        try {
            val b = backend
            if (b != null) {
                b.setState(tunnel, Tunnel.State.DOWN, null)
                Log.i(TAG, "WireGuard backend desmontado e recursos liberados em handleOnDestroy.")
            }
        } catch (e: Exception) {
            Log.e(TAG, "Erro ao liberar recursos do WireGuard em handleOnDestroy: ${e.message}", e)
        }
    }
}
