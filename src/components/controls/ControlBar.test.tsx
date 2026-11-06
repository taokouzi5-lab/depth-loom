import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ControlBar } from './ControlBar'
import type { ComponentProps } from 'react'

type ControlBarProps = ComponentProps<typeof ControlBar>

function renderBar(overrides: Partial<ControlBarProps> = {}) {
  const props: ControlBarProps = {
    fileName: 'landscape.png',
    width: 1024,
    height: 640,
    isBusy: false,
    view: 'original',
    onViewChange: vi.fn(),
    isDepthReady: false,
    strength: 1,
    onStrengthChange: vi.fn(),
    isExporting: false,
    onExportPng: vi.fn(),
    onExportVideo: vi.fn(),
    onReset: vi.fn(),
    onBrowse: vi.fn(),
    ...overrides,
  }
  render(<ControlBar {...props} />)
  return props
}

describe('ControlBar', () => {
  it('shows file info and keeps depth views disabled until ready', () => {
    renderBar()

    expect(screen.getByText('landscape.png')).toBeInTheDocument()
    expect(screen.getByText('1024 × 640 px · 本地')).toBeInTheDocument()
    expect(screen.getByText('拖拽旋转 · 滚轮 / 双指缩放')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '深度' })).toBeDisabled()
    expect(screen.getByRole('button', { name: '3D' })).toBeDisabled()
    expect(screen.getByRole('slider', { name: '深度强度' })).toBeDisabled()
    expect(screen.getByRole('button', { name: '原图' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })

  it('switches to the depth view when enabled', () => {
    const props = renderBar({ isDepthReady: true })

    fireEvent.click(screen.getByRole('button', { name: '深度' }))
    expect(props.onViewChange).toHaveBeenCalledWith('depth')
  })

  it('switches to 3D and enables the strength slider', () => {
    const props = renderBar({ isDepthReady: true, view: '3d' })

    expect(screen.getByRole('button', { name: '3D' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    const slider = screen.getByRole('slider', { name: '深度强度' })
    expect(slider).toBeEnabled()

    fireEvent.change(slider, { target: { value: '1.5' } })
    expect(props.onStrengthChange).toHaveBeenCalledWith(1.5)
  })

  it('uses the depth hint while the depth view is active', () => {
    renderBar({ view: 'depth', isDepthReady: true })

    expect(screen.getByText('深度图 · 越亮越近')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '深度' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })

  it('invokes reset and replace actions', () => {
    const props = renderBar({ isDepthReady: true })

    fireEvent.click(screen.getByRole('button', { name: '重置视角' }))
    fireEvent.click(screen.getByRole('button', { name: '换一张' }))

    expect(props.onReset).toHaveBeenCalledOnce()
    expect(props.onBrowse).toHaveBeenCalledOnce()
  })

  it('opens the export menu and dispatches PNG/video exports', () => {
    const props = renderBar({ isDepthReady: true, view: '3d' })

    fireEvent.click(screen.getByRole('button', { name: '导出' }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'PNG 截图' }))
    expect(props.onExportPng).toHaveBeenCalledOnce()

    fireEvent.click(screen.getByRole('button', { name: '导出' }))
    fireEvent.click(screen.getByRole('menuitem', { name: '3 秒 WebM' }))
    expect(props.onExportVideo).toHaveBeenCalledOnce()
  })

  it('disables the video export until depth is ready', () => {
    renderBar()
    fireEvent.click(screen.getByRole('button', { name: '导出' }))

    expect(screen.getByRole('menuitem', { name: '3 秒 WebM' })).toBeDisabled()
  })

  it('disables the export trigger while exporting', () => {
    renderBar({ isExporting: true })

    expect(screen.getByRole('button', { name: /导出中/ })).toBeDisabled()
  })

  it('disables actions while an image is decoding', () => {
    renderBar({ isBusy: true })

    expect(screen.getByRole('button', { name: '重置视角' })).toBeDisabled()
    expect(screen.getByRole('button', { name: '换一张' })).toBeDisabled()
  })
})
