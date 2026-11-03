# A ponte JavaScript precisa manter os métodos anotados.
-keepclassmembers class br.com.intruso.jogo.MainActivity$Bridge {
    @android.webkit.JavascriptInterface <methods>;
}
