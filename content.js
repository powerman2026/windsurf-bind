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

  // 固定填写的信息
  const FIXED_INFO = {
    billingName: 'FuckWindsurf',
    billingCountry: 'HK',
    billingAdministrativeArea: 'Kowloon',
    billingLocality: '九龍城',
    billingAddressLine1: '庇利街碧丽花园',
    billingPostalCode: '999077'
  };

  // 随机生成邮编（用于没有配置邮编时的备选）
  function randomPostalCode() {
    return Math.floor(100000 + Math.random() * 900000).toString();
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

  // 模拟用户输入
  function simulateInput(element, value) {
    if (!element) return false;

    // 聚焦元素
    element.focus();

    // 清空现有值
    element.value = '';

    // 触发输入事件
    const inputEvent = new Event('input', { bubbles: true, cancelable: true });
    const changeEvent = new Event('change', { bubbles: true, cancelable: true });

    // 逐字符输入以触发所有事件监听器
    for (let i = 0; i < value.length; i++) {
      element.value += value[i];
      element.dispatchEvent(inputEvent);
    }

    element.dispatchEvent(changeEvent);
    element.blur();

    return true;
  }

  // 模拟选择下拉框
  function simulateSelect(element, value) {
    if (!element) return false;

    element.focus();
    element.value = value;

    const inputEvent = new Event('input', { bubbles: true, cancelable: true });
    const changeEvent = new Event('change', { bubbles: true, cancelable: true });

    element.dispatchEvent(inputEvent);
    element.dispatchEvent(changeEvent);
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

      // 表单字段配置：id, 填写值, 类型(input/select), 日志描述, 填写后延迟ms
      // required=false 的字段缺失时不告警（兼容不同国家的地址字段差异）
      const fields = [
        { id: 'cardNumber',                  value: formatCardNumber(card.number),           type: 'input',  label: '卡号',   delay: 50, required: true  },
        { id: 'cardExpiry',                  value: formatExpiry(card.month, card.year),     type: 'input',  label: '过期日期', delay: 50, required: true  },
        { id: 'cardCvc',                     value: card.cvc,                                type: 'input',  label: 'CVC',    delay: 50, required: true  },
        { id: 'billingName',                 value: FIXED_INFO.billingName,                  type: 'input',  label: '姓名',   delay: 50, required: true  },
        { id: 'billingCountry',              value: FIXED_INFO.billingCountry,               type: 'select', label: '国家',   delay: 80, required: true  },
        { id: 'billingAdministrativeArea',   value: FIXED_INFO.billingAdministrativeArea,    type: 'select', label: '州/省',  delay: 50, required: false },
        { id: 'billingLocality',             value: FIXED_INFO.billingLocality,              type: 'input',  label: '城市',   delay: 50, required: false },
        { id: 'billingPostalCode',           value: FIXED_INFO.billingPostalCode || randomPostalCode(), type: 'input', label: '邮编', delay: 50, required: false },
        { id: 'billingAddressLine1',         value: FIXED_INFO.billingAddressLine1,          type: 'input',  label: '地址',   delay: 50, required: false },
      ];

      // 等待页面元素加载
      await new Promise(resolve => setTimeout(resolve, 100));

      // 逐个填写表单字段
      for (const field of fields) {
        const el = document.getElementById(field.id);
        if (el) {
          field.type === 'select' ? simulateSelect(el, field.value) : simulateInput(el, field.value);
          console.log(`[Windsurf] ✅ 已填写${field.label}: 元素类型=${el.tagName}, 当前值="${el.value}"`);
        } else if (field.required) {
          console.warn(`[Windsurf] ⚠️ 未找到必填元素 #${field.id} (${field.label})`);
        } else {
          console.log(`[Windsurf] ℹ️ 跳过可选字段 #${field.id} (${field.label})`);
        }
        await new Promise(resolve => setTimeout(resolve, field.delay));
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

  // 自动点击"开始试用"按钮
  // 监测金额稳定后自动提交，并带重试机制
  async function autoClickSubmit() {
    console.log('[Windsurf] 开始监测金额变化...');

    // 获取当前金额文本
    const getAmountText = () => {
      const amountElements = document.querySelectorAll('[class*="Amount"], [class*="amount"], [class*="total"], [class*="Total"]');
      let text = '';
      amountElements.forEach(el => {
        text += el.textContent + '|';
      });
      return text;
    };

    // 等待金额稳定（连续3次检测相同）
    let lastAmount = '';
    let stableCount = 0;
    const maxWait = 30; // 最多等待30秒
    let waitCount = 0;

    while (stableCount < 3 && waitCount < maxWait) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      waitCount++;
      
      const currentAmount = getAmountText();
      
      if (currentAmount === lastAmount && currentAmount !== '') {
        stableCount++;
        console.log(`[Windsurf] 金额稳定检测 ${stableCount}/3`);
      } else {
        stableCount = 0;
        lastAmount = currentAmount;
        console.log('[Windsurf] 金额变化中，继续等待...');
      }
    }

    if (waitCount >= maxWait) {
      console.log('[Windsurf] 等待超时，尝试点击提交按钮');
    }

    // 查找并点击提交按钮
    const submitBtn = findSubmitButton();
    if (submitBtn) {
      console.log('[Windsurf] 找到提交按钮，准备点击');
      showStatus('金额已稳定，自动提交中...', 'info');
      
      // 等待一下再点击
      await new Promise(resolve => setTimeout(resolve, 500));
      
      submitBtn.click();
      console.log('[Windsurf] 已点击"开始试用"按钮');
      showStatus('✓ 已自动提交！', 'success');

      // 提交后重试检测：如果按钮仍可点击，说明提交未生效，自动重试
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
      // 每次等待3秒后检查
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      const btn = findSubmitButton();
      
      // 按钮已消失，说明页面已跳转/提交成功
      if (!btn) {
        console.log('[Windsurf] 提交按钮已消失，提交成功');
        return;
      }
      
      // 按钮处于 loading/processing 状态，说明正在提交
      if (btn.disabled || 
          btn.classList.contains('SubmitButton--processing') ||
          btn.getAttribute('aria-busy') === 'true') {
        console.log('[Windsurf] 提交正在处理中，继续等待...');
        // 处理中则额外等5秒再检查
        await new Promise(resolve => setTimeout(resolve, 5000));
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

