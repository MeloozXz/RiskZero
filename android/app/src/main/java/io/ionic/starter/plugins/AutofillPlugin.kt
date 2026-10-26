package io.ionic.starter.plugins

import android.util.Log
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin

/**
 * Plugin Capacitor para ponte de comunicação bidirecional com o AutofillService nativo do Android.
 * Permite que a camada React envie credenciais temporárias descriptografadas (Zero-Knowledge)
 * e receba eventos quando o sistema operacional requisitar preenchimento automático.
 */
@CapacitorPlugin(name = "Autofill")
class AutofillPlugin : Plugin() {

    data class CachedCredentials(
        val username: String?,
        val password: String?,
        val timestamp: Long = System.currentTimeMillis()
    )

    override fun load() {
        super.load()
        registerInstance(this)
        Log.d(TAG, "AutofillPlugin inicializado e registrado.")
    }

    override fun handleOnDestroy() {
        unregisterInstance(this)
        clearTemporaryCredentials()
        super.handleOnDestroy()
    }

    /**
     * Permite à camada React disparar ou testar o evento de solicitação de autofill
     */
    @PluginMethod
    fun notifyAutofillRequest(call: PluginCall) {
        val requestId = call.getString("requestId") ?: "manual_${System.currentTimeMillis()}"
        Log.d(TAG, "notifyAutofillRequest acionado (requestId: $requestId)")

        val data = JSObject().apply {
            put("requestId", requestId)
            put("timestamp", System.currentTimeMillis().toString())
        }

        notifyListeners("onAutofillRequested", data)

        val result = JSObject().apply {
            put("success", true)
            put("requestId", requestId)
        }
        call.resolve(result)
    }

    /**
     * Recebe credenciais descriptografadas do React em memória volátil temporária.
     * Segue a diretriz Zero-Knowledge: não grava em disco nem em logs sensíveis.
     */
    @PluginMethod
    fun provideCredentials(call: PluginCall) {
        val username = call.getString("username")
        val password = call.getString("password")

        if (username.isNullOrBlank() && password.isNullOrBlank()) {
            call.reject("Credenciais inválidas: username e password estão em branco.")
            return
        }

        setTemporaryCredentials(username, password)
        Log.d(TAG, "Credenciais voláteis recebidas com sucesso do React.")

        val result = JSObject().apply {
            put("success", true)
        }
        call.resolve(result)
    }

    companion object {
        private const val TAG = "AutofillPlugin"

        @Volatile
        private var activeInstance: AutofillPlugin? = null

        @Volatile
        private var cachedCredentials: CachedCredentials? = null

        fun registerInstance(plugin: AutofillPlugin) {
            activeInstance = plugin
        }

        fun unregisterInstance(plugin: AutofillPlugin) {
            if (activeInstance === plugin) {
                activeInstance = null
            }
        }

        /**
         * Dispara o evento 'onAutofillRequested' para os ouvintes registrados na camada React
         */
        fun dispatchAutofillRequest(
            appPackage: String?,
            webDomain: String?,
            focusedId: String?
        ) {
            val instance = activeInstance
            if (instance == null) {
                Log.w(TAG, "Nenhuma instância ativa do AutofillPlugin registrada para receber o evento.")
                return
            }

            Log.d(TAG, "Despachando evento onAutofillRequested para o React (package: $appPackage)")

            val data = JSObject().apply {
                put("appPackage", appPackage ?: "")
                put("webDomain", webDomain ?: "")
                put("focusedId", focusedId ?: "")
                put("timestamp", System.currentTimeMillis().toString())
            }

            instance.notifyListeners("onAutofillRequested", data)
        }

        /**
         * Armazena credenciais em memória volátil
         */
        fun setTemporaryCredentials(username: String?, password: String?) {
            cachedCredentials = CachedCredentials(username, password)
        }

        /**
         * Recupera e descarta as credenciais temporárias (auto-consumo único para segurança)
         */
        fun getAndClearTemporaryCredentials(): CachedCredentials? {
            val creds = cachedCredentials
            cachedCredentials = null
            return creds
        }

        /**
         * Limpa credenciais da memória
         */
        fun clearTemporaryCredentials() {
            cachedCredentials = null
        }
    }
}
