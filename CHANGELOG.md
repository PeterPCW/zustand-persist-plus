# Changelog

All notable changes to `zustand-persist-plus` are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.0] - 2025-01-30

### Added
- Cloud sync support with Supabase adapter
- Cloud sync support with Firebase adapter
- Real-time sync middleware (`withCloudSync`)
- Conflict resolution strategies (last-write-wins, server-wins, client-wins, merge)
- `CLOUD_SYNC_EXAMPLES.md` with comprehensive examples

### Changed
- Updated `package.json` exports for new cloud sync modules
- Improved TypeScript types for sync adapters

### Fixed
- TypeScript strict mode compatibility issues

## [0.1.0] - 2025-01-29

### Added
- Initial release
- Encryption middleware (AES-GCM, XSalsa20)
- Compression middleware (LZ-String)
- Migration engine with version tracking
- IndexedDB storage adapter
- Full TypeScript support
- Comprehensive test suite
