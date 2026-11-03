package br.com.vilasossego.ninguemdorme

import android.app.Activity
import com.google.android.gms.ads.AdError
import com.google.android.gms.ads.AdRequest
import com.google.android.gms.ads.FullScreenContentCallback
import com.google.android.gms.ads.LoadAdError
import com.google.android.gms.ads.MobileAds
import com.google.android.gms.ads.interstitial.InterstitialAd
import com.google.android.gms.ads.interstitial.InterstitialAdLoadCallback
import com.google.android.gms.ads.rewarded.RewardedAd
import com.google.android.gms.ads.rewarded.RewardedAdLoadCallback
import org.json.JSONObject

/** Anúncios do AdMob: intersticial entre partidas e com recompensa (+XP). Sempre pré-carregados. */
class AdsManager(private val act: Activity, private val emit: (JSONObject) -> Unit) {
    private var inter: InterstitialAd? = null
    private var rewarded: RewardedAd? = null
    private var started = false

    fun init() {
        if (started) return
        started = true
        MobileAds.initialize(act) { }
        loadInterstitial()
        loadRewarded()
    }

    private fun loadInterstitial() {
        InterstitialAd.load(act, BuildConfig.INTERSTITIAL_ID, AdRequest.Builder().build(), object : InterstitialAdLoadCallback() {
            override fun onAdLoaded(ad: InterstitialAd) { inter = ad }
            override fun onAdFailedToLoad(e: LoadAdError) { inter = null }
        })
    }

    private fun loadRewarded() {
        RewardedAd.load(act, BuildConfig.REWARDED_ID, AdRequest.Builder().build(), object : RewardedAdLoadCallback() {
            override fun onAdLoaded(ad: RewardedAd) { rewarded = ad }
            override fun onAdFailedToLoad(e: LoadAdError) { rewarded = null }
        })
    }

    fun showInterstitial() {
        val ad = inter ?: run { loadInterstitial(); return }   // sem anúncio pronto: simplesmente não mostra
        inter = null
        ad.fullScreenContentCallback = object : FullScreenContentCallback() {
            override fun onAdDismissedFullScreenContent() { loadInterstitial() }
            override fun onAdFailedToShowFullScreenContent(e: AdError) { loadInterstitial() }
        }
        ad.show(act)
    }

    fun showRewarded() {
        val ad = rewarded ?: run {
            loadRewarded()
            emit(JSONObject().put("type", "reward").put("ok", false))
            return
        }
        rewarded = null
        var earned = false
        ad.fullScreenContentCallback = object : FullScreenContentCallback() {
            override fun onAdDismissedFullScreenContent() {
                emit(JSONObject().put("type", "reward").put("ok", earned))
                loadRewarded()
            }
            override fun onAdFailedToShowFullScreenContent(e: AdError) {
                emit(JSONObject().put("type", "reward").put("ok", false))
                loadRewarded()
            }
        }
        ad.show(act) { earned = true }
    }
}
