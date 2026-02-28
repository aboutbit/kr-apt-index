'use strict';

require('dotenv').config();

const path = require('path');
const { fetchAllData } = require('./lib/fetcher');
const { generateHTML } = require('./lib/html-generator');
const { loadJSON } = require('./lib/utils');

const TMP_DIR = path.resolve(__dirname, '.tmp');
const OUTPUT_PATH = path.resolve(__dirname, 'index.html');

async function main() {
  const args = process.argv.slice(2);
  const generateOnly = args.includes('--generate-only');
  const scrapeOnly   = args.includes('--scrape-only');

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  한국 아파트 가격 지수 대시보드');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  const apiKey = process.env.REB_API_KEY || '';
  if (!apiKey) {
    console.warn('\n  ⚠  REB_API_KEY 없음 — KEY 없이는 데이터 수집이 제한적입니다.');
    console.warn('     무료 발급: https://www.reb.or.kr → 로그인 → Open API → 인증키 발급\n');
  }

  const molitApiKey = process.env.MOLIT_API_KEY || '';
  if (!molitApiKey) {
    console.warn('  ⚠  MOLIT_API_KEY 없음 — 실거래가 조회 기능이 비활성화됩니다.\n');
  }

  const kakaoJsKey = process.env.KAKAO_JS_KEY || '';
  if (!kakaoJsKey) {
    console.warn('  ⚠  KAKAO_JS_KEY 없음 — 지도 기능이 비활성화됩니다.\n');
  }

  let regionsData;

  const skipFetch = process.env.SKIP_FETCH === '1';
  if (skipFetch) {
    console.log('\n  ⏭  SKIP_FETCH=1: 가격지수 수집 건너뜀 (지도 테스트 모드)');
    regionsData = loadFromCache() || [];
  } else if (generateOnly) {
    console.log('\n  ⏭  --generate-only: 캐시에서 로드 중...');
    regionsData = loadFromCache();
    if (!regionsData) {
      console.error('  ❌ 캐시 없음. 먼저 데이터를 수집하세요.');
      process.exit(1);
    }
  } else {
    regionsData = await fetchAllData(apiKey);
  }

  if (scrapeOnly) {
    console.log('\n  ✅ --scrape-only: 데이터 수집 완료. HTML 생성 건너뜀.');
    return;
  }

  await generateHTML(regionsData, OUTPUT_PATH, molitApiKey, kakaoJsKey);

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  완료!');
  console.log(`  출력: ${OUTPUT_PATH}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

function loadFromCache() {
  const fs = require('fs');
  const surveyFile = path.join(TMP_DIR, 'survey_all.json');
  const txFile     = path.join(TMP_DIR, 'transaction_all.json');
  const weeklyFile = path.join(TMP_DIR, 'weekly_all.json');

  if (!fs.existsSync(surveyFile) && !fs.existsSync(txFile)) return null;

  const surveyMap = loadJSON(surveyFile)  || {};
  const txMap     = loadJSON(txFile)      || {};
  const weeklyMap = fs.existsSync(weeklyFile) ? (loadJSON(weeklyFile) || {}) : {};

  const nameSet = new Set([
    ...Object.keys(surveyMap),
    ...Object.keys(txMap),
    ...Object.keys(weeklyMap),
  ]);
  if (nameSet.size === 0) return null;

  const regionsData = [...nameSet].map(name => ({
    name,
    survey:      surveyMap[name]  || [],
    transaction: txMap[name]      || [],
    weekly:      weeklyMap[name]  || [],
  }));

  regionsData.sort((a, b) => {
    if (a.name === '전국') return -1;
    if (b.name === '전국') return 1;
    return a.name.localeCompare(b.name, 'ko');
  });

  console.log(`  캐시 로드 완료: ${regionsData.length}개 지역`);
  return regionsData;
}

main().catch(err => {
  console.error('\n  ❌ 오류:', err.message);
  if (process.env.DEBUG) console.error(err.stack);
  process.exit(1);
});
