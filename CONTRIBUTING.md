# Contributing to zustand-persist-plus

Thank you for your interest in contributing! This guide will help you get started.

## Getting Started

### Prerequisites

- Node.js 18+
- pnpm 8+
- TypeScript 5.0+

### Setup

```bash
# Clone the repository
git clone https://github.com/yourusername/zustand-persist-plus.git
cd zustand-persist-plus

# Install dependencies
pnpm install

# Run tests
pnpm test

# Build the package
pnpm build
```

## Development

### Project Structure

```
src/
├── adapters/        # Storage adapters (IndexedDB, Supabase, Firebase)
├── encryption/      # Encryption logic (AES-GCM, XSalsa20)
├── compression/     # LZ-String compression
├── migrations/      # Schema migration engine
├── middleware/      # Zustand middleware implementations
├── types/           # TypeScript type definitions
└── utils/           # Utility functions
```

### Adding a New Feature

1. **Create a feature branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Add tests** for your feature in `tests/`

3. **Update TypeScript types** in `src/types/`

4. **Update documentation** in `docs/`

5. **Run the test suite**
   ```bash
   pnpm test
   pnpm type-check
   ```

6. **Submit a pull request**

### Coding Standards

- **TypeScript**: Strict mode enabled, no `any` types
- **Testing**: 80%+ coverage required
- **Documentation**: Update README and docs for new features
- **Commits**: Use [Conventional Commits](https://www.conventionalcommits.org/)

## Publishing

### Version Bump

```bash
# Patch release
pnpm version patch

# Minor release
pnpm version minor

# Major release
pnpm version major
```

### Release Process

1. Update CHANGELOG.md
2. Bump version in package.json
3. Create git tag
4. Push to GitHub
5. Publish to npm:
   ```bash
   npm login
   npm publish
   ```

## Questions?

Open an issue on GitHub or reach out to the maintainers.
