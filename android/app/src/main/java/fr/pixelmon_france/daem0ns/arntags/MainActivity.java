package fr.pixelmon_france.daem0ns.arntags;

import android.nfc.NfcAdapter;
import android.nfc.Tag;
import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    private NfcAdapter nfcAdapter;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        nfcAdapter = NfcAdapter.getDefaultAdapter(this);
    }

    @Override
    protected void onResume() {
        super.onResume();

        if (nfcAdapter == null) {
            return;
        }

        /*
         * Reader Mode donne la priorité à cette Activity quand elle est
         * affichée. Android ne traite donc pas une URL NDEF comme un lien
         * à ouvrir dans le navigateur pendant que arntags est au premier plan.
         *
         * Le plugin @capgo/capacitor-nfc reste responsable de l’envoi des
         * événements `tagDiscovered` / `ndefDiscovered` vers TypeScript.
         */
        nfcAdapter.enableReaderMode(
            this,
            new NfcAdapter.ReaderCallback() {
                @Override
                public void onTagDiscovered(Tag tag) {
                    /*
                     * Ne rien lire ni écrire ici.
                     * Le plugin Capacitor est censé gérer les tags et transmettre
                     * les événements au frontend.
                     *
                     * Ce callback sert uniquement à empêcher Android de dispatcher
                     * automatiquement les tags URL vers le navigateur.
                     */
                }
            },
            NfcAdapter.FLAG_READER_NFC_A
                | NfcAdapter.FLAG_READER_NFC_B
                | NfcAdapter.FLAG_READER_NFC_F
                | NfcAdapter.FLAG_READER_NFC_V,
            null
        );
    }

    @Override
    protected void onPause() {
        if (nfcAdapter != null) {
            nfcAdapter.disableReaderMode(this);
        }

        super.onPause();
    }
}
