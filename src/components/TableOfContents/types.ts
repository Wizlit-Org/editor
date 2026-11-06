import { Editor } from '@tiptap/react'

export interface TableOfContentsProps {
  editor: Editor
  className?: string
  anchorOffset?: number // 기본값 88
  scrollContainerSelector?: string // 기본값 '.memo-scroll-surface, [class*="overflow-auto"]'
  scrollBehavior?: 'smooth' | 'auto' // 기본값 'smooth'
  highlightDuration?: number // 기본값 1600
  initialExpanded?: boolean // 기본값 true
  stickyOffset?: number | string // 기본값 8
  scrollSpy?: boolean // 기본값 true
  topScrollThreshold?: number // 기본값 60
}

export interface HeadingItem {
  id: string
  level: number
  text: string
  pos: number
}
