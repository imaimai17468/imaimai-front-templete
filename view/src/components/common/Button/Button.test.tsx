import { render, screen } from '@testing-library/react'
import { composeStories } from '@storybook/testing-react'
import * as stories from './Button.stories'
import React from 'react'

const { Default } = composeStories(stories)

test('render button with default args', () => {
  render(<Default>Button</Default>)
  const buttonElement = screen.getByText(/Button/i)
  expect(buttonElement).not.toBeNull()
})
