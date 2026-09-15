import { Capacitor, registerPlugin } from '@capacitor/core'

import type { NdefRecord, ScannedNfcTag } from '../types/nfc'

type NativeNfcPlugin = {
  startScanSession?: () => Promise<void>
  stopScanSession?: () => Promise<void>
  write?: (options: { records: unknown[] }) => Promise<void>
  addListener: (
    eventName: 'nfcTagScanned' | 'nfcError',
    listenerFunc: (event: unknown) => void,
  ) => Promise<{ remove: () => Promise<void> }>
}

const NativeNfc = registerPlugin<NativeNfcPlugin>('Nfc')

const textDecoder = new TextDecoder()
const textEncoder = new TextEncoder()

function toBase64(bytes: Uint8Array): string {
  let binary = ''

  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }

  return window.btoa(binary)
}

function fromBase64(value: string): Uint8Array {
  const binary = window.atob(value)
  return Uint8Array.from(binary, (character) => character.charCodeAt(0))
}

function readPossibleBytes(value: unknown): Uint8Array {
  if (value instanceof Uint8Array) return value
  if (value instanceof ArrayBuffer) return new Uint8Array(value)
  if (Array.isArray(value)) return new Uint8Array(value)

  if (value && typeof value === 'object' && 'buffer' in value) {
    const buffer = (value as { buffer?: unknown }).buffer
    if (buffer instanceof ArrayBuffer) return new Uint8Array(buffer)
  }

  if (typeof value === 'string') return textEncoder.encode(value)

  return new Uint8Array()
}

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null
}

function normaliseRecord(value: unknown): NdefRecord {
  const record = (value ?? {}) as Record<string, unknown>
  const bytes = readPossibleBytes(record.data)
  const text = readString(record.text)
  const uri = readString(record.uri)

  let dataText: string | null = text ?? uri

  if (!dataText && bytes.byteLength > 0) {
    try {
      dataText = textDecoder.decode(bytes)
    } catch {
      dataText = null
    }
  }

  return {
    recordType: readString(record.recordType) ?? readString(record.type) ?? 'unknown',
    mediaType: readString(record.mediaType) ?? readString(record.mimeType),
    id: readString(record.id),
    encoding: readString(record.encoding),
    language: readString(record.lang) ?? readString(record.language),
    text,
    uri,
    dataBase64: bytes.byteLength > 0 ? toBase64(bytes) : null,
    dataText,
  }
}

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? value as Record<string, unknown> : {}
}

function normaliseNativeTag(value: unknown): ScannedNfcTag {
  const event = asObject(value)
  const tag = asObject(event.nfcTag ?? event.tag ?? value)
  const unknownRecords = tag.records ?? tag.ndefMessage ?? tag.ndefRecords ?? []
  const records = Array.isArray(unknownRecords)
    ? unknownRecords.map(normaliseRecord)
    : []

  const capacityValue = tag.capacity ?? tag.maxSize
  const capacity = typeof capacityValue === 'number' ? capacityValue : null
  const writable = tag.isWritable ?? tag.writable

  return {
    uid: readString(tag.id) ?? readString(tag.uid),
    type: readString(tag.type) ?? readString(tag.techType),
    capacity,
    isWritable: typeof writable === 'boolean' ? writable : null,
    records,
    rawNdef: tag,
  }
}

function normaliseWebRecord(record: NDEFRecord): NdefRecord {
  const data = record.data ? new Uint8Array(record.data.buffer) : new Uint8Array()

  return normaliseRecord({
    recordType: record.recordType,
    mediaType: record.mediaType,
    id: record.id,
    data,
  })
}

function nativeRecordFromRecord(record: NdefRecord): Record<string, unknown> {
  return {
    recordType: record.recordType,
    mediaType: record.mediaType ?? undefined,
    id: record.id ?? undefined,
    data: record.dataBase64
      ? Array.from(fromBase64(record.dataBase64))
      : record.dataText ?? record.text ?? record.uri ?? '',
  }
}

