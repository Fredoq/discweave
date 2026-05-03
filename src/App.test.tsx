import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import App from './App'

describe('App', () => {
  it('renders the catalog workspace', () => {
    render(<App />)

    expect(
      screen.getByRole('heading', { name: 'Collection catalog' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('searchbox', { name: 'Search catalog' }),
    ).toBeInTheDocument()
  })

  it('filters catalog entries by user query', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.type(screen.getByRole('searchbox'), 'digitization')

    expect(screen.getByText('Blue Monday')).toBeInTheDocument()
    expect(
      screen.queryByText('Selected Ambient Works 85-92'),
    ).not.toBeInTheDocument()
  })
})
