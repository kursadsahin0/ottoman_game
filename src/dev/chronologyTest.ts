import { HISTORICAL_BASELINE } from '@data/HistoricalContent';
import { validateHistoricalRecords, validateReigns, validateTimelineAssertions, type ReignRecord } from '@systems/ChronologyValidator';

let passed = 0; let failed = 0;
function check(label: string, condition: boolean): void { if (condition) { passed++; console.log(`  ok  ${label}`); } else { failed++; console.error(`FAIL  ${label}`); } }
const errors = validateHistoricalRecords().filter(issue => issue.severity === 'error');
check('curated source-backed baseline passes chronology checks', errors.length === 0);
check('timeline retains Osman death as an upper bound', HISTORICAL_BASELINE.find(e => e.id === 'osman-death-by-1324')?.datePrecision === 'terminus_ante_quem');
check('Bapheus date avoids unsupported day-level precision', HISTORICAL_BASELINE.find(e => e.id === 'bapheus-1302')?.datePrecision === 'year' && HISTORICAL_BASELINE.find(e => e.id === 'bapheus-1302')?.dateLabel.includes('gün') === true);
check('fictional opening encounter is not presented as historical', HISTORICAL_BASELINE.every(e => e.id !== 'frontier_local_military_request'));

const rangeIssues = validateHistoricalRecords([{ ...HISTORICAL_BASELINE[0]!, id: 'bad-life', startYear: 1250, endYear: 1251, people: ['test_person'] }], { people: [{ id: 'test_person', name: 'Test person', birthEarliest: 1280, birthLatest: 1284, notes: 'Test fixture only' }] });
check('events before a known birth boundary are detectable', rangeIssues.some(issue => issue.code === 'before-birth'));
const afterDeath = validateHistoricalRecords([{ ...HISTORICAL_BASELINE[0]!, id: 'bad-death', startYear: 1330, endYear: 1331, people: ['osman_gazi'] }]);
check('events after the latest possible death are detectable', afterDeath.some(issue => issue.code === 'after-death'));

const reigns: ReignRecord[] = [{ rulerId: 'a', startYear: 1300, endYear: 1320 }, { rulerId: 'b', startYear: 1315, endYear: 1330 }];
check('inconsistent overlapping reign dates are detected', validateReigns(reigns).some(issue => issue.code === 'overlapping-reigns' && issue.severity === 'error'));
const missingDependency = validateHistoricalRecords([{ ...HISTORICAL_BASELINE[0]!, id: 'missing-prereq', prerequisites: ['nonexistent'] }]);
check('missing prerequisite references are detected', missingDependency.some(issue => issue.code === 'missing-prerequisite'));
const cycle = validateHistoricalRecords([
  { ...HISTORICAL_BASELINE[0]!, id: 'cycle-a', prerequisites: ['cycle-b'] },
  { ...HISTORICAL_BASELINE[0]!, id: 'cycle-b', prerequisites: ['cycle-a'] },
]);
check('impossible prerequisite cycles are detected', cycle.some(issue => issue.code === 'prerequisite-cycle'));
const missingPlace = validateHistoricalRecords([{ ...HISTORICAL_BASELINE[0]!, id: 'missing-place', locations: ['lost_city'] }]);
check('locations missing from the period registry are detected', missingPlace.some(issue => issue.code === 'unknown-location'));
const latePlace = validateHistoricalRecords([{ ...HISTORICAL_BASELINE[0]!, id: 'late-place', startYear: 1200, endYear: 1201, locations: ['bapheus'] }]);
check('locations unavailable in the selected period are detected', latePlace.some(issue => issue.code === 'location-out-of-period'));
check('unlabelled alternative timeline contradiction is rejected', validateTimelineAssertions([{ eventId: 'ankara-battle-1402', outcome: 'Victorious for Bayezid', classification: 'alternate_history', divergesFromBaseline: true }]).some(issue => issue.code === 'unmarked-timeline-contradiction'));
check('marked alternate history remains valid and distinct', validateTimelineAssertions([{ eventId: 'ankara-battle-1402', outcome: 'Victorious for Bayezid', classification: 'alternate_history', divergesFromBaseline: true, explicitMajorDivergence: true }]).length === 0);

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