function toWebNfcBufferSource(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength)
  copy.set(bytes)

  return copy.buffer
}

function webRecordFromRecord(record: NdefRecord): NDEFRecordInit {
  if (record.recordType === 'text') {
    return {
      recordType: 'text',
      data: record.text ?? record.dataText ?? '',
      id: record.id ?? undefined,
      lang: record.language ?? undefined,
      encoding: record.encoding ?? undefined,
    }
  }

  if (record.recordType === 'url' || record.recordType === 'absolute-url') {
    return {
      recordType: record.recordType,
      data: record.uri ?? record.dataText ?? '',
      id: record.id ?? undefined,
    }
  }

  const data: string | ArrayBuffer = record.dataBase64
    ? toWebNfcBufferSource(fromBase64(record.dataBase64))
    : record.dataText ?? record.text ?? record.uri ?? ''

  return {
    recordType: record.recordType === 'unknown' ? 'mime' : record.recordType,
    mediaType: record.mediaType ?? 'application/octet-stream',
    id: record.id ?? undefined,
    data,
  }
}

export function isNfcAvailable(): boolean {
  return Capacitor.isNativePlatform() || 'NDEFReader' in window
}

export async function scanNfcTag(onProgress?: (message: string) => void): Promise<ScannedNfcTag> {
  if (Capacitor.isNativePlatform()) {
    return new Promise(async (resolve, reject) => {
      let scannedListener: { remove: () => Promise<void> } | undefined
      let errorListener: { remove: () => Promise<void> } | undefined

      const cleanup = async (): Promise<void> => {
        await NativeNfc.stopScanSession?.().catch(() => undefined)
        await scannedListener?.remove().catch(() => undefined)
        await errorListener?.remove().catch(() => undefined)
      }

      try {
        scannedListener = await NativeNfc.addListener('nfcTagScanned', (event) => {
          void cleanup().then(() => resolve(normaliseNativeTag(event)))
        })

        errorListener = await NativeNfc.addListener('nfcError', (event) => {
          const message = asObject(event).message
          void cleanup().then(() => reject(new Error(readString(message) ?? 'Erreur NFC.')))
        })

        onProgress?.('Approche le tag NFC du téléphone…')
        await NativeNfc.startScanSession?.()
      } catch (error) {
        await cleanup()
        reject(error)
      }
    })
  }

  if (!('NDEFReader' in window)) {
    throw new Error('NFC indisponible. Utilise l’application Android/iOS ou Chrome Android avec HTTPS.')
  }

  const reader = new NDEFReader()
  await reader.scan()
  onProgress?.('Approche le tag NFC du téléphone…')

  return new Promise((resolve, reject) => {
    reader.onreadingerror = () => {
      reject(new Error('Le tag NFC n’a pas pu être lu.'))
    }

    reader.onreading = (event) => {
      resolve({
        uid: event.serialNumber || null,
        type: 'NDEF',
        capacity: null,
        isWritable: null,
        records: Array.from(event.message.records, normaliseWebRecord),
        rawNdef: null,
      })
    }
  })
}

export async function writeNfcTag(
  records: NdefRecord[],
  onProgress?: (message: string) => void,
): Promise<void> {
  if (records.length === 0) {
    throw new Error('Ce tag sauvegardé ne contient aucun enregistrement NDEF à écrire.')
  }

  onProgress?.('Approche un tag NFC réinscriptible…')

  if (Capacitor.isNativePlatform()) {
    await NativeNfc.write?.({
      records: records.map(nativeRecordFromRecord),
    })
    return
  }

  if (!('NDEFReader' in window)) {
    throw new Error('Écriture NFC indisponible dans ce navigateur. Utilise l’application native.')
  }

  const writer = new NDEFReader()
  await writer.write({
    records: records.map(webRecordFromRecord),
  })
}