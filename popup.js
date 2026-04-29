/**
 * Windsurf 自动填卡 - 弹出页面逻辑
 * 信用卡管理功能
 */

// 信用卡列表
let cards = [];

// DOM 元素
const batchInput = document.getElementById('batchInput');
const batchAddBtn = document.getElementById('batchAddBtn');
const cardList = document.getElementById('cardList');
const cardCount = document.getElementById('cardCount');
const clearAllBtn = document.getElementById('clearAllBtn');

// 初始化
document.addEventListener('DOMContentLoaded', () => {
  loadCards();
  bindEvents();
  // 显示版本号
  const manifest = chrome.runtime.getManifest();
  document.getElementById('versionTag').textContent = `v${manifest.version}`;
});

// 绑定事件
function bindEvents() {
  batchAddBtn.addEventListener('click', handleBatchAdd);
  clearAllBtn.addEventListener('click', handleClearAll);
}

// 加载信用卡列表
function loadCards() {
  chrome.storage.local.get(['cards'], (result) => {
    cards = result.cards || [];
    renderCardList();
  });
}

// 保存信用卡列表
function saveCards() {
  chrome.storage.local.set({ cards: cards }, () => {
    console.log('信用卡列表已保存');
  });
}

// 随机生成到期时间（未来1~5年内的随机月份）
function randomExpiry() {
  const now = new Date();
  const futureMonths = Math.floor(Math.random() * 60) + 1; // 1~60个月后
  const future = new Date(now.getFullYear(), now.getMonth() + futureMonths, 1);
  const month = String(future.getMonth() + 1).padStart(2, '0');
  const year = String(future.getFullYear());
  return { month, year };
}

// 随机生成3位CVC
function randomCVC() {
  return String(Math.floor(100 + Math.random() * 900));
}

// 解析信用卡字符串
// 支持多种格式：
// 格式0: 纯卡号（自动去空格/横杠，随机生成到期时间和CVC）
// 格式1: 卡号|月份|年份|CVC (原格式)
// 格式2: 卡号|月份/年份|CVC (斜杠分隔)
// 格式3: 卡号|月份/年份(2位或4位)|CVC
function parseCardString(str) {
  // 先去除首尾空格
  const trimmed = str.trim();
  if (!trimmed) return null;

  const parts = trimmed.split('|');
  
  let number, month, year, cvc;
  
  if (parts.length === 4) {
    // 格式1: 卡号|月份|年份|CVC
    [number, month, year, cvc] = parts;
  } else if (parts.length === 3) {
    // 格式2/3: 卡号|月份/年份|CVC
    [number, , cvc] = parts;
    const expiryPart = parts[1];
    
    // 解析月份/年份
    if (expiryPart.includes('/')) {
      const expiryParts = expiryPart.split('/');
      month = expiryParts[0];
      year = expiryParts[1];
    } else {
      // 尝试解析 MMYY 或 MMYYYY 格式
      if (expiryPart.length === 4) {
        month = expiryPart.slice(0, 2);
        year = '20' + expiryPart.slice(2, 4);
      } else if (expiryPart.length === 6) {
        month = expiryPart.slice(0, 2);
        year = expiryPart.slice(2, 6);
      } else {
        return null;
      }
    }
  } else if (parts.length === 1) {
    // 格式0: 纯卡号，随机生成到期时间和CVC
    number = parts[0];
    const expiry = randomExpiry();
    month = expiry.month;
    year = expiry.year;
    cvc = randomCVC();
  } else {
    return null;
  }

  // 清理卡号（去空格、横杠、点号等非数字字符）
  const cleanNumber = number.replace(/[\s\-\.]/g, '');
  
  // 验证卡号（至少13位数字）
  if (!/^\d{13,19}$/.test(cleanNumber)) {
    return null;
  }

  // 验证月份（01-12）
  const monthNum = parseInt(month, 10);
  if (isNaN(monthNum) || monthNum < 1 || monthNum > 12) {
    return null;
  }

  // 处理年份
  let fullYear = year;
  if (year.length === 2) {
    fullYear = '20' + year;
  }
  
  // 验证年份（4位数字）
  if (!/^\d{4}$/.test(fullYear)) {
    return null;
  }

  // 验证 CVC（3-4位数字）
  if (!/^\d{3,4}$/.test(cvc)) {
    return null;
  }

  return {
    number: cleanNumber,
    month: month.padStart(2, '0'),
    year: fullYear,
    cvc: cvc,
    id: Date.now() + Math.random().toString(36).substr(2, 9)
  };
}

// 批量添加信用卡
function handleBatchAdd() {
  const input = batchInput.value.trim();
  if (!input) {
    alert('请输入信用卡信息');
    return;
  }

  const lines = input.split('\n').filter(line => line.trim());
  let addedCount = 0;
  let failedCount = 0;

  lines.forEach(line => {
    const card = parseCardString(line);
    if (card) {
      // 检查是否已存在相同卡号
      const exists = cards.some(c => c.number === card.number);
      if (!exists) {
        cards.push(card);
        addedCount++;
      }
    } else {
      failedCount++;
    }
  });

  if (addedCount > 0) {
    saveCards();
    renderCardList();
    batchInput.value = '';
  }

  // 显示结果
  let message = `成功添加 ${addedCount} 张卡`;
  if (failedCount > 0) {
    message += `，${failedCount} 张格式错误`;
  }
  alert(message);
}

// 清空所有信用卡
function handleClearAll() {
  if (cards.length === 0) {
    alert('列表已经是空的');
    return;
  }

  if (confirm(`确定要清空全部 ${cards.length} 张信用卡吗？`)) {
    cards = [];
    saveCards();
    renderCardList();
  }
}

// 渲染信用卡列表
function renderCardList() {
  // 更新数量
  cardCount.textContent = `${cards.length} 张`;

  // 空状态
  if (cards.length === 0) {
    cardList.innerHTML = `
      <div class="empty-state">
        <p>暂无信用卡</p>
        <p class="hint">请在上方批量添加</p>
      </div>
    `;
    return;
  }

  // 渲染列表
  cardList.innerHTML = cards.map(card => `
    <div class="card-item" data-id="${card.id}">
      <div class="card-info">
        <span class="card-number">${formatCardNumber(card.number)}</span>
        <span class="card-details">${card.month}/${card.year} · CVC: ${card.cvc}</span>
      </div>
      <div class="card-actions">
        <button class="btn btn-delete" data-delete-id="${card.id}">删除</button>
      </div>
    </div>
  `).join('');

  // 绑定删除按钮事件（事件委托）
  cardList.querySelectorAll('.btn-delete').forEach(btn => {
    btn.addEventListener('click', function() {
      const id = this.getAttribute('data-delete-id');
      handleDeleteCard(id);
    });
  });
}

// 删除单张信用卡
function handleDeleteCard(id) {
  cards = cards.filter(card => card.id !== id);
  saveCards();
  renderCardList();
}

// 格式化卡号显示（隐藏中间部分）
function formatCardNumber(number) {
  if (number.length < 8) return number;
  const first4 = number.slice(0, 4);
  const last4 = number.slice(-4);
  const middle = '*'.repeat(number.length - 8);
  return `${first4} ${middle.slice(0, 4)} ${middle.slice(4) || '****'} ${last4}`;
}

