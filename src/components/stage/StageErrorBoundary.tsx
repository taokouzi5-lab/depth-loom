import { Component, type ReactNode } from 'react'

type StageErrorBoundaryProps = {
  children: ReactNode
}

type StageErrorBoundaryState = {
  hasError: boolean
}

/**
 * Error boundaries still require a class component in React 19. This one covers
 * lazy-chunk load failures and unexpected render errors in the Three.js stage;
 * WebGL initialisation failures are handled inside DepthStage with a retry path.
 */
export class StageErrorBoundary extends Component<
  StageErrorBoundaryProps,
  StageErrorBoundaryState
> {
  state: StageErrorBoundaryState = { hasError: false }

  static getDerivedStateFromError(): StageErrorBoundaryState {
    return { hasError: true }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="dl-stage-error" role="alert">
          <div className="dl-stage-error__inner">
            <p>3D 舞台加载失败，可能是网络或浏览器缓存问题。</p>
            <button
              type="button"
              className="dl-stage-error__action"
              onClick={() => window.location.reload()}
            >
              重新加载
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
