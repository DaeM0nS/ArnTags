import { Capacitor, registerPlugin } from '@capacitor/core'

const NativeNfc = registerPlugin('Nfc', {
  web: () => import('./nfc-web.js').then((m) => new m.NfcWeb()),
})

const decoder = new TextDecoder()
const encoder = new TextEncoder()

function bytesToBase64(bytes) {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

function base64ToBytes(value) {
  const binary = atob(value)
  return Uint8Array.from(binary, (char) => char.charCodeAt(0))
}

function normaliseRecord(record) {
  const data = record?.data instanceof Uint8Array
    ? record.data
    : record?.data?.buffer
      ? new Uint8Array(record.data.buffer)
      : typeof record?.data === 'string'
        ? encoder.encode(record.data)
        : new Uint8Array()

  return {
    recordType: record?.recordType || record?.type || 'unknown',
    mediaType: record?.mediaType || record?.mimeType || null,
    id: record?.id || null,
    encoding: record?.encoding || null,
    lang: record?.lang || null,
    text: record?.text || null,
    uri: record?.uri || null,
    dataBase64: bytesToBase64(data),
    dataText: record?.text || record?.uri || (data.length ? decoder.decode(data) : ''),
  }
}

function normaliseTag(event) {
  const tag = event?.nfcTag || event?.tag || event || {}
  const records = tag.records || tag.ndefMessage || tag.ndefRecords || []
  return {
    uid: tag.id || tag.uid || null,
    type: tag.type || tag.techType || null,
    capacity: tag.capacity || tag.maxSize || null,
    isWritable: tag.isWritable ?? tag.writable ?? null,
    records: Array.from(records, normaliseRecord),
    raw: tag,
  }
}

export async function readTag(onProgress) {
  if (Capacitor.isNativePlatform()) {
    return new Promise(async (resolve, reject) => {
      let scanListener
      let errorListener
      try {
        scanListener = await NativeNfc.addListener('nfcTagScanned', async (event) => {
          const tag = normaliseTag(event)
          await NativeNfc.stopScanSession?.()
          await scanListener?.remove()
          await errorListener?.remove()
          resolve(tag)
        })
        errorListener = await NativeNfc.addListener('nfcError', async (event) => {
          await scanListener?.remove()
          await errorListener?.remove()
          reject(new Error(event?.message || 'Erreur NFC'))
        })
        await NativeNfc.startScanSession?.()
        onProgress?.('Approchez le tag du téléphone…')
      } catch (error) {
        await scanListener?.remove()
        await errorListener?.remove()
        reject(error)
      }
    })
  }

  if (!('NDEFReader' in window)) {
    throw new Error('NFC indisponible : utilisez l’application native Android/iOS ou Chrome Android en HTTPS.')
  }

  const reader = new window.NDEFReader()
  await reader.scan()
  onProgress?.('Approchez le tag du téléphone…')

  return new Promise((resolve, reject) => {
    reader.onreadingerror = () => reject(new Error('Le tag NFC n’a pas pu être lu.'))
    reader.onreading = (event) => {
      const records = Array.from(event.message.records || [], (record) => {
        let data = new Uint8Array()
        try { data = record.data ? new Uint8Array(record.data.buffer) : new Uint8Array() } catch {}
        return normaliseRecord({
          recordType: record.recordType,
          mediaType: record.mediaType,
          id: record.id,
          data,
        })
      })
      resolve({ uid: event.serialNumber || null, type: null, capacity: null, isWritable: null, records, raw: null })
    }
  })
}

function recordToNative(record) {
  return {
    recordType: record.recordType,
    mediaType: record.mediaType || undefined,
    id: record.id || undefined,
    data: record.dataBase64 ? Array.from(base64ToBytes(record.dataBase64)) : record.dataText || '',
  }
}

export async function writeTag(tag, onProgress) {
  if (!tag?.records?.length) throw new Error('Ce tag ne contient aucun enregistrement NDEF.')

  onProgress?.('Approchez le tag réinscriptible…')

  if (Capacitor.isNativePlatform()) {
    return NativeNfc.write({ records: tag.records.map(recordToNative) })
  }

  if (!('NDEFReader' in window)) {
    throw new Error('Écriture NFC indisponible dans ce navigateur. Utilisez l’application native.')
  }

  const writer = new window.NDEFReader()
  await writer.write({ records: tag.records.map((record) => ({
    recordType: record.recordType === 'unknown' ? 'mime' : record.recordType,
    mediaType: record.mediaType || undefined,
    id: record.id || undefined,
    data: record.dataBase64 ? base64ToBytes(record.dataBase64) : record.dataText || '',
  })) })
}