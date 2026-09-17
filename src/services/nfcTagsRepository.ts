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
    .order('display_order', { ascending: true })
    .order('created_at', { ascending: true })

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

export async function markNfcTagAsWritten(id: string): Promise<NfcTag> {
  const { data, error } = await supabase
    .from(tableName)
    .update({ written_at: new Date().toISOString() })
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

export async function updateNfcTagsOrder(
  orderedTagIds: string[],
): Promise<void> {
  const updates = orderedTagIds.map((id, index) => ({
    id,
    display_order: index + 1,
  }))

  /*
   * On fait une requête par tag : c'est très simple et suffisamment fiable
   * pour une petite collection personnelle de tags.
   *
   * Les policies RLS empêchent un utilisateur de modifier les tags
   * d’un autre utilisateur.
   */
  const results = await Promise.all(
    updates.map(({ id, display_order }) =>
      supabase
        .from(tableName)
        .update({ display_order })
        .eq('id', id),
    ),
  )

  const failure = results.find((result) => result.error)

  if (failure?.error) {
    throw failure.error
  }
}