# Change Log

All notable changes to the "File Orchestrator" extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.0.7] - 2026-01-21

### Added

-   **Cross-Directory Search**: Search for related files across the entire workspace, not just in the same directory
-   **Smart Caching**: Intelligent caching system with automatic invalidation when files change
-   **Configurable Search Scope**: Choose between same directory, workspace-wide, or custom path patterns
-   **Search Performance Options**: Configure timeout, exclusion patterns, and cache behavior
-   **Progress Indicators**: Visual feedback during file searches in large projects
-   **Enhanced Related Files View**: Shows directory paths for files in different folders

### Changed

-   Default search scope is now `workspace` instead of `sameDirectory` (can be changed in settings)
-   Jump to Related File menu now shows search scope and directory paths
-   Related Files sidebar now supports cross-directory display with folder icons

### Performance

-   Search result caching reduces subsequent search time by up to 95%
-   Automatic exclusion of common directories (node_modules, .git, dist, build)
-   Configurable search timeout prevents freezing on very large projects

## [0.0.6] - 2026-01-21

### Added

-   **Context Menu Integration**: Right-click on files in Explorer to access File Orchestrator operations
-   **Operation Preview**: Preview files before executing rename, move, or delete operations
-   Icons for all commands in the UI

### Improved

-   Commands can now be triggered from context menu without opening the file first
-   Better user experience with visual confirmation before destructive operations

## [0.0.2] - 2024-08-16

### Added

-   Create new files with specified extensions
-   Jump to related files feature
-   Bulk replace text across related files

### Changed

-   Improved error handling and user feedback in file operations

### Fixed

-   Issue with target directory validation in move operation
