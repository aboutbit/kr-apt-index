'use strict';

const fs = require('fs');
const path = require('path');

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function saveJSON(filePath, data) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

function loadJSON(filePath) {
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

function isCacheFresh(filePath, maxAgeMs) {
  if (!fs.existsSync(filePath)) return false;
  const stat = fs.statSync(filePath);
  return (Date.now() - stat.mtimeMs) < maxAgeMs;
}

function todayStr() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}${m}${dd}`;
}

module.exports = { sleep, saveJSON, loadJSON, isCacheFresh, todayStr };
