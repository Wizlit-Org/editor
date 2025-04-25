# Wizlit Editor

A modern editor component library for Next.js and React applications.

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

## Development

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the development server:
   ```bash
   npm run dev
   ```
4. View Storybook:
   ```bash
   npm run storybook
   ```

## Local Testing with yalc

For local development and testing in other projects, we recommend using [yalc](https://github.com/wclr/yalc) instead of npm link. yalc provides a more reliable way to test local packages.

### Setup

1. (Initial) Install yalc globally:
   ```bash
   npm install -g yalc
   ```

2. In the Wizlit Editor project directory, publish the package:
   ```bash
   yalc publish
   ```

3. In your test project directory, add the local package:
   ```bash
   yalc add @wizlit/editor
   ```

### Updating the Package

When you make changes to the Wizlit Editor:

1. Build the package:
   ```bash
   npm run build
   ```

2. Push the changes:
   ```bash
   yalc push
   ```

### Removing the Package

To remove the local package from your test project:
```bash
yalc remove @wizlit/editor
```

## Building

To build the library:

```bash
npm run build
```

## License

MIT 




