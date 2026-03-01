'use strict';

const fs = require('fs');
const path = require('path');
const https = require('https');

const TMP_DIR    = path.resolve(__dirname, '../.tmp');
const COORDS_CACHE_FILE = path.resolve(__dirname, '../data/coords-cache.json');
const CHARTJS_CACHE = path.join(TMP_DIR, 'chart.min.js');
const CHARTJS_CDN = 'https://cdn.jsdelivr.net/npm/chart.js@4/dist/chart.umd.min.js';

async function fetchChartJS() {
  if (fs.existsSync(CHARTJS_CACHE)) return fs.readFileSync(CHARTJS_CACHE, 'utf-8');

  console.log('  📦 Chart.js 다운로드 중...');
  return new Promise((resolve, reject) => {
    const fetch = (url, redirects = 0) => {
      if (redirects > 5) return reject(new Error('Too many redirects'));
      https.get(url, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          return fetch(res.headers.location, redirects + 1);
        }
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          if (!fs.existsSync(TMP_DIR)) fs.mkdirSync(TMP_DIR, { recursive: true });
          fs.writeFileSync(CHARTJS_CACHE, data, 'utf-8');
          resolve(data);
        });
        res.on('error', reject);
      }).on('error', reject);
    };
    fetch(CHARTJS_CDN);
  });
}

/**
 * 전체 HTML 대시보드 생성
 * @param {Array} regionsData - [{ name, survey: [{date,idx}], transaction: [{date,idx}], weekly: [{date,idx}] }]
 * @param {string} outputPath
 */
const SIGUNGU_CODES = require('./sigungu-codes');

