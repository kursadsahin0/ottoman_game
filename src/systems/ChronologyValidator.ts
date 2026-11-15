import { HISTORICAL_BASELINE, HISTORICAL_LOCATIONS, HISTORICAL_PEOPLE, HISTORICAL_SOURCES, type HistoricalClassification, type HistoricalRecord } from '@data/HistoricalContent';
import { HISTORICAL_EVENTS, type HistoricalEvent } from '@data/HistoricalData';

export interface ChronologyIssue { code: string; severity: 'error' | 'warning'; recordId?: string; message: string }
export interface ReignRecord { rulerId: string; startYear: number; endYear?: number; startApproximate?: boolean; endApproximate?: boolean }
export interface TimelineAssertion { eventId: string; outcome: string; classification: HistoricalClassification; divergesFromBaseline?: boolean; explicitMajorDivergence?: boolean }

export function validateEventDefinitions(events:HistoricalEvent[]=HISTORICAL_EVENTS):ChronologyIssue[]{
  const issues:ChronologyIssue[]=[],byId=new Map<string,HistoricalEvent>();
  for(const event of events){
    if(byId.has(event.id))issues.push({code:'duplicate-event-id',severity:'error',recordId:event.id,message:'Event IDs must be unique.'});
    byId.set(event.id,event);
    if(event.latestYear!==undefined&&event.latestYear<event.earliestYear)issues.push({code:'invalid-event-window',severity:'error',recordId:event.id,message:'Event end year precedes its start year.'});
    if(!event.choices.length)issues.push({code:'event-without-choice',severity:'error',recordId:event.id,message:'Playable events need at least one choice.'});
    if(new Set(event.choices.map(choice=>choice.id)).size!==event.choices.length)issues.push({code:'duplicate-choice-id',severity:'error',recordId:event.id,message:'Choice IDs must be unique within an event.'});
    if(event.baselineEventId&&!HISTORICAL_BASELINE.some(record=>record.id===event.baselineEventId))issues.push({code:'unknown-event-anchor',severity:'error',recordId:event.id,message:`Historical anchor is missing: ${event.baselineEventId}`});
    for(const choice of event.choices){
      if(choice.divergesFromBaseline&&(!event.baselineEventId||!choice.divergenceExplanation?.trim()))issues.push({code:'unexplained-event-divergence',severity:'error',recordId:event.id,message:`Choice ${choice.id} needs a historical anchor and an explanation for its divergence.`});
      for(const cost of choice.immediateConsequences.filter(consequence=>consequence.type==='currency'&&typeof consequence.value==='number'&&consequence.value<0)){
        const covered=(choice.requirements??[]).some(requirement=>requirement.type==='currency'&&requirement.value>=Math.abs(cost.value as number));
        if(!covered)issues.push({code:'unguarded-event-cost',severity:'error',recordId:event.id,message:`Choice ${choice.id} spends currency without an affordability prerequisite.`});
      }
    }
  }
  for(const event of events)for(const id of event.prerequisites){const prerequisite=byId.get(id);if(!prerequisite)issues.push({code:'missing-event-prerequisite',severity:'error',recordId:event.id,message:`Event prerequisite is missing: ${id}`});else if(prerequisite.earliestYear>(event.latestYear??event.earliestYear))issues.push({code:'event-prerequisite-out-of-range',severity:'error',recordId:event.id,message:`Prerequisite ${id} occurs after this event's window.`});}
  const visiting=new Set<string>(),visited=new Set<string>();const visit=(id:string):void=>{if(visiting.has(id)){issues.push({code:'event-prerequisite-cycle',severity:'error',recordId:id,message:'Playable event prerequisites contain a cycle.'});return;}if(visited.has(id))return;visiting.add(id);for(const dependency of byId.get(id)?.prerequisites??[])if(byId.has(dependency))visit(dependency);visiting.delete(id);visited.add(id);};
  for(const id of byId.keys())visit(id);
  return issues;
}

