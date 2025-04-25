# Wizlit Editor

[![GitHub](https://img.shields.io/badge/GitHub-Wizlit%20Editor-blue)](https://github.com/Wizlit-Org/editor) [![npm](https://img.shields.io/npm/dm/@wizlit/editor)](https://www.npmjs.com/package/@wizlit/editor) [![latest](https://img.shields.io/npm/v/@wizlit/editor)](https://www.npmjs.com/package/@wizlit/editor)

Based on Tiptap editor, a modern editor component library for Next.js and React for Wizlit

## Features

- Built with Next.js 15.3 and React 19
- TypeScript support
- Storybook documentation
- Fully customizable
- Modern and clean design

## Installation

### 1. Install Dependencies

First, install the required dependencies:

```bash
npm install -D tailwindcss @tailwindcss/postcss postcss @tailwindcss/typography tailwindcss-animate
npm install @fontsource/inter cal-sans
npm install @wizlit/editor
```

### 2. Configure Tailwind CSS

Create a `tailwind.config.js` file in your project root:

```javascript
const defaultTheme = require('tailwindcss/defaultTheme')

/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ['class'],
  content: [
    './src/**/*.{ts,tsx}',
  ],
  safelist: ['ProseMirror'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', ...defaultTheme.fontFamily.sans],
      },
    },
  },
  plugins: [require('tailwindcss-animate'), require('@tailwindcss/typography')],
}
```

### 3. Configure PostCSS

Create a `postcss.config.mjs` file in your project root:

```javascript
const config = {
    plugins: {
        "@tailwindcss/postcss": {},
    },
};
export default config;
```

### 4. Set Up Fonts

In your `src/app/layout.tsx` file, import the required fonts:

```tsx
import 'cal-sans'
import '@fontsource/inter/100.css'
import '@fontsource/inter/200.css'
import '@fontsource/inter/300.css'
import '@fontsource/inter/400.css'
import '@fontsource/inter/500.css'
import '@fontsource/inter/600.css'
import '@fontsource/inter/700.css'
```

### 5. Configure Global Styles

Add the following to your `globals.css` file:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

### 6. Using the Editor

Here's an example of how to use the editor in your component:

```tsx
import { BlockEditor } from "@wizlit/editor";
import '@wizlit/editor/dist/styles/index.css'

function MyComponent() {
  return (
    <div className="w-full h-full">
      <BlockEditor
        content={`
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
        `}
        onChange={(content: string) => console.log('Content changed:', content)}
        onUploadImage={async (file: File) => {
          console.log('Image upload is disabled in the demo... Please implement the API.uploadImage method in your project.')
          await new Promise(r => setTimeout(r, 2500))
          return `https://picsum.photos/${Math.floor(Math.random() * 300) + 100}/${Math.floor(Math.random() * 200) + 100}`
        }}
        className="w-[100vw] h-[100vh]"
      />
    </div>
  );
}
```

## BlockEditor Props

The `BlockEditor` component accepts the following props:

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `content` | `string` | No | `''` | Initial HTML content for the editor |
| `onChange` | `(content: string, stats: { characters: number; words: number; percentage: number }) => void` | No | - | Callback function called when editor content changes, includes character count, word count, and completion percentage |
| `className` | `string` | No | `''` | Additional CSS classes to apply to the editor |
| `readOnly` | `boolean` | No | `false` | Whether the editor is in read-only mode |
| `onUploadImage` | `(file: File) => Promise<string>` | Yes | - | Function to handle image uploads. Must return a Promise that resolves to the image URL |
| `maxSize` | `number` | No | `5 * 1024 * 1024` (5MB) | Maximum file size in bytes for image uploads |
| `maxImages` | `number` | No | `3` | Maximum number of images allowed in the editor |
| `maxCharacters` | `number` | No | - | Maximum number of characters allowed in the editor |
| `showDebug` | `boolean` | No | `false` | Whether to show debug information including character count, word count, and editor state |

### Example Usage with All Props

```tsx
import { BlockEditor } from "@wizlit/editor";
import '@wizlit/editor/dist/styles/index.css'

function MyComponent() {
  const handleContentChange = (content: string) => {
    console.log('Content changed:', content);
  };

  const handleImageUpload = async (file: File) => {
    // Implement your image upload logic here
    // This is just an example
    const formData = new FormData();
    formData.append('image', file);
    
    const response = await fetch('/api/upload', {
      method: 'POST',
      body: formData,
    });
    
    const data = await response.json();
    return data.url;
  };

  return (
    <div className="w-full h-full">
      <BlockEditor
        content="<p>Initial content</p>"
        onChange={handleContentChange}
        className="my-custom-class"
        readOnly={false}
        onUploadImage={handleImageUpload}
        maxSize={10 * 1024 * 1024} // 10MB
        maxImages={5}
      />
    </div>
  );
}
```

## Development
For detailed development instructions, please refer to [DEVELOPMENT.md](DEVELOPMENT.md).

## License

MIT 




