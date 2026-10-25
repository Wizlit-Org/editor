import React from 'react'

/**
 * Direction-explicit icon for deleting a horizontal table row
 */
export const DeleteRowIcon: React.FC<{ className?: string }> = ({
  className = 'w-3.5 h-3.5 text-red-500 dark:text-red-400',
}) => (
  <svg
    className={className}
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.75"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="2" y="3" width="12" height="4" rx="0.75" />
    <rect x="2" y="9.5" width="12" height="4" rx="0.75" strokeDasharray="2 1.5" opacity="0.45" />
    <line x1="6" y1="5" x2="10" y2="5" strokeWidth="2" />
  </svg>
)

/**
 * Direction-explicit icon for deleting a vertical table column
 */
export const DeleteColumnIcon: React.FC<{ className?: string }> = ({
  className = 'w-3.5 h-3.5 text-red-500 dark:text-red-400',
}) => (
  <svg
    className={className}
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.75"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="3" y="2" width="4" height="12" rx="0.75" />
    <rect x="9.5" y="2" width="4" height="12" rx="0.75" strokeDasharray="2 1.5" opacity="0.45" />
    <line x1="5" y1="6" x2="5" y2="10" strokeWidth="2" />
  </svg>
)
