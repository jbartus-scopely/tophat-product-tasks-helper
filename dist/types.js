export const PRIORITY_ORDER = ['Critical', 'Major', 'Minor', 'Unprioritized', ''];
export const CSV_DISPLAY_COLUMNS = [
    'ID',
    'JIRA',
    'Description/Problem',
    'Priority',
    'Status',
    'Initiative',
    'Priority pod',
    'Reporter',
    'Date',
    'Comments',
];
export const CSV_REQUIRED_FIELDS = ['ID', 'Description/Problem', 'Status'];
export const CSV_VALID_PRIORITIES = ['Critical', 'Major', 'Minor', 'Unprioritized'];
export const CSV_VALID_STATUSES = ['TRIAGE', 'TODO', 'Prioritized', 'HOLD'];
export const STATUS_ORDER = [
    'Prioritized',
    'Pre-Pro Ready',
    'Ready for release',
    'Prepro-In Progress',
    'TODO',
    'Pod Working',
    'BLOCK',
    'TRIAGE',
    'HOLD',
    'Live',
    '',
];
export const PREPRO_VALUES = ['0 - Low', '1 - Mid', '2 - High'];
export const RISK_VALUES = ['Low', 'High'];
export const APPEARANCE_VALUES = ['All Sessions', 'Daily', 'Sometimes', 'Uncommon'];
//# sourceMappingURL=types.js.map