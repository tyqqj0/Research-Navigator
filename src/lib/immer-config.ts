// Ensure Immer supports Map and Set structures across the app
import { enableMapSet } from 'immer';

try {
    enableMapSet();
} catch {
    // ignore if already enabled or in non-browser contexts
}

export { };


