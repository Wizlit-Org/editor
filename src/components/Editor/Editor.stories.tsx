import type { Meta, StoryObj } from '@storybook/react';
import Editor from './Editor';

const meta: Meta<typeof Editor> = {
  title: 'Components/Editor',
  component: Editor,
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof Editor>;

export const Default: Story = {
  args: {
    content: '<p>Hello, World! 👋</p>',
    placeholder: 'Start writing...',
  },
};

export const Empty: Story = {
  args: {
    content: '',
    placeholder: 'Write your story here...',
  },
};

export const WithRichContent: Story = {
  args: {
    content: `
      <h1>Rich Content Example</h1>
      <p>This is a paragraph with <strong>bold</strong> and <em>italic</em> text.</p>
      <ul>
        <li>Bullet point 1</li>
        <li>Bullet point 2</li>
      </ul>
      <blockquote>
        <p>This is a blockquote</p>
      </blockquote>
      <pre><code>const code = "example";</code></pre>
    `,
  },
};

export const WithCustomClass: Story = {
  args: {
    content: '<p>This editor has custom styling</p>',
    className: 'bg-gray-100 p-4 rounded-lg',
  },
}; 