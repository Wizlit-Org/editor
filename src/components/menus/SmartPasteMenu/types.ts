export type SmartPasteType = 'image_url' | 'youtube_url' | 'web_url' | 'code' | 'list'

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
  meta?: {
    videoId?: string
    url?: string
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
