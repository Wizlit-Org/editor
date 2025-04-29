# Wizlit Editor Development Guide

This guide provides detailed information for developers working on the Wizlit Editor.

## Development Setup

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

## Project Structure

```
src/
├── components/         # React components
├── extensions/        # Tiptap extensions
├── hooks/            # Custom React hooks
├── styles/           # CSS and styling
└── utils/            # Utility functions
```

## Development Workflow

### Local Testing with yalc

For local development and testing in other projects, we recommend using [yalc](https://github.com/wclr/yalc).

1. (Only for the first time) Install yalc globally:
   ```bash
   npm install -g yalc
   ```

2. In the Wizlit Editor project directory:
   ```bash
   yalc publish
   ```

3. In your test project:
   ```bash
   yalc add @wizlit/editor
   ```

### Removing the Package

To remove the local package from your test project:
```bash
yalc remove @wizlit/editor
```

### Updating the Package

When you make changes to the Wizlit Editor:

```bash
npm run dev
```

### Publishing to npm

1. Update the version number in `package.json`

2. Publish the package:
   - For production: `npm run publish` (publish with latest tag)
   - For removing: `npm run publish:remove`

### Version Management

- Use semantic versioning (MAJOR.MINOR.PATCH)
- Update version in `package.json` before publishing
- Tag releases in git after successful publish

## Testing

1. Run unit tests:
   ```bash
   npm test
   ```

2. Run tests in watch mode:
   ```bash
   npm run test:watch
   ```

3. Run tests with coverage:
   ```bash
   npm run test:coverage
   ```

## Code Style

- Follow TypeScript best practices
- Use ESLint for code linting
- Use Prettier for code formatting
- Write meaningful commit messages

## Contributing

1. Create a new branch for your feature/fix
2. Make your changes
3. Run tests and ensure they pass
4. Submit a pull request

## Troubleshooting

### Common Issues

1. **Build fails**
   - Clear the dist directory: `npm run clean`
   - Reinstall dependencies: `npm install`
   - Try rebuilding: `npm run build`

2. **Storybook won't start**
   - Clear node_modules: `rm -rf node_modules`
   - Reinstall dependencies: `npm install`
   - Restart Storybook: `npm run storybook`

3. **TypeScript errors**
   - Check your TypeScript version
   - Ensure all dependencies are properly typed
   - Run type checking: `npm run type-check`

## Performance Optimization

- Use React.memo for pure components
- Implement proper memoization
- Monitor bundle size
- Use code splitting where appropriate

## Security Considerations

- Keep dependencies updated
- Follow security best practices
- Regular security audits
- Use secure coding patterns

## Support

For development support:
- Check the documentation
- Review existing issues
- Create a new issue if needed
- Contact the maintainers 