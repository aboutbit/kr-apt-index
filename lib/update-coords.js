'use strict';

/**
 * 아파트 좌표 캐시 업데이터
 *
 * MOLIT 실거래 API로 전국 시군구를 순회하며 아파트 좌표를 수집합니다.
 * - 1순위: MOLIT 상세 API가 직접 제공하는 lat/lng
 * - 2순위: Kakao REST API 키워드 검색 (MOLIT 좌표 없을 때)
 *
 * 결과: data/coords-cache.json  (key: "lawdCd|umdNm|aptNm")
 *
 * 환경변수:
 *   MOLIT_API_KEY    - 필수
 *   KAKAO_REST_KEY   - 선택 (없으면 MOLIT 좌표만 수집)
 *
 * Usage:
 *   node lib/update-coords.js
 *   node lib/update-coords.js --months 3   # 최근 N개월치 조회 (기본 1)
 */

require('dotenv').config();

const https = require('https');
const fs    = require('fs');
const path  = require('path');

const SIGUNGU_CODES = require('./sigungu-codes');

const DATA_DIR   = path.resolve(__dirname, '../data');
const CACHE_FILE = path.join(DATA_DIR, 'coords-cache.json');

const MOLIT_KEY  = process.env.MOLIT_API_KEY  || '';
const KAKAO_KEY  = process.env.KAKAO_REST_KEY || '';

const args         = process.argv.slice(2);
const monthsIdx    = args.indexOf('--months');
const FETCH_MONTHS = monthsIdx !== -1 ? parseInt(args[monthsIdx + 1], 10) || 1 : 1;

// ── 유틸 ────────────────────────────────────────────────────────────────────

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

const FETCH_TIMEOUT_MS = 10000; // 10초 타임아웃

function fetchJSON(url) {
  return new Promise((resolve, reject) => {
    const get = (u, hops = 0) => {
      if (hops > 5) return reject(new Error('Too many redirects'));
      const req = https.get(u, res => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          return get(res.headers.location, hops + 1);
        }
        let buf = '';
        res.on('data', c => buf += c);
        res.on('end', () => { try { resolve(JSON.parse(buf)); } catch (e) { reject(e); } });
        res.on('error', reject);
      }).on('error', reject);
      req.setTimeout(FETCH_TIMEOUT_MS, () => { req.destroy(new Error('timeout')); });
    };
    get(url);
  });
}

// Kakao REST API 키워드 검색 → { lat, lng } | null
function kakaoSearch(query) {
  return new Promise(resolve => {
    const options = {
      hostname: 'dapi.kakao.com',
      path:     `/v2/local/search/keyword.json?query=${encodeURIComponent(query)}&size=1`,
      headers:  { Authorization: `KakaoAK ${KAKAO_KEY}` },
    };
    const req = https.get(options, res => {
      let buf = '';
      res.on('data', c => buf += c);
      res.on('end', () => {
        try {
          const docs = JSON.parse(buf).documents || [];
          resolve(docs.length > 0 ? { lat: parseFloat(docs[0].y), lng: parseFloat(docs[0].x) } : null);
        } catch { resolve(null); }
      });
      res.on('error', () => resolve(null));
    }).on('error', () => resolve(null));
    req.setTimeout(FETCH_TIMEOUT_MS, () => { req.destroy(); resolve(null); });
  });
}

// 조회할 월 목록 (YYYYMM, 최신순)
function recentMonths(n) {
  const months = [];
  const now = new Date();
  for (let i = 0; i < n; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(String(d.getFullYear()) + String(d.getMonth() + 1).padStart(2, '0'));
  }
  return months;
}

// ── 메인 ────────────────────────────────────────────────────────────────────

