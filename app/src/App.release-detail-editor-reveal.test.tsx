import { describe, expect, it } from 'vitest'
import * as h from './test/appTestHarness'

h.setupAppTestHooks()

describe('App release detail editor reveal', () => {
  it('scrolls the release editor into view without moving trigger focus', async () => {
    window.history.pushState(
      {},
      '',
      '/releases?release=selected-ambient-works-85-92',
    )
    const reveal = stubEditorReveal()

    try {
      const user = h.userEvent.setup()
      h.render(<h.App />)

      const editButton = h.screen.getByRole('button', { name: 'Edit record' })
      await user.click(editButton)
      const editor = h.screen.getByRole('form', { name: 'Edit release' })

      await h.waitFor(() => expect(reveal.scrollIntoView).toHaveBeenCalled())
      expect(reveal.lastTarget()).toContainElement(editor)
      expect(reveal.scrollIntoView).toHaveBeenLastCalledWith({
        block: 'start',
        inline: 'nearest',
      })
      expect(editButton).toHaveFocus()
    } finally {
      reveal.restore()
    }
  })

  it('reveals and focuses the Discogs lookup instead of the initial track', async () => {
    window.history.pushState(
      {},
      '',
      '/releases?release=selected-ambient-works-85-92',
    )
    const reveal = stubEditorReveal()

    try {
      const user = h.userEvent.setup()
      h.render(<h.App />)

      await user.click(
        h.screen.getByRole('button', { name: 'Update via Discogs' }),
      )
      const query = h.screen.getByRole('textbox', { name: 'Discogs query' })

      await h.waitFor(() => expect(query).toHaveFocus())
      expect(reveal.lastTarget()).toContainElement(query)
    } finally {
      reveal.restore()
    }
  })

  it('scrolls the local file editor into view without moving trigger focus', async () => {
    window.history.pushState(
      {},
      '',
      '/releases?release=selected-ambient-works-85-92',
    )
    const originalDesktopBridge = window.discweaveDesktop
    window.discweaveDesktop = {
      isDesktop: true,
      exports: { download: h.vi.fn() },
      imports: { pickAndScan: h.vi.fn() },
      localEdits: {
        inspect: h.vi.fn().mockResolvedValue({
          path: '/music/example.flac',
          format: 'flac',
          sizeBytes: 100,
          lastModifiedAt: '2026-08-23T00:00:00.000Z',
          tags: {},
          technical: {},
        }),
        preview: h.vi.fn(),
        apply: h.vi.fn(),
      },
    }
    h.mockFetch(h.jsonResponse({ items: [], limit: 100, offset: 0, total: 0 }))
    const reveal = stubEditorReveal()

    try {
      const user = h.userEvent.setup()
      h.render(<h.App />)

      const editButton = h.screen.getByRole('button', {
        name: 'Edit local files',
      })
      await user.click(editButton)
      const editor = await h.screen.findByRole('region', {
        name: 'Local file editor',
      })

      await h.waitFor(() => expect(reveal.scrollIntoView).toHaveBeenCalled())
      expect(reveal.lastTarget()).toContainElement(editor)
      expect(reveal.scrollIntoView).toHaveBeenLastCalledWith({
        block: 'start',
        inline: 'nearest',
      })
      expect(editButton).toHaveFocus()
    } finally {
      reveal.restore()
      window.discweaveDesktop = originalDesktopBridge
    }
  })
})

function stubEditorReveal() {
  const originalScrollIntoView = Object.getOwnPropertyDescriptor(
    HTMLElement.prototype,
    'scrollIntoView',
  )
  const scrollIntoView = h.vi.fn()
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
    configurable: true,
    value: scrollIntoView,
  })
  const requestAnimationFrame = h.vi
    .spyOn(window, 'requestAnimationFrame')
    .mockImplementation((callback) => {
      callback(0)
      return 1
    })

  return {
    scrollIntoView,
    lastTarget: () =>
      scrollIntoView.mock.contexts.at(-1) as HTMLElement | undefined,
    restore: () => {
      requestAnimationFrame.mockRestore()
      if (originalScrollIntoView) {
        Object.defineProperty(
          HTMLElement.prototype,
          'scrollIntoView',
          originalScrollIntoView,
        )
      } else {
        Reflect.deleteProperty(HTMLElement.prototype, 'scrollIntoView')
      }
    },
  }
}
