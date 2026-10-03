import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ImportPatternSettings } from './ImportPatternSettings'

const api = vi.hoisted(() => ({
  createImportPattern: vi.fn(),
  deleteImportPattern: vi.fn(),
  loadImportPatterns: vi.fn(),
  testImportPattern: vi.fn(),
  updateImportPattern: vi.fn(),
}))

vi.mock('../catalog/catalogApi', () => api)

describe('ImportPatternSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    api.loadImportPatterns.mockResolvedValue({
      items: [
        {
          id: 'disc-pattern',
          kind: 'discFolder',
          template: 'Disc {disc} - {discTitle}',
          sortOrder: 60,
          isActive: true,
          isBuiltin: true,
        },
      ],
    })
    api.testImportPattern.mockResolvedValue({
      matched: true,
      fields: { disc: '3', discMarker: 'Disc 03', discTitle: 'Retro' },
      issues: [],
    })
  })

  it('offers disc folder patterns with their own template and preview', async () => {
    const user = userEvent.setup()
    render(<ImportPatternSettings onModeChange={() => undefined} />)

    expect(await screen.findByText('Disc {disc} - {discTitle}')).toBeVisible()
    expect(
      screen.getByRole('cell', { name: 'Disc folder' }),
    ).toBeInTheDocument()

    await user.selectOptions(screen.getByLabelText('Kind'), 'discFolder')

    expect(screen.getByLabelText('Template')).toHaveValue(
      'Disc {disc} - {discTitle}',
    )
    expect(screen.getByLabelText('Test input')).toHaveValue(
      'Disc 03 - Retrospective Mix',
    )
    expect(screen.getByText(/{disc} is required/)).toBeVisible()

    await user.click(screen.getByRole('button', { name: 'Test' }))

    await waitFor(() => {
      expect(api.testImportPattern).toHaveBeenCalledWith(
        'discFolder',
        'Disc {disc} - {discTitle}',
        'Disc 03 - Retrospective Mix',
      )
    })
    expect(await screen.findByText('Pattern matched')).toBeVisible()
  })
})
