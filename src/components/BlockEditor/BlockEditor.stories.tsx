import type { Meta, StoryObj } from '@storybook/react';
import BlockEditor from './BlockEditor';

import 'cal-sans';
import '@fontsource/inter/100.css';
import '@fontsource/inter/200.css';
import '@fontsource/inter/300.css';
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';

const meta: Meta<typeof BlockEditor> = {
  title: 'Components/Editor',
  component: BlockEditor,
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof BlockEditor>;

export const Default: Story = {
  args: {
    content: '<p>Hello, World! 👋</p>',
    onUploadImage: async (file: File) => {
      console.log('Image upload is disabled in the demo... Please implement the API.uploadImage method in your project.')
      await new Promise(r => setTimeout(r, Math.floor(Math.random() * 5000) + 1000))
      return `https://picsum.photos/${Math.floor(Math.random() * 300) + 100}/${Math.floor(Math.random() * 200) + 100}`
    },
  },
};

export const Empty: Story = {
  args: {
    content: '',
    onUploadImage: async (file: File) => {
      console.log('Image upload is disabled in the demo... Please implement the API.uploadImage method in your project.')
      await new Promise(r => setTimeout(r, Math.floor(Math.random() * 5000) + 1000))
      return `https://picsum.photos/${Math.floor(Math.random() * 300) + 100}/${Math.floor(Math.random() * 200) + 100}`
    },
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
    onUploadImage: async (file: File) => {
      console.log('Image upload is disabled in the demo... Please implement the API.uploadImage method in your project.')
      await new Promise(r => setTimeout(r, Math.floor(Math.random() * 5000) + 1000))
      return `https://picsum.photos/${Math.floor(Math.random() * 300) + 100}/${Math.floor(Math.random() * 200) + 100}`
    },
    maxSize: 1024 * 10,
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
  },
}; 