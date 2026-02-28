'use strict';

/**
 * R-ONE API fetcher
 * 엔드포인트: https://www.reb.or.kr/r-one/openapi/SttsApiTblData.do
 *
 * 사용 STATBL_ID:
 *   A_2024_00045   - (월) 매매가격지수_아파트
 *   T247493131863202 - (월) 실거래가격지수_아파트_규모별 (전국/서울/수도권/지방 × 초소형~대형)
 *
 * KEY 없이는 요청당 ~5건만 반환되어 수만 건 수집 불가.
 * KEY 있으면 pSize=1000으로 수십 페이지로 완전 수집 가능.
 *
 * KEY 발급 (무료):
 *   옵션1: https://www.reb.or.kr → 로그인 → Open API → 인증키 발급
 *   옵션2: https://www.data.go.kr → 15134761 서비스 활용신청 → 인증키 사용
 *   .env 에 REB_API_KEY=<발급받은키> 추가
 */

const axios = require('axios');
const path = require('path');
const { saveJSON, loadJSON, isCacheFresh, sleep } = require('./utils');

const TMP_DIR = path.resolve(__dirname, '../.tmp');
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24시간

const BASE_URL = 'https://www.reb.or.kr/r-one/openapi/SttsApiTblData.do';
const STATBL_SURVEY  = 'A_2024_00045';       // (월) 매매가격지수
const STATBL_TX      = 'T247493131863202';   // (월) 실거래가격지수 (규모별)
const STATBL_WEEKLY  = 'T244183132827305';   // (주) 주간 매매가격지수

const P_SIZE = 1000; // KEY 있을 때 최대 페이지 크기

/**
 * YYYYMM → "YYYY.MM"
 */
function toDateStr(raw) {
  const s = String(raw || '').trim();
  if (s.length !== 6) return null;
  return `${s.slice(0, 4)}.${s.slice(4, 6)}`;
}

/**
 * R-ONE API 단일 페이지 호출
 * @returns {{ totalCount: number, rows: Array }}
 */
async function callApi(params, apiKey) {
  const reqParams = {
    Type: 'json',
    pSize: P_SIZE,
    pIndex: 1,
    ...params,
  };
  if (apiKey) reqParams.KEY = apiKey;

  const res = await axios.get(BASE_URL, {
    params: reqParams,
    timeout: 20000,
  });

  // R-ONE API 응답 구조: { SttsApiTblData: [ { head: [...] }, { row: [...] } ] }
  const wrapper = res.data?.SttsApiTblData;
  if (!wrapper) throw new Error('R-ONE API: 예상치 못한 응답 구조');

  const [headBlock, rowBlock] = Array.isArray(wrapper)
    ? [wrapper[0], wrapper[1]]
    : [wrapper, wrapper];

  const head = headBlock?.head?.[0] || headBlock?.head || {};
  const totalCount = parseInt(head?.list_total_count || '0', 10);
  const resultCode = head?.RESULT?.CODE || '';
  if (resultCode && resultCode !== 'INFO-000') {
    throw new Error(`R-ONE API 오류 (${resultCode}): ${head?.RESULT?.MESSAGE}`);
  }

  const rowRaw = rowBlock?.row;
  const rows = Array.isArray(rowRaw) ? rowRaw : (rowRaw ? [rowRaw] : []);

  return { totalCount, rows };
}

/**
 * 전체 페이지 수집 (페이지네이션)
 */
async function fetchAllPages(extraParams, apiKey, label) {
  const allRows = [];
  let pIndex = 1;
  let total = null;

  while (true) {
    const { totalCount, rows } = await callApi({ ...extraParams, pIndex }, apiKey);

    if (total === null) {
      total = totalCount;
      if (total === 0) {
        console.warn(`    ⚠  ${label}: 데이터 없음 (KEY 없이는 제한적)`);
        break;
      }
      const pages = Math.ceil(total / P_SIZE);
      console.log(`      총 ${total}건 / 약 ${pages}페이지 예상`);
    }

    allRows.push(...rows);
    process.stdout.write(`\r      ${allRows.length}/${total}건 수집됨...`);

    if (allRows.length >= total) break;

    pIndex++;
    await sleep(200);
  }

  if (total && total > 0) process.stdout.write('\n');
  return allRows;
}

