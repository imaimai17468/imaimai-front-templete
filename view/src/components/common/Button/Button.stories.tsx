import React from 'react'
import { ComponentStory, ComponentMeta } from '@storybook/react'

import { Button } from './Button'

export default {
  title: 'Button',
  component: Button,
} as ComponentMeta<typeof Button>

const Template: ComponentStory<typeof Button> = (args) => (
  <Button {...args}>{args.children}</Button>
)

export const Default = Template.bind({})
Default.args = {
  children: 'Button',
}

export const Outlined = Template.bind({})
Outlined.args = {
  outlined: true,
  children: 'Button',
}

export const Small = Template.bind({})
Small.args = {
  size: 'small',
  children: 'Button',
}

export const OutlinedSmall = Template.bind({})
OutlinedSmall.args = {
  outlined: true,
  size: 'small',
  children: 'Button',
}