/** Pure validation functions are usable in editor tooling, tests, and release checks. */
export function validateHistoricalRecords(records: HistoricalRecord[] = HISTORICAL_BASELINE, registries: { sources?: typeof HISTORICAL_SOURCES; people?: typeof HISTORICAL_PEOPLE; locations?: typeof HISTORICAL_LOCATIONS } = {}): ChronologyIssue[] {
  const issues: ChronologyIssue[] = [];
  const eventById = new Map(records.map(record => [record.id, record]));
  const sourceById = new Map((registries.sources ?? HISTORICAL_SOURCES).map(source => [source.id, source]));
  const personById = new Map((registries.people ?? HISTORICAL_PEOPLE).map(person => [person.id, person]));
  const locationById = new Map((registries.locations ?? HISTORICAL_LOCATIONS).map(location => [location.id, location]));

  for (const record of records) {
    if (record.endYear < record.startYear) issues.push({ code: 'invalid-date-range', severity: 'error', recordId: record.id, message: 'Olay bitiş yılı başlangıç yılından önce.' });
    if (record.classification === 'documented_fact' || record.classification === 'disputed_interpretation') {
      if (!record.sources.length) issues.push({ code: 'missing-source', severity: 'error', recordId: record.id, message: 'Tarihsel iddia için kaynak kaydı yok.' });
      for (const citation of record.sources) {
        const source = sourceById.get(citation.sourceId);
        if (!source) issues.push({ code: 'unknown-source', severity: 'error', recordId: record.id, message: `Kaynak kaydı bulunamadı: ${citation.sourceId}` });
        else if (!source.checkedOn || !source.checkedReference || !citation.supports.trim()) issues.push({ code: 'unchecked-source', severity: 'error', recordId: record.id, message: `Kaynağın iddiayı desteklediği doğrulanmamış: ${source.id}` });
      }
    }
    if (record.classification === 'alternate_history' && !record.divergenceRequired) issues.push({ code: 'unmarked-alternate-history', severity: 'error', recordId: record.id, message: 'Alternatif tarih açık ayrışma işareti gerektirir.' });
    if ((record.classification === 'plausible_unverified' || record.classification === 'disputed_interpretation') && !record.disputedInterpretations.length) issues.push({ code: 'missing-uncertainty-note', severity: 'warning', recordId: record.id, message: 'Belirsizlik veya tartışma notu ekleyin.' });
    for (const personId of record.people) {
      const person = personById.get(personId);
      if (!person) { issues.push({ code: 'unknown-person', severity: 'error', recordId: record.id, message: `Kişi kaydı bulunamadı: ${personId}` }); continue; }
      if (person.birthEarliest !== undefined && record.endYear < person.birthEarliest) issues.push({ code: 'before-birth', severity: 'error', recordId: record.id, message: `${person.name}, doğum aralığından önce olayda görünüyor.` });
      if (person.deathLatest !== undefined && record.startYear > person.deathLatest) issues.push({ code: 'after-death', severity: 'error', recordId: record.id, message: `${person.name}, olası ölüm tarihinden sonra olayda görünüyor.` });
      if (person.birthLatest !== undefined && record.startYear < person.birthLatest && (person.birthEarliest === undefined || record.endYear >= person.birthEarliest)) issues.push({ code: 'birth-date-overlap', severity: 'warning', recordId: record.id, message: `${person.name} için olay/doğum tarihleri belirsizlik aralığında örtüşüyor.` });
      if (person.deathEarliest !== undefined && record.endYear > person.deathEarliest && (person.deathLatest === undefined || record.startYear <= person.deathLatest)) issues.push({ code: 'death-date-overlap', severity: 'warning', recordId: record.id, message: `${person.name} için olay/ölüm tarihleri belirsizlik aralığında örtüşüyor.` });
    }
    for (const locationId of record.locations) {
      const location = locationById.get(locationId);
      if (!location) { issues.push({ code: 'unknown-location', severity: 'error', recordId: record.id, message: `Konum kaydı bulunamadı: ${locationId}` }); continue; }
      if (record.endYear < location.availableFrom || (location.availableUntil !== undefined && record.startYear > location.availableUntil)) issues.push({ code: 'location-out-of-period', severity: 'error', recordId: record.id, message: `${location.name}, belirtilen tarih aralığında kullanılamıyor.` });
      if (location.classification === 'fictional' && record.classification !== 'fictional' && record.classification !== 'alternate_history') issues.push({ code: 'fictional-location-in-baseline', severity: 'error', recordId: record.id, message: 'Kurgu konum, tarihsel temel olayda kullanılamaz.' });
    }
    for (const prerequisiteId of record.prerequisites) {
      const prerequisite = eventById.get(prerequisiteId);
      if (!prerequisite) issues.push({ code: 'missing-prerequisite', severity: 'error', recordId: record.id, message: `Önkoşul bulunamadı: ${prerequisiteId}` });
      else if (prerequisite.startYear > record.startYear) issues.push({ code: 'prerequisite-after-event', severity: 'error', recordId: record.id, message: `Önkoşul ${prerequisiteId}, bu olaydan sonra başlıyor.` });
    }
  }

  const visiting = new Set<string>();
  const visited = new Set<string>();
  const visit = (id: string): void => {
    if (visiting.has(id)) { issues.push({ code: 'prerequisite-cycle', severity: 'error', recordId: id, message: 'Olay önkoşulları döngü oluşturuyor.' }); return; }
    if (visited.has(id)) return;
    visiting.add(id);
    for (const dependency of eventById.get(id)?.prerequisites ?? []) if (eventById.has(dependency)) visit(dependency);
    visiting.delete(id); visited.add(id);
  };
  for (const id of eventById.keys()) visit(id);
  return issues;
}