async function generateHTML(regionsData, outputPath, molitApiKey = '', kakaoJsKey = '') {
  console.log('\n  🎨 Phase B: HTML 대시보드 생성 중...');

  const chartJS = await fetchChartJS();

  // ── 좌표 캐시 로드 ───────────────────────────────────────────────────────
  const coordsCache = fs.existsSync(COORDS_CACHE_FILE)
    ? JSON.parse(fs.readFileSync(COORDS_CACHE_FILE, 'utf-8'))
    : {};
  const coordsCacheJSON = JSON.stringify(coordsCache);
  console.log(`  📍 좌표 캐시: ${Object.keys(coordsCache).length}개 아파트`);

  const generatedDate = new Date().toLocaleDateString('ko-KR', {
    year: 'numeric', month: 'long', day: 'numeric',
  });

  // ── 지역 데이터 JSON 임베딩 (키: region.name) ────────────────────────
  const allDataObj = {};
  for (const region of regionsData) {
    allDataObj[region.name] = {
      name:        region.name,
      survey:      region.survey,
      transaction: region.transaction,
      weekly:      region.weekly || [],
    };
  }
  const allDataJSON = JSON.stringify(allDataObj);

  // ── 지역 selector 옵션 ───────────────────────────────────────────────
  const regionOptions = regionsData
    .map(r => `<option value="${r.name}">${r.name}</option>`)
    .join('');

  // ── 기간 버튼 ────────────────────────────────────────────────────────
  const periodButtons = [
    { label: '전체', value: '0' },
    { label: '10년', value: '120' },
    { label: '5년',  value: '60' },
    { label: '3년',  value: '36' },
    { label: '1년',  value: '12' },
  ]
    .map(({ label, value }) =>
      `<button class="period-btn${value === '0' ? ' active' : ''}" data-months="${value}">${label}</button>`
    )
    .join('');

  const firstRegion = regionsData[0]?.name || '전국';
  const sigunguCodesJSON = JSON.stringify(SIGUNGU_CODES);
  const molitApiKeySafe = (molitApiKey || '').replace(/'/g, "\\'");
  const kakaoScriptTag  = kakaoJsKey
    ? `<script type="text/javascript" src="//dapi.kakao.com/v2/maps/sdk.js?appkey=${kakaoJsKey}&libraries=services&autoload=false"></script>`
    : '';

  // 지수 섹션 표시 여부 (regionsData 없으면 숨김)
  const indexHidden = regionsData.length === 0;

  const html = `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>한국 아파트 가격 지수 대시보드</title>
  <style>
    :root {
      --bg: #f0f4f8;
      --surface: #ffffff;
      --surface2: #f8fafc;
      --border: #dde3ea;
      --border-light: #eef1f5;
      --text: #1e293b;
      --text-muted: #64748b;
      --accent: #2563eb;
      --survey-color: #2563eb;
      --tx-color: #ea580c;
      --weekly-color: #16a34a;
      --green: #16a34a;
      --red: #dc2626;
      --shadow: 0 1px 4px rgba(0,0,0,0.07), 0 2px 12px rgba(0,0,0,0.04);
      --shadow-sm: 0 1px 3px rgba(0,0,0,0.06);
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Noto Sans KR', sans-serif;
      background: var(--bg);
      color: var(--text);
      line-height: 1.6;
    }
    .container { max-width: 1100px; margin: 0 auto; padding: 24px 20px; }

    /* ── Header ─────────────────────────────────────────────── */
    header {
      background: var(--surface);
      border-radius: 16px;
      padding: 32px 28px;
      margin-bottom: 20px;
      box-shadow: var(--shadow);
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 12px;
    }
    .header-left h1 {
      font-size: 1.55em;
      font-weight: 700;
      color: var(--text);
      letter-spacing: -0.02em;
    }
    .header-left p {
      color: var(--text-muted);
      font-size: 0.85em;
      margin-top: 3px;
    }
    .header-badge {
      background: #eff6ff;
      border: 1px solid #bfdbfe;
      color: #1d4ed8;
      font-size: 0.75em;
      font-weight: 600;
      padding: 4px 12px;
      border-radius: 20px;
      white-space: nowrap;
    }

    /* ── Controls ────────────────────────────────────────────── */
    .controls {
      background: var(--surface);
      border-radius: 12px;
      padding: 14px 20px;
      margin-bottom: 16px;
      box-shadow: var(--shadow-sm);
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 16px;
      border: 1px solid var(--border-light);
    }
    .control-group {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .control-label {
      font-size: 0.82em;
      font-weight: 600;
      color: var(--text-muted);
      white-space: nowrap;
    }
    select {
      background: var(--surface2);
      border: 1px solid var(--border);
      color: var(--text);
      padding: 7px 14px;
      border-radius: 8px;
      font-size: 0.9em;
      cursor: pointer;
      outline: none;
      min-width: 110px;
      font-family: inherit;
    }
    select:hover, select:focus { border-color: var(--accent); }

    .period-btns { display: flex; gap: 5px; flex-wrap: wrap; }
    .period-btn, .freq-btn {
      padding: 6px 14px;
      border-radius: 7px;
      border: 1px solid var(--border);
      background: var(--surface2);
      color: var(--text-muted);
      cursor: pointer;
      font-size: 0.82em;
      font-weight: 500;
      transition: all 0.15s;
      font-family: inherit;
    }
    .period-btn:hover, .freq-btn:hover { border-color: var(--accent); color: var(--accent); background: #eff6ff; }
    .period-btn.active, .freq-btn.active {
      background: var(--accent);
      border-color: var(--accent);
      color: #fff;
      font-weight: 600;
    }
    .freq-btns { display: flex; gap: 5px; }

    /* ── Stats row ───────────────────────────────────────────── */
    .stats-row {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(155px, 1fr));
      gap: 12px;
      margin-bottom: 16px;
    }
    .stat-card {
      background: var(--surface);
      border: 1px solid var(--border-light);
      border-radius: 12px;
      padding: 14px 18px;
      box-shadow: var(--shadow-sm);
    }
    .stat-label {
      font-size: 0.72em;
      font-weight: 600;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.04em;
      margin-bottom: 5px;
    }
    .stat-value { font-size: 1.5em; font-weight: 700; letter-spacing: -0.02em; }
    .stat-value.survey  { color: var(--survey-color); }
    .stat-value.tx      { color: var(--tx-color); }
    .stat-value.weekly  { color: var(--weekly-color); }
    .stat-sub { font-size: 0.72em; color: var(--text-muted); margin-top: 2px; }

    /* ── Chart card ──────────────────────────────────────────── */
    .chart-card {
      background: var(--surface);
      border: 1px solid var(--border-light);
      border-radius: 14px;
      padding: 22px 24px;
      margin-bottom: 16px;
      box-shadow: var(--shadow);
    }
    .chart-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 18px;
      flex-wrap: wrap;
      gap: 10px;
    }
    .chart-title {
      font-size: 1.05em;
      font-weight: 700;
      color: var(--text);
    }
    .chart-subtitle { font-size: 0.78em; color: var(--text-muted); margin-top: 2px; }
    .legend-row {
      display: flex;
      gap: 10px;
      font-size: 0.82em;
      color: var(--text-muted);
      flex-wrap: wrap;
      align-items: center;
    }
    .legend-item {
      display: flex;
      align-items: center;
      gap: 7px;
      cursor: pointer;
      padding: 5px 10px;
      border-radius: 7px;
      border: 1px solid var(--border);
      background: var(--surface2);
      font-weight: 500;
      transition: all 0.15s;
      user-select: none;
    }
    .legend-item:hover { border-color: var(--accent); background: #eff6ff; }
    .legend-item.dimmed {
      opacity: 0.35;
      background: #f1f5f9;
    }
    .legend-dot {
      display: inline-block;
      width: 24px;
      height: 3px;
      border-radius: 2px;
      flex-shrink: 0;
    }
    .legend-dot.survey { background: var(--survey-color); }
    .legend-dot.tx     { background: var(--tx-color); }
    .legend-dot.weekly { background: var(--weekly-color); }

    .chart-container { position: relative; height: 380px; }
    #no-data-msg {
      display: none;
      text-align: center;
      color: var(--text-muted);
      padding: 60px 20px;
      font-style: italic;
    }

    /* ── Table section ───────────────────────────────────────── */
    .table-section {
      background: var(--surface);
      border: 1px solid var(--border-light);
      border-radius: 14px;
      padding: 20px 24px;
      margin-bottom: 20px;
      box-shadow: var(--shadow-sm);
    }
    .table-section h3 {
      font-size: 0.88em;
      font-weight: 700;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 14px;
    }
    .table-wrapper {
      max-height: 340px;
      overflow-y: auto;
      border-radius: 8px;
      border: 1px solid var(--border);
    }
    table { width: 100%; border-collapse: collapse; font-size: 0.86em; }
    thead th {
      position: sticky;
      top: 0;
      background: var(--surface2);
      padding: 10px 16px;
      text-align: left;
      font-weight: 700;
      font-size: 0.82em;
      color: var(--text-muted);
      border-bottom: 1px solid var(--border);
      z-index: 1;
    }
    tbody td {
      padding: 8px 16px;
      border-bottom: 1px solid var(--border-light);
      color: var(--text);
    }
    tbody tr:last-child td { border-bottom: none; }
    tbody tr:hover { background: #f0f7ff; }
    td.idx-val { font-variant-numeric: tabular-nums; font-weight: 500; }
    td.idx-val.survey-col  { color: var(--survey-color); }
    td.idx-val.tx-col      { color: var(--tx-color); }
    td.idx-val.weekly-col  { color: var(--weekly-color); }

    /* ── Footer ──────────────────────────────────────────────── */
    footer {
      text-align: center;
      color: var(--text-muted);
      font-size: 0.78em;
      padding: 18px;
      border-top: 1px solid var(--border-light);
    }
    footer a { color: var(--accent); text-decoration: none; }
    footer a:hover { text-decoration: underline; }

    /* ── 실거래가 조회 섹션 ────────────────────────────────────── */
    .trade-section {
      background: var(--surface);
      border: 1px solid var(--border-light);
      border-radius: 14px;
      padding: 22px 24px;
      margin-bottom: 20px;
      box-shadow: var(--shadow-sm);
    }
    .trade-section-title {
      font-size: 1.05em;
      font-weight: 700;
      color: var(--text);
      margin-bottom: 16px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .trade-tag {
      display: inline-block;
      background: #f0fdf4;
      border: 1px solid #bbf7d0;
      color: #16a34a;
      font-size: 0.72em;
      font-weight: 600;
      padding: 2px 8px;
      border-radius: 10px;
    }
    .trade-controls {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      align-items: center;
      margin-bottom: 14px;
    }
    .trade-btn {
      padding: 7px 18px;
      border-radius: 8px;
      border: 1px solid var(--accent);
      background: var(--accent);
      color: #fff;
      cursor: pointer;
      font-size: 0.9em;
      font-weight: 600;
      font-family: inherit;
      transition: opacity 0.15s;
    }
    .trade-btn:hover:not(:disabled) { opacity: 0.85; }
    .trade-btn:disabled { opacity: 0.4; cursor: not-allowed; }
    .trade-status {
      font-size: 0.84em;
      color: var(--text-muted);
      min-height: 20px;
      margin-bottom: 12px;
    }
    .trade-status.error { color: #dc2626; }
    .price-cell { font-variant-numeric: tabular-nums; font-weight: 600; color: #2563eb; text-align: right; }
    .area-cell { color: var(--text-muted); }

    /* ── 지도 ─────────────────────────────────────────────────── */
    .map-wrap { display: none; margin-bottom: 14px; position: relative; }
    .map-wrap.visible { display: block; }
    #trade-map {
      height: 440px;
      border-radius: 10px;
      border: 1px solid var(--border);
      z-index: 0;
    }
    .map-legend {
      position: absolute; bottom: 28px; right: 10px;
      background: rgba(255,255,255,0.93);
      border: 1px solid var(--border);
      border-radius: 8px; padding: 8px 12px;
      font-size: 0.75em; z-index: 1000;
      box-shadow: var(--shadow-sm); line-height: 1.9;
      pointer-events: none;
    }
    .map-legend-row { display: flex; align-items: center; gap: 6px; color: var(--text); }
    .map-dot {
      width: 12px; height: 12px; border-radius: 50%;
      border: 2px solid #fff;
      box-shadow: 0 0 0 1px rgba(0,0,0,0.18);
      flex-shrink: 0;
    }
    @media (max-width: 640px) { #trade-map { height: 300px; } }

    /* ── Table always horizontally scrollable ────────────────── */
    .table-wrapper { overflow-x: auto; }

    /* ── Responsive ──────────────────────────────────────────── */
    @media (max-width: 640px) {
      .container { padding: 10px; }
      header { padding: 18px 14px; border-radius: 12px; }
      .header-left h1 { font-size: 1.15em; }
      .header-left p { font-size: 0.78em; }

      .controls { flex-direction: column; align-items: stretch; gap: 10px; padding: 12px 14px; }
      .control-group { width: 100%; }
      .control-group select { width: 100%; min-width: unset; }
      .control-label { min-width: 36px; }

      .stats-row { grid-template-columns: repeat(2, 1fr); gap: 8px; }
      .stat-card { padding: 10px 12px; }
      .stat-value { font-size: 1.25em; }
      .stat-label { font-size: 0.68em; }

      .chart-card { padding: 14px 12px; border-radius: 12px; }
      .chart-container { height: 230px; }
      .chart-header { flex-direction: column; gap: 8px; }
      .legend-row { gap: 5px; }
      .legend-item { padding: 4px 8px; font-size: 0.76em; }

      .table-section { padding: 14px 12px; border-radius: 12px; }

      .trade-section { padding: 14px 12px; border-radius: 12px; }
      .trade-controls { flex-direction: column; align-items: stretch; gap: 8px; }
      .trade-controls .control-group { width: 100%; }
      .trade-controls select { width: 100%; min-width: unset; }
      .trade-btn { width: 100%; padding: 11px 18px; font-size: 0.95em; }

      /* 실거래가 테이블: 모바일에서 덜 중요한 컬럼 숨김 */
      .col-dong, .col-floor, .col-type { display: none; }
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <div class="header-left">
        <h1>한국 아파트 가격 지수 대시보드</h1>
        <p>한국부동산원 공식 지수 — 기준: 2017.11 = 100 (아파트) &nbsp;·&nbsp; 생성일: ${generatedDate}</p>
      </div>
      <span class="header-badge">R-ONE API</span>
    </header>

    <!-- 가격지수 섹션 (데이터 없으면 숨김) -->
    <div id="index-section"${indexHidden ? ' style="display:none"' : ''}>

    <!-- 컨트롤 -->
    <div class="controls">
      <div class="control-group">
        <span class="control-label">지역</span>
        <select id="region-select" onchange="updateRegion()">
          ${regionOptions}
        </select>
      </div>
      <div class="control-group">
        <span class="control-label">주기</span>
        <div class="freq-btns" id="freq-btns">
          <button class="freq-btn active" data-freq="monthly">월간</button>
          <button class="freq-btn" data-freq="weekly">주간</button>
        </div>
      </div>
      <div class="control-group">
        <span class="control-label">기간</span>
        <div class="period-btns" id="period-btns">
          ${periodButtons}
        </div>
      </div>
    </div>

    <!-- 요약 통계 (월간 모드) -->
    <div class="stats-row" id="stats-monthly">
      <div class="stat-card">
        <div class="stat-label">매매가격지수 (최신)</div>
        <div class="stat-value survey" id="stat-survey-latest">—</div>
        <div class="stat-sub" id="stat-survey-date">—</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">실거래가격지수 (최신)</div>
        <div class="stat-value tx" id="stat-tx-latest">—</div>
        <div class="stat-sub" id="stat-tx-date">—</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">매매 전월 대비</div>
        <div class="stat-value" id="stat-survey-mom">—</div>
        <div class="stat-sub">전월비 변화</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">실거래 전월 대비</div>
        <div class="stat-value" id="stat-tx-mom">—</div>
        <div class="stat-sub">전월비 변화</div>
      </div>
    </div>

    <!-- 요약 통계 (주간 모드) -->
    <div class="stats-row" id="stats-weekly" style="display:none">
      <div class="stat-card">
        <div class="stat-label">주간 매매가격지수 (최신)</div>
        <div class="stat-value weekly" id="stat-weekly-latest">—</div>
        <div class="stat-sub" id="stat-weekly-date">—</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">전주 대비</div>
        <div class="stat-value" id="stat-weekly-wow">—</div>
        <div class="stat-sub">주간 변화</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">연초 대비 (YTD)</div>
        <div class="stat-value" id="stat-weekly-ytd">—</div>
        <div class="stat-sub">올해 1월 첫 주 대비</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">1년 전 대비</div>
        <div class="stat-value" id="stat-weekly-yoy">—</div>
        <div class="stat-sub">52주 전 대비</div>
      </div>
    </div>

    <!-- 차트 -->
    <div class="chart-card">
      <div class="chart-header">
        <div>
          <div class="chart-title" id="chart-title">전국 아파트 가격 지수</div>
          <div class="chart-subtitle" id="chart-subtitle">기준: 2017.11 = 100&nbsp;&nbsp;|&nbsp;&nbsp;실거래가격지수는 전국/서울/수도권/지방만 제공</div>
        </div>
        <div class="legend-row" id="legend-row">
          <span class="legend-item" id="legend-survey" onclick="toggleSeries('survey')">
            <span class="legend-dot survey"></span>매매가격지수 (조사)
          </span>
          <span class="legend-item" id="legend-tx" onclick="toggleSeries('tx')">
            <span class="legend-dot tx"></span>실거래가격지수 (거래)
          </span>
          <span class="legend-item" id="legend-weekly" onclick="toggleSeries('weekly')" style="display:none">
            <span class="legend-dot weekly"></span>주간 매매가격지수
          </span>
        </div>
      </div>
      <div class="chart-container">
        <canvas id="main-chart"></canvas>
      </div>
      <div id="no-data-msg">이 지역의 데이터가 없습니다.</div>
    </div>
    <!-- 테이블 -->
    <div class="table-section">
      <h3 id="table-title">월별 데이터 (최신 24개월)</h3>
      <div id="table-container"></div>
    </div>
    </div><!-- /index-section -->

    <!-- 실거래가 조회 -->
    <div class="trade-section">
      <div class="trade-section-title">
        동별 아파트 실거래가 조회
        <span class="trade-tag">국토교통부 API</span>
      </div>
      <div class="trade-controls">
        <div class="control-group">
          <span class="control-label">시/도</span>
          <select id="sido-select" onchange="onSidoChange()">
            <option value="">-- 선택 --</option>
          </select>
        </div>
        <div class="control-group">
          <span class="control-label">시/군/구</span>
          <select id="sigungu-select" onchange="onSigunguChange()" disabled>
            <option value="">-- 선택 --</option>
          </select>
        </div>
        <div class="control-group">
          <span class="control-label">동</span>
          <select id="dong-select" onchange="onDongChange()" disabled>
            <option value="전체">전체</option>
          </select>
        </div>
        <div class="control-group">
          <span class="control-label">아파트</span>
          <select id="apt-select" onchange="onAptChange()" disabled>
            <option value="전체">전체</option>
          </select>
        </div>
        <button class="trade-btn" id="trade-search-btn" onclick="searchTrade()" disabled>조회</button>
      </div>
      <div class="trade-status" id="trade-status">시/도와 시/군/구를 선택 후 조회하세요.</div>
      <div class="map-wrap" id="map-wrap">
        <div id="pyeong-filter" style="display:flex;gap:6px;flex-wrap:wrap;padding:8px 0 6px;"></div>
        <div id="trade-map"></div>
        <div class="map-legend">
          <div class="map-legend-row"><span class="map-dot" style="background:#dc2626"></span>10억 이상</div>
          <div class="map-legend-row"><span class="map-dot" style="background:#ea580c"></span>5~10억</div>
          <div class="map-legend-row"><span class="map-dot" style="background:#2563eb"></span>2~5억</div>
          <div class="map-legend-row"><span class="map-dot" style="background:#16a34a"></span>2억 미만</div>
        </div>
      </div>
      <div id="trade-table-container"></div>
    </div>

    <footer>
      데이터 출처: <a href="https://www.reb.or.kr/r-one" target="_blank" rel="noopener">한국부동산원 R-ONE</a>
      — 아파트 매매가격지수(A_2024_00045) &amp; 공동주택 실거래가격지수(T247493131863202) &amp; 주간 매매가격지수(T244183132827305) &mdash; 자동 생성됨
    </footer>
  </div>

  ${kakaoScriptTag}
  <script>${chartJS}</script>
  <script>
    Chart.defaults.color = '#64748b';
    Chart.defaults.borderColor = '#e2e8f0';
    Chart.defaults.font.family = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Noto Sans KR', sans-serif";

    const ALL_DATA = ${allDataJSON};

    let _chart = null;
    let _currentName = '${firstRegion}';
    let _currentMonths = 0;
    let _mode = 'monthly'; // 'monthly' | 'weekly'
    let _showSurvey = true;
    let _showTx = true;
    let _showWeekly = true;

    // ── 유틸 ───────────────────────────────────────────────────────────
    // 월간 데이터 슬라이스 (date: "YYYY.MM")
    function sliceData(arr, months) {
      if (!months || arr.length === 0) return arr;
      const allDates = arr.map(d => d.date).sort();
      const latest = allDates[allDates.length - 1];
      const [ly, lm] = latest.split('.').map(Number);
      let y = ly, m = lm - months;
      while (m <= 0) { m += 12; y--; }
      const cutoff = y + '.' + String(m).padStart(2, '0');
      return arr.filter(d => d.date >= cutoff);
    }

    // 주간 데이터 슬라이스 (date: "YYYY-MM-DD")
    function sliceDataISO(arr, months) {
      if (!months || arr.length === 0) return arr;
      const latest = new Date(arr[arr.length - 1].date);
      const cutoff = new Date(latest);
      cutoff.setMonth(cutoff.getMonth() - months);
      const cutoffStr = cutoff.toISOString().slice(0, 10);
      return arr.filter(d => d.date >= cutoffStr);
    }

    function toMap(arr) {
      return Object.fromEntries(arr.map(d => [d.date, d.idx]));
    }

    function mergeLabels(a, b) {
      return [...new Set([...a.map(d => d.date), ...b.map(d => d.date)])].sort();
    }

    // ── 월간 통계 카드 ──────────────────────────────────────────────────
    function updateMonthlyStats(survey, transaction) {
      function set(arr, latestId, dateId, momId) {
        if (!arr || arr.length === 0) {
          document.getElementById(latestId).textContent = '—';
          document.getElementById(dateId).textContent = '데이터 없음';
          const el = document.getElementById(momId);
          if (el) { el.textContent = '—'; el.style.color = ''; }
          return;
        }
        const last = arr[arr.length - 1];
        document.getElementById(latestId).textContent = last.idx.toFixed(1);
        document.getElementById(dateId).textContent = last.date;
        if (arr.length >= 2) {
          const diff = last.idx - arr[arr.length - 2].idx;
          const el = document.getElementById(momId);
          el.textContent = (diff >= 0 ? '+' : '') + diff.toFixed(2);
          el.style.color = diff > 0 ? '#16a34a' : diff < 0 ? '#dc2626' : '#64748b';
        }
      }
      set(survey,      'stat-survey-latest', 'stat-survey-date', 'stat-survey-mom');
      set(transaction, 'stat-tx-latest',     'stat-tx-date',     'stat-tx-mom');
    }

    // ── 주간 통계 카드 ──────────────────────────────────────────────────
    function updateWeeklyStats(weekly) {
      const el = (id) => document.getElementById(id);
      if (!weekly || weekly.length === 0) {
        el('stat-weekly-latest').textContent = '—';
        el('stat-weekly-date').textContent = '데이터 없음';
        el('stat-weekly-wow').textContent = '—';
        el('stat-weekly-ytd').textContent = '—';
        el('stat-weekly-yoy').textContent = '—';
        ['stat-weekly-wow','stat-weekly-ytd','stat-weekly-yoy'].forEach(id => { el(id).style.color = ''; });
        return;
      }
      const last = weekly[weekly.length - 1];
      el('stat-weekly-latest').textContent = last.idx.toFixed(1);
      el('stat-weekly-date').textContent = last.date;

      function setDiff(elId, diff) {
        const node = el(elId);
        node.textContent = (diff >= 0 ? '+' : '') + diff.toFixed(2);
        node.style.color = diff > 0 ? '#16a34a' : diff < 0 ? '#dc2626' : '#64748b';
      }

      // WoW: vs previous week
      if (weekly.length >= 2) {
        setDiff('stat-weekly-wow', last.idx - weekly[weekly.length - 2].idx);
      } else {
        el('stat-weekly-wow').textContent = '—';
      }

      // YTD: vs first week of current year
      const curYear = last.date.slice(0, 4);
      const ytdRef = weekly.find(d => d.date.startsWith(curYear));
      if (ytdRef) {
        setDiff('stat-weekly-ytd', last.idx - ytdRef.idx);
      } else {
        el('stat-weekly-ytd').textContent = '—';
      }

      // YoY: vs 52 weeks ago
      const yoyDate = new Date(last.date);
      yoyDate.setDate(yoyDate.getDate() - 364);
      const yoyStr = yoyDate.toISOString().slice(0, 10);
      // Find closest weekly point within ±7 days
      const yoyRef = weekly.reduce((best, d) => {
        if (!best) return d;
        return Math.abs(new Date(d.date) - new Date(yoyStr)) < Math.abs(new Date(best.date) - new Date(yoyStr)) ? d : best;
      }, null);
      if (yoyRef && Math.abs(new Date(yoyRef.date) - new Date(yoyStr)) <= 7 * 24 * 60 * 60 * 1000) {
        setDiff('stat-weekly-yoy', last.idx - yoyRef.idx);
      } else {
        el('stat-weekly-yoy').textContent = '—';
      }
    }

    // ── 월간 차트 렌더 ──────────────────────────────────────────────────
    function renderMonthlyChart(survey, transaction) {
      const noDataMsg = document.getElementById('no-data-msg');
      const canvas    = document.getElementById('main-chart');

      if (survey.length === 0 && transaction.length === 0) {
        noDataMsg.style.display = 'block';
        canvas.style.display = 'none';
        if (_chart) { _chart.destroy(); _chart = null; }
        return;
      }
      noDataMsg.style.display = 'none';
      canvas.style.display = 'block';

      const labels = mergeLabels(survey, transaction);
      const svMap  = toMap(survey);
      const txMap  = toMap(transaction);
      const isLong = labels.length > 120;

      const datasets = [];
      if (survey.length > 0) {
        datasets.push({
          label: '매매가격지수 (조사)',
          data: labels.map(d => svMap[d] ?? null),
          borderColor: '#2563eb',
          backgroundColor: 'rgba(37,99,235,0.07)',
          fill: false,
          tension: 0.3,
          pointRadius: isLong ? 0 : 2,
          pointHoverRadius: 5,
          spanGaps: true,
          borderWidth: 2,
          hidden: !_showSurvey,
        });
      }
      if (transaction.length > 0) {
        datasets.push({
          label: '실거래가격지수 (거래)',
          data: labels.map(d => txMap[d] ?? null),
          borderColor: '#ea580c',
          backgroundColor: 'rgba(234,88,12,0.07)',
          fill: false,
          tension: 0.3,
          pointRadius: isLong ? 0 : 2,
          pointHoverRadius: 5,
          spanGaps: true,
          borderWidth: 2,
          hidden: !_showTx,
        });
      }

      if (_chart) _chart.destroy();

      _chart = new Chart(document.getElementById('main-chart').getContext('2d'), {
        type: 'line',
        data: { labels, datasets },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: { mode: 'index', intersect: false },
          plugins: {
            legend: { display: false },
            tooltip: {
              backgroundColor: '#fff',
              titleColor: '#1e293b',
              bodyColor: '#475569',
              borderColor: '#e2e8f0',
              borderWidth: 1,
              padding: 10,
              callbacks: {
                label: item => item.raw != null
                  ? ' ' + item.dataset.label + ': ' + item.raw.toFixed(1)
                  : null,
              },
            },
          },
          scales: {
            x: {
              ticks: {
                maxTicksLimit: isLong ? 10 : 14,
                maxRotation: 45,
                color: '#94a3b8',
                font: { size: 11 },
              },
              grid: { display: false },
              border: { color: '#e2e8f0' },
            },
            y: {
              grid: { color: '#f1f5f9' },
              border: { color: '#e2e8f0' },
              ticks: { color: '#94a3b8', font: { size: 11 } },
              title: {
                display: true,
                text: '지수 (2017.11 = 100)',
                color: '#94a3b8',
                font: { size: 11 },
              },
            },
          },
        },
      });
    }

    // ── 주간 차트 렌더 ──────────────────────────────────────────────────
    function renderWeeklyChart(weekly) {
      const noDataMsg = document.getElementById('no-data-msg');
      const canvas    = document.getElementById('main-chart');

      if (weekly.length === 0) {
        noDataMsg.style.display = 'block';
        canvas.style.display = 'none';
        if (_chart) { _chart.destroy(); _chart = null; }
        return;
      }
      noDataMsg.style.display = 'none';
      canvas.style.display = 'block';

      const labels = weekly.map(d => d.date);
      const isLong = labels.length > 260;

      if (_chart) _chart.destroy();

      _chart = new Chart(document.getElementById('main-chart').getContext('2d'), {
        type: 'line',
        data: {
          labels,
          datasets: [{
            label: '주간 매매가격지수',
            data: weekly.map(d => d.idx),
            borderColor: '#16a34a',
            backgroundColor: 'rgba(22,163,74,0.07)',
            fill: false,
            tension: 0.2,
            pointRadius: isLong ? 0 : 2,
            pointHoverRadius: 5,
            spanGaps: true,
            borderWidth: 2,
            hidden: !_showWeekly,
          }],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: { mode: 'index', intersect: false },
          plugins: {
            legend: { display: false },
            tooltip: {
              backgroundColor: '#fff',
              titleColor: '#1e293b',
              bodyColor: '#475569',
              borderColor: '#e2e8f0',
              borderWidth: 1,
              padding: 10,
              callbacks: {
                label: item => item.raw != null
                  ? ' 주간 매매가격지수: ' + item.raw.toFixed(1)
                  : null,
              },
            },
          },
          scales: {
            x: {
              ticks: {
                maxTicksLimit: isLong ? 10 : 16,
                maxRotation: 45,
                color: '#94a3b8',
                font: { size: 11 },
              },
              grid: { display: false },
              border: { color: '#e2e8f0' },
            },
            y: {
              grid: { color: '#f1f5f9' },
              border: { color: '#e2e8f0' },
              ticks: { color: '#94a3b8', font: { size: 11 } },
              title: {
                display: true,
                text: '지수 (2017.11 = 100)',
                color: '#94a3b8',
                font: { size: 11 },
              },
            },
          },
        },
      });
    }

    // ── 월간 테이블 렌더 ────────────────────────────────────────────────
    function renderMonthlyTable(survey, transaction) {
      const dateSet = new Set([
        ...survey.map(d => d.date),
        ...transaction.map(d => d.date),
      ]);
      const dates = [...dateSet].sort().reverse().slice(0, 24);
      const svMap = toMap(survey);
      const txMap = toMap(transaction);

      let rows = '';
      for (const date of dates) {
        const sv = svMap[date];
        const tx = txMap[date];
        rows += '<tr>'
          + '<td>' + date + '</td>'
          + '<td class="idx-val survey-col">' + (sv != null ? sv.toFixed(1) : '—') + '</td>'
          + '<td class="idx-val tx-col">'     + (tx != null ? tx.toFixed(1) : '—') + '</td>'
          + '</tr>';
      }

      document.getElementById('table-container').innerHTML =
        '<div class="table-wrapper"><table>'
        + '<thead><tr><th>연월</th><th>매매가격지수 (조사)</th><th>실거래가격지수 (거래)</th></tr></thead>'
        + '<tbody>' + rows + '</tbody>'
        + '</table></div>';
    }

    // ── 주간 테이블 렌더 ────────────────────────────────────────────────
    function renderWeeklyTable(weekly) {
      const recent = [...weekly].reverse().slice(0, 52); // 최신 52주

      let rows = '';
      for (let i = 0; i < recent.length; i++) {
        const cur  = recent[i];
        const prev = recent[i + 1];
        const diff = prev ? cur.idx - prev.idx : null;
        const diffStr = diff != null
          ? '<span style="color:' + (diff > 0 ? '#16a34a' : diff < 0 ? '#dc2626' : '#64748b') + '">'
            + (diff >= 0 ? '+' : '') + diff.toFixed(2) + '</span>'
          : '—';
        rows += '<tr>'
          + '<td>' + cur.date + '</td>'
          + '<td class="idx-val weekly-col">' + cur.idx.toFixed(1) + '</td>'
          + '<td>' + diffStr + '</td>'
          + '</tr>';
      }

      document.getElementById('table-container').innerHTML =
        '<div class="table-wrapper"><table>'
        + '<thead><tr><th>날짜</th><th>주간 매매가격지수</th><th>전주 대비</th></tr></thead>'
        + '<tbody>' + rows + '</tbody>'
        + '</table></div>';
    }

    // ── 모드 UI 전환 ───────────────────────────────────────────────────
    function applyModeUI() {
      const isMonthly = _mode === 'monthly';
      document.getElementById('stats-monthly').style.display = isMonthly ? '' : 'none';
      document.getElementById('stats-weekly').style.display  = isMonthly ? 'none' : '';

      document.getElementById('legend-survey').style.display = isMonthly ? '' : 'none';
      document.getElementById('legend-tx').style.display     = isMonthly ? '' : 'none';
      document.getElementById('legend-weekly').style.display = isMonthly ? 'none' : '';

      document.getElementById('chart-subtitle').textContent = isMonthly
        ? '기준: 2017.11 = 100\u00a0\u00a0|\u00a0\u00a0실거래가격지수는 전국/서울/수도권/지방만 제공'
        : '기준: 2017.11 = 100\u00a0\u00a0|\u00a0\u00a0주간 매매가격지수 (조사)만 제공';

      document.getElementById('table-title').textContent = isMonthly
        ? '월별 데이터 (최신 24개월)'
        : '주간 데이터 (최신 52주)';
    }

    // ── 메인 업데이트 ──────────────────────────────────────────────────
    function update() {
      const regionData = ALL_DATA[_currentName];
      if (!regionData) return;

      document.getElementById('chart-title').textContent =
        _currentName + ' 아파트 ' + (_mode === 'weekly' ? '주간 ' : '') + '가격 지수';

      applyModeUI();

      if (_mode === 'monthly') {
        const rawSurvey = regionData.survey      || [];
        const rawTx     = regionData.transaction || [];
        updateMonthlyStats(rawSurvey, rawTx);
        renderMonthlyChart(sliceData(rawSurvey, _currentMonths), sliceData(rawTx, _currentMonths));
        renderMonthlyTable(rawSurvey, rawTx);
      } else {
        const rawWeekly = regionData.weekly || [];
        updateWeeklyStats(rawWeekly);
        renderWeeklyChart(sliceDataISO(rawWeekly, _currentMonths));
        renderWeeklyTable(rawWeekly);
      }
    }

    // ── 시리즈 토글 ────────────────────────────────────────────────────
    function toggleSeries(which) {
      if (which === 'survey') {
        _showSurvey = !_showSurvey;
        document.getElementById('legend-survey').classList.toggle('dimmed', !_showSurvey);
      } else if (which === 'tx') {
        _showTx = !_showTx;
        document.getElementById('legend-tx').classList.toggle('dimmed', !_showTx);
      } else {
        _showWeekly = !_showWeekly;
        document.getElementById('legend-weekly').classList.toggle('dimmed', !_showWeekly);
      }
      if (!_chart) return;
      _chart.data.datasets.forEach((ds, i) => {
        if (which === 'survey' && ds.label.includes('매매가격지수 (조사)')) {
          _chart.setDatasetVisibility(i, _showSurvey);
        } else if (which === 'tx' && ds.label.includes('실거래')) {
          _chart.setDatasetVisibility(i, _showTx);
        } else if (which === 'weekly' && ds.label.includes('주간')) {
          _chart.setDatasetVisibility(i, _showWeekly);
        }
      });
      _chart.update();
    }

    // ── 이벤트 ────────────────────────────────────────────────────────
    function updateRegion() {
      _currentName = document.getElementById('region-select').value;
      update();
    }

    document.getElementById('period-btns').addEventListener('click', e => {
      const btn = e.target.closest('.period-btn');
      if (!btn) return;
      document.querySelectorAll('.period-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      _currentMonths = parseInt(btn.dataset.months, 10);
      update();
    });

    document.getElementById('freq-btns').addEventListener('click', e => {
      const btn = e.target.closest('.freq-btn');
      if (!btn) return;
      const freq = btn.dataset.freq;
      if (freq === _mode) return;
      document.querySelectorAll('.freq-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      _mode = freq;
      update();
    });

    update();

    // ── 실거래가 조회 ──────────────────────────────────────────────────────
    var MOLIT_KEY    = '${molitApiKeySafe}';
    var SIGUNGU      = ${sigunguCodesJSON};
    // 빌드 시 수집된 아파트 좌표 캐시 (key: "lawdCd|umdNm|aptNm")
    var COORDS_CACHE = ${coordsCacheJSON};
    var _tradeData = [];
    var _kakaoMap      = null;
    var _overlays      = [];
    var _overlayData   = [];
    var _activeFilter    = 'all';
    var _currentIW       = null;
    var _highlightedUid  = null;

    // 아파트별 지오코딩 (좌표 캐시 → MOLIT API 좌표 → Kakao JS SDK 순으로 조회)
    function geocodeApts(items, sigunguNm, lawdCd) {
      return new Promise(function(resolveAll) {
        if (typeof kakao === 'undefined') {
          showTradeStatus('Kakao SDK 로드 실패 — 페이지를 새로고침하거나 콘솔을 확인하세요.', true);
          return resolveAll(items);
        }
        kakao.maps.load(function() {
          if (!kakao.maps.services) {
            showTradeStatus('kakao.maps.services 없음 — SDK 초기화 실패', true);
            return resolveAll(items);
          }
          var aptKeys = {};
          items.forEach(function(it) {
            var key = (it.aptNm || '') + '||' + (it.umdNm || '');
            if (!aptKeys[key]) {
              // 1순위: 빌드 시 수집된 좌표 캐시
              var ck = (lawdCd || '') + '|' + (it.umdNm || '') + '|' + (it.aptNm || '');
              var cached = COORDS_CACHE[ck];
              if (cached) {
                aptKeys[key] = { aptNm: it.aptNm || '', umdNm: it.umdNm || '',
                                 lat: cached.lat, lng: cached.lng };
                return;
              }
              // 2순위: MOLIT API 응답의 lat/lng
              var existLat = parseFloat(it.lat), existLng = parseFloat(it.lng);
              var hasCoords = !isNaN(existLat) && !isNaN(existLng) && existLat !== 0 && existLng !== 0;
              aptKeys[key] = { aptNm: it.aptNm || '', umdNm: it.umdNm || '',
                               lat: hasCoords ? existLat : null, lng: hasCoords ? existLng : null };
            }
          });
          // 3순위: 아직 좌표 없는 아파트만 Kakao JS SDK로 지오코딩
          var uniqueKeys = Object.keys(aptKeys).filter(function(k) { return aptKeys[k].lat === null; });
          if (uniqueKeys.length === 0) return resolveAll(items);

          var ps = new kakao.maps.services.Places();
          var done = 0;
          // 쿼리 배열을 순서대로 시도, 찾으면 즉시 종료
          function searchApt(apt, queries, idx, resolve) {
            if (idx >= queries.length) return resolve();
            ps.keywordSearch(queries[idx], function(results, status) {
              if (status === kakao.maps.services.Status.OK && results.length > 0) {
                apt.lat = parseFloat(results[0].y);
                apt.lng = parseFloat(results[0].x);
                resolve();
              } else {
                searchApt(apt, queries, idx + 1, resolve);
              }
            }, { size: 1 });
          }
          var chain = Promise.resolve();
          uniqueKeys.forEach(function(key) {
            chain = chain.then(function() {
              var apt = aptKeys[key];
              var prefix = sigunguNm ? sigunguNm + ' ' : '';
              // 괄호 제거 변형: 한가람(한양) → 한가람
              var aptNmClean = apt.aptNm.replace(/\([^)]*\)/g, '').trim();
              var queries = [
                prefix + apt.umdNm + ' ' + apt.aptNm,   // 1차: 동+원본이름
                prefix + apt.aptNm,                      // 2차: 원본이름만
              ];
              if (aptNmClean && aptNmClean !== apt.aptNm) {
                queries.push(prefix + apt.umdNm + ' ' + aptNmClean); // 3차: 동+괄호제거
                queries.push(prefix + aptNmClean);                   // 4차: 괄호제거만
              }
              return new Promise(function(res) {
                searchApt(apt, queries, 0, function() {
                  done++;
                  showTradeStatus('좌표 조회 중... (' + done + '/' + uniqueKeys.length + '개)', false);
                  res();
                });
              });
            });
          });
          chain.then(function() {
            var failed = uniqueKeys.filter(function(k) { return aptKeys[k].lat === null; });
            if (failed.length > 0) {
              console.warn('[지오코딩 실패 ' + failed.length + '개]', failed.map(function(k) {
                return aptKeys[k].umdNm + ' ' + aptKeys[k].aptNm;
              }).join(' / '));
            }
            resolveAll(items.map(function(it) {
              var key = (it.aptNm || '') + '||' + (it.umdNm || '');
              var c = aptKeys[key];
              if (c && c.lat !== null) return Object.assign({}, it, { lat: c.lat, lng: c.lng });
              return it;
            }));
          });
        });
      });
    }

    function initTradeMap() {
      if (_kakaoMap) return;
      var container = document.getElementById('trade-map');
      _kakaoMap = new kakao.maps.Map(container, {
        center: new kakao.maps.LatLng(37.5665, 126.9780),
        level: 5,
      });
    }

    function renderTradeMap(items) {
      var mapWrap = document.getElementById('map-wrap');
      var valid = items.filter(function(it) {
        var la = parseFloat(it.lat), lo = parseFloat(it.lng);
        return !isNaN(la) && !isNaN(lo) && la !== 0 && lo !== 0;
      });
      if (valid.length === 0) { mapWrap.classList.remove('visible'); return; }
      mapWrap.classList.add('visible');
      initTradeMap();

      // 이전 오버레이 제거
      _overlays.forEach(function(o) { o.setMap(null); });
      _overlays = [];
      _overlayData = [];
      _activeFilter = 'all';
      if (_currentIW) { _currentIW.setMap(null); _currentIW = null; window._mapCurrentIW = null; }
      _highlightedUid = null;

      // 아파트별로 그룹화 (동일 아파트 거래 통합)
      var aptMap = {};
      valid.forEach(function(it) {
        var key = (it.aptNm || '') + '||' + (it.umdNm || '');
        if (!aptMap[key]) aptMap[key] = {
          aptNm: it.aptNm || '—',
          umdNm: it.umdNm || '',
          lat: parseFloat(it.lat),
          lng: parseFloat(it.lng),
          trades: [],
        };
        aptMap[key].trades.push(it);
      });

      var bounds = new kakao.maps.LatLngBounds();

      Object.values(aptMap).forEach(function(apt) {
        // 최신순 정렬
        apt.trades.sort(function(a, b) {
          var da = String(a.dealYear)+String(a.dealMonth).padStart(2,'0')+String(a.dealDay).padStart(2,'0');
          var db = String(b.dealYear)+String(b.dealMonth).padStart(2,'0')+String(b.dealDay).padStart(2,'0');
          return db.localeCompare(da);
        });

        var amt = parseInt((apt.trades[0].dealAmount || '0').replace(/,/g,''), 10);
        var priceLabel = amt >= 10000
          ? (amt / 10000).toFixed(1).replace(/\.0$/, '') + '억'
          : amt.toLocaleString() + '만';
        var color = amt >= 100000 ? '#dc2626'
                  : amt >= 50000  ? '#ea580c'
                  : amt >= 20000  ? '#2563eb'
                  :                 '#16a34a';

        var pos = new kakao.maps.LatLng(apt.lat, apt.lng);
        var uid = 'apt_' + Math.random().toString(36).substr(2, 8);

        // 모든 거래의 고유 면적 수집
        var areaSet = {};
        apt.trades.forEach(function(t) {
          var ar = parseFloat(t.excluUseAr || 0);
          if (ar > 0) areaSet[ar.toFixed(0)] = ar;
        });
        var areas = Object.values(areaSet).sort(function(a, b) { return a - b; });
        // 공급면적 기준 평형 근사: 전용㎡ × 1.3 / 3.3058
        var pyeongsArr = areas.map(function(a) { return Math.round(a * 1.3 / 3.3058); });

        var areaText;
        if (areas.length === 0) {
          areaText = '';
        } else if (areas.length === 1) {
          areaText = areas[0].toFixed(1) + '㎡ (' + pyeongsArr[0] + '평)';
        } else {
          areaText = pyeongsArr.join('·') + '평';
        }
        var overlayContent = '<div id="' + uid + '" style="'
          + 'background:#fff;border-radius:8px;padding:4px 8px;cursor:pointer;text-align:center;'
          + 'border-top:3px solid ' + color + ';'
          + 'box-shadow:0 2px 6px rgba(0,0,0,0.22);font-family:-apple-system,sans-serif;'
          + 'white-space:nowrap;min-width:56px">'
          + '<div style="font-size:10px;color:#334155;font-weight:600;margin-bottom:1px">' + apt.aptNm + '</div>'
          + '<div id="' + uid + '_price" style="font-size:12px;color:' + color + ';font-weight:700">' + priceLabel + '</div>'
          + '<div id="' + uid + '_area" style="font-size:9px;color:#64748b;margin-top:1px">' + areaText + '</div>'
          + '</div>';

        var overlay = new kakao.maps.CustomOverlay({
          position: pos,
          content: overlayContent,
          yAnchor: 1.2,
          zIndex: 3,
        });
        overlay.setMap(_kakaoMap);
        _overlays.push(overlay);
        _overlayData.push({ overlay: overlay, pyeongsArr: pyeongsArr, trades: apt.trades, uid: uid, aptNm: apt.aptNm, umdNm: apt.umdNm });

        // 팝업: 최근 5건 거래 내역
        var rows = apt.trades.slice(0, 5).map(function(it) {
          var raw = parseInt((it.dealAmount || '0').replace(/,/g,''), 10);
          var price = raw >= 10000
            ? (raw / 10000).toFixed(1).replace(/\.0$/, '') + '억'
            : raw.toLocaleString() + '만';
          var dt = it.dealYear + '.' + String(it.dealMonth).padStart(2,'0') + '.' + String(it.dealDay).padStart(2,'0');
          var ar = parseFloat(it.excluUseAr || 0).toFixed(0);
          return '<tr>'
            + '<td style="padding:3px 6px">' + dt + '</td>'
            + '<td style="padding:3px 6px">' + ar + '㎡</td>'
            + '<td style="padding:3px 6px">' + (it.floor || '—') + '층</td>'
            + '<td style="padding:3px 6px;font-weight:700;color:#2563eb">' + price + '</td>'
            + '</tr>';
        }).join('');

        var extra = apt.trades.length > 5
          ? '<div style="font-size:0.75em;color:#94a3b8;margin-top:3px;text-align:right">외 ' + (apt.trades.length - 5) + '건</div>'
          : '';

        var closeBtn = '<button onclick="if(window._mapCurrentIW){window._mapCurrentIW.setMap(null);window._mapCurrentIW=null;}" '
          + 'style="position:absolute;top:4px;right:6px;background:none;border:none;font-size:18px;'
          + 'cursor:pointer;color:#94a3b8;line-height:1;padding:2px 6px">×</button>';
        var popupContent = '<div style="position:relative;min-width:240px;background:#fff;border-radius:10px;'
          + 'box-shadow:0 4px 20px rgba(0,0,0,0.28);font-family:-apple-system,sans-serif;'
          + 'line-height:1.5;padding:10px 14px 10px;margin-bottom:10px">'
          + closeBtn
          + '<div style="font-weight:700;font-size:0.95em;margin-bottom:2px">' + apt.aptNm + '</div>'
          + '<div style="font-size:0.8em;color:#64748b;margin-bottom:8px">' + apt.umdNm + '</div>'
          + '<table style="width:100%;font-size:0.82em;border-collapse:collapse">'
          + '<thead><tr style="color:#94a3b8;border-bottom:1px solid #e2e8f0">'
          + '<th style="padding:3px 6px;font-weight:600">날짜</th>'
          + '<th style="padding:3px 6px;font-weight:600">면적</th>'
          + '<th style="padding:3px 6px;font-weight:600">층</th>'
          + '<th style="padding:3px 6px;font-weight:600">금액</th>'
          + '</tr></thead>'
          + '<tbody>' + rows + '</tbody>'
          + '</table>' + extra + '</div>';

        var iw = new kakao.maps.CustomOverlay({
          position: pos,
          content: popupContent,
          yAnchor: 1.15,
          zIndex: 100,
        });

        // 클릭 시 팝업 표시 (다른 마커 위에 오도록 zIndex 100)
        (function(infoWin, elemId) {
          setTimeout(function() {
            var el = document.getElementById(elemId);
            if (el) {
              el.addEventListener('click', function(e) {
                e.stopPropagation();
                if (_currentIW) _currentIW.setMap(null);
                _currentIW = infoWin;
                window._mapCurrentIW = infoWin;
                infoWin.setMap(_kakaoMap);
              });
            }
          }, 100);
        })(iw, uid);

        bounds.extend(pos);
      });

      setTimeout(function() {
        _kakaoMap.setBounds(bounds, 60, 60, 60, 60);
      }, 100);

      // 평수대 필터 버튼 렌더링
      var filterEl = document.getElementById('pyeong-filter');
      if (filterEl) {
        filterEl.innerHTML = ['all','10','20','30','40'].map(function(r) {
          var label = r === 'all' ? '전체' : r === '40' ? '40평 이상' : r + '평대';
          var isActive = r === 'all';
          return '<button class="pyeong-filter-btn" data-range="' + r + '" '
            + 'style="padding:5px 12px;border:none;border-radius:16px;cursor:pointer;font-size:12px;font-weight:600;'
            + 'background:' + (isActive ? '#2563eb' : '#e2e8f0') + ';'
            + 'color:' + (isActive ? '#fff' : '#475569') + '">'
            + label + '</button>';
        }).join('');
        filterEl.onclick = function(e) {
          var btn = e.target.closest('.pyeong-filter-btn');
          if (btn) filterTradeMap(btn.dataset.range);
        };
      }
    }

    function filterTradeMap(range) {
      _activeFilter = range;
      _overlayData.forEach(function(d) {
        var matchingTrades = range === 'all' ? d.trades : (d.trades || []).filter(function(t) {
          var ar = parseFloat(t.excluUseAr || 0);
          var p = Math.round(ar * 1.3 / 3.3058);
          if (range === '10') return p >= 10 && p < 20;
          if (range === '20') return p >= 20 && p < 30;
          if (range === '30') return p >= 30 && p < 40;
          if (range === '40') return p >= 40;
          return false;
        });
        var visible = matchingTrades.length > 0;
        d.overlay.setMap(visible ? _kakaoMap : null);
        if (!visible) return;

        // 필터에 맞는 거래 기준으로 마커 가격·평형 업데이트
        var latestTrade = matchingTrades[0]; // 이미 날짜 내림차순 정렬됨
        var amt = parseInt((latestTrade.dealAmount || '0').replace(/,/g,''), 10);
        var newPriceLabel = amt >= 10000
          ? (amt / 10000).toFixed(1).replace(/\.0$/, '') + '억'
          : amt.toLocaleString() + '만';
        var newColor = amt >= 100000 ? '#dc2626'
                    : amt >= 50000  ? '#ea580c'
                    : amt >= 20000  ? '#2563eb'
                    :                 '#16a34a';
        var chipEl  = document.getElementById(d.uid);
        var priceEl = document.getElementById(d.uid + '_price');
        var areaEl  = document.getElementById(d.uid + '_area');
        if (chipEl)  chipEl.style.borderTopColor = newColor;
        if (priceEl) { priceEl.textContent = newPriceLabel; priceEl.style.color = newColor; }
        if (areaEl) {
          var mAreas = [], mAreaSet = {};
          matchingTrades.forEach(function(t) {
            var ar = parseFloat(t.excluUseAr || 0);
            if (ar > 0 && !mAreaSet[ar.toFixed(0)]) { mAreaSet[ar.toFixed(0)] = true; mAreas.push(ar); }
          });
          mAreas.sort(function(a, b) { return a - b; });
          var mPyeongsArr = mAreas.map(function(a) { return Math.round(a * 1.3 / 3.3058); });
          var newAreaText = mAreas.length === 0 ? '' :
            mAreas.length === 1
              ? mAreas[0].toFixed(1) + '㎡ (' + mPyeongsArr[0] + '평)'
              : mPyeongsArr.join('·') + '평';
          areaEl.textContent = newAreaText;
          areaEl.style.display = newAreaText ? '' : 'none';
        }
      });
      document.querySelectorAll('.pyeong-filter-btn').forEach(function(btn) {
        var active = btn.dataset.range === range;
        btn.style.background = active ? '#2563eb' : '#e2e8f0';
        btn.style.color      = active ? '#fff'     : '#475569';
      });
    }

    // 시/도 selector 초기화
    (function() {
      var sel = document.getElementById('sido-select');
      Object.keys(SIGUNGU).forEach(function(sido) {
        var opt = document.createElement('option');
        opt.value = sido;
        opt.textContent = sido;
        sel.appendChild(opt);
      });
    })();

    function onSidoChange() {
      var sido = document.getElementById('sido-select').value;
      var sigunguSel = document.getElementById('sigungu-select');
      var dongSel    = document.getElementById('dong-select');
      var btn        = document.getElementById('trade-search-btn');
      sigunguSel.innerHTML = '<option value="">-- 선택 --</option>';
      dongSel.innerHTML    = '<option value="전체">전체</option>';
      sigunguSel.disabled  = !sido;
      dongSel.disabled     = true;
      btn.disabled         = true;
      _tradeData           = [];
      document.getElementById('trade-table-container').innerHTML = '';
      showTradeStatus('시/군/구를 선택 후 조회하세요.', false);
      if (!sido) return;
      var list = SIGUNGU[sido];
      Object.keys(list).forEach(function(name) {
        var opt = document.createElement('option');
        opt.value = list[name];
        opt.textContent = name;
        sigunguSel.appendChild(opt);
      });
      sigunguSel.disabled = false;
    }

    function onSigunguChange() {
      var lawdCd = document.getElementById('sigungu-select').value;
      var dongSel = document.getElementById('dong-select');
      var aptSel  = document.getElementById('apt-select');
      dongSel.innerHTML = '<option value="전체">전체</option>';
      aptSel.innerHTML  = '<option value="전체">전체</option>';
      dongSel.disabled  = true;
      aptSel.disabled   = true;
      _tradeData        = [];
      document.getElementById('trade-table-container').innerHTML = '';
      document.getElementById('trade-search-btn').disabled = !lawdCd;
      if (lawdCd) showTradeStatus('조회 버튼을 눌러 최근 3개월 실거래가를 가져옵니다.', false);
    }

    function onDongChange() {
      var dong = document.getElementById('dong-select').value;
      refreshAptSelect(dong);
      renderTradeTable(dong, '전체');
    }

    function onAptChange() {
      var dong = document.getElementById('dong-select').value;
      var apt  = document.getElementById('apt-select').value;
      renderTradeTable(dong, apt);
    }

    function refreshAptSelect(dongFilter) {
      var aptSel = document.getElementById('apt-select');
      var items  = _tradeData.filter(function(it) {
        if (it.cdealType && it.cdealType.trim() === 'O') return false;
        if (dongFilter && dongFilter !== '전체' && it.umdNm !== dongFilter) return false;
        return true;
      });
      var aptSet = {};
      items.forEach(function(it) { if (it.aptNm) aptSet[it.aptNm] = true; });
      var apts = Object.keys(aptSet).sort();
      aptSel.innerHTML = '<option value="전체">전체</option>';
      apts.forEach(function(name) {
        var opt = document.createElement('option');
        opt.value = name;
        opt.textContent = name;
        aptSel.appendChild(opt);
      });
      aptSel.disabled = apts.length === 0;
    }

    async function searchTrade() {
      if (!MOLIT_KEY) {
        showTradeStatus('MOLIT_API_KEY가 설정되지 않았습니다. .env에 MOLIT_API_KEY를 추가하고 재생성하세요. (data.go.kr → 국토교통부 아파트매매 실거래자료 서비스 신청)', true);
        return;
      }
      var lawdCd = document.getElementById('sigungu-select').value;
      if (!lawdCd) return;
      var sigunguSel = document.getElementById('sigungu-select');
      var sigunguNm  = sigunguSel.options[sigunguSel.selectedIndex].text;
      var btn = document.getElementById('trade-search-btn');
      btn.disabled = true;
      document.getElementById('map-wrap').classList.remove('visible');
      showTradeStatus('데이터 조회 중... (최근 3개월)', false);
      try {
        var now    = new Date();
        var months = [];
        for (var i = 0; i < 3; i++) {
          var d = new Date(now.getFullYear(), now.getMonth() - i, 1);
          months.push(String(d.getFullYear()) + String(d.getMonth() + 1).padStart(2, '0'));
        }
        var allItems = [];
        // 상세 API (lat/lng 포함) 우선 시도, 미등록 시 기본 API로 폴백
        var detailedBase = 'https://apis.data.go.kr/1613000/RTMSDataSvcAptTradeDev/getRTMSDataSvcAptTradeDev';
        var basicBase    = 'https://apis.data.go.kr/1613000/RTMSDataSvcAptTrade/getRTMSDataSvcAptTrade';
        var useDetailed  = true;

        for (var mi = 0; mi < months.length; mi++) {
          var ym = months[mi];
          var base = useDetailed ? detailedBase : basicBase;
          // serviceKey는 URLSearchParams 외부에서 처리 (이중인코딩 방지)
          var params = '?serviceKey=' + MOLIT_KEY
            + '&LAWD_CD=' + encodeURIComponent(lawdCd)
            + '&DEAL_YMD=' + encodeURIComponent(ym)
            + '&numOfRows=100&pageNo=1&_type=json';
          var res = await fetch(base + params);
          if (!res.ok) throw new Error('HTTP ' + res.status);
          var data = await res.json();
          // 상세 API 접근 오류 감지 → 기본 API로 폴백
          var resultCode = data && data.response && data.response.header && data.response.header.resultCode;
          if (useDetailed && resultCode && !String(resultCode).startsWith('0')) {
            useDetailed = false;
            base = basicBase;
            res = await fetch(base + params);
            if (!res.ok) throw new Error('HTTP ' + res.status);
            data = await res.json();
          }
          var body = data && data.response && data.response.body;
          if (!body) continue;
          var items = body.items && body.items.item;
          if (!items) continue;
          var arr = Array.isArray(items) ? items : [items];
          for (var k = 0; k < arr.length; k++) allItems.push(arr[k]);
        }
        _tradeData = allItems;

        // 동 목록 추출 (API 필드명: umdNm)
        var dongSet = {};
        allItems.forEach(function(it) { if (it.umdNm) dongSet[it.umdNm] = true; });
        var dongs = Object.keys(dongSet).sort();
        var dongSel = document.getElementById('dong-select');
        dongSel.innerHTML = '<option value="전체">전체</option>';
        dongs.forEach(function(dong) {
          var opt = document.createElement('option');
          opt.value = dong;
          opt.textContent = dong;
          dongSel.appendChild(opt);
        });
        dongSel.disabled = dongs.length === 0;

        refreshAptSelect('전체');
        renderTradeTable('전체', '전체');

        // 지도 렌더 (해제 거래 제외, 지오코딩 후)
        var mapItems = allItems.filter(function(it) {
          return !(it.cdealType && it.cdealType.trim() === 'O');
        });
        var uniqueAptCount = Object.keys(mapItems.reduce(function(acc, it) {
          acc[(it.aptNm || '') + '||' + (it.umdNm || '')] = 1; return acc;
        }, {})).length;
        showTradeStatus('좌표 조회 중... (' + uniqueAptCount + '개 아파트)', false);
        var geocodedItems = await geocodeApts(mapItems, sigunguNm, lawdCd);

        var mappedApts = Object.keys(geocodedItems.reduce(function(acc, it) {
          var la = parseFloat(it.lat), lo = parseFloat(it.lng);
          if (!isNaN(la) && !isNaN(lo) && la !== 0 && lo !== 0) {
            acc[(it.aptNm || '') + '||' + (it.umdNm || '')] = 1;
          }
          return acc;
        }, {})).length;
        renderTradeMap(geocodedItems);
        showTradeStatus(allItems.length + '건 조회됨 | 지도: ' + mappedApts + '/' + uniqueAptCount + '개 아파트', false);
      } catch(err) {
        console.error(err);
        var msg = '조회 실패: ' + err.message;
        if (err.message.indexOf('fetch') !== -1 || err.message.indexOf('Failed') !== -1 || err.message.indexOf('CORS') !== -1) {
          msg = 'API 호출 오류. 로컬 파일(file://)에서는 브라우저 보안 정책으로 차단될 수 있습니다.'
            + ' 터미널에서 "python3 -m http.server 8080" 실행 후 http://localhost:8080 에서 열어보세요.'
            + ' (또는 MOLIT_API_KEY 형식 확인: data.go.kr → 마이페이지 → "일반 인증키(Decoding)")';
        }
        showTradeStatus(msg, true);
      } finally {
        btn.disabled = false;
      }
    }

    function renderTradeTable(dongFilter, aptFilter) {
      // API 필드명 매핑:
      //   aptNm=아파트명, umdNm=법정동, dealAmount=거래금액, excluUseAr=전용면적
      //   floor=층, dealYear/dealMonth/dealDay=거래일, dealingGbn=거래유형
      //   cdealType="O" → 해제된 거래
      var items = _tradeData.filter(function(it) {
        if (it.cdealType && it.cdealType.trim() === 'O') return false;
        if (dongFilter && dongFilter !== '전체' && it.umdNm !== dongFilter) return false;
        if (aptFilter  && aptFilter  !== '전체' && it.aptNm !== aptFilter)  return false;
        return true;
      });

      items.sort(function(a, b) {
        var da = String(a.dealYear) + String(a.dealMonth).padStart(2,'0') + String(a.dealDay).padStart(2,'0');
        var db = String(b.dealYear) + String(b.dealMonth).padStart(2,'0') + String(b.dealDay).padStart(2,'0');
        return db.localeCompare(da);
      });

      if (items.length === 0) {
        document.getElementById('trade-table-container').innerHTML =
          '<p style="color:var(--text-muted);font-size:0.88em;padding:8px 0">해당 지역의 거래 데이터가 없습니다.</p>';
        return;
      }

      var rows = items.map(function(it) {
        var rawPrice = parseInt((it.dealAmount || '0').replace(/,/g,''), 10);
        var priceStr = rawPrice >= 10000
          ? (rawPrice / 10000).toFixed(1).replace(/\.0$/, '') + '억'
          : rawPrice.toLocaleString() + '만';
        var date = it.dealYear + '.' + String(it.dealMonth).padStart(2,'0') + '.' + String(it.dealDay).padStart(2,'0');
        var area = parseFloat(it.excluUseAr || 0).toFixed(1);
        var aptEsc = (it.aptNm || '').replace(/"/g, '&quot;');
        var umdEsc = (it.umdNm || '').replace(/"/g, '&quot;');
        return '<tr data-apt="' + aptEsc + '" data-umd="' + umdEsc + '" style="cursor:pointer">'
          + '<td>' + date + '</td>'
          + '<td>' + (it.aptNm || '—') + '</td>'
          + '<td class="col-dong">' + (it.umdNm || '—') + '</td>'
          + '<td class="area-cell">' + area + '㎡</td>'
          + '<td class="col-floor">' + (it.floor || '—') + '층</td>'
          + '<td class="price-cell">' + priceStr + '</td>'
          + '<td class="col-type" style="color:var(--text-muted);font-size:0.85em">' + (it.dealingGbn || '—') + '</td>'
          + '</tr>';
      }).join('');

      document.getElementById('trade-table-container').innerHTML =
        '<div class="table-wrapper" style="max-height:480px">'
        + '<table>'
        + '<thead><tr>'
        + '<th>거래일</th><th>아파트명</th><th class="col-dong">법정동</th><th>전용면적</th><th class="col-floor">층</th>'
        + '<th style="text-align:right">거래금액</th><th class="col-type">거래유형</th>'
        + '</tr></thead>'
        + '<tbody>' + rows + '</tbody>'
        + '</table></div>';

      // 행 클릭 → 지도 마커 강조
      document.querySelectorAll('#trade-table-container tbody tr').forEach(function(tr) {
        tr.addEventListener('click', function() {
          highlightMapMarker(this.dataset.apt, this.dataset.umd);
        });
      });
    }

    function highlightMapMarker(aptNm, umdNm) {
      // 이전 강조 해제
      if (_highlightedUid) {
        var prevEl = document.getElementById(_highlightedUid);
        if (prevEl) {
          prevEl.style.outline = '';
          prevEl.style.outlineOffset = '';
          prevEl.style.boxShadow = '0 2px 6px rgba(0,0,0,0.22)';
          prevEl.style.transform = '';
          prevEl.style.zIndex = '';
        }
        _highlightedUid = null;
      }

      // 해당 아파트 오버레이 찾기
      var match = null;
      for (var i = 0; i < _overlayData.length; i++) {
        if (_overlayData[i].aptNm === aptNm && _overlayData[i].umdNm === umdNm) {
          match = _overlayData[i]; break;
        }
      }
      if (!match) return;

      // 지도 중심 이동
      _kakaoMap.panTo(match.overlay.getPosition());

      // 마커 강조 스타일
      _highlightedUid = match.uid;
      setTimeout(function() {
        var el = document.getElementById(match.uid);
        if (el) {
          el.style.outline = '2px solid #f97316';
          el.style.outlineOffset = '2px';
          el.style.boxShadow = '0 0 0 4px rgba(249,115,22,0.25), 0 4px 12px rgba(0,0,0,0.3)';
          el.style.transform = 'scale(1.08)';
          el.style.zIndex = '50';
          // 팝업도 자동으로 열기
          el.click();
        }
      }, 300); // panTo 완료 후
    }

    function showTradeStatus(msg, isError) {
      var el = document.getElementById('trade-status');
      el.textContent = msg;
      el.className = 'trade-status' + (isError ? ' error' : '');
    }
  </script>
</body>
</html>`;

  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(outputPath, html, 'utf-8');

  const sizeKB = (Buffer.byteLength(html, 'utf-8') / 1024).toFixed(0);
  console.log(`  ✅ HTML 생성 완료: ${outputPath} (${sizeKB} KB)`);
  return outputPath;
}

module.exports = { generateHTML };
