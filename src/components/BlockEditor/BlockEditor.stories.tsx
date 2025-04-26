import type { Meta, StoryObj } from '@storybook/react';
import BlockEditor from './BlockEditor';

const meta: Meta<typeof BlockEditor> = {
  title: 'Components/Editor',
  component: BlockEditor,
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
  argTypes: {
    onUploadImage: {
      action: false,
    },
    onChange: {
      action: false,
    },
  },
};

export default meta;
type Story = StoryObj<typeof BlockEditor>;

export const Default: Story = {
  args: {
    content: '<p>Hello, World! 👋</p>',
    onChange: (content, stats) => {
      console.log(content, stats)
    },
  },
};

export const Empty: Story = {
  args: {
    content: '',
    onChange: (content, stats) => {
      console.log(content, stats)
    },
  },
};

export const WithRichContent: Story = {
  args: {
    content: `
      <h1>Rich Content Example</h1>
      <p>This is a <code>paragraph</code> with <strong>bold</strong> and <em>italic</em> text.</p>
      <ul>
        <li>Bullet point 1</li>
        <li>Bullet point 2</li>
      </ul>
      <blockquote>
        <p>This is a blockquote</p>
      </blockquote>
      <pre><code class="language-javascript">const code = "example";const code = "example";const code = "example";const code = "example";
function red() {
  String show = "hello"
}</code></pre>
    `,
    onChange: (content, stats) => {
      console.log(content, stats)
    },
    maxSize: 1024 * 10,
    maxCharacters: 5000,
    showDebug: true,
    onUploadImage: undefined,
  },
};

export const ShortMaxCharacters: Story = {
  args: {
    content: '<p>This editor has custom styling</p>',
    maxCharacters: 100,
    showDebug: true,
    onUploadImage: undefined,
    onChange: undefined,
  },
};

export const WithCustomClass: Story = {
  args: {
    content: '<p>This editor has custom styling</p>',
    className: 'bg-gray-100 p-4 rounded-lg',
    onUploadImage: async (file: File) => {
      console.log('Image upload is disabled in the demo... Please implement the API.uploadImage method in your project.')
      await new Promise(r => setTimeout(r, Math.floor(Math.random() * 5000) + 1000))
      return `https://picsum.photos/${Math.floor(Math.random() * 300) + 100}/${Math.floor(Math.random() * 200) + 100}`
    },
    onChange: (content, stats) => {
      console.log(content, stats)
    },
  },
}; 