export function validateReigns(reigns: ReignRecord[]): ChronologyIssue[] {
  const issues: ChronologyIssue[] = [];
  for (const reign of reigns) if (reign.endYear !== undefined && reign.endYear < reign.startYear) issues.push({ code: 'invalid-reign', severity: 'error', recordId: reign.rulerId, message: 'Saltanat bitişi başlangıcından önce.' });
  const ordered = [...reigns].filter(r => r.endYear !== undefined).sort((a, b) => a.startYear - b.startYear);
  for (let i = 1; i < ordered.length; i++) {
    const previous = ordered[i - 1]!; const current = ordered[i]!;
    if (previous.endYear! > current.startYear) {
      const uncertain = previous.endApproximate || current.startApproximate || previous.endYear === current.startYear;
      issues.push({ code: 'overlapping-reigns', severity: uncertain ? 'warning' : 'error', recordId: current.rulerId, message: `${previous.rulerId} ve ${current.rulerId} saltanat tarihleri örtüşüyor; yaklaşık tarihler olabilir.` });
    }
  }
  return issues;
}

export function validateTimelineAssertions(assertions: TimelineAssertion[]): ChronologyIssue[] {
  return assertions.flatMap(assertion => assertion.divergesFromBaseline && !assertion.explicitMajorDivergence
    ? [{ code: 'unmarked-timeline-contradiction', severity: 'error' as const, recordId: assertion.eventId, message: `“${assertion.outcome}” tarihsel temelden ayrışıyor ancak büyük ayrışma olarak işaretlenmemiş.` }]
    : assertion.classification === 'alternate_history' && !assertion.divergesFromBaseline
      ? [{ code: 'alternate-without-divergence', severity: 'error' as const, recordId: assertion.eventId, message: 'Alternatif tarih sonucu zaman çizgisi ayrışması olarak kaydedilmemiş.' }]
      : []);
}

export function getChronologyHealth(): ChronologyIssue[] { return [...validateHistoricalRecords(),...validateEventDefinitions()]; }
