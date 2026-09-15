export type NdefRecordType =
  | 'text'
  | 'url'
  | 'mime'
  | 'absolute-url'
  | 'smart-poster'
  | 'empty'
  | 'unknown'

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
}

export type ScannedNfcTag = {
  uid: string | null
  type: string | null
  capacity: number | null
  isWritable: boolean | null
  records: NdefRecord[]
  rawNdef: Record<string, unknown> | null
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
}