/**
 * 매매가격지수 수집
 * 반환: { [regionName]: [{ date: "YYYY.MM", idx: number }] }
 *
 * 최상위 지역(CLS_FULLNM에 ">" 없음)만 유지 → 전국, 수도권, 지방, 5대광역시, 각 도 등
 */
async function fetchSurveyIndex(apiKey) {
  const cacheFile = path.join(TMP_DIR, 'survey_all.json');
  if (isCacheFresh(cacheFile, CACHE_TTL_MS)) {
    console.log('    ⚡ 매매가격지수: 캐시 재사용');
    return loadJSON(cacheFile);
  }

  console.log('    📡 매매가격지수 (A_2024_00045) 수집 중...');
  const rows = await fetchAllPages(
    { STATBL_ID: STATBL_SURVEY, DTACYCLE_CD: 'MM' },
    apiKey,
    '매매가격지수',
  );

  // 최상위 지역만 필터 (CLS_FULLNM에 ">" 없는 것 = 시도 수준 이상)
  const topRows = rows.filter(r => !String(r.CLS_FULLNM || '').includes('>'));

  // 지역별 시계열 구축
  const regionMap = {};
  for (const row of topRows) {
    const name = String(row.CLS_NM || '').trim();
    const date = toDateStr(row.WRTTIME_IDTFR_ID);
    const idx  = parseFloat(row.DTA_VAL);
    if (!name || !date || isNaN(idx)) continue;

    if (!regionMap[name]) regionMap[name] = [];
    regionMap[name].push({ date, idx });
  }

  for (const arr of Object.values(regionMap)) {
    arr.sort((a, b) => a.date.localeCompare(b.date));
  }

  console.log(`    ✅ 매매가격지수 최상위 지역: ${Object.keys(regionMap).join(', ')}`);
  saveJSON(cacheFile, regionMap);
  return regionMap;
}

/**
 * 실거래가격지수 수집
 * 반환: { [regionName]: [{ date: "YYYY.MM", idx: number }] }
 *
 * GRP_NM 기준 지역: 전국, 서울, 수도권, 지방
 * 각 지역별로 5개 규모(초소형~대형)의 단순 평균 → 전체 규모 지수 대체
 */
