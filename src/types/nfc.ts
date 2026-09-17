export type NdefRecordType =
  | 'text'
  | 'url'
  | 'mime'
  | 'absolute-url'
  | 'smart-poster'
  | 'empty'
  | 'unknown'

/*
 * Record normalisé pour l’interface et la base.
 * Les champs native* permettent un aller-retour fiable entre lecture native
 * et écriture native : ils sont prioritaires lors de la réécriture.
 */
export type NdefRecord = {
  recordType: NdefRecordType | string
  mediaType: string | null
  id: string | null
  encoding: string | null
  language: string | null
  text: string | null
  uri: string | null
  dataBase64: string | null
  dataText: string | null

  nativeTnf: number | null
  nativeType: number[] | null
  nativeId: number[] | null
  nativePayload: number[] | null
}

export type ScannedNfcTag = {
  uid: string | null
  type: string | null
  capacity: number | null
  isWritable: boolean | null
  records: NdefRecord[]
  rawNdef: Record<string, unknown> | null
  ndefFormat: 'native' | 'web' | 'unknown'
}

export type NfcTag = {
  id: string
  user_id: string
  name: string
  tag_uid: string | null
  tag_type: string | null
  capacity: number | null
  is_writable: boolean | null
  records: NdefRecord[]
  raw_ndef: Record<string, unknown> | null
  source: string
  display_order: number
  is_favorite: boolean
  ndef_format?: 'native' | 'web' | 'unknown'
  written_at?: string | null
  created_at: string
  updated_at: string
}

export type NfcTagInsert = {
  user_id: string
  name: string
  tag_uid: string | null
  tag_type: string | null
  capacity: number | null
  is_writable: boolean | null
  records: NdefRecord[]
  raw_ndef: Record<string, unknown> | null
  source: string
  display_order?: number
  is_favorite?: boolean
  ndef_format?: 'native' | 'web' | 'unknown'
}