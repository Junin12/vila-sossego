package br.com.vilasossego.ninguemdorme

import android.app.Activity
import com.android.billingclient.api.AcknowledgePurchaseParams
import com.android.billingclient.api.BillingClient
import com.android.billingclient.api.BillingClientStateListener
import com.android.billingclient.api.BillingFlowParams
import com.android.billingclient.api.BillingResult
import com.android.billingclient.api.ConsumeParams
import com.android.billingclient.api.PendingPurchasesParams
import com.android.billingclient.api.ProductDetails
import com.android.billingclient.api.Purchase
import com.android.billingclient.api.PurchasesUpdatedListener
import com.android.billingclient.api.QueryProductDetailsParams
import com.android.billingclient.api.QueryPurchasesParams
import org.json.JSONArray
import org.json.JSONObject

/**
 * Compras no Google Play (cadastre todos no Play Console como "produto único"):
 *  - remove_ads, avatar_pack, vila_completa: ficam para sempre (acknowledge).
 *  - passe_noite: consumível (24h de tudo liberado; dá para comprar de novo em outra noite). É consumido logo depois da compra.
 */
class BillingManager(private val act: Activity, private val emit: (JSONObject) -> Unit) : PurchasesUpdatedListener {
    companion object {
        val IDS = listOf("remove_ads", "avatar_pack", "vila_completa", "passe_noite")
        val CONSUMIVEIS = setOf("passe_noite")
    }

    private val client: BillingClient = BillingClient.newBuilder(act)
        .setListener(this)
        .enablePendingPurchases(PendingPurchasesParams.newBuilder().enableOneTimeProducts().build())
        .build()
    private var details: Map<String, ProductDetails> = emptyMap()

    fun start() {
        if (client.isReady) { loadAll(); return }
        client.startConnection(object : BillingClientStateListener {
            override fun onBillingSetupFinished(r: BillingResult) { if (r.responseCode == BillingClient.BillingResponseCode.OK) loadAll() }
            override fun onBillingServiceDisconnected() { }
        })
    }

    /** Ao voltar para o app: confere de novo o que a pessoa já comprou (ex.: compra pendente concluída). */
    fun refresh() { if (client.isReady) queryOwned() }
    fun close() { client.endConnection() }

    private fun loadAll() { queryDetails(); queryOwned() }

    private fun queryDetails() {
        val products = IDS.map {
            QueryProductDetailsParams.Product.newBuilder().setProductId(it).setProductType(BillingClient.ProductType.INAPP).build()
        }
        client.queryProductDetailsAsync(QueryProductDetailsParams.newBuilder().setProductList(products).build()) { _, result ->
            details = result.productDetailsList.associateBy { it.productId }
            val prices = JSONObject()
            details.forEach { (id, d) -> d.oneTimePurchaseOfferDetails?.let { prices.put(id, it.formattedPrice) } }
            emit(JSONObject().put("type", "prices").put("prices", prices))
        }
    }

    private fun queryOwned() {
        client.queryPurchasesAsync(QueryPurchasesParams.newBuilder().setProductType(BillingClient.ProductType.INAPP).build()) { r, list ->
            if (r.responseCode == BillingClient.BillingResponseCode.OK) {
                val ids = handle(list)
                emit(JSONObject().put("type", "owned").put("ids", JSONArray(ids)))
            }
        }
    }

    /**
     * Confirma (acknowledge) as compras concluídas — sem isso o Google estorna em 3 dias — e devolve os ids que ficam.
     * Consumível (passe_noite): consome e avisa o jogo ("purchased"), inclusive se o app fechou antes de consumir.
     */
    private fun handle(purchases: List<Purchase>): List<String> {
        val owned = mutableListOf<String>()
        for (p in purchases) {
            if (p.purchaseState != Purchase.PurchaseState.PURCHASED) continue
            val consumivel = p.products.any { it in CONSUMIVEIS }
            if (consumivel) {
                client.consumeAsync(ConsumeParams.newBuilder().setPurchaseToken(p.purchaseToken).build()) { r, _ ->
                    if (r.responseCode == BillingClient.BillingResponseCode.OK) {
                        p.products.filter { it in CONSUMIVEIS }.forEach { emit(JSONObject().put("type", "purchased").put("id", it)) }
                    }
                }
                continue
            }
            if (!p.isAcknowledged) {
                client.acknowledgePurchase(AcknowledgePurchaseParams.newBuilder().setPurchaseToken(p.purchaseToken).build()) { }
            }
            owned += p.products.filter { it in IDS }
        }
        return owned
    }

    fun buy(id: String) {
        val d = details[id] ?: return
        val params = BillingFlowParams.newBuilder()
            .setProductDetailsParamsList(listOf(BillingFlowParams.ProductDetailsParams.newBuilder().setProductDetails(d).build()))
            .build()
        client.launchBillingFlow(act, params)
    }

    override fun onPurchasesUpdated(r: BillingResult, purchases: MutableList<Purchase>?) {
        if (r.responseCode == BillingClient.BillingResponseCode.OK && purchases != null) {
            handle(purchases).forEach { emit(JSONObject().put("type", "purchased").put("id", it)) }
        } else if (r.responseCode != BillingClient.BillingResponseCode.USER_CANCELED) {
            emit(JSONObject().put("type", "error"))
        }
    }
}
