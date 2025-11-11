# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.1] - 2025-11-11

#### Fixes

- Fix exception when parsing cloud account response when room has no devices in it

## [1.0.0] - 2025-11-09

### BREAKING CHANGES

#### Package Structure

- Changed output directory from `dist` to `.dist`
- Updated module exports to use new ES module format with explicit `types` and `default` fields
- Removed CommonJS `main` and `types` fields in favor of `exports` map
- Updated TypeScript target from older ECMAScript to ES2024

#### File Renames (Internal API)

- Renamed `LightwaveJsonMessageProcessor.ts` to `LightwaveMessageProcessorForJson.ts`
- Renamed `LightwaveTextMessageProcessor.ts` to `LightwaveMessageProcessorForText.ts`

#### Removed Features

- Removed `bin` directory and CLI executable

### Added

- Comprehensive test suite using Vitest
  - Added test files: `LightwaveAccount.test.ts`, `LightwaveRFClient.test.ts`, `index.test.ts`
  - Added test fixtures in `src/.fixtures/` for VCR-based HTTP testing
  - Integration with `fetch-vcr` for HTTP request recording/replaying
- TypeScript strict mode enabled for better type safety
- Modern build tooling with Vitest for testing

### Changed

- Complete TypeScript rewrite with improved type definitions
- Updated dependencies:
  - Upgraded to modern lockfile format (lockfileVersion 3)
  - Added `vitest` v4.0.7 as dev dependency
  - Added `fetch-vcr` v3.2.0 for HTTP testing
  - Updated `debug` to 4.3.3
  - Updated all TypeScript type definitions to latest versions
- Modernized TypeScript configuration:
  - Target set to ES2024
  - Strict mode enabled
  - Output directory changed to `.dist`
  - Enabled declaration file generation
- Improved `.gitignore` to include `.dist` directory

### Improved

- Better code organization with renamed message processor files
- Enhanced type safety throughout the codebase
- More maintainable project structure
- Better testing infrastructure

### Migration Guide

For users upgrading from 0.0.x to 1.0.0:

1. **Import paths remain unchanged** - The public API exports are the same
2. **If you were directly importing internal files**, update:
   - `LightwaveJsonMessageProcessor` → `LightwaveMessageProcessorForJson`
   - `LightwaveTextMessageProcessor` → `LightwaveMessageProcessorForText`
3. **Build output** - The compiled files are now in `.dist/` instead of `dist/` (but this shouldn't affect consumers of the package)
4. **CLI removed** - If you were using the CLI, you'll need to use the library API directly

---

## [0.0.9] - Earlier

Previous releases. See git history for details.
