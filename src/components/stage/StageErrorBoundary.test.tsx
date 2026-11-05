import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { StageErrorBoundary } from './StageErrorBoundary'

function ThrowingStage(): never {
  throw new Error('lazy chunk failed')
}

describe('StageErrorBoundary', () => {
  it('renders a reload fallback when the stage cannot load', () => {
    // React logs the caught error; keep the test output clean.
    // oxlint-disable-next-line no-console -- intentional silencing of the expected React error log
    vi.spyOn(console, 'error').mockImplementation(() => {})

    render(
      <StageErrorBoundary>
        <ThrowingStage />
      </StageErrorBoundary>,
    )

    expect(screen.getByRole('alert')).toHaveTextContent('3D 舞台加载失败')
    expect(screen.getByRole('button', { name: /重新加载/ })).toBeInTheDocument()
  })
})
