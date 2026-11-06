import { ConvertSrc, OnImageClick } from '@/extensions/ImageBlock/components/ImageBlockView'
import { UploadListDialogProps } from '@/extensions/ImageUpload/components/UploadListDialog.tsx'

export interface EditorStats {
  characters?: number;
  words?: number;
  percentage?: number;
  embedCount?: number;
  embedList?: string[];
  plainText?: string;
}

export interface BlockEditorProps {
  key?: string // Unique key for multiple editor instances
  content?: string
  onChange?: (content: string, isChanged: { isChanged: boolean, isStrictChanged: boolean }, stats: EditorStats) => void
  className?: string
  readOnly?: boolean
  showDebug?: boolean | { altCharacterCounter?: boolean }
  theme?: 'light' | 'dark'
  themeColor?: string

  maxCharacters?: number // Maximum number of characters (default: 5000)
  altCharacterCounter?: boolean

  maxEmbeddings?: number // Maximum number of embeds (default: 3)
  image?: {
    maxSize?: number // Maximum file size in bytes (default: 5MB)
    disableBuiltInUploadDialog?: boolean
    convertSrc?: ConvertSrc
    onUploadImage?: (file: File) => Promise<string>
    imageProxyUrl?: (url: string) => string
    getUploadDialogProps?: (props: UploadListDialogProps) => void
    onClick?: OnImageClick
    onLoadingChange?: (hasUploading: boolean) => void
  }

  link?: {
    disableDefaultAction?: boolean | ((url: string) => boolean)
    onClick?: (url: string) => void
  }

  // 15종 확장 Props 인터페이스
  anchorOffset?: number // 헤더 앵커 점프 시 상단 오프셋 (기본값: 88)
  bottomMenuOffset?: number | string // 하단 플로팅 툴바 TextMenu bottom 오프셋 (기본값: 68)
  scrollContainerSelector?: string // 부모 스크롤러 DOM 셀렉터 (기본값: '.memo-scroll-surface, [class*="overflow-auto"]')
  scrollBehavior?: 'smooth' | 'auto' // 스크롤 애니메이션 방식 (기본값: 'smooth')
  highlightDuration?: number // 헤더 하이라이트 틴트 펄스 지속시간 ms (기본값: 1600)
  disableSlashCommand?: boolean // 슬래시(/) 커맨드 팝업 메뉴 비활성화 옵션 (기본값: false)
  showToc?: boolean // 목차 렌더링 활성 여부 (기본값: true)
  initialTocExpanded?: boolean // 인라인 TOC 초기 펼침/접힘 제어 (기본값: true)
  tocStickyOffset?: number | string // 스티키 TOC 바 top 오프셋 (기본값: 8)
  tocScrollSpy?: boolean // 본문 스크롤 URL Hash 실시간 동기화 온오프 (기본값: true)
  topScrollThreshold?: number // 최상단 도달 및 해시 소거 기준 scrollTop px (기본값: 60)
  autofocus?: boolean | 'start' | 'end' | 'all' | number // 초기 포커스 진입 제어 (기본값: true)
  placeholder?: string // 빈 문서 placeholder 안내 문구 (기본값: '')
  editorPaddingBottom?: string // 본문 최하단 여백 클래스 (기본값: 'pb-16')
  showTableScrollIndicator?: boolean // 표 좌우 스크롤 인디케이터 표시 여부 (기본값: true)
}
