# Contributing to Emby Thumbnail Manager

First off, thank you for considering contributing to Emby Thumbnail Manager! 🎉

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [How Can I Contribute?](#how-can-i-contribute)
- [Development Setup](#development-setup)
- [Coding Standards](#coding-standards)
- [Commit Messages](#commit-messages)
- [Pull Request Process](#pull-request-process)

## Code of Conduct

This project and everyone participating in it is governed by our Code of Conduct. By participating, you are expected to uphold this code.

## How Can I Contribute?

### Reporting Bugs

Before creating bug reports, please check the existing issues to avoid duplicates. When you create a bug report, include as many details as possible:

- **Use a clear and descriptive title**
- **Describe the exact steps to reproduce the problem**
- **Provide specific examples**
- **Describe the behavior you observed and what you expected**
- **Include screenshots if relevant**
- **Include your environment details**: OS, Node.js version, FFmpeg version

### Suggesting Enhancements

Enhancement suggestions are tracked as GitHub issues. When creating an enhancement suggestion:

- **Use a clear and descriptive title**
- **Provide a detailed description of the suggested enhancement**
- **Explain why this enhancement would be useful**
- **List any alternative solutions you've considered**

### Pull Requests

- Fill in the required template
- Follow the coding standards
- Include tests when adding new features
- Update documentation as needed
- End all files with a newline

## Development Setup

### Prerequisites

- Node.js >= 16.0.0
- npm >= 8.0.0
- FFmpeg >= 4.0
- Git

### Setup Steps

```bash
# 1. Fork and clone the repository
git clone https://github.com/YOUR_USERNAME/emby-thumbnail-manager.git
cd emby-thumbnail-manager

# 2. Install dependencies
npm install

# 3. Copy environment template
cp .env.example .env

# 4. Run in development mode
npm run dev

# 5. Run tests
npm test

# 6. Run linter
npm run lint
```

### Project Structure

```
strmthumbnail/
├── src/
│   ├── config/          # Configuration management
│   ├── middleware/      # Express middleware
│   ├── routes/          # API routes
│   ├── services/        # Business logic
│   └── utils/           # Utility functions
├── public/              # Frontend static files
├── logs/                # Log files (auto-generated)
├── __tests__/           # Test files
├── server.js            # Main entry point
├── package.json         # Dependencies
├── Dockerfile           # Docker configuration
└── docker-compose.yml   # Docker Compose config
```

## Coding Standards

### JavaScript Style Guide

We use ESLint and Prettier for code consistency:

```bash
# Check code style
npm run lint

# Auto-fix issues
npm run lint:fix

# Format code
npm run format
```

### Key Conventions

- **Use async/await** instead of callbacks
- **Use const by default**, let when reassignment is needed
- **Destructure objects** when possible
- **Use template literals** for string concatenation
- **Add JSDoc comments** for public functions
- **Handle errors** appropriately - don't swallow them
- **Avoid hardcoding** - use configuration
- **Log important operations** with appropriate levels

### Example Code

```javascript
/**
 * Process a video file and generate thumbnail
 * @param {string} videoPath - Path to the video file
 * @param {object} options - Processing options
 * @returns {Promise<object>} Processing result
 */
async function processVideo(videoPath, options = {}) {
  try {
    const { quality = 85, position = 'middle' } = options;

    // Validate input
    if (!videoPath) {
      throw new Error('Video path is required');
    }

    // Process video
    const result = await generateThumbnail(videoPath, { quality, position });

    this.logger.info('Video processed successfully', { path: videoPath });
    return result;
  } catch (error) {
    this.logger.error('Failed to process video', {
      error: error.message,
      path: videoPath
    });
    throw error;
  }
}
```

## Commit Messages

We follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

### Format

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types

- **feat**: New feature
- **fix**: Bug fix
- **docs**: Documentation changes
- **style**: Code style changes (formatting, etc.)
- **refactor**: Code refactoring
- **perf**: Performance improvements
- **test**: Adding or updating tests
- **chore**: Maintenance tasks
- **ci**: CI/CD changes
- **build**: Build system changes

### Examples

```bash
feat(video): add support for multiple thumbnail positions

Add options to capture thumbnails from start, middle, end, or auto-selected positions.

Closes #123

---

fix(auth): prevent brute force attacks

Implement rate limiting on login attempts with 15-minute lockout after 5 failed attempts.

---

docs(readme): update installation instructions

Add Docker installation steps and troubleshooting guide.
```

## Pull Request Process

### Before Submitting

1. **Run tests**: `npm test`
2. **Run linter**: `npm run lint`
3. **Update documentation** if needed
4. **Add tests** for new features
5. **Update CHANGELOG.md**

### Submission Steps

1. **Create a new branch** from `main`:
   ```bash
   git checkout -b feat/your-feature-name
   ```

2. **Make your changes** following the coding standards

3. **Commit your changes** with conventional commit messages:
   ```bash
   git add .
   git commit -m "feat(scope): description"
   ```

4. **Push to your fork**:
   ```bash
   git push origin feat/your-feature-name
   ```

5. **Create a Pull Request** on GitHub

### PR Template

When creating a PR, include:

- **Description**: What does this PR do?
- **Related Issues**: Fixes #XXX
- **Type of Change**: Bug fix, feature, documentation, etc.
- **Testing**: How was this tested?
- **Screenshots**: If UI changes
- **Checklist**:
  - [ ] Code follows style guidelines
  - [ ] Self-review completed
  - [ ] Comments added for complex code
  - [ ] Documentation updated
  - [ ] Tests added/updated
  - [ ] All tests passing
  - [ ] No new warnings

### Review Process

- All submissions require review
- Reviewers may ask for changes
- Once approved, maintainers will merge

## Testing

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm test -- --coverage
```

### Writing Tests

Place tests in `__tests__/` directory or next to the file being tested with `.test.js` suffix:

```javascript
// __tests__/videoService.test.js
const VideoService = require('../src/services/videoService');

describe('VideoService', () => {
  let videoService;

  beforeEach(() => {
    videoService = new VideoService(mockConfig, mockLogger, mockCache);
  });

  test('should generate thumbnail at correct position', async () => {
    const result = await videoService.generateThumbnail(
      'http://example.com/video.mp4',
      '/tmp/output.jpg',
      100,
      { position: 'middle' }
    );

    expect(result.success).toBe(true);
    expect(result.path).toBe('/tmp/output.jpg');
  });
});
```

## Security

If you discover a security vulnerability, please email security@example.com instead of creating a public issue. We take security seriously and will respond promptly.

## Questions?

Feel free to:
- Open an issue with the `question` label
- Join our discussions
- Email us at support@example.com

## Recognition

Contributors will be recognized in:
- README.md
- CHANGELOG.md
- Release notes

Thank you for contributing! 🙏
