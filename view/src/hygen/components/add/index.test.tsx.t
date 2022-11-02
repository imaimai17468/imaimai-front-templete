---
to: components/<%= level %>/<%= name %>/<%= name %>.test.tsx
unless_exists: true
---
import React from "react";
import { render, screen } from '@testing-library/react'
import { composeStories } from '@storybook/testing-react'
import * as stories from './<%= name %>.stories'

const { Default } = composeStories(stories)

test('render <%= name %> with default args', () => {
  render(<Default><%= name %></Default>)
  const <%= name %>Element = screen.getByText(/<%= name %>/i)
  expect(<%= name %>Element).not.toBeNull()
})
