'use strict';

const fs = require('fs');
const path = require('path');
const https = require('https');

const TMP_DIR = path.resolve(__dirname, '../.tmp');
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
// ── 전국 시군구 법정동코드 (MOLIT 아파트 실거래가 API LAWD_CD) ─────────────
const SIGUNGU_CODES = {
  '서울특별시': {
    '종로구':'11110','중구':'11140','용산구':'11170','성동구':'11200','광진구':'11215',
    '동대문구':'11230','중랑구':'11260','성북구':'11290','강북구':'11305','도봉구':'11320',
    '노원구':'11350','은평구':'11380','서대문구':'11410','마포구':'11440','양천구':'11470',
    '강서구':'11500','구로구':'11530','금천구':'11545','영등포구':'11560','동작구':'11590',
    '관악구':'11620','서초구':'11650','강남구':'11680','송파구':'11710','강동구':'11740',
  },
  '부산광역시': {
    '중구':'26110','서구':'26140','동구':'26170','영도구':'26200','부산진구':'26230',
    '동래구':'26260','남구':'26290','북구':'26320','해운대구':'26350','사하구':'26380',
    '금정구':'26410','강서구':'26440','연제구':'26470','수영구':'26500','사상구':'26530',
    '기장군':'26710',
  },
  '대구광역시': {
    '중구':'27110','동구':'27140','서구':'27170','남구':'27200','북구':'27230',
    '수성구':'27260','달서구':'27290','달성군':'27710','군위군':'27720',
  },
  '인천광역시': {
    '중구':'28110','동구':'28140','미추홀구':'28177','연수구':'28185','남동구':'28200',
    '부평구':'28237','계양구':'28245','서구':'28260','강화군':'28710','옹진군':'28720',
  },
  '광주광역시': {
    '동구':'29110','서구':'29140','남구':'29155','북구':'29170','광산구':'29200',
  },
  '대전광역시': {
    '동구':'30110','중구':'30140','서구':'30170','유성구':'30200','대덕구':'30230',
  },
  '울산광역시': {
    '중구':'31110','남구':'31140','동구':'31170','북구':'31200','울주군':'31710',
  },
  '세종특별자치시': {
    '세종시':'36110',
  },
  '경기도': {
    '수원시 장안구':'41111','수원시 권선구':'41113','수원시 팔달구':'41115','수원시 영통구':'41117',
    '성남시 수정구':'41131','성남시 중원구':'41133','성남시 분당구':'41135',
    '의정부시':'41150','안양시 만안구':'41171','안양시 동안구':'41173',
    '부천시':'41190','광명시':'41210','평택시':'41220','동두천시':'41250',
    '안산시 상록구':'41271','안산시 단원구':'41273',
    '고양시 덕양구':'41281','고양시 일산동구':'41285','고양시 일산서구':'41287',
    '과천시':'41290','구리시':'41310','남양주시':'41360','오산시':'41370',
    '시흥시':'41390','군포시':'41410','의왕시':'41430','하남시':'41450',
    '용인시 처인구':'41461','용인시 기흥구':'41463','용인시 수지구':'41465',
    '파주시':'41480','이천시':'41500','안성시':'41550','김포시':'41570',
    '화성시':'41590','광주시':'41610','양주시':'41630','포천시':'41650',
    '여주시':'41670','연천군':'41800','가평군':'41820','양평군':'41830',
  },
  '강원특별자치도': {
    '춘천시':'51110','원주시':'51130','강릉시':'51150','동해시':'51170','태백시':'51190',
    '속초시':'51210','삼척시':'51230','홍천군':'51720','횡성군':'51730','영월군':'51750',
    '평창군':'51760','정선군':'51770','철원군':'51780','화천군':'51790',
    '양구군':'51800','인제군':'51810','고성군':'51820','양양군':'51830',
  },
  '충청북도': {
    '청주시 상당구':'43111','청주시 서원구':'43112','청주시 흥덕구':'43113','청주시 청원구':'43114',
    '충주시':'43130','제천시':'43150','보은군':'43720','옥천군':'43730',
    '영동군':'43740','증평군':'43745','진천군':'43750','괴산군':'43760',
    '음성군':'43770','단양군':'43800',
  },
  '충청남도': {
    '천안시 동남구':'44131','천안시 서북구':'44133','공주시':'44150','보령시':'44180',
    '아산시':'44200','서산시':'44210','논산시':'44230','계룡시':'44250','당진시':'44270',
    '금산군':'44710','부여군':'44760','서천군':'44770','청양군':'44790',
    '홍성군':'44800','예산군':'44810','태안군':'44825',
  },
  '전북특별자치도': {
    '전주시 완산구':'52111','전주시 덕진구':'52113','군산시':'52130','익산시':'52140',
    '정읍시':'52180','남원시':'52190','김제시':'52210','완주군':'52710',
    '진안군':'52720','무주군':'52730','장수군':'52740','임실군':'52750',
    '순창군':'52770','고창군':'52790','부안군':'52800',
  },
  '전라남도': {
    '목포시':'46110','여수시':'46130','순천시':'46150','나주시':'46170','광양시':'46230',
    '담양군':'46710','곡성군':'46720','구례군':'46730','고흥군':'46770','보성군':'46780',
    '화순군':'46790','장흥군':'46800','강진군':'46810','해남군':'46820','영암군':'46830',
    '무안군':'46840','함평군':'46860','영광군':'46870','장성군':'46880',
    '완도군':'46890','진도군':'46900','신안군':'46910',
  },
  '경상북도': {
    '포항시 남구':'47111','포항시 북구':'47113','경주시':'47130','김천시':'47150',
    '안동시':'47170','구미시':'47190','영주시':'47210','영천시':'47230','상주시':'47250',
    '문경시':'47280','경산시':'47290','의성군':'47730','청송군':'47750','영양군':'47760',
    '영덕군':'47770','청도군':'47820','고령군':'47830','성주군':'47840','칠곡군':'47850',
    '예천군':'47900','봉화군':'47920','울진군':'47930','울릉군':'47940',
  },
  '경상남도': {
    '창원시 의창구':'48121','창원시 성산구':'48123','창원시 마산합포구':'48125',
    '창원시 마산회원구':'48127','창원시 진해구':'48129','진주시':'48170',
    '통영시':'48220','사천시':'48240','김해시':'48250','밀양시':'48270',
    '거제시':'48310','양산시':'48330','의령군':'48720','함안군':'48730',
    '창녕군':'48740','고성군':'48820','남해군':'48840','하동군':'48850',
    '산청군':'48860','함양군':'48870','거창군':'48880','합천군':'48890',
  },
  '제주특별자치도': {
    '제주시':'50110','서귀포시':'50130',
  },
};

