// 한국천문연구원 특일 정보 API(공공데이터포털)로 올해 ~ 올해+3년 공휴일·24절기를 받아 holidays.json 을 만든다.
//   - getRestDeInfo      : 공휴일 (대체공휴일·임시공휴일 포함)
//   - get24DivisionsInfo : 24절기
//
// 실행:  KASI_API_KEY=발급받은키 node scripts/fetch_holidays.mjs
//   (GitHub Actions 에서는 Secrets 의 KASI_API_KEY 를 쓴다. 키는 절대 파일에 적지 말 것)
//
// 안전장치:
//   - API 오류·형식 이상이면 파일을 바꾸지 않고 실패(exit 1)
//   - 어떤 해의 데이터가 비었거나 모자라면(아직 발표 전 등) 그 해는 기존 파일 내용을 그대로 둔다
//   - 내용(연도별 데이터)이 바뀌었을 때만 updated_at 을 갱신하고 파일을 쓴다 → 변경 없으면 커밋도 없음
//
// Node 20 이상 (내장 fetch). 다른 패키지는 필요 없다.

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const FEED_VERSION = 1;
export const SOURCE = "한국천문연구원 특일 정보 (공공데이터포털, data.go.kr)";
const BASE = "https://apis.data.go.kr/B090041/openapi/service/SpcdeInfoService";

/** locdate(20260101) → "2026-01-01" */
export const toDate = (loc) => {
  const s = String(loc);
  return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
};

/** API 응답 item 들 → 저장 형식 */
export function toDays(holidayItems, termItems) {
  const days = [];
  for (const it of holidayItems) {
    days.push({ date: toDate(it.locdate), name: String(it.dateName).trim(), kind: "holiday", isOffDay: it.isHoliday === "Y" });
  }
  for (const it of termItems) {
    days.push({ date: toDate(it.locdate), name: String(it.dateName).trim(), kind: "solar_term", isOffDay: false });
  }
  return sortDays(dedupe(days));
}

const dedupe = (days) => {
  const seen = new Set();
  return days.filter((d) => {
    const k = `${d.date}|${d.kind}|${d.name}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
};

export const sortDays = (days) => [...days].sort((a, b) => (a.date + a.kind + a.name).localeCompare(b.date + b.kind + b.name));

/** 한 해 데이터가 쓸 만한지 (공휴일 10개 이상, 절기 정확히 24개) — 앱의 holidayFeed.ts 검사와 같은 기준 */
export function isCompleteYear(days) {
  const hol = days.filter((d) => d.kind === "holiday").length;
  const terms = days.filter((d) => d.kind === "solar_term").length;
  return hol >= 10 && terms === 24;
}

/**
 * 새로 받은 연도별 데이터와 기존 파일을 합친다.
 * - 새 데이터가 완전한 해만 바꾸고, 모자란 해는 기존 값을 유지
 * - 범위(올해~+3년) 밖의 지난 해는 버린다(파일이 계속 커지지 않게) — 단, 작년은 남겨 둔다
 * 내용이 바뀌었으면 updated_at 을 now 로, 아니면 기존 값을 유지한다.
 */
export function buildFeed(previous, fetchedByYear, years, nowIso) {
  const prevYears = previous?.years ?? {};
  const minKeep = Math.min(...years) - 1;
  const out = {};
  const keys = new Set([...Object.keys(prevYears), ...years.map(String)]);
  for (const y of [...keys].sort()) {
    if (Number(y) < minKeep) continue;
    const fresh = fetchedByYear[y];
    if (fresh && isCompleteYear(fresh)) out[y] = sortDays(fresh);
    else if (prevYears[y]) out[y] = prevYears[y];
  }
  const changed = JSON.stringify(out) !== JSON.stringify(prevYears);
  return {
    changed,
    feed: {
      version: FEED_VERSION,
      updated_at: changed || !previous?.updated_at ? nowIso : previous.updated_at,
      source: SOURCE,
      years: out,
    },
  };
}

async function fetchMonth(key, op, year, month) {
  const encoded = key.includes("%") ? key : encodeURIComponent(key);
  const url = `${BASE}/${op}?serviceKey=${encoded}&solYear=${year}&solMonth=${String(month).padStart(2, "0")}&numOfRows=100&_type=json`;
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(url);
      const text = await res.text();
      let json;
      try {
        json = JSON.parse(text);
      } catch {
        // 키 오류 등은 XML 로 온다
        const msg = /<returnAuthMsg>([^<]+)/.exec(text)?.[1] ?? /<resultMsg>([^<]+)/.exec(text)?.[1] ?? text.slice(0, 160);
        throw new Error(`${op} ${year}-${month}: ${msg}`);
      }
      const header = json?.response?.header;
      if (header && header.resultCode !== "00") throw new Error(`${op} ${year}-${month}: ${header.resultCode} ${header.resultMsg}`);
      const items = json?.response?.body?.items?.item;
      if (!items) return [];
      return Array.isArray(items) ? items : [items];
    } catch (e) {
      if (attempt >= 3) throw e;
      await new Promise((r) => setTimeout(r, 2000 * attempt));
    }
  }
}

async function fetchYear(key, year) {
  const hol = [];
  const terms = [];
  for (let m = 1; m <= 12; m++) {
    hol.push(...(await fetchMonth(key, "getRestDeInfo", year, m)));
    terms.push(...(await fetchMonth(key, "get24DivisionsInfo", year, m)));
  }
  return toDays(hol, terms);
}

async function main() {
  const here = dirname(fileURLToPath(import.meta.url));
  const out = join(here, "..", "holidays.json");
  const key = (process.env.KASI_API_KEY ?? "").trim();
  if (!key) {
    console.error("KASI_API_KEY 환경변수가 없습니다. (GitHub: Settings → Secrets and variables → Actions)");
    process.exit(1);
  }
  const thisYear = Number(process.env.FROM_YEAR ?? new Date().getFullYear());
  const years = [thisYear, thisYear + 1, thisYear + 2, thisYear + 3];
  const previous = existsSync(out) ? JSON.parse(readFileSync(out, "utf8")) : null;

  const fetched = {};
  for (const y of years) {
    const days = await fetchYear(key, y);
    const ok = isCompleteYear(days);
    console.log(`${y}: 공휴일 ${days.filter((d) => d.kind === "holiday").length}, 절기 ${days.filter((d) => d.kind === "solar_term").length}${ok ? "" : " → 아직 불완전, 기존 값 유지"}`);
    fetched[y] = days;
  }

  const { changed, feed } = buildFeed(previous, fetched, years, new Date().toISOString().replace(/\.\d{3}Z$/, "Z"));
  if (Object.keys(feed.years).length === 0) {
    console.error("받은 데이터가 하나도 없습니다. 파일을 바꾸지 않습니다.");
    process.exit(1);
  }
  if (!changed) {
    console.log("변경 없음 — holidays.json 그대로");
    return;
  }
  writeFileSync(out, JSON.stringify(feed, null, 1) + "\n", "utf8");
  console.log(`holidays.json 갱신 (${Object.keys(feed.years).join(", ")})`);
}

// node 로 직접 실행했을 때만 main (테스트에서 import 할 때는 실행 안 함)
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => {
    console.error("실패:", e.message);
    process.exit(1);
  });
}