async function fetchTransactionIndex(apiKey) {
  const cacheFile = path.join(TMP_DIR, 'transaction_all.json');
  if (isCacheFresh(cacheFile, CACHE_TTL_MS)) {
    console.log('    ⚡ 실거래가격지수: 캐시 재사용');
    return loadJSON(cacheFile);
  }

  console.log('    📡 실거래가격지수 (T247493131863202) 수집 중...');
  const rows = await fetchAllPages(
    { STATBL_ID: STATBL_TX, DTACYCLE_CD: 'MM' },
    apiKey,
    '실거래가격지수',
  );

  // GRP_NM × date 별로 지수값 누적 (규모 평균 내기 위해)
  const accumulator = {}; // { name: { date: [idx, ...] } }
  for (const row of rows) {
    const name = String(row.GRP_NM || '').trim();
    const date = toDateStr(row.WRTTIME_IDTFR_ID);
    const idx  = parseFloat(row.DTA_VAL);
    if (!name || !date || isNaN(idx)) continue;

    if (!accumulator[name]) accumulator[name] = {};
    if (!accumulator[name][date]) accumulator[name][date] = [];
    accumulator[name][date].push(idx);
  }

  // 규모별 단순 평균 → 대표 지수
  const regionMap = {};
  for (const [name, dateMap] of Object.entries(accumulator)) {
    regionMap[name] = Object.entries(dateMap)
      .map(([date, vals]) => ({
        date,
        idx: vals.reduce((a, b) => a + b, 0) / vals.length,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  console.log(`    ✅ 실거래가격지수 지역: ${Object.keys(regionMap).join(', ')}`);
  saveJSON(cacheFile, regionMap);
  return regionMap;
}

/**
 * 주간 매매가격지수 수집
 * 반환: { [regionName]: [{ date: "YYYY-MM-DD", idx: number }] }
 *
 * WRTTIME_IDTFR_ID: YYYYWW 형식 (예: "201219" = 2012년 19주)
 * WRTTIME_DESC: "YYYY-MM-DD" 형식 → 해당 주의 시작일로 사용
 * 최상위 지역(CLS_FULLNM에 ">" 없음)만 유지
 */
async function fetchWeeklyIndex(apiKey) {
  const cacheFile = path.join(TMP_DIR, 'weekly_all.json');
  if (isCacheFresh(cacheFile, CACHE_TTL_MS)) {
    console.log('    ⚡ 주간 매매가격지수: 캐시 재사용');
    return loadJSON(cacheFile);
  }

  console.log('    📡 주간 매매가격지수 (T244183132827305) 수집 중...');
  const rows = await fetchAllPages(
    { STATBL_ID: STATBL_WEEKLY, DTACYCLE_CD: 'WK' },
    apiKey,
    '주간 매매가격지수',
  );

  // 최상위 지역만 필터 (CLS_FULLNM에 ">" 없는 것)
  const topRows = rows.filter(r => !String(r.CLS_FULLNM || '').includes('>'));

  // 지역별 시계열 구축 - WRTTIME_DESC 사용 (YYYY-MM-DD 형식)
  const regionMap = {};
  for (const row of topRows) {
    const name = String(row.CLS_NM || '').trim();
    const date = String(row.WRTTIME_DESC || '').trim().slice(0, 10); // "YYYY-MM-DD"
    const idx  = parseFloat(row.DTA_VAL);
    if (!name || date.length < 10 || isNaN(idx)) continue;

    if (!regionMap[name]) regionMap[name] = [];
    regionMap[name].push({ date, idx });
  }

  for (const arr of Object.values(regionMap)) {
    arr.sort((a, b) => a.date.localeCompare(b.date));
  }

  console.log(`    ✅ 주간 매매가격지수 최상위 지역: ${Object.keys(regionMap).join(', ')}`);
  saveJSON(cacheFile, regionMap);
  return regionMap;
}

/**
 * 전체 수집 + 통합
 * 반환: [{ name, survey: [{date,idx}], transaction: [{date,idx}], weekly: [{date,idx}] }]
 */
async function fetchAllData(apiKey) {
  console.log('\n  📡 Phase A: R-ONE API 데이터 수집 중...');

  const [surveyMap, txMap, weeklyMap] = await Promise.all([
    fetchSurveyIndex(apiKey),
    fetchTransactionIndex(apiKey),
    fetchWeeklyIndex(apiKey),
  ]);

  // 전체 지역 union
  const nameSet = new Set([
    ...Object.keys(surveyMap),
    ...Object.keys(txMap),
    ...Object.keys(weeklyMap),
  ]);

  const regionsData = [...nameSet].map(name => ({
    name,
    survey:      surveyMap[name]  || [],
    transaction: txMap[name]      || [],
    weekly:      weeklyMap[name]  || [],
  }));

  // 전국 먼저, 나머지 가나다순
  regionsData.sort((a, b) => {
    if (a.name === '전국') return -1;
    if (b.name === '전국') return 1;
    return a.name.localeCompare(b.name, 'ko');
  });

  console.log(`\n  ✅ 지역 수: ${regionsData.length}개`);
  return regionsData;
}

module.exports = { fetchAllData };