async function main() {
  if (!MOLIT_KEY) {
    console.error('❌ MOLIT_API_KEY 환경변수가 없습니다.');
    process.exit(1);
  }

  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

  const cache = fs.existsSync(CACHE_FILE)
    ? JSON.parse(fs.readFileSync(CACHE_FILE, 'utf-8'))
    : {};

  const months = recentMonths(FETCH_MONTHS);
  console.log(`\n📍 좌표 캐시 업데이트`);
  console.log(`   조회 월: ${months.join(', ')}`);
  console.log(`   기존 캐시: ${Object.keys(cache).length}개`);
  if (!KAKAO_KEY) console.log('   ⚠ KAKAO_REST_KEY 없음 — MOLIT 좌표만 수집');
  console.log();

  const detailedBase = 'https://apis.data.go.kr/1613000/RTMSDataSvcAptTradeDev/getRTMSDataSvcAptTradeDev';
  const basicBase    = 'https://apis.data.go.kr/1613000/RTMSDataSvcAptTrade/getRTMSDataSvcAptTrade';

  let newFromMolit = 0;
  let newFromKakao = 0;
  let kakaoFailed  = 0;
  let sigunguDone  = 0;
  const totalSigungu = Object.values(SIGUNGU_CODES).reduce((s, g) => s + Object.keys(g).length, 0);

  for (const [sido, sigungus] of Object.entries(SIGUNGU_CODES)) {
    for (const [sigunguNm, lawdCd] of Object.entries(sigungus)) {
      sigunguDone++;
      process.stdout.write(`\r   진행: ${sigunguDone}/${totalSigungu} 시군구 — 캐시 ${Object.keys(cache).length}개   `);
      // 50 시군구마다 중간 저장 (실패해도 진행분 보존)
      if (sigunguDone % 50 === 0) {
        fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2), 'utf-8');
        process.stdout.write(` [저장됨]`);
      }

      for (const ym of months) {
        // 상세 API 우선 시도 (lat/lng 포함), 실패 시 기본 API
        let items;
        // 참고: resultCode는 API에 따라 '00' 또는 '000' 모두 사용됨
        for (const base of [detailedBase, basicBase]) {
          const url = `${base}?serviceKey=${MOLIT_KEY}&LAWD_CD=${encodeURIComponent(lawdCd)}&DEAL_YMD=${ym}&numOfRows=100&pageNo=1&_type=json`;
          try {
            const data = await fetchJSON(url);
            const resultCode = data?.response?.header?.resultCode;
            if (resultCode && !String(resultCode).startsWith('0')) continue;
            const raw = data?.response?.body?.items?.item;
            if (!raw) break; // 데이터 없음 (정상)
            items = Array.isArray(raw) ? raw : [raw];
            break;
          } catch { continue; }
        }
        if (!items) continue;

        // 고유 아파트 좌표 수집
        const seen = new Set();
        for (const it of items) {
          const aptNm = (it.aptNm || '').trim();
          const umdNm = (it.umdNm || '').trim();
          if (!aptNm) continue;

          const cacheKey = `${lawdCd}|${umdNm}|${aptNm}`;
          if (cache[cacheKey] || seen.has(cacheKey)) continue;
          seen.add(cacheKey);

          // 1순위: MOLIT 상세 API 좌표
          const moLat = parseFloat(it.lat), moLng = parseFloat(it.lng);
          if (!isNaN(moLat) && !isNaN(moLng) && moLat !== 0 && moLng !== 0) {
            cache[cacheKey] = { lat: moLat, lng: moLng };
            newFromMolit++;
            continue;
          }

          // 2순위: Kakao REST API (첫 번째 쿼리만 시도 — 속도 우선)
          if (!KAKAO_KEY) continue;
          await sleep(50); // Kakao API 레이트 리밋 방지
          const found = await kakaoSearch(`${sigunguNm} ${umdNm} ${aptNm}`)
            || await kakaoSearch(`${sigunguNm} ${aptNm}`);

          if (found) {
            cache[cacheKey] = { lat: found.lat, lng: found.lng };
            newFromKakao++;
          } else {
            kakaoFailed++;
          }
        }
      }
    }
  }

  // 저장
  fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2), 'utf-8');

  console.log(`\n\n✅ 완료`);
  console.log(`   MOLIT 좌표 신규: +${newFromMolit}개`);
  if (KAKAO_KEY) {
    console.log(`   Kakao 지오코딩 신규: +${newFromKakao}개`);
    console.log(`   Kakao 실패: ${kakaoFailed}개`);
  }
  console.log(`   전체 캐시: ${Object.keys(cache).length}개`);
  console.log(`   저장: ${CACHE_FILE}\n`);
}

main().catch(err => {
  console.error('\n❌ 오류:', err.message);
  process.exit(1);
});
