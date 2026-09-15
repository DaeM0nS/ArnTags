import type { JSX } from "react/jsx-runtime"

type NfcScanOverlayProps = {
  message: string
}

export default function NfcScanOverlay({ message }: NfcScanOverlayProps): JSX.Element {
  return (
    <div className="nfc-scan-overlay" role="status" aria-live="polite">
      <div className="nfc-scan-overlay__pulse" aria-hidden="true">
        ⌁
      </div>
      <h2>Lecture NFC</h2>
      <p>{message}</p>
      <span className="nfc-scan-overlay__line" aria-hidden="true" />
    </div>
  )
}