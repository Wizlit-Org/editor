import React from 'react'
import { Icon } from '@/components/ui/Icon'
import { PasteOptionItem } from './types'

export interface PastePreviewHeaderProps {
  isVisible: boolean
  isExiting: boolean
  animTiming: string
  isDark: boolean
  descAnim: boolean
  description: string
  options: PasteOptionItem[]
  selectedId: string
  onSelectOption: (id: string) => void
}

export const PastePreviewHeader: React.FC<PastePreviewHeaderProps> = ({
  isVisible,
  isExiting,
  animTiming,
  isDark,
  descAnim,
  description,
  options,
  selectedId,
  onSelectOption,
}) => {
  return (
    <div
      onClick={e => e.stopPropagation()}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        gap: '12px',
        flexShrink: 0,
        maxWidth: '94vw',
        opacity: isVisible ? 1 : 0,
        transform: isVisible
          ? 'translateY(0px) scale(1)'
          : isExiting
            ? 'translateY(6px) scale(0.96)'
            : 'translateY(-10px) scale(0.96)',
        transition: `opacity ${animTiming}, transform ${animTiming}`,
      }}
    >
      {/* 1단: 상단 위 제목 및 선택된 삽입 방식 1줄 설명 */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px' }}>
        <span
          style={{
            fontSize: '19px',
            fontWeight: 700,
            letterSpacing: '-0.02em',
            lineHeight: 1.2,
            color: isDark ? '#fafafa' : '#0f172a',
            textShadow: isDark ? '0 2px 10px rgba(0,0,0,0.45)' : '0 1px 2px rgba(255,255,255,0.8)',
          }}
        >
          붙여넣기 형식 선택
        </span>
        <p
          style={{
            margin: 0,
            fontSize: '13px',
            fontWeight: 500,
            lineHeight: 1.4,
            color: isDark ? 'rgba(228, 228, 231, 0.85)' : 'rgba(51, 65, 85, 0.88)',
            opacity: descAnim ? 1 : 0,
            transform: descAnim ? 'translateY(0px)' : 'translateY(3px)',
            transition: descAnim ? 'opacity 200ms ease-out, transform 200ms ease-out' : 'none',
          }}
        >
          {description}
        </p>
      </div>

      {/* 2단: 제목 바로 밑 선택지 플로팅 글라스모피즘 캡슐 독 */}
      <div
        role="tablist"
        aria-label="삽입 방식 선택"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '5px',
          padding: '6px',
          borderRadius: '18px',
          maxWidth: '92vw',
          overflowX: 'auto',
          backgroundColor: isDark ? 'rgba(24, 24, 27, 0.52)' : 'rgba(255, 255, 255, 0.56)',
          backgroundImage: isDark
            ? 'linear-gradient(135deg, rgba(39, 39, 42, 0.62) 0%, rgba(24, 24, 27, 0.44) 100%)'
            : 'linear-gradient(135deg, rgba(255, 255, 255, 0.72) 0%, rgba(241, 245, 249, 0.48) 100%)',
          backdropFilter: 'blur(22px) saturate(190%)',
          WebkitBackdropFilter: 'blur(22px) saturate(190%)',
          border: isDark ? '1px solid rgba(255, 255, 255, 0.16)' : '1px solid rgba(255, 255, 255, 0.88)',
          boxShadow: isDark
            ? '0 14px 34px -6px rgba(0, 0, 0, 0.55), 0 0 0 1px rgba(0, 0, 0, 0.3), inset 0 1px 0 0 rgba(255, 255, 255, 0.16)'
            : '0 12px 30px -6px rgba(15, 23, 42, 0.12), 0 0 0 1px rgba(148, 163, 184, 0.22), inset 0 1px 0 0 rgba(255, 255, 255, 0.95)',
        }}
      >
        {options.map(opt => {
          const isSelected = opt.id === selectedId
          return (
            <button
              key={opt.id}
              role="tab"
              aria-selected={isSelected}
              type="button"
              onClick={() => onSelectOption(opt.id)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                lineHeight: 1,
                height: '34px',
                padding: '0 15px',
                borderRadius: '12px',
                fontSize: '12.5px',
                fontWeight: 600,
                cursor: 'pointer',
                flexShrink: 0,
                backgroundColor: isSelected ? 'var(--editor-primary, #faaf2d)' : 'transparent',
                backgroundImage: isSelected
                  ? 'linear-gradient(135deg, color-mix(in srgb, var(--editor-primary, #faaf2d) 92%, white) 0%, color-mix(in srgb, var(--editor-primary, #faaf2d) 82%, black) 100%)'
                  : 'none',
                color: isSelected ? '#ffffff' : isDark ? '#d4d4d8' : '#334155',
                border: isSelected ? '1px solid var(--editor-accent-border, rgba(250, 175, 45, 0.55))' : '1px solid transparent',
                boxShadow: isSelected
                  ? '0 6px 16px -2px var(--editor-accent-border, rgba(250, 175, 45, 0.45)), inset 0 1px 0 0 rgba(255, 255, 255, 0.45)'
                  : 'none',
                transition: 'all 200ms cubic-bezier(0.16, 1, 0.3, 1)',
              }}
            >
              <Icon
                name={opt.icon as any}
                className={`w-3.5 h-3.5 ${isSelected ? 'text-white' : 'opacity-75'}`}
              />
              <span>{opt.label}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
