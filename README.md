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
import { useState } from 'react';
import { UploadListDialog, UploadListDialogProps } from '@wizlit/editor';

function MyComponent() {
  const [content, setContent] = useState('<p>Initial content</p>');
  const [uploadDialogProps, setUploadDialogProps] = useState<UploadListDialogProps>({} as UploadListDialogProps);

  const handleContentChange = (newContent: string, isChanged: { isChanged: boolean, isStrictChanged: boolean }, stats: EditorStats) => {
    console.log('Content changed:', newContent);
    console.log('Change status:', isChanged);
    console.log('Stats:', stats);
    setContent(newContent);
  };

  return (
    <div className="flex flex-col gap-4 p-4 h-screen relative">
      <div className="flex justify-end">
        <button 
          onClick={() => setContent('<p>New content after button click! 🎉</p>')}
          className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 transition-colors"
        >
          Change Content
        </button>
      </div>
      
      <BlockEditor
        content={content}
        onChange={handleContentChange}
        className="pr-8 pl-20 py-16 lg:pl-8 lg:pr-8"
        readOnly={false}
        showDebug={true}
        maxCharacters={1000}
        altCharacterCounter={true}
        maxEmbeddings={8}
        image={{
          maxSize: 10 * 1024 * 1024, // 10MB
          disableBuiltInUploadDialog: true,
          getUploadDialogProps: props => {
            setUploadDialogProps(props)
          },
          onUploadImage: async (file: File) => {
            console.log('Image upload is disabled in the demo... Please implement the API.uploadImage method in your project.')
            return `https://example.image`
          },
          convertSrc: (src: string) => {
            if (src.startsWith('https://picsum.photos/')) {
              return 'https://encrypted-tbn0.gstatic.com'
            }
            return "EXTERNAL_IMAGE"
          },
          onClick: (url: string, event: MouseEvent) => {
            console.log(url)
          },
        }}
        link={{
          disableDefaultAction: true,
          onClick: (url: string) => {
            if (url.startsWith('http')) {
              console.log(url)
            }
          },
        }}
      />

      <UploadListDialog
        {...uploadDialogProps}
        className="fixed bottom-4 left-4"
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
| `onChange` | `(content: string, isChanged: { isChanged: boolean, isStrictChanged: boolean }, stats: EditorStats) => void` | No | - | Callback function called when editor content changes, includes change status and statistics |
| `className` | `string` | No | `''` | Additional CSS classes to apply to the editor |
| `readOnly` | `boolean` | No | `false` | Whether the editor is in read-only mode |
| `showDebug` | `boolean \| { altCharacterCounter?: boolean }` | No | `false` | Whether to show debug information including character count, word count, and editor state |
| `maxCharacters` | `number` | No | - | Maximum number of characters allowed in the editor |
| `altCharacterCounter` | `boolean` | No | `false` | Use alternative character counting method |
| `maxEmbeddings` | `number` | No | `3` | Maximum number of images allowed in the editor |
| `image` | `object` | No | - | Image-related configuration |
| `image.maxSize` | `number` | No | `5 * 1024 * 1024` (5MB) | Maximum file size in bytes for image uploads |
| `image.disableBuiltInUploadDialog` | `boolean` | No | `false` | Whether to disable the built-in upload dialog |
| `image.convertSrc` | `(src: string) => string` | No | - | Function to convert image source URLs |
| `image.onUploadImage` | `(file: File) => Promise<string>` | No | - | Function to handle image uploads. Must return a Promise that resolves to the image URL |
| `image.getUploadDialogProps` | `(props: UploadListDialogProps) => void` | No | - | Callback to get upload dialog props for custom implementation |
| `image.onClick` | `(url: string, event: MouseEvent) => void` | No | - | Function called when an image is clicked |
| `link` | `object` | No | - | Link-related configuration |
| `link.disableDefaultAction` | `boolean \| ((url: string) => boolean)` | No | `false` | When set to true or returns true from function, prevents default link behavior (opening in new tab). Use with `onClick` to handle link clicks |
| `link.onClick` | `(url: string) => void` | No | - | Function called when a link is clicked |
| `key` | `string` | No | - | Unique key for multiple editor instances |

### EditorStats Interface

The `EditorStats` interface returned in the `onChange` callback includes:

| Property | Type | Description |
|----------|------|-------------|
| `characters` | `number` | Number of characters in the editor |
| `words` | `number` | Number of words in the editor |
| `percentage` | `number` | Completion percentage if maxCharacters is set |
| `embedCount` | `number` | Number of embedded elements |
| `embedList` | `string[]` | List of embedded element URLs |
| `plainText` | `string` | Plain text content of the editor |

### UploadListDialogProps Interface

The `UploadListDialogProps` interface includes:

| Property | Type | Description |
|----------|------|-------------|
| `items` | `UploadListItem[]` | List of upload items |
| `onRetry` | `(id: string) => void` | Function to retry failed uploads |
| `className` | `string` | Additional CSS classes for the dialog |
| `pillClassName` | `string` | Additional CSS classes for the pill component |
| `dialogClassName` | `string` | Additional CSS classes for the dialog container |

## Development
For detailed development instructions, please refer to [DEVELOPMENT.md](DEVELOPMENT.md).

## License

MIT