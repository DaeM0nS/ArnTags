package fr.pixelmon_france.daem0ns.arntags;

import android.content.Intent;
import android.nfc.NfcAdapter;
import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        consumeNfcIntent(getIntent());
    }

    @Override
    public void onNewIntent(Intent intent) {
        super.onNewIntent(intent);

        consumeNfcIntent(intent);
    }

    private void consumeNfcIntent(Intent intent) {
        if (intent == null) {
            return;
        }

        String action = intent.getAction();

        if (
            NfcAdapter.ACTION_NDEF_DISCOVERED.equals(action)
                || NfcAdapter.ACTION_TAG_DISCOVERED.equals(action)
                || NfcAdapter.ACTION_TECH_DISCOVERED.equals(action)
        ) {
            /*
             * Empêche l'intent NFC URL de déclencher une navigation extérieure.
             * Le plugin Capacitor NFC reçoit toujours la session de lecture
             * via son propre mécanisme de scan.
             */
            intent.setAction(null);
            intent.setData(null);
        }
    }
}