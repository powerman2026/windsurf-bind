/**
 * Windsurf 自动填卡 - 内容脚本
 * 注入到 Stripe 支付页面，显示悬浮窗并执行自动填卡
 */

(function() {
  'use strict';

  console.log('[Windsurf] ====== content.js 已加载 ======');
  console.log('[Windsurf] 页面URL:', window.location.href);
  console.log('[Windsurf] document.readyState:', document.readyState);
  console.log('[Windsurf] 是否在iframe中:', window !== window.top);

  // === 随机中国大陆地址生成 ===
  const CN_PROVINCES = [
    { name: '北京市', en: 'Beijing', cities: ['北京市'], postalPrefix: '10' },
    { name: '上海市', en: 'Shanghai', cities: ['上海市'], postalPrefix: '20' },
    { name: '广东省', en: 'Guangdong', cities: ['广州市', '深圳市', '东莞市', '佛山市', '珠海市'], postalPrefix: '51' },
    { name: '江苏省', en: 'Jiangsu', cities: ['南京市', '苏州市', '无锡市', '常州市', '南通市'], postalPrefix: '21' },
    { name: '浙江省', en: 'Zhejiang', cities: ['杭州市', '宁波市', '温州市', '嘉兴市', '绍兴市'], postalPrefix: '31' },
    { name: '山东省', en: 'Shandong', cities: ['济南市', '青岛市', '烟台市', '潍坊市'], postalPrefix: '25' },
    { name: '四川省', en: 'Sichuan', cities: ['成都市', '绵阳市', '德阳市', '南充市'], postalPrefix: '61' },
    { name: '湖北省', en: 'Hubei', cities: ['武汉市', '宜昌市', '襄阳市', '荆州市'], postalPrefix: '43' },
    { name: '福建省', en: 'Fujian', cities: ['福州市', '厦门市', '泉州市', '漳州市'], postalPrefix: '35' },
    { name: '湖南省', en: 'Hunan', cities: ['长沙市', '株洲市', '湘潭市', '衡阳市'], postalPrefix: '41' },
    { name: '河南省', en: 'Henan', cities: ['郑州市', '洛阳市', '开封市', '南阳市'], postalPrefix: '45' },
    { name: '辽宁省', en: 'Liaoning', cities: ['沈阳市', '大连市', '鞍山市', '抚顺市'], postalPrefix: '11' }
  ];
  const CN_STREETS = ['人民路', '解放路', '建设路', '中山路', '和平路', '胜利路', '光明路', '新华路', '文化路', '幸福路', '长江路', '黄河路'];
  const CN_FAMILY_NAMES = ['李', '王', '张', '刘', '陈', '杨', '赵', '黄', '周', '吴', '徐', '孙', '胡', '朱', '高', '林', '何', '郭', '马', '罗'];
  const CN_GIVEN_NAMES = ['伟', '芳', '娜', '敏', '静', '丽', '强', '磊', '军', '洋', '勇', '艳', '杰', '娟', '涛', '明', '超', '秀英', '霞', '平', '刚', '桂英'];

  function pickRandom(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

  function generateRandomInfo() {
    const province = pickRandom(CN_PROVINCES);
    const city = pickRandom(province.cities);
    const street = pickRandom(CN_STREETS);
    const streetNum = Math.floor(Math.random() * 999) + 1;
    const building = Math.floor(Math.random() * 30) + 1;
    const unit = Math.floor(Math.random() * 6) + 1;
    const room = Math.floor(Math.random() * 20) + 1;
    const postalCode = province.postalPrefix + String(Math.floor(1000 + Math.random() * 9000));
    const name = pickRandom(CN_FAMILY_NAMES) + pickRandom(CN_GIVEN_NAMES);

    return {
      billingName: name,
      billingCountry: 'CN',
      // 省份：同时携带中英文，simulateSelect 会做模糊匹配
      billingAdministrativeArea: province.en,
      billingAdministrativeAreaCN: province.name,
      billingLocality: city,
      billingAddressLine1: `${street}${streetNum}号${building}栋${unit}单元${room}01室`,
      billingPostalCode: postalCode
    };
  }

  // 创建悬浮窗
  function createFloatingWindow() {
    // 检查是否已存在
    if (document.getElementById('windsurf-autofill-container')) {
      return;
    }

    const container = document.createElement('div');
    container.id = 'windsurf-autofill-container';

    const statusDiv = document.createElement('div');
    statusDiv.id = 'windsurf-status';

    const button = document.createElement('button');
    button.id = 'windsurf-autofill-btn';
    button.textContent = '一键填卡';
    button.addEventListener('click', handleAutoFill);

    container.appendChild(statusDiv);
    container.appendChild(button);
    document.body.appendChild(container);

    console.log('[Windsurf] 悬浮窗已创建');
  }

  // 显示状态提示
  function showStatus(message, type = 'info') {
    const statusDiv = document.getElementById('windsurf-status');
    if (!statusDiv) return;

    statusDiv.textContent = message;
    statusDiv.className = `show ${type}`;

    setTimeout(() => {
      statusDiv.className = '';
    }, 3000);
  }

  // 瞬间填充 input（用原生 setter 绕过 React 受控组件，不逐字符）
  function simulateInput(element, value) {
    if (!element) return false;

    element.focus();

    // 使用原生 setter 设置值（绕过 React 的控制）
    const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    if (nativeSetter) {
      nativeSetter.call(element, value);
    } else {
      element.value = value;
    }

    // 清除 React 的 valueTracker，否则 onChange 不会触发
    if (element._valueTracker) {
      element._valueTracker.setValue('');
    }

    // 触发完整事件序列
    element.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
    element.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
    element.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'a' }));
    element.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, key: 'a' }));
    element.blur();

    return true;
  }

  // 模拟选择下拉框（支持模糊匹配 option 的 text/value）
  function simulateSelect(element, value, altValue) {
    if (!element) return false;

    element.focus();

    // 先尝试直接赋值
    element.value = value;

    // 如果直接赋值不匹配任何 option，遍历做模糊匹配
    if (element.value !== value || !element.value) {
      const candidates = [value, altValue].filter(Boolean);
      const options = element.querySelectorAll('option');
      for (const opt of options) {
        const optText = (opt.textContent || '').toLowerCase();
        const optVal = (opt.value || '').toLowerCase();
        for (const candidate of candidates) {
          const lc = candidate.toLowerCase();
          if (optVal === lc || optText.includes(lc) || optVal.includes(lc)) {
            element.value = opt.value;
            console.log(`[Windsurf] 省份模糊匹配: "${candidate}" → option value="${opt.value}" text="${opt.textContent}"`);
            break;
          }
        }
        if (element.value && element.selectedIndex > 0) break;
      }
    }

    element.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
    element.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
    element.blur();

    return true;
  }

  // 格式化卡号（添加空格）
  function formatCardNumber(cardNumber) {
    // 移除所有非数字字符
    const cleaned = cardNumber.replace(/\D/g, '');
    // 每4位添加空格
    return cleaned.replace(/(\d{4})(?=\d)/g, '$1 ');
  }

  // 格式化过期日期
  function formatExpiry(month, year) {
    // 确保月份是两位数
    const mm = month.toString().padStart(2, '0');
    // 取年份后两位
    const yy = year.toString().slice(-2);
    return `${mm} / ${yy}`;
  }

  // 勾选复选框（使用 click 以触发 React 状态更新）
  function simulateCheck(element) {
    if (!element) return false;
    if (element.checked) return true;
    element.click();
    return element.checked;
  }

  // 轮询等待某个元素出现（最多等 timeout 毫秒）
  async function waitForElement(checkFn, timeout = 3000, interval = 100) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      if (checkFn()) return true;
      await new Promise(resolve => setTimeout(resolve, interval));
    }
    return checkFn();
  }

  // 展开"银行卡"支付方式（页面新增步骤：默认未展开）
  async function ensureCardMethodExpanded() {
    // 如果卡号输入框已经存在，说明已经展开
    if (document.getElementById('cardNumber')) {
      console.log('[Windsurf] 银行卡表单已展开');
      return true;
    }

    const cardRadio = document.getElementById('payment-method-accordion-item-title-card');

    // 优先点击 accordion 按钮（aria-label="用银行卡支付"）
    const cardBtn = document.querySelector('[data-testid="card-accordion-item-button"]');
    if (cardBtn) {
      cardBtn.click();
      console.log('[Windsurf] 已点击"银行卡"展开按钮');
    } else if (cardRadio) {
      cardRadio.click();
      console.log('[Windsurf] 已点击银行卡 radio');
    } else {
      console.warn('[Windsurf] ⚠️ 未找到银行卡选项');
      return false;
    }

    // 等待卡号输入框渲染出来（最多 3 秒）
    const ok = await waitForElement(() => !!document.getElementById('cardNumber'), 3000);
    if (ok) {
      console.log('[Windsurf] ✅ 银行卡表单已渲染');
    } else {
      console.warn('[Windsurf] ⚠️ 展开后仍未检测到 #cardNumber');
    }
    return ok;
  }

  // 勾选"同意条款"复选框（页面新增步骤）
  function ensureTermsAgreed() {
    const termsCheckbox = document.getElementById('termsOfServiceConsentCheckbox');
    if (!termsCheckbox) {
      console.log('[Windsurf] 页面无同意条款选项，跳过');
      return true;
    }
    if (termsCheckbox.checked) {
      console.log('[Windsurf] 同意条款已勾选');
      return true;
    }
    const ok = simulateCheck(termsCheckbox);
    console.log(`[Windsurf] ${ok ? '✅ 已勾选' : '⚠️ 勾选失败'}同意条款`);
    return ok;
  }

  // 执行自动填卡
  async function handleAutoFill() {
    const button = document.getElementById('windsurf-autofill-btn');
    if (!button) return;

    button.disabled = true;
    button.textContent = '填卡中...';
    showStatus('正在获取信用卡信息...', 'info');

    try {
      // 从 background 获取随机信用卡
      console.log('[Windsurf] 正在向background请求信用卡...');
      const response = await chrome.runtime.sendMessage({ action: 'getRandomCard' });
      console.log('[Windsurf] background响应:', JSON.stringify(response));

      if (!response || !response.success) {
        console.error('[Windsurf] 获取信用卡失败:', response);
        showStatus(response?.error || '获取信用卡失败', 'error');
        return;
      }

      const card = response.card;
      console.log('[Windsurf] 获取到信用卡:', card.number.slice(-4));

      // 步骤 1（新增）：展开"银行卡"支付方式
      await ensureCardMethodExpanded();

      // 每次填卡都随机生成中国大陆地址
      const addrInfo = generateRandomInfo();
      console.log('[Windsurf] 本次随机地址:', JSON.stringify(addrInfo));

      // 表单字段配置：id, 填写值, 类型(input/select), 日志描述
      // required=false 的字段缺失时不告警（兼容不同国家的地址字段差异）
      const fields = [
        { id: 'cardNumber',                  value: formatCardNumber(card.number),           type: 'input',  label: '卡号',   required: true  },
        { id: 'cardExpiry',                  value: formatExpiry(card.month, card.year),     type: 'input',  label: '过期日期', required: true  },
        { id: 'cardCvc',                     value: card.cvc,                                type: 'input',  label: 'CVC',    required: true  },
        { id: 'billingName',                 value: addrInfo.billingName,                    type: 'input',  label: '姓名',   required: true  },
        { id: 'billingCountry',              value: addrInfo.billingCountry,                 type: 'select', label: '国家',   required: true  },
        { id: 'billingAdministrativeArea',   value: addrInfo.billingAdministrativeArea, altValue: addrInfo.billingAdministrativeAreaCN, type: 'select', label: '州/省', required: false },
        { id: 'billingLocality',             value: addrInfo.billingLocality,                type: 'input',  label: '城市',   required: false },
        { id: 'billingPostalCode',           value: addrInfo.billingPostalCode,              type: 'input',  label: '邮编',   required: false },
        { id: 'billingAddressLine1',         value: addrInfo.billingAddressLine1,            type: 'input',  label: '地址',   required: false },
      ];

      // 瞬间同步填充所有字段（不再等待）
      const fillStart = performance.now();
      let filledCount = 0;
      for (const field of fields) {
        const el = document.getElementById(field.id);
        if (el) {
          field.type === 'select' ? simulateSelect(el, field.value, field.altValue) : simulateInput(el, field.value);
          filledCount++;
        } else if (field.required) {
          console.warn(`[Windsurf] ⚠️ 未找到必填元素 #${field.id} (${field.label})`);
        }
      }
      console.log(`[Windsurf] ⚡ 瞬间填入 ${filledCount} 个字段，耗时 ${(performance.now() - fillStart).toFixed(1)}ms`);

      // 省份下拉可能依赖于国家选择后的异步加载，等一个动画帧后重新填一次省份（兼容首次差一点的场景）
      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
      const provinceField = fields.find(f => f.id === 'billingAdministrativeArea');
      if (provinceField) {
        const provinceEl = document.getElementById(provinceField.id);
        if (provinceEl && (!provinceEl.value || provinceEl.selectedIndex <= 0)) {
          simulateSelect(provinceEl, provinceField.value, provinceField.altValue);
          console.log('[Windsurf] 🔄 省份补填:', provinceEl.value);
        }
      }

      // 步骤 2（新增）：勾选同意条款
      ensureTermsAgreed();

      showStatus('✓ 填卡完成！等待自动提交...', 'success');
      console.log('[Windsurf] 自动填卡完成，开始监测金额变化');

      // 自动点击"开始试用"按钮
      try {
        await autoClickSubmit();
      } catch (submitError) {
        console.error('[Windsurf] 自动提交失败:', submitError);
      }

    } catch (error) {
      console.error('[Windsurf] 填卡失败:', error);
      showStatus('填卡失败: ' + error.message, 'error');
    } finally {
      button.disabled = false;
      button.textContent = '一键填卡';
    }
  }

  // 查找提交按钮（开始试用）
  function findSubmitButton() {
    // 尝试多种选择器
    const selectors = [
      'button[type="submit"]',
      '.SubmitButton',
      '[data-testid="hosted-payment-submit-button"]',
      'button.SubmitButton-IconContainer',
      '.SubmitButton-IconContainer'
    ];
    
    for (const selector of selectors) {
      const btn = document.querySelector(selector);
      if (btn) return btn;
    }
    
    // 通过按钮文本查找
    const buttons = document.querySelectorAll('button');
    for (const btn of buttons) {
      if (btn.textContent.includes('开始试用') || 
          btn.textContent.includes('Start trial') ||
          btn.textContent.includes('Subscribe')) {
        return btn;
      }
    }
    return null;
  }

  // 自动点击“开始试用/订阅”按钮
  // 策略：快速轮询按钮是否可点击，不再监测金额变化
  async function autoClickSubmit() {
    console.log('[Windsurf] 等待提交按钮就绪...');

    const maxWaitMs = 15000; // 最多等待15秒
    const pollInterval = 150; // 每150ms检查一次
    const start = Date.now();

    while (Date.now() - start < maxWaitMs) {
      const btn = findSubmitButton();
      if (btn && !btn.disabled && !btn.classList.contains('SubmitButton--processing')) {
        console.log('[Windsurf] 提交按钮已就绪，点击提交');
        showStatus('自动提交中...', 'info');
        btn.click();
        console.log('[Windsurf] 已点击提交按钮');
        showStatus('✓ 已自动提交！', 'success');
        // 提交后重试检测
        await verifyAndRetrySubmit();
        return;
      }
      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }

    // 超时处理
    const btn = findSubmitButton();
    if (btn) {
      console.log('[Windsurf] 等待超时，强制点击');
      btn.click();
      await verifyAndRetrySubmit();
    } else {
      console.log('[Windsurf] 未找到提交按钮');
      showStatus('填卡完成，请手动点击提交', 'info');
    }
  }

  // 提交后验证并重试
  async function verifyAndRetrySubmit() {
    const maxRetries = 5;
    
    for (let retry = 1; retry <= maxRetries; retry++) {
      // 等待后检查
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const btn = findSubmitButton();
      
      // 按钮已消失，说明页面已跳转/提交成功
      if (!btn) {
        console.log('[Windsurf] 提交按钮已消失，提交成功');
        return;
      }
      
      // 按钮处于 loading/processing 状态，说明正在提交
      if (btn.disabled || 
          btn.classList.contains('SubmitButton--processing') ||
          btn.classList.contains('SubmitButton--success') ||
          btn.getAttribute('aria-busy') === 'true') {
        console.log('[Windsurf] 提交正在处理中，继续等待...');
        await new Promise(resolve => setTimeout(resolve, 3000));
        continue;
      }
      
      // 按钮仍然可点击，说明提交未生效，重试
      console.log(`[Windsurf] 检测到提交未生效，第 ${retry}/${maxRetries} 次重试点击`);
      showStatus(`提交未生效，重试第 ${retry} 次...`, 'info');
      btn.click();
    }
    
    console.log('[Windsurf] 已达到最大重试次数');
    showStatus('多次重试后仍未成功，请手动提交', 'error');
  }

  // 检测是否可以开始自动填卡：
  // - 卡号表单已渲染（老版本：直接展开），或
  // - 银行卡折叠按钮已渲染（新版本：需先点击展开）
  function isPaymentFormReady() {
    return !!(
      document.getElementById('cardNumber') ||
      document.querySelector('[data-testid="card-accordion-item-button"]') ||
      document.getElementById('payment-method-accordion-item-title-card')
    );
  }

  // 等待表单元素加载完成后自动触发填卡
  // 使用 MutationObserver 替代 setInterval，在后台标签页中不会被 Chrome 节流
  function waitForFormAndAutoFill() {
    let triggered = false;

    // 先立即检查一次
    if (isPaymentFormReady()) {
      console.log('[Windsurf] ✅ 支付入口已存在，立即开始填卡');
      triggered = true;
      setTimeout(() => handleAutoFill(), 500);
      return;
    }

    console.log('[Windsurf] 支付入口尚未出现，启动 MutationObserver 监听...');

    // MutationObserver 监听 DOM 变化，检测表单元素出现
    const observer = new MutationObserver(() => {
      if (triggered) return;

      if (isPaymentFormReady()) {
        triggered = true;
        observer.disconnect();
        console.log('[Windsurf] ✅ MutationObserver 检测到支付入口已加载，自动开始填卡...');
        showStatus('检测到支付表单，自动填卡中...', 'info');
        setTimeout(() => handleAutoFill(), 500);
      }
    });

    observer.observe(document.body || document.documentElement, {
      childList: true,
      subtree: true
    });

    // 兜底：120秒超时断开 observer，避免永久监听
    setTimeout(() => {
      if (!triggered) {
        observer.disconnect();
        console.log('[Windsurf] ❌ MutationObserver 超时（120s），请手动点击填卡按钮');
        showStatus('未检测到支付表单，请手动点击', 'info');
      }
    }, 120000);
  }

  // 初始化
  function init() {
    console.log('[Windsurf] init() 开始执行, readyState:', document.readyState);
    // 等待页面加载完成
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        console.log('[Windsurf] DOMContentLoaded 触发');
        createFloatingWindow();
        waitForFormAndAutoFill();
      });
    } else {
      console.log('[Windsurf] 页面已加载完成，直接执行');
      createFloatingWindow();
      waitForFormAndAutoFill();
    }
  }

  init();
})();

