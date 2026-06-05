// Document types
export * from './document-types';

// Key transformation utilities and types
export * from './key-transform';

// Event types
export * from './event-types';

// Comment types
export type {
  Comment,
  CommentContent,
  CommentJSON,
  CommentThreadingProfile,
  CommentThreadingStyle,
} from './comments-types';

// Identity helpers
export * from './identity';

// List numbering helpers
export * from './list-numbering';
export * from './list-rendering';

// File helpers
export * from './helpers/get-file-object';
export * from './helpers/compare-superdoc-versions';

// Vue directives
export { default as vClickOutside } from './helpers/v-click-outside';

// Note: Vue components like BasicUpload must be imported directly from the components path:
// import BasicUpload from '@superdoc/common/components/BasicUpload.vue'
// This is because .vue files cannot be re-exported from compiled TypeScript in dist/

// Collaboration/Awareness
export * from './collaboration/awareness';

// Telemetry — routed to the fork's no-op so `new Telemetry()` is inert (no network).
// COMMUNITY_LICENSE_KEY is forced to '' here. The original Telemetry class is bypassed.
export { default as Telemetry } from '../../../telemetry-noop';
export const COMMUNITY_LICENSE_KEY = '';
export type { TelemetryConfig, TelemetryPayload, DocumentOpenEvent, BrowserInfo } from './Telemetry';
