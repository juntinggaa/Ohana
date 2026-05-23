import { Component, type ReactNode, type ErrorInfo } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
  componentStack?: string
}

/**
 * 顶层错误边界 —— 防止单一组件报错把整个页面变白屏
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error('[ErrorBoundary]', error, info)
    this.setState({ componentStack: info.componentStack ?? undefined })
  }

  handleReset = () => {
    this.setState({ error: null })
  }

  handleClearStorage = () => {
    try {
      window.localStorage.clear()
      window.location.reload()
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error(e)
    }
  }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen bg-paper grid place-items-center p-8">
          <div className="max-w-xl">
            <div className="eyebrow text-rouge-500 mb-3">页面出错了</div>
            <h1 className="font-serif text-h2 text-ink-900 mb-3 leading-tight">
              抱歉，刚才有一段代码炸了。
            </h1>
            <p className="text-small text-ink-600 mb-6 leading-relaxed">
              这通常是因为浏览器里有上一个版本的数据残留。
              下面这个按钮会清掉本地存储并刷新页面，应该能修。
            </p>
            <div className="bg-paper-100 border-l-2 border-rouge-500 px-4 py-3 mb-6">
              <div className="text-tiny text-ink-500 mb-1">报错详情（给开发者看）</div>
              <pre className="text-tiny font-mono text-ink-700 whitespace-pre-wrap break-all">
                {this.state.error.message}
              </pre>
              {this.state.componentStack && (
                <details className="mt-3">
                  <summary className="text-tiny text-ink-500 cursor-pointer">
                    展开组件栈
                  </summary>
                  <pre className="text-tiny font-mono text-ink-500 whitespace-pre-wrap break-all mt-2">
                    {this.state.componentStack}
                  </pre>
                </details>
              )}
            </div>
            <div className="flex gap-3">
              <button onClick={this.handleClearStorage} className="btn-rouge">
                清空本地存储并刷新
              </button>
              <button onClick={this.handleReset} className="btn-outline">
                重试当前页
              </button>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
