/**
 * Bootstrap file to eagerly load and register all session orchestrators.
 * Import this in top-level pages to ensure command handlers are ready before first user interaction.
 */

import './chat.orchestrator';
import './direction.orchestrator';
import './collection.orchestrator';
import './report.orchestrator';
// Note: title.orchestrator doesn't exist; title logic is handled by title.supervisor

// Export a dummy value to prevent tree-shaking
export const orchestratorsReady = true;

