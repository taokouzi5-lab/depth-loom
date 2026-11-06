import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { UploadZone } from './UploadZone'

describe('UploadZone', () => {
  it('renders the empty-state promise, samples, and privacy copy', () => {
    render(<UploadZone onBrowse={vi.fn()} onSample={vi.fn()} />)

    expect(screen.getByRole('heading', { name: /让一张照片/ })).toBeInTheDocument()
    expect(screen.getByText(/图片只在浏览器本地处理/)).toBeInTheDocument()
    expect(screen.getByText(/JPG · PNG · WebP/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /加载示例：山景/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /加载示例：街景/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /加载示例：猫肖像/ })).toBeInTheDocument()
  })

  it('opens the file picker when the drop card is activated', () => {
    const onBrowse = vi.fn()
    render(<UploadZone onBrowse={onBrowse} onSample={vi.fn()} />)

    const button = screen.getByRole('button', { name: /拖入图片|选择图片/ })
    expect(button).toHaveAttribute('type', 'button')
    fireEvent.click(button)
    expect(onBrowse).toHaveBeenCalledOnce()
  })

  it('loads a sample image', () => {
    const onSample = vi.fn()
    render(<UploadZone onBrowse={vi.fn()} onSample={onSample} />)

    fireEvent.click(screen.getByRole('button', { name: /加载示例：山景/ }))
    expect(onSample).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'landscape', fileName: 'landscape.jpg' }),
    )
  })

  it('shows an error with a dismiss action', () => {
    const onDismissError = vi.fn()
    render(
      <UploadZone
        onBrowse={vi.fn()}
        onSample={vi.fn()}
        error={{ code: 'too_large', message: '图片超过 20 MB，请先压缩或换一张。' }}
        onDismissError={onDismissError}
      />,
    )

    expect(screen.getByRole('alert')).toHaveTextContent('图片超过 20 MB')
    fireEvent.click(screen.getByRole('button', { name: /知道了/ }))
    expect(onDismissError).toHaveBeenCalledOnce()
  })

  it('disables the picker and samples while a decode is in flight', () => {
    render(<UploadZone onBrowse={vi.fn()} onSample={vi.fn()} isBusy />)

    const button = screen.getByRole('button', { name: /拖入图片|选择图片|正在解码/ })
    expect(button).toBeDisabled()
    expect(screen.getByRole('button', { name: /加载示例：山景/ })).toBeDisabled()
    expect(screen.getByText(/正在解码/)).toBeInTheDocument()
  })
})
