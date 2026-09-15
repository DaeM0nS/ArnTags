interface NDEFRecord {
  readonly recordType: string
  readonly mediaType: string | null
  readonly id: string | null
  readonly encoding: string | null
  readonly lang: string | null
  readonly data: DataView | null
}

interface NDEFMessage {
  readonly records: readonly NDEFRecord[]
}

interface NDEFReadingEvent extends Event {
  readonly serialNumber: string
  readonly message: NDEFMessage
}

type NDEFRecordDataSource = string | BufferSource | NDEFMessageInit

interface NDEFRecordInit {
  recordType: string
  mediaType?: string
  id?: string
  encoding?: string
  lang?: string
  data?: NDEFRecordDataSource
}

interface NDEFMessageInit {
  records: NDEFRecordInit[]
}

interface NDEFWriteOptions {
  overwrite?: boolean
  signal?: AbortSignal
}

interface NDEFReader extends EventTarget {
  onreading: ((event: NDEFReadingEvent) => void) | null
  onreadingerror: ((event: Event) => void) | null
  scan(options?: { signal?: AbortSignal }): Promise<void>
  write(
    message: string | BufferSource | NDEFMessageInit,
    options?: NDEFWriteOptions,
  ): Promise<void>
}

declare const NDEFReader: {
  prototype: NDEFReader
  new (): NDEFReader
}