async function generateHTML(regionsData, outputPath, molitApiKey = '', kakaoJsKey = '') {
  console.log('\n  🎨 Phase B: HTML 대시보드 생성 중...');

  const chartJS = await fetchChartJS();

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
  const kakaoJsKeySafe  = (kakaoJsKey  || '').replace(/'/g, "\\'");
  const kakaoScriptTag  = kakaoJsKey
    ? `<script type="text/javascript" src="//dapi.kakao.com/v2/maps/sdk.js?appkey=${kakaoJsKey}&libraries=services"></script>`
    : '';

  const html = `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css">
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
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
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
    var MOLIT_KEY = '${molitApiKeySafe}';
    var SIGUNGU = ${sigunguCodesJSON};
    var _tradeData = [];
    var _leafletMap = null;
    var _markerLayer = null;

    // 아파트별 지오코딩 (Kakao 장소 검색 → lat/lng)
    function geocodeApts(items) {
      if (typeof kakao === 'undefined' || !kakao.maps || !kakao.maps.services) {
        return Promise.resolve(items);
      }
      var aptKeys = {};
      items.forEach(function(it) {
        var key = (it.aptNm || '') + '||' + (it.umdNm || '');
        if (!aptKeys[key]) aptKeys[key] = { aptNm: it.aptNm || '', umdNm: it.umdNm || '', lat: null, lng: null };
      });
      var uniqueKeys = Object.keys(aptKeys);
      if (uniqueKeys.length === 0) return Promise.resolve(items);
      var ps = new kakao.maps.services.Places();
      return Promise.all(uniqueKeys.map(function(key) {
        var apt = aptKeys[key];
        return new Promise(function(resolve) {
          ps.keywordSearch(apt.aptNm + ' ' + apt.umdNm, function(results, status) {
            if (status === kakao.maps.services.Status.OK && results.length > 0) {
              apt.lat = parseFloat(results[0].y);
              apt.lng = parseFloat(results[0].x);
            }
            resolve();
          }, { size: 1, category_group_code: 'AG2' });
        });
      })).then(function() {
        return items.map(function(it) {
          var key = (it.aptNm || '') + '||' + (it.umdNm || '');
          var c = aptKeys[key];
          if (c && c.lat !== null) return Object.assign({}, it, { lat: c.lat, lng: c.lng });
          return it;
        });
      });
    }

    function initTradeMap() {
      if (_leafletMap) return;
      _leafletMap = L.map('trade-map', { center: [37.5665, 126.9780], zoom: 12 });
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(_leafletMap);
      _markerLayer = L.layerGroup().addTo(_leafletMap);
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
      _markerLayer.clearLayers();

      // 아파트별로 그룹화 (동일 위치 거래 통합)
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

      var bounds = [];
      Object.values(aptMap).forEach(function(apt) {
        // 최신순 정렬
        apt.trades.sort(function(a, b) {
          var da = String(a.dealYear)+String(a.dealMonth).padStart(2,'0')+String(a.dealDay).padStart(2,'0');
          var db = String(b.dealYear)+String(b.dealMonth).padStart(2,'0')+String(b.dealDay).padStart(2,'0');
          return db.localeCompare(da);
        });

        // 최신 거래금액 기준 색상
        var amt = parseInt((apt.trades[0].dealAmount || '0').replace(/,/g,''), 10);
        var color = amt >= 100000 ? '#dc2626'
                  : amt >= 50000  ? '#ea580c'
                  : amt >= 20000  ? '#2563eb'
                  :                 '#16a34a';

        var marker = L.circleMarker([apt.lat, apt.lng], {
          radius: 9, fillColor: color,
          color: '#fff', weight: 2,
          opacity: 1, fillOpacity: 0.88,
        });

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

        var popup = '<div style="min-width:230px;font-family:-apple-system,sans-serif;line-height:1.5">'
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

        marker.bindPopup(popup, { maxWidth: 280 });
        _markerLayer.addLayer(marker);
        bounds.push([apt.lat, apt.lng]);
      });

      if (bounds.length > 0) {
        setTimeout(function() {
          _leafletMap.invalidateSize();
          if (bounds.length === 1) {
            _leafletMap.setView(bounds[0], 16);
          } else {
            _leafletMap.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 });
          }
        }, 150);
      }
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
          if (useDetailed && resultCode && resultCode !== '00') {
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
        showTradeStatus('좌표 조회 중... (' + Object.keys(mapItems.reduce(function(acc, it) {
          acc[(it.aptNm || '') + '||' + (it.umdNm || '')] = 1; return acc;
        }, {})).length + '개 아파트)', false);
        var geocodedItems = await geocodeApts(mapItems);
        renderTradeMap(geocodedItems);

        showTradeStatus(allItems.length + '건 조회됨 (최근 3개월, 해제 거래 포함)', false);
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
        return '<tr>'
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
