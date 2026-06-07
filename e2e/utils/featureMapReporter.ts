import type {
  Reporter,
  FullConfig,
  Suite,
  FullResult,
} from '@playwright/test/reporter';
import { readFileSync, appendFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';

interface Feature { id: string; type: string; name: string; spec: string; }
type Status = 'passed' | 'failed' | 'flaky' | 'skipped' | 'notcovered';

const ICON: Record<Status, string> = {
  passed: '✅ Passed',
  failed: '❌ Failed',
  flaky: '⚠️ Flaky',
  skipped: '⏭️ Skipped',
  notcovered: '🚫 Not Covered',
};

interface TestRec { id: string; title: string; file: string; status: Status; duration: number; }
interface Scenario { id: string; type: string; title: string; spec: string; status: Status; duration: number; }

function parseKV(s: string): { k: string; v: string } | null {
  const m = s.match(/^([A-Za-z0-9_]+):\s*(.*)$/);
  if (!m) return null;
  let v = m[2].trim();
  if (v.length >= 2 && ((v[0] === '"' && v.at(-1) === '"') || (v[0] === "'" && v.at(-1) === "'"))) {
    v = v.slice(1, -1);
  }
  return { k: m[1], v };
}

/** Minimal YAML reader for the fixed `features:` list — no deps. */
function parseFeatureMap(file: string): Feature[] {
  const out: Feature[] = [];
  let cur: Partial<Feature> | null = null;
  let inFeatures = false;
  for (const raw of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const trimmed = raw.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    if (trimmed === 'features:') { inFeatures = true; continue; }
    if (!inFeatures) continue;
    const item = raw.match(/^\s*-\s+(.*)$/);
    if (item) {
      cur = {};
      out.push(cur as Feature);
      const kv = parseKV(item[1]);
      if (kv) (cur as Record<string, string>)[kv.k] = kv.v;
      continue;
    }
    const kv = parseKV(trimmed);
    if (kv && cur) (cur as Record<string, string>)[kv.k] = kv.v;
  }
  return out;
}

function extractId(title: string): string {
  return title.match(/\b([A-Z]{2}\d{4})\b/)?.[1] ?? '';
}

function fmtDuration(ms: number): string {
  const totalSec = ms / 1000;
  if (totalSec < 60) return `${totalSec.toFixed(1)}s`;
  const sec = Math.round(totalSec);
  return `${Math.floor(sec / 60)}m ${sec % 60}s`;
}

const cell = (s: string) => String(s).replace(/\|/g, '\\|');

function table(headers: string[], rows: string[][]): string {
  const head = `| ${headers.join(' | ')} |`;
  const sep = `| ${headers.map(() => '---').join(' | ')} |`;
  const body = rows.map((r) => `| ${r.map(cell).join(' | ')} |`).join('\n');
  return `${head}\n${sep}\n${body}`;
}

export default class FeatureMapReporter implements Reporter {
  private rootSuite!: Suite;
  private startedAt = Date.now();
  private features: Feature[] = [];

  onBegin(_config: FullConfig, suite: Suite): void {
    this.rootSuite = suite;
    this.startedAt = Date.now();
    const fmPath = path.join(process.cwd(), 'feature-map', 'feature-map.yml');
    try { this.features = parseFeatureMap(fmPath); }
    catch (e) { console.warn(`[feature-map] could not read ${fmPath}: ${(e as Error).message}`); }
  }

  onEnd(_result: FullResult): void {
    try {
      const markdown = this.buildReport();
      const summaryFile = process.env.GITHUB_STEP_SUMMARY;
      if (summaryFile) appendFileSync(summaryFile, `${markdown}\n`);
      const outDir = path.join(process.cwd(), 'playwright-report');
      mkdirSync(outDir, { recursive: true });
      writeFileSync(path.join(outDir, 'feature-map-summary.md'), `${markdown}\n`);
      console.log('[feature-map] summary written to playwright-report/feature-map-summary.md');
    } catch (e) {
      console.warn(`[feature-map] report failed: ${(e as Error).message}`);
    }
  }

  private buildReport(): string {
    const wall = Date.now() - this.startedAt;
    const recs: TestRec[] = this.rootSuite.allTests().map((t) => {
      const oc = t.outcome();
      const status: Status =
        oc === 'expected' ? 'passed'
        : oc === 'unexpected' ? 'failed'
        : oc === 'flaky' ? 'flaky'
        : 'skipped';
      return {
        id: extractId(t.title), title: t.title,
        file: path.relative(process.cwd(), t.location.file).replace(/\\/g, '/'),
        status, duration: t.results.at(-1)?.duration ?? 0,
      };
    });

    const byId = new Map<string, TestRec>();
    for (const r of recs) if (r.id) byId.set(r.id, r);

    const scenarios: Scenario[] = this.features.map((f) => {
      const r = byId.get(f.id);
      return {
        id: f.id, type: f.type ?? '', title: f.name, spec: f.spec ?? '',
        status: r ? r.status : ('notcovered' as Status),
        duration: r ? r.duration : 0,
      };
    }).sort((a, b) => a.id.localeCompare(b.id));

    const total = recs.length;
    const count = (s: Status) => recs.filter((r) => r.status === s).length;
    const passed = count('passed'), failed = count('failed'), flaky = count('flaky'), skipped = count('skipped');
    const notCovered = scenarios.filter((s) => s.status === 'notcovered').length;
    const coverage = total ? ((passed / total) * 100).toFixed(1) : '0.0';
    const avg = total ? recs.reduce((a, r) => a + r.duration, 0) / total : 0;
    const date = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

    const finalStats = table(
      ['Test','Total','Passed ✅','Failed ❌','Flaky ⚠️','Skipped ⏭️','Not Covered 🚫','Coverage','Duration','Average','Date'],
      [['E2E', String(total), String(passed), String(failed), String(flaky), String(skipped),
        String(notCovered), `${coverage}%`, fmtDuration(wall), fmtDuration(avg), date]],
    );

    const files = [...new Set([...recs.map((r) => r.file), ...this.features.map((f) => f.spec)])].filter(Boolean).sort();
    const specRows = files.map((file) => {
      const fr = recs.filter((r) => r.file === file);
      const fc = (s: Status) => fr.filter((r) => r.status === s).length;
      const nc = scenarios.filter((s) => s.status === 'notcovered' && s.spec === file).length;
      const time = fr.reduce((a, r) => a + r.duration, 0);
      return [file, String(fr.length), String(fc('passed')), String(fc('failed')), String(fc('skipped')),
              String(nc), fmtDuration(time), fr.length ? fmtDuration(time / fr.length) : '-'];
    });
    const specStats = table(['Spec File','Total','Passed ✅','Failed ❌','Skipped ⏭️','Not Covered 🚫','Total Time','Avg Time'], specRows);

    const scenarioRows = scenarios.map((s) => [
      s.id, s.type, s.title, ICON[s.status],
      s.status === 'notcovered' ? '-' : fmtDuration(s.duration),
    ]);
    const scenarioStats = table(['ID','Type','Title','Status','Duration'], scenarioRows);

    const featureIds = new Set(this.features.map((f) => f.id));
    const unmapped = recs.filter((r) => !featureIds.has(r.id));
    const unmappedNote = unmapped.length
      ? `\n> ⚠️ ${unmapped.length} executed test(s) have no feature-map id — give the test an "AA0001 : " title prefix or add the id to feature-map/feature-map.yml.\n`
      : '';

    return [
      '## ✏️ Test Summary', '',
      '### 📊 Final Statistics', '', finalStats, '',
      '### 📂 Spec File Statistics', '', specStats, '',
      '### 🏆 Covered Scenarios', '', scenarioStats,
      unmappedNote,
    ].join('\n');
  }
}
