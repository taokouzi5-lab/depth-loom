import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { UploadZone } from './UploadZone'

describe('UploadZone', () => {
  it('renders the empty-state promise and privacy copy', () => {
    render(<UploadZone onBrowse={vi.fn()} />)

    expect(screen.getByRole('heading', { name: /让一张照片/ })).toBeInTheDocument()
    expect(screen.getByText(/图片只在浏览器本地处理/)).toBeInTheDocument()
    expect(screen.getByText(/JPG · PNG · WebP/)).toBeInTheDocument()
  })

  it('opens the file picker when the drop card is activated', () => {
    const onBrowse = vi.fn()
    render(<UploadZone onBrowse={onBrowse} />)

    const button = screen.getByRole('button', { name: /拖入图片|选择图片/ })
    expect(button).toHaveAttribute('type', 'button')
    fireEvent.click(button)
    expect(onBrowse).toHaveBeenCalledOnce()
  })

  it('shows an error with a dismiss action', () => {
    const onDismissError = vi.fn()
    render(
      <UploadZone
        onBrowse={vi.fn()}
        error={{ code: 'too_large', message: '图片超过 20 MB，请先压缩或换一张。' }}
        onDismissError={onDismissError}
      />,
    )

    expect(screen.getByRole('alert')).toHaveTextContent('图片超过 20 MB')
    fireEvent.click(screen.getByRole('button', { name: /知道了/ }))
    expect(onDismissError).toHaveBeenCalledOnce()
  })

  it('disables the picker while a decode is in flight', () => {
    render(<UploadZone onBrowse={vi.fn()} isBusy />)

    const button = screen.getByRole('button', { name: /拖入图片|选择图片|正在解码/ })
    expect(button).toBeDisabled()
    expect(screen.getByText(/正在解码/)).toBeInTheDocument()
  })
})
