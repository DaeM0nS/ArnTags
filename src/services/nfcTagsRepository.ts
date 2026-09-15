import { supabase } from '../supabaseClient'
import type { NfcTag, NfcTagInsert } from '../types/nfc'

const tableName = 'nfc_tags'

function asNfcTag(value: unknown): NfcTag {
  return value as NfcTag
}

export async function getNfcTags(): Promise<NfcTag[]> {
  const { data, error } = await supabase
    .from(tableName)
    .select('*')
    .order('updated_at', { ascending: false })

  if (error) throw error

  return (data ?? []).map(asNfcTag)
}

export async function createNfcTag(payload: NfcTagInsert): Promise<NfcTag> {
  const { data, error } = await supabase
    .from(tableName)
    .insert(payload)
    .select('*')
    .single()

  if (error) throw error

  return asNfcTag(data)
}

export async function updateNfcTagName(id: string, name: string): Promise<NfcTag> {
  const { data, error } = await supabase
    .from(tableName)
    .update({ name })
    .eq('id', id)
    .select('*')
    .single()

  if (error) throw error

  return asNfcTag(data)
}

export async function deleteNfcTag(id: string): Promise<void> {
  const { error } = await supabase.from(tableName).delete().eq('id', id)

  if (error) throw error
}