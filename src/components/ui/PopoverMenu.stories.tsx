import type { Meta, StoryObj } from '@storybook/react'
import { Menu, Item, CategoryTitle, Divider } from './PopoverMenu'
import { icons } from 'lucide-react'

const meta: Meta<typeof Menu> = {
  title: 'UI/PopoverMenu',
  component: Menu,
  tags: ['autodocs'],
  argTypes: {
    trigger: { control: 'text' },
    isOpen: { control: 'boolean' },
    withPortal: { control: 'boolean' },
    tooltip: { control: 'text' },
  },
}

export default meta
type Story = StoryObj<typeof Menu>

export const Default: Story = {
  args: {
    trigger: 'Click me',
    tooltip: 'Open menu',
  },
  render: (args) => (
    <Menu {...args}>
      <Item label="Item 2" icon="Settings" onClick={() => console.log('Item 2 clicked')} />
      <Divider />
      <Item label="Item 3" icon="User" onClick={() => console.log('Item 3 clicked')} />
    </Menu>
  ),
}

export const WithCategories: Story = {
  args: {
    trigger: 'Menu with Categories',
    tooltip: 'Open categorized menu',
  },
  render: (args) => (
    <Menu {...args}>
      <CategoryTitle>Actions</CategoryTitle>
      <Item label="New Document" icon="File" onClick={() => console.log('New Document clicked')} />
      <Item label="Save" icon="Save" onClick={() => console.log('Save clicked')} />
      
      <CategoryTitle>Settings</CategoryTitle>
      <Item label="Preferences" icon="Settings" onClick={() => console.log('Preferences clicked')} />
    </Menu>
  ),
}

export const WithActiveState: Story = {
  args: {
    trigger: 'Menu with Active State',
    tooltip: 'Open menu with active items',
  },
  render: (args) => (
    <Menu {...args}>
      <Item 
        label="Active Item" 
        icon="Check" 
        onClick={() => console.log('Active Item clicked')} 
        isActive={true}
      />
      <Item 
        label="Inactive Item" 
        icon="X" 
        onClick={() => console.log('Inactive Item clicked')} 
        isActive={false}
      />
    </Menu>
  ),
}

export const WithDisabledItems: Story = {
  args: {
    trigger: 'Menu with Disabled Items',
    tooltip: 'Open menu with disabled items',
  },
  render: (args) => (
    <Menu {...args}>
      <Item 
        label="Enabled Item" 
        icon="Check" 
        onClick={() => console.log('Enabled Item clicked')} 
      />
      <Item 
        label="Disabled Item" 
        icon="X" 
        onClick={() => console.log('Disabled Item clicked')} 
        disabled={true}
      />
    </Menu>
  ),
}

export const WithCustomTrigger: Story = {
  args: {
    trigger: <button className="px-4 py-2 bg-blue-500 text-white rounded">Custom Trigger</button>,
    customTrigger: true,
    tooltip: 'Open menu with custom trigger',
  },
  render: (args) => (
    <Menu {...args}>
      <Item label="Item 2" icon="Settings" onClick={() => console.log('Item 2 clicked')} />
    </Menu>
  ),
} 