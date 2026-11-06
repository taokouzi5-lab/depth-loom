import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { DepthStatus } from './DepthStatus'

describe('DepthStatus', () => {
  it('renders nothing while idle', () => {
    const { container } = render(
      <DepthStatus
        status="idle"
        progress={null}
        mode={null}
        error={null}
        onRetry={vi.fn()}
      />,
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('shows model download progress', () => {
    render(
      <DepthStatus
        status="loading"
        progress={{ loaded: 42, total: 100, progress: 42 }}
        mode={null}
        error={null}
        onRetry={vi.fn()}
      />,
    )

    expect(screen.getByRole('status')).toHaveTextContent('正在加载深度模型')
    expect(screen.getByText('42%')).toBeInTheDocument()
  })

  it('shows the CPU mode badge when WASM is active', () => {
    render(
      <DepthStatus
        status="ready"
        progress={null}
        mode="wasm"
        error={null}
        onRetry={vi.fn()}
      />,
    )

    expect(screen.getByRole('status')).toHaveTextContent('深度已就绪')
    expect(screen.getByText('CPU 模式 · 较慢')).toBeInTheDocument()
  })

  it('shows an error and invokes retry', () => {
    const onRetry = vi.fn()
    render(
      <DepthStatus
        status="error"
        progress={null}
        mode={null}
        error="model failed"
        onRetry={onRetry}
      />,
    )

    expect(screen.getByRole('alert')).toHaveTextContent('深度估计失败')
    expect(screen.getByText('model failed')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '重试' }))
    expect(onRetry).toHaveBeenCalledOnce()
  })
})
