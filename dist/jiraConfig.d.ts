import type { JiraSavedSectionsConfigResult } from './types.js';
export declare const JIRA_SAVED_SECTIONS_CONFIG_PATH: string;
export declare function loadJiraSavedSectionsConfig(filePath?: string): JiraSavedSectionsConfigResult;
export declare function parseJiraSavedSectionsConfig(value: unknown, filePath?: string): JiraSavedSectionsConfigResult;
