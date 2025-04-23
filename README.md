# Wizlit Editor

A modern editor component library for Next.js and React applications.

## Features

- Built with Next.js 15.3 and React 19
- TypeScript support
- Storybook documentation
- Fully customizable
- Modern and clean design

## Installation

Install the plugin from npm:
```bash
npm install -D @tailwindcss/typography
```
Then add the plugin to your main `style.css` file:
```
  @import "tailwindcss";
+ @plugin "@tailwindcss/typography";
```
Install library
```bash
npm install @wizlit/editor
# or
yarn add @wizlit/editor
```

## Usage

```tsx
import { Editor } from '@wizlit/editor';

function MyComponent() {
  const handleContentChange = (content: string) => {
    console.log('Content changed:', content);
  };

  return (
    <Editor
      content="<p>Hello, World!</p>"
      onChange={handleContentChange}
    />
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




