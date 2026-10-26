import React from 'react'

export interface PastePreviewFooterProps {
  isVisible: boolean
  isExiting: boolean
  animTiming: string
  isDark: boolean
  hasMultipleOptions: boolean
  onClose: () => void
  onConfirm: () => void
}

export const PastePreviewFooter: React.FC<PastePreviewFooterProps> = ({
  isVisible,
  isExiting,
  animTiming,
  isDark,
  hasMultipleOptions,
  onClose,
  onConfirm,
}) => {
  const renderKbd = (keyText: string) => (
    <kbd
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: '18px',
        height: '18px',
        padding: '0 4.5px',
        borderRadius: '5px',
        fontSize: '10.5px',
        fontWeight: 600,
        lineHeight: 1,
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
        backgroundColor: isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.07)',
        border: isDark ? '1px solid rgba(255, 255, 255, 0.16)' : '1px solid rgba(0, 0, 0, 0.12)',
        boxShadow: isDark
          ? '0 1px 2px rgba(0, 0, 0, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.1)'
          : '0 1px 2px rgba(0, 0, 0, 0.05), inset 0 1px 0 rgba(255, 255, 255, 0.8)',
        color: isDark ? '#fafafa' : '#0f172a',
      }}
    >
      {keyText}
    </kbd>
  )

  return (
    <div
      onClick={e => e.stopPropagation()}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '12px',
        flexShrink: 0,
        maxWidth: '95vw',
        opacity: isVisible ? 1 : 0,
        transform: isVisible
          ? 'translateY(0px) scale(1)'
          : isExiting
            ? 'translateY(6px) scale(0.96)'
            : 'translateY(10px) scale(0.96)',
        transition: `opacity ${animTiming}, transform ${animTiming}`,
      }}
    >
      {/* 4단 (삽입+취소 버튼 바로 위): 단축키 안내 글라스 캡슐 배지 */}
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '5px 14px',
          borderRadius: '9999px',
          fontSize: '11.5px',
          fontWeight: 500,
          lineHeight: 1.2,
          color: isDark ? 'rgba(212, 212, 216, 0.88)' : 'rgba(71, 85, 105, 0.92)',
          backgroundColor: isDark ? 'rgba(24, 24, 27, 0.48)' : 'rgba(255, 255, 255, 0.54)',
          backdropFilter: 'blur(20px) saturate(180%)',
          WebkitBackdropFilter: 'blur(20px) saturate(180%)',
          border: isDark ? '1px solid rgba(255, 255, 255, 0.14)' : '1px solid rgba(255, 255, 255, 0.88)',
          boxShadow: isDark
            ? '0 4px 16px rgba(0, 0, 0, 0.35), inset 0 1px 0 0 rgba(255, 255, 255, 0.12)'
            : '0 4px 16px rgba(15, 23, 42, 0.08), inset 0 1px 0 0 rgba(255, 255, 255, 0.9)',
        }}
      >
        {hasMultipleOptions ? (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
            {renderKbd('←')}
            {renderKbd('→')}
            <span>또는</span>
            {renderKbd('Tab')}
            <span>옵션 전환</span>
            <span style={{ opacity: 0.45, margin: '0 3px' }}>·</span>
            {renderKbd('↵')}
            <span>삽입</span>
            <span style={{ opacity: 0.45, margin: '0 3px' }}>·</span>
            {renderKbd('Esc')}
            <span>취소</span>
          </span>
        ) : (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
            {renderKbd('↵')}
            <span>삽입</span>
            <span style={{ opacity: 0.45, margin: '0 3px' }}>·</span>
            {renderKbd('Esc')}
            <span>취소</span>
          </span>
        )}
      </div>

      {/* 5단 (하단 중앙): [취소] + [삽입 ↵] 프로스티드 글라스 버튼 */}
      <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
        <button
          type="button"
          onClick={onClose}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            lineHeight: 1,
            height: '38px',
            padding: '0 20px',
            borderRadius: '9999px',
            fontSize: '13px',
            fontWeight: 600,
            cursor: 'pointer',
            backgroundColor: isDark ? 'rgba(39, 39, 42, 0.55)' : 'rgba(255, 255, 255, 0.62)',
            backgroundImage: isDark
              ? 'linear-gradient(135deg, rgba(63, 63, 70, 0.58) 0%, rgba(24, 24, 27, 0.48) 100%)'
              : 'linear-gradient(135deg, rgba(255, 255, 255, 0.78) 0%, rgba(241, 245, 249, 0.52) 100%)',
            backdropFilter: 'blur(20px) saturate(190%)',
            WebkitBackdropFilter: 'blur(20px) saturate(190%)',
            color: isDark ? '#f4f4f5' : '#334155',
            border: isDark ? '1px solid rgba(255, 255, 255, 0.18)' : '1px solid rgba(255, 255, 255, 0.9)',
            boxShadow: isDark
              ? '0 8px 20px -4px rgba(0, 0, 0, 0.45), 0 0 0 1px rgba(0, 0, 0, 0.25), inset 0 1px 0 0 rgba(255, 255, 255, 0.18)'
              : '0 8px 20px -4px rgba(15, 23, 42, 0.1), 0 0 0 1px rgba(148, 163, 184, 0.22), inset 0 1px 0 0 rgba(255, 255, 255, 0.95)',
            transition: 'all 180ms cubic-bezier(0.16, 1, 0.3, 1)',
          }}
          className="hover:scale-[1.03] active:scale-95"
        >
          취소
        </button>

        <button
          type="button"
          onClick={onConfirm}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            lineHeight: 1,
            height: '38px',
            padding: '0 24px',
            borderRadius: '9999px',
            fontSize: '13px',
            fontWeight: 600,
            cursor: 'pointer',
            backgroundColor: 'var(--editor-primary, #faaf2d)',
            backgroundImage: 'linear-gradient(135deg, color-mix(in srgb, var(--editor-primary, #faaf2d) 92%, white) 0%, color-mix(in srgb, var(--editor-primary, #faaf2d) 82%, black) 100%)',
            backdropFilter: 'blur(20px) saturate(190%)',
            WebkitBackdropFilter: 'blur(20px) saturate(190%)',
            color: '#ffffff',
            border: '1px solid var(--editor-accent-border, rgba(250, 175, 45, 0.58))',
            boxShadow:
              '0 10px 26px -4px var(--editor-accent-border, rgba(250, 175, 45, 0.52)), 0 0 0 1px var(--editor-accent, rgba(250, 175, 45, 0.25)), inset 0 1px 0 0 rgba(255, 255, 255, 0.48)',
            transition: 'all 180ms cubic-bezier(0.16, 1, 0.3, 1)',
          }}
          className="hover:scale-[1.03] active:scale-95"
        >
          <span>삽입</span>
          <span style={{ fontSize: '12px', opacity: 0.92 }} className="font-mono">
            ↵
          </span>
        </button>
      </div>
    </div>
  )
}
