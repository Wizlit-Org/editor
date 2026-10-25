export type SmartPasteType = 'image_url' | 'image_data' | 'youtube_url' | 'web_url' | 'code' | 'list'

export interface SmartPasteOption {
  id: string
  label: string
  description?: string
  icon: string
  action: () => void
}

export interface SmartPasteEventDetail {
  text: string
  type: SmartPasteType
  files?: File[]
  meta?: {
    videoId?: string
    url?: string
    mimeType?: string
  }
  coords: {
    top: number
    left: number
    bottom: number
  }
  selection: {
    from: number
    to: number
  }
}
