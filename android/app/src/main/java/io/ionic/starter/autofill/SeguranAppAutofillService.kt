package io.ionic.starter.autofill

import android.os.Build
import android.os.CancellationSignal
import android.service.autofill.AutofillService
import android.service.autofill.FillCallback
import android.service.autofill.FillRequest
import android.service.autofill.SaveCallback
import android.service.autofill.SaveRequest
import android.util.Log
import androidx.annotation.RequiresApi
import io.ionic.starter.plugins.AutofillPlugin

/**
 * Serviço Nativo de Preenchimento Automático (Autofill) do SeguranApp.
 * Executado pelo Android OS para identificar campos de login/senha e preenchê-los
 * sob demanda com base nas credenciais descriptografadas na camada React (Zero-Knowledge).
 */
@RequiresApi(Build.VERSION_CODES.O)
class SeguranAppAutofillService : AutofillService() {

    companion object {
        private const val TAG = "SeguranAppAutofill"
    }

    override fun onCreate() {
        super.onCreate()
        Log.d(TAG, "SeguranAppAutofillService criado pelo Android OS.")
    }

    /**
     * Invocado pelo Android quando o usuário toca em um campo de entrada (login/senha)
     * em um aplicativo ou navegador suportado.
     */
    override fun onFillRequest(
        request: FillRequest,
        cancellationSignal: CancellationSignal,
        callback: FillCallback
    ) {
        Log.d(TAG, "onFillRequest called - flags: ${request.flags}, id: ${request.id}")

        if (cancellationSignal.isCanceled) {
            Log.d(TAG, "FillRequest cancelado pelo sistema operacional.")
            return
        }

        // Extrai metadados da tela solicitante
        val fillContexts = request.fillContexts
        val latestStructure = fillContexts.lastOrNull()?.structure
        val packageName = latestStructure?.activityComponent?.packageName

        Log.d(TAG, "Solicitação de Autofill originada do pacote: $packageName")

        // Notifica a ponte Capacitor/React para buscar credenciais no cofre
        AutofillPlugin.dispatchAutofillRequest(
            appPackage = packageName,
            webDomain = null,
            focusedId = null
        )

        // Fase 1: Responde com resposta nula sem travar a interface do usuário
        // Na Fase 2, construiremos o FillResponse com RemoteViews e Datasets personalizados
        callback.onSuccess(null)
    }

    /**
     * Invocado pelo Android quando o usuário submete um formulário e o SO oferece salvar
     */
    override fun onSaveRequest(request: SaveRequest, callback: SaveCallback) {
        Log.d(TAG, "onSaveRequest called - solicitação de salvamento de credencial recebida.")
        // Fase 1: Reconhece a solicitação
        callback.onSuccess()
    }

    override fun onDestroy() {
        Log.d(TAG, "SeguranAppAutofillService destruído.")
        super.onDestroy()
    }
}
