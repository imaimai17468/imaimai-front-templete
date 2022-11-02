import React from 'react'

type Props = {
  outlined?: boolean
  size?: 'small' | 'middle'
  children: React.ReactNode
  onClick?: () => void
}

export const Button: React.FC<Props> = ({
  outlined = false,
  size = 'middle',
  children,
  onClick,
}) => {
  return (
    <button
      type="button"
      className={`
        rounded
        ${size === 'middle' ? 'px-5 py-1' : 'px-3 py-1 text-sm'}
        ${
          outlined
            ? 'border border-blue-600 text-blue-600 hover:bg-blue-600 hover:text-white'
            : 'border-none bg-blue-600 text-white hover:bg-blue-500'
        }
      `}
      onClick={onClick}
    >
      {children}
    </button>
  )
}
