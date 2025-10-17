// 全局状态
let currentElement = null;
let currentLocators = [];
let currentAILocators = [];
let isSelecting = false;
let messageListenerAdded = false;
let chatHistory = [];
let chatElementSignature = null;
let chatMessageCounter = 0;
let activeChatRequestId = null;
let chatStreamingMessageId = null;
let isChatStreaming = false;
const MAX_CHAT_MESSAGES = 20;

// DOM 元素
const startSelectBtn = document.getElementById('startSelectBtn');
const stopSelectBtn = document.getElementById('stopSelectBtn');
const elementInfo = document.getElementById('elementInfo');
const locatorsSection = document.getElementById('locatorsSection');
const aiLocatorsSection = document.getElementById('aiLocatorsSection');
const clearBtn = document.getElementById('clearBtn');
const aiGenerateBtn = document.getElementById('aiGenerateBtn');
const settingsBtn = document.getElementById('settingsBtn');
const locatorsList = document.getElementById('locatorsList');
const aiLocatorsList = document.getElementById('aiLocatorsList');
const aiChatBtn = document.getElementById('aiChatBtn');
const aiChatDialog = document.getElementById('aiChatDialog');
const chatCloseBtn = document.getElementById('chatCloseBtn');
const chatMessages = document.getElementById('chatMessages');
const chatInput = document.getElementById('chatInput');
const chatSendBtn = document.getElementById('chatSendBtn');
const chatStatus = document.getElementById('chatStatus');

// 初始化
document.addEventListener('DOMContentLoaded', () => {
  // 🔧 修复：在初始化时就添加消息监听器，而不是等到startSelection
  console.log('🔵 [Popup] DOMContentLoaded - 添加消息监听器');
  if (!messageListenerAdded) {
    chrome.runtime.onMessage.addListener(handleRuntimeMessage);
    messageListenerAdded = true;
    console.log('🔵 [Popup] 消息监听器已在初始化时添加');
  }
  
  loadStoredData();
  setupEventListeners();
});

// 设置事件监听
function setupEventListeners() {
  startSelectBtn.addEventListener('click', startSelection);
  stopSelectBtn.addEventListener('click', stopSelection);
  clearBtn.addEventListener('click', clearSelection);
  aiGenerateBtn.addEventListener('click', generateWithAI);
  settingsBtn.addEventListener('click', openSettings);
  // AI对话框默认显示，不需要打开/关闭逻辑
  if (chatSendBtn) chatSendBtn.addEventListener('click', handleChatSend);
  if (chatInput) chatInput.addEventListener('keydown', handleChatInputKeydown);
  renderChatMessages();
}

// 开始选择元素
async function startSelection() {
  try {
    console.log('🔵 [Popup] 开始选择元素流程');
    
    // 清空之前的数据（选择新元素时才清空）
    currentElement = null;
    currentLocators = [];
    currentAILocators = [];
    resetChatState({ clearStorage: true });
    elementInfo.style.display = 'none';
    locatorsSection.style.display = 'none';
    aiLocatorsSection.style.display = 'none';
    
    // 清空存储的数据（包括 AI 生成的定位器）
    await chrome.storage.local.remove(['lastElement', 'lastLocators', 'lastAILocators', 'lastChatHistory', 'lastChatSignature']);
    
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    console.log('🔵 [Popup] 当前标签页:', tab.id, tab.url);
    
    // 注入内容脚本并启动选择模式
    console.log('🔵 [Popup] 发送startSelection消息到content script');
    await chrome.tabs.sendMessage(tab.id, { action: 'startSelection' });
    console.log('🔵 [Popup] startSelection消息已发送');
    
    isSelecting = true;
    startSelectBtn.style.display = 'none';
    stopSelectBtn.style.display = 'flex';
    showToast('请在页面上点击要选择的元素');
    
    // 🔧 修复：监听器已在初始化时添加，这里不再需要
    console.log('🔵 [Popup] 消息监听器状态:', messageListenerAdded ? '已添加' : '未添加');
    
    // 🎯 新增：关闭弹窗，让用户可以选择元素
    console.log('🔵 [Popup] 关闭弹窗以便用户选择元素');
    window.close();
  } catch (error) {
    console.error('❌ [Popup] 启动选择模式失败:', error);
    console.error('❌ [Popup] 错误详情:', error.message, error.stack);
    
    // 更详细的错误提示
    if (error.message.includes('Could not establish connection')) {
      showToast('无法连接到页面，请刷新页面后重试', 'error');
    } else if (error.message.includes('No tab with id')) {
      showToast('标签页不存在，请重新打开扩展', 'error');
    } else {
      showToast('启动失败: ' + error.message, 'error');
    }
  }
}

// 停止选择元素
async function stopSelection() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    await chrome.tabs.sendMessage(tab.id, { action: 'stopSelection' });
    
    isSelecting = false;
    stopSelectBtn.style.display = 'none';
    startSelectBtn.style.display = 'flex';
    showToast('已停止选择');
  } catch (error) {
    console.error('停止选择失败:', error);
  }
}

// 处理元素选择
function handleRuntimeMessage(message, sender, sendResponse) {
  console.log('🟣 [Popup] handleRuntimeMessage 收到消息:', message.action);
  
  switch (message.action) {
    case 'elementSelected':
      console.log('🟣 [Popup] 收到元素选中信息，这是同步消息，不需要返回true');
      currentElement = message.data;
      handleElementChange(currentElement);
      displayElementInfo(currentElement);
      displayLocators(currentElement.locators);
      isSelecting = false;
      stopSelectBtn.style.display = 'none';
      startSelectBtn.style.display = 'flex';
      console.log('🟣 [Popup] 元素选择完成，返回false（同步消息）');
      return false; // 同步消息，不需要异步响应
      
    case 'aiChatStream':
      console.log('🟣 [Popup] 处理AI流式更新，这是单向消息，不需要返回true');
      handleChatStreamUpdate(message);
      return false; // 单向消息，不需要响应
      
    case 'aiChatComplete':
      console.log('🟣 [Popup] 处理AI完成消息，这是单向消息，不需要返回true');
      handleChatStreamComplete(message);
      return false; // 单向消息，不需要响应
      
    case 'aiChatError':
      console.log('🟣 [Popup] 处理AI错误消息，这是单向消息，不需要返回true');
      handleChatStreamError(message);
      return false; // 单向消息，不需要响应
      
    default:
      console.log('🟣 [Popup] 未知消息类型，返回false');
      return false; // 未知消息，不处理
  }
}


// 显示元素信息
function displayElementInfo(element) {
  elementInfo.style.display = 'block';
  
  document.getElementById('elementTag').textContent = element.tagName;
  document.getElementById('elementText').textContent = element.text || '(无文本)';
  
  const attrsContainer = document.getElementById('elementAttrs');
  attrsContainer.innerHTML = '';
  
  if (element.attributes && Object.keys(element.attributes).length > 0) {
    Object.entries(element.attributes).forEach(([key, value]) => {
      const attrDiv = document.createElement('div');
      attrDiv.className = 'attr-item';
      attrDiv.textContent = `${key}="${value}"`;
      attrsContainer.appendChild(attrDiv);
    });
  } else {
    attrsContainer.textContent = '(无属性)';
  }
}

// 显示定位器列表
async function displayLocators(locators) {
  currentLocators = locators;
  locatorsSection.style.display = 'block';
  
  locatorsList.innerHTML = '';
  
  locators.forEach((locator, index) => {
    // 添加到列表
    const locatorItem = createLocatorItem(locator, index);
    locatorsList.appendChild(locatorItem);
  });
  
  // 自动验证所有定位器
  await autoValidateAllLocators();
}

// 创建定位器项
function createLocatorItem(locator, index) {
  const item = document.createElement('div');
  item.className = 'locator-item';
  item.dataset.index = index;
  
  const header = document.createElement('div');
  header.className = 'locator-header';
  
  const type = document.createElement('span');
  type.className = 'locator-type';
  type.textContent = locator.type;
  
  // 状态标签（初始为验证中）
  const status = document.createElement('span');
  status.className = 'locator-status testing';
  status.textContent = '验证中...';
  type.appendChild(status);
  
  const actions = document.createElement('div');
  actions.className = 'locator-actions';
  
  // 验证按钮
  const verifyBtn = document.createElement('button');
  verifyBtn.className = 'action-btn';
  verifyBtn.innerHTML = '🔍';
  verifyBtn.title = '验证定位器';
  verifyBtn.addEventListener('click', async (e) => {
    e.stopPropagation();
    await verifyLocator(locator, item);
  });
  
  // 复制按钮
  const copyBtn = document.createElement('button');
  copyBtn.className = 'action-btn';
  copyBtn.innerHTML = '📋';
  copyBtn.title = '复制';
  copyBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    showCopyMenu(copyBtn, locator, index);
  });
  
  actions.appendChild(verifyBtn);
  actions.appendChild(copyBtn);
  header.appendChild(type);
  header.appendChild(actions);
  
  const value = document.createElement('div');
  value.className = 'locator-value';
  value.textContent = locator.value;
  
  item.appendChild(header);
  item.appendChild(value);
  
  return item;
}

// 显示复制菜单
function showCopyMenu(button, locator, index) {
  // 移除现有菜单
  const existingMenu = document.querySelector('.copy-format-menu');
  if (existingMenu) {
    existingMenu.remove();
  }
  
  const menu = document.createElement('div');
  menu.className = 'copy-format-menu';
  
  const formats = [
    { label: '纯表达式', format: 'plain' },
    { label: 'Selenium (Python)', format: 'selenium-python' },
    { label: 'Selenium (Java)', format: 'selenium-java' },
    { label: 'Playwright', format: 'playwright' },
    { label: 'Cypress', format: 'cypress' }
  ];
  
  formats.forEach(({ label, format }) => {
    const item = document.createElement('div');
    item.className = 'copy-format-item';
    item.textContent = label;
    item.addEventListener('click', () => {
      copyLocator(locator, format);
      menu.remove();
    });
    menu.appendChild(item);
  });
  
  // 定位菜单
  const rect = button.getBoundingClientRect();
  menu.style.position = 'fixed';
  menu.style.top = `${rect.bottom + 5}px`;
  menu.style.left = `${rect.left - 100}px`;
  
  document.body.appendChild(menu);
  
  // 点击其他地方关闭菜单
  setTimeout(() => {
    document.addEventListener('click', () => menu.remove(), { once: true });
  }, 0);
}

// 复制定位器
function copyLocator(locator, format) {
  let textToCopy = '';
  
  switch (format) {
    case 'plain':
      textToCopy = locator.value;
      break;
    case 'selenium-python':
      textToCopy = generateSeleniumPython(locator);
      break;
    case 'selenium-java':
      textToCopy = generateSeleniumJava(locator);
      break;
    case 'playwright':
      textToCopy = generatePlaywright(locator);
      break;
    case 'cypress':
      textToCopy = generateCypress(locator);
      break;
  }
  
  navigator.clipboard.writeText(textToCopy).then(() => {
    showToast(`已复制 ${format} 格式`);
  }).catch(err => {
    console.error('复制失败:', err);
    showToast('复制失败', 'error');
  });
}

// 生成 Selenium Python 代码
function generateSeleniumPython(locator) {
  const typeMap = {
    'XPath': 'XPATH',
    'CSS Selector': 'CSS_SELECTOR',
    'ID': 'ID',
    'Name': 'NAME',
    'Class Name': 'CLASS_NAME',
    'Tag Name': 'TAG_NAME'
  };
  
  const byType = typeMap[locator.type] || 'XPATH';
  return `driver.find_element(By.${byType}, "${locator.value}")`;
}

// 生成 Selenium Java 代码
function generateSeleniumJava(locator) {
  const typeMap = {
    'XPath': 'xpath',
    'CSS Selector': 'cssSelector',
    'ID': 'id',
    'Name': 'name',
    'Class Name': 'className',
    'Tag Name': 'tagName'
  };
  
  const method = typeMap[locator.type] || 'xpath';
  return `driver.findElement(By.${method}("${locator.value}"))`;
}

// 生成 Playwright 代码
function generatePlaywright(locator) {
  if (locator.type === 'CSS Selector') {
    return `page.locator("${locator.value}")`;
  } else if (locator.type === 'XPath') {
    return `page.locator("xpath=${locator.value}")`;
  } else if (locator.type === 'ID') {
    return `page.locator("#${locator.value}")`;
  }
  return `page.locator("${locator.value}")`;
}

// 生成 Cypress 代码
function generateCypress(locator) {
  if (locator.type === 'CSS Selector') {
    return `cy.get("${locator.value}")`;
  } else if (locator.type === 'XPath') {
    return `cy.xpath("${locator.value}")`;
  } else if (locator.type === 'ID') {
    return `cy.get("#${locator.value}")`;
  }
  return `cy.get("${locator.value}")`;
}

// 验证单个定位器
async function verifyLocator(locator, item) {
  try {
    // 显示验证中状态
    const statusSpan = item.querySelector('.locator-status');
    statusSpan.className = 'locator-status testing';
    statusSpan.textContent = '验证中...';
    
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const response = await chrome.tabs.sendMessage(tab.id, {
      action: 'testLocator',
      data: locator
    });
    
    // 更新状态
    updateLocatorStatus(item, response.count);
    
    // 显示toast提示
    if (response.count === 0) {
      showToast('❌ 未找到匹配的元素', 'error');
    } else if (response.count === 1) {
      showToast('✅ 找到唯一元素（推荐使用）', 'success');
    } else {
      showToast(`⚠️ 找到 ${response.count} 个匹配元素（不唯一）`, 'warning');
    }
  } catch (error) {
    console.error('验证失败:', error);
    showToast('验证失败', 'error');
    updateLocatorStatus(item, -1);
  }
}

// AI 生成定位器
async function generateWithAI() {
  if (!currentElement) {
    showToast('请先选择一个元素', 'warning');
    return;
  }
  
  // 显示加载状态
  showAILoading(true);
  
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const response = await chrome.tabs.sendMessage(tab.id, {
      action: 'generateWithAI',
      data: { element: currentElement }
    });
    
    console.log('AI 响应:', response);
    
    if (response.success) {
      // 将 AI 生成的定位器显示在独立区域
      if (response.locators && response.locators.length > 0) {
        console.log('显示 AI 定位器:', response.locators);
        
        // 保存到 storage（content.js 已经保存了，这里再保存一次确保数据一致）
        await chrome.storage.local.set({ lastAILocators: response.locators });
        
        displayAILocators(response.locators);
        showToast('AI 生成成功', 'success');
      } else {
        showToast('AI 未生成任何定位器', 'warning');
      }
    } else {
      showToast(response.error || 'AI 生成失败', 'error');
    }
  } catch (error) {
    console.error('AI 生成失败:', error);
    showToast('AI 生成失败，请检查设置', 'error');
  } finally {
    // 无论成功失败，都隐藏加载状态
    showAILoading(false);
  }
}

// 显示/隐藏 AI 加载状态
// AI 对话功能（对话框默认显示，移除打开/关闭逻辑）

function handleChatInputKeydown(event) {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    handleChatSend();
  }
}

async function handleChatSend() {
  if (!chatInput || !chatSendBtn) return;
  if (!currentElement) {
    showToast('请先选择一个元素', 'warning');
    return;
  }
  if (isChatStreaming) {
    updateChatStatus('AI 正在回复，请稍候...', 'warning');
    return;
  }

  const prompt = chatInput.value.trim();
  if (!prompt) {
    showToast('请输入需要沟通的内容', 'warning');
    return;
  }

  const signature = getElementSignature(currentElement);
  if (!signature) {
    showToast('无法获取元素信息，请重新选择', 'error');
    return;
  }

  if (!chatElementSignature || chatElementSignature !== signature) {
    resetChatState({ clearStorage: true });
    chatElementSignature = signature;
  }

  const userMessage = createChatMessage('user', prompt);
  addChatMessage(userMessage);
  chatInput.value = '';

  const assistantMessage = createChatMessage('assistant', '');
  assistantMessage.streaming = true;
  addChatMessage(assistantMessage, { persist: false });
  chatStreamingMessageId = assistantMessage.id;

  setChatLoadingState(true);
  updateChatStatus('AI 正在生成回复...', 'info');

  const history = chatHistory
    .filter(message => message.id !== chatStreamingMessageId)
    .map(message => ({
      role: message.role === 'assistant' ? 'assistant' : 'user',
      content: message.content
    }));

  activeChatRequestId = Date.now();
  try {
    await dispatchChatRequest({
      element: currentElement,
      prompt,
      history,
      requestId: activeChatRequestId
    });
  } catch (error) {
    console.error('发送对话失败:', error);
    updateChatStatus('发送失败，请检查网络或配置', 'error');
    setChatLoadingState(false);
    finalizeAssistantMessage('发送失败，请稍后重试', { isError: true });
  } finally {
    persistChatState();
  }
}

async function dispatchChatRequest(payload) {
  console.log('🟣 [Popup] 发送chatWithAI消息, requestId:', payload.requestId);
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  
  try {
    const response = await chrome.tabs.sendMessage(tab.id, {
      action: 'chatWithAI',
      data: payload
    });
    console.log('🟣 [Popup] chatWithAI消息发送成功，响应:', response);
  } catch (error) {
    console.error('🟣 [Popup] chatWithAI消息发送失败:', error);
    throw error;
  }
}

function addChatMessage(message, { persist = true } = {}) {
  chatHistory.push(message);
  trimChatHistory();
  renderChatMessages();
  if (persist) {
    persistChatState();
  }
}

function renderChatMessages() {
  if (!chatMessages) return;

  chatMessages.innerHTML = '';

  if (!chatHistory.length) {
    const empty = document.createElement('div');
    empty.className = 'chat-empty';
    empty.textContent = '暂无对话，输入需求即可开始';
    chatMessages.appendChild(empty);
    return;
  }

  chatHistory.forEach(message => {
    const item = document.createElement('div');
    const classes = ['chat-message', message.role];
    if (message.streaming) {
      classes.push('streaming');
    }
    if (message.isError) {
      classes.push('error');
    }
    item.className = classes.join(' ');

    const bubble = document.createElement('div');
    bubble.className = 'chat-bubble';
    
    // 🎨 优化：如果是assistant消息，应用Markdown样式渲染
    if (message.role === 'assistant' && message.content) {
      bubble.innerHTML = formatMarkdown(message.content);
    } else {
      bubble.textContent = message.content || (message.streaming ? '...' : '');
    }
    
    item.appendChild(bubble);

    if (message.timestamp) {
      const meta = document.createElement('div');
      meta.className = 'chat-meta';
      meta.textContent = formatChatTimestamp(message.timestamp);
      item.appendChild(meta);
    }

    chatMessages.appendChild(item);
  });

  chatMessages.scrollTop = chatMessages.scrollHeight;
  
  // 为代码块添加复制按钮监听器
  attachCodeCopyListeners();
}

// 🎨 优化的Markdown格式化函数
function formatMarkdown(text) {
  if (!text) return '';
  
  let html = text;
  
  // 1. 先处理代码块（避免内部内容被其他规则处理）
  const codeBlocks = [];
  html = html.replace(/```(\w*)\n?([\s\S]*?)```/g, (match, lang, code) => {
    const placeholder = `__CODE_BLOCK_${codeBlocks.length}__`;
    const trimmedCode = code.trim();
    const copyBtn = `<button class="code-copy-btn" data-code="${escapeHtml(trimmedCode).replace(/"/g, '&quot;')}" title="复制代码">
      <svg class="copy-icon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/>
      </svg>
      <span>复制</span>
    </button>`;
    codeBlocks.push(`<pre class="code-block">${copyBtn}<code class="language-${lang || 'text'}">${escapeHtml(trimmedCode)}</code></pre>`);
    return placeholder;
  });
  
  // 2. 处理行内代码（保护不被其他规则影响）
  const inlineCodes = [];
  html = html.replace(/`([^`\n]+)`/g, (match, code) => {
    const placeholder = `__INLINE_CODE_${inlineCodes.length}__`;
    inlineCodes.push(`<code class="inline-code">${escapeHtml(code)}</code>`);
    return placeholder;
  });
  
  // 3. 处理粗体（必须在斜体之前，避免 ** 被误识别为两个 *）
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  
  // 4. 处理斜体
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
  
  // 5. 处理链接
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" class="md-link">$1</a>');
  
  // 6. 处理标题（按级别从高到低）
  html = html.replace(/^#### (.+)$/gm, '<h5 class="md-h4">$1</h5>');
  html = html.replace(/^### (.+)$/gm, '<h4 class="md-h3">$1</h4>');
  html = html.replace(/^## (.+)$/gm, '<h3 class="md-h2">$1</h3>');
  html = html.replace(/^# (.+)$/gm, '<h2 class="md-h1">$1</h2>');
  
  // 7. 处理列表
  // 无序列表
  html = html.replace(/^[-*] (.+)$/gm, '<li class="md-li">$1</li>');
  // 有序列表
  html = html.replace(/^\d+\. (.+)$/gm, '<li class="md-li md-li-ordered">$1</li>');
  
  // 将连续的列表项包装在 ul/ol 中
  html = html.replace(/(<li class="md-li">[\s\S]*?<\/li>\n?)+/g, (match) => {
    return `<ul class="md-ul">${match}</ul>`;
  });
  html = html.replace(/(<li class="md-li md-li-ordered">[\s\S]*?<\/li>\n?)+/g, (match) => {
    return `<ol class="md-ol">${match}</ol>`;
  });
  
  // 8. 处理段落和换行
  // 将双换行符分隔的内容识别为段落
  const paragraphs = html.split(/\n\n+/);
  html = paragraphs.map(para => {
    para = para.trim();
    if (!para) return '';
    
    // 如果已经是块级元素，不需要包裹 p 标签
    if (para.match(/^<(h[1-6]|ul|ol|pre|blockquote)/)) {
      return para;
    }
    
    // 单换行符转为 br
    para = para.replace(/\n/g, '<br>');
    
    return `<p class="md-p">${para}</p>`;
  }).join('\n');
  
  // 9. 恢复代码块
  codeBlocks.forEach((code, index) => {
    html = html.replace(`__CODE_BLOCK_${index}__`, code);
  });
  
  // 10. 恢复行内代码
  inlineCodes.forEach((code, index) => {
    html = html.replace(`__INLINE_CODE_${index}__`, code);
  });
  
  return html;
}

// 代码块复制功能：为代码块添加复制事件监听
function attachCodeCopyListeners() {
  const copyButtons = document.querySelectorAll('.code-copy-btn');
  copyButtons.forEach(button => {
    // 移除旧的监听器（如果存在）
    button.replaceWith(button.cloneNode(true));
  });
  
  // 重新获取按钮并添加监听器
  document.querySelectorAll('.code-copy-btn').forEach(button => {
    button.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      const codeText = button.getAttribute('data-code');
      if (!codeText) return;
      
      // 解码HTML实体
      const textarea = document.createElement('textarea');
      textarea.innerHTML = codeText;
      const decodedCode = textarea.value;
      
      try {
        await navigator.clipboard.writeText(decodedCode);
        
        // 显示复制成功状态
        const originalHTML = button.innerHTML;
        button.classList.add('copied');
        button.innerHTML = `
          <svg class="copy-icon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
          </svg>
          <span>已复制</span>
        `;
        
        // 2秒后恢复
        setTimeout(() => {
          button.classList.remove('copied');
          button.innerHTML = originalHTML;
        }, 2000);
      } catch (err) {
        console.error('复制失败:', err);
        showToast('复制失败', 'error');
      }
    });
  });
}

// HTML转义函数
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function createChatMessage(role, content) {
  chatMessageCounter += 1;
  return {
    id: chatMessageCounter,
    role,
    content,
    timestamp: Date.now(),
    streaming: false,
    isError: false
  };
}

function trimChatHistory() {
  if (chatHistory.length <= MAX_CHAT_MESSAGES) {
    return;
  }
  const overflow = chatHistory.length - MAX_CHAT_MESSAGES;
  chatHistory.splice(0, overflow);
}

function formatChatTimestamp(timestamp) {
  const date = new Date(timestamp);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function setChatLoadingState(loading) {
  isChatStreaming = loading;
  if (chatSendBtn) {
    chatSendBtn.disabled = loading;
    chatSendBtn.style.opacity = loading ? '0.7' : '';
  }
}

function updateChatStatus(message = '', type = 'info') {
  if (!chatStatus) return;
  chatStatus.textContent = message;
  chatStatus.className = type && type !== 'info' ? chat-status  : 'chat-status';
}

function getElementSignature(element) {
  if (!element) return null;
  const snippet = (element.outerHTML || '').substring(0, 200);
  return `${element.xpath || ''}|${snippet}`;
}

function handleElementChange(element) {
  const signature = getElementSignature(element);
  if (!signature) {
    resetChatState({ clearStorage: true });
    return;
  }
  if (!chatElementSignature) {
    chatElementSignature = signature;
    persistChatState();
    return;
  }
  if (chatElementSignature !== signature) {
    resetChatState({ clearStorage: true });
    chatElementSignature = signature;
    persistChatState();
  }
}

function resetChatState({ clearStorage = false, keepSignature = false } = {}) {
  chatHistory = [];
  if (!keepSignature) {
    chatElementSignature = null;
  }
  activeChatRequestId = null;
  chatStreamingMessageId = null;
  isChatStreaming = false;
  chatMessageCounter = 0;
  if (chatInput) {
    chatInput.value = '';
  }
  setChatLoadingState(false);
  updateChatStatus('');
  renderChatMessages();
  if (clearStorage) {
    clearChatStorage();
  } else {
    persistChatState();
  }
}

async function persistChatState() {
  try {
    await chrome.storage.local.set({
      lastChatHistory: chatHistory,
      lastChatSignature: chatElementSignature
    });
  } catch (error) {
    console.error('保存对话失败:', error);
  }
}

async function clearChatStorage() {
  try {
    await chrome.storage.local.remove(['lastChatHistory', 'lastChatSignature']);
  } catch (error) {
    console.error('清空对话存储失败:', error);
  }
}

function handleChatStreamUpdate(message) {
  if (!message || message.requestId !== activeChatRequestId) {
    return;
  }
  const assistantMessage = chatHistory.find(item => item.id === chatStreamingMessageId);
  if (!assistantMessage) {
    return;
  }
  assistantMessage.streaming = true;
  assistantMessage.content = (assistantMessage.content || '') + (message.delta || '');
  assistantMessage.timestamp = Date.now();
  renderChatMessages();
  persistChatState();
}

function finalizeAssistantMessage(content, { isError = false } = {}) {
  const assistantMessage = chatHistory.find(item => item.id === chatStreamingMessageId);
  if (!assistantMessage) {
    return;
  }
  assistantMessage.streaming = false;
  assistantMessage.isError = isError;
  assistantMessage.content = content || (isError ? 'AI 响应失败' : '（AI 未返回内容）');
  assistantMessage.timestamp = Date.now();
  chatStreamingMessageId = null;
  activeChatRequestId = null;
  renderChatMessages();
  persistChatState();
}

function handleChatStreamComplete(message) {
  if (!message || message.requestId !== activeChatRequestId) {
    return;
  }
  setChatLoadingState(false);
  finalizeAssistantMessage((message.content || '').trim());
  updateChatStatus('AI 已完成回复', 'success');
}

function handleChatStreamError(message) {
  if (message?.requestId && message.requestId !== activeChatRequestId) {
    return;
  }
  setChatLoadingState(false);
  const errorText = message?.error || 'AI 响应失败，请稍后重试';
  finalizeAssistantMessage(errorText, { isError: true });
  updateChatStatus(errorText, 'error');
}

function normalizeChatHistory(history) {
  if (!Array.isArray(history)) {
    return [];
  }
  const now = Date.now();
  return history.map((item, index) => ({
    id: item?.id ?? index + 1,
    role: item?.role === 'assistant' ? 'assistant' : 'user',
    content: item?.content || '',
    timestamp: item?.timestamp || now,
    streaming: false,
    isError: Boolean(item?.isError)
  }));
}

function refreshChatCounter() {
  chatMessageCounter = chatHistory.reduce((maxId, message) => Math.max(maxId, message.id || 0), 0);
}

function showAILoading(show) {
  const btn = aiGenerateBtn;
  const icon = btn.querySelector('.icon');
  const text = btn.querySelector('span:not(.icon)');
  
  if (show) {
    btn.disabled = true;
    btn.style.opacity = '0.7';
    btn.style.cursor = 'not-allowed';
    icon.textContent = '⏳';
    text.textContent = 'AI 分析中...';
  } else {
    btn.disabled = false;
    btn.style.opacity = '';
    btn.style.cursor = '';
    icon.textContent = '🤖';
    text.textContent = 'AI优化';
  }
}

// 显示 AI 生成的定位器
async function displayAILocators(locators) {
  console.log('displayAILocators 被调用，定位器数量:', locators.length);
  
  // 保存AI定位器到全局变量和存储
  currentAILocators = locators;
  await chrome.storage.local.set({ lastAILocators: locators });
  
  aiLocatorsSection.style.display = 'block';
  
  aiLocatorsList.innerHTML = '';
  
  // 获取当前 testLocatorSelect 的起始索引
  const baseIndex = currentLocators.length;
  
  locators.forEach((locator, index) => {
    const actualIndex = baseIndex + index;
    
    console.log(`添加 AI 定位器 ${index}:`, locator);
    
    // 添加到 AI 列表
    const locatorItem = createLocatorItem(locator, actualIndex);
    aiLocatorsList.appendChild(locatorItem);
    
    // 添加到全局定位器列表
    currentLocators.push(locator);
  });
  
  console.log('AI 定位器区域显示状态:', aiLocatorsSection.style.display);
  console.log('AI 定位器列表子元素数量:', aiLocatorsList.children.length);
  
  // 自动验证 AI 生成的定位器
  await autoValidateAILocators(baseIndex, locators.length);
}

// 自动验证 AI 定位器
async function autoValidateAILocators(startIndex, count) {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    for (let i = 0; i < count; i++) {
      const index = startIndex + i;
      const locator = currentLocators[index];
      const item = document.querySelector(`.locator-item[data-index="${index}"]`);
      
      if (!item) continue;
      
      try {
        const response = await chrome.tabs.sendMessage(tab.id, {
          action: 'testLocator',
          data: locator
        });
        
        updateLocatorStatus(item, response.count);
      } catch (error) {
        console.error(`验证定位器 ${index} 失败:`, error);
        updateLocatorStatus(item, -1);
      }
      
      // 添加小延迟避免过快
      await new Promise(resolve => setTimeout(resolve, 50));
    }
  } catch (error) {
    console.error('自动验证失败:', error);
  }
}

// 清除选择
function clearSelection() {
  currentElement = null;
  currentLocators = [];
  currentAILocators = [];
  resetChatState({ clearStorage: true });
  elementInfo.style.display = 'none';
  locatorsSection.style.display = 'none';
  aiLocatorsSection.style.display = 'none';
  
  // 清除存储
  chrome.storage.local.remove(['lastElement', 'lastLocators', 'lastAILocators', 'lastChatHistory', 'lastChatSignature']);
}

// 打开设置页面
function openSettings() {
  chrome.runtime.openOptionsPage();
}

// 加载存储的数据
async function loadStoredData() {
  try {
    console.log('🔵 [Popup] 开始加载存储的数据...');
    const result = await chrome.storage.local.get(['lastElement', 'lastLocators', 'lastAILocators', 'lastChatHistory', 'lastChatSignature']);
    console.log('🔵 [Popup] 存储数据:', {
      hasElement: !!result.lastElement,
      hasLocators: !!result.lastLocators,
      hasChatHistory: !!result.lastChatHistory,
      chatHistoryLength: result.lastChatHistory?.length
    });
    
    if (result.lastElement && result.lastLocators) {
      currentElement = result.lastElement;
      currentLocators = result.lastLocators;

      const restoredSignature = getElementSignature(currentElement);
      chatElementSignature = restoredSignature;
      
      // 恢复对话历史
      let hasValidChatHistory = false;
      if (restoredSignature && result.lastChatSignature === restoredSignature && Array.isArray(result.lastChatHistory)) {
        console.log('🔵 [Popup] 恢复对话历史，消息数量:', result.lastChatHistory.length);
        chatHistory = normalizeChatHistory(result.lastChatHistory);
        refreshChatCounter();
        hasValidChatHistory = chatHistory.length > 0;
        
        console.log('🔵 [Popup] 标准化后的对话历史:', chatHistory);
      } else {
        console.log('🔵 [Popup] 无有效对话历史或签名不匹配');
        chatHistory = [];
        refreshChatCounter();
        if (result.lastChatHistory || result.lastChatSignature) {
          clearChatStorage();
        }
      }
      
      updateChatStatus('');
      
      // 检查最后一条消息是否还在streaming状态
      if (chatHistory.length > 0) {
        const lastMessage = chatHistory[chatHistory.length - 1];
        console.log('🔵 [Popup] 最后一条消息:', lastMessage);
        
        if (lastMessage.streaming && lastMessage.role === 'assistant') {
          // 如果有streaming消息，说明之前popup关闭了，现在恢复时应该结束streaming状态
          console.log('🔵 [Popup] 检测到未完成的streaming消息，内容长度:', lastMessage.content?.length);
          lastMessage.streaming = false;
          if (!lastMessage.content || lastMessage.content.trim() === '') {
            console.log('🔵 [Popup] streaming消息内容为空，标记为错误');
            lastMessage.content = '（AI响应已保存，但popup在响应期间关闭）';
            lastMessage.isError = true;
          } else {
            console.log('🔵 [Popup] streaming消息有内容，保留内容');
          }
          setChatLoadingState(false);
        }
      }
      
      renderChatMessages();
      persistChatState();
      
      // 如果有对话历史，自动显示对话框
      if (hasValidChatHistory) {
        console.log('🔵 [Popup] 检测到对话历史，延迟打开对话框以确保DOM已就绪');
        // 使用 setTimeout 确保 DOM 完全加载后再打开对话框
        setTimeout(() => {
          console.log('🔵 [Popup] 现在打开对话框');
          openChatDialog();
          // 再次渲染消息，确保显示最新内容
          renderChatMessages();
        }, 100);
      }

      displayElementInfo(currentElement);
      await displayLocators(currentLocators);
      
      // 如果有AI生成的定位器，也恢复显示
      if (result.lastAILocators && result.lastAILocators.length > 0) {
        console.log('从 storage 恢复 AI 定位器:', result.lastAILocators.length, '个');
        currentAILocators = result.lastAILocators;
        await displayAILocators(currentAILocators);
      }
    } else if (result.lastAILocators && result.lastAILocators.length > 0) {
      // 特殊情况：只有 AI 定位器但没有元素信息（用户关闭了弹窗后 AI 才返回）
      // 这种情况下需要等待并重新获取元素信息
      console.log('检测到独立的 AI 定位器，等待元素信息...');
      
      // 设置一个监听器，当元素信息可用时显示 AI 定位器
      const checkInterval = setInterval(async () => {
        const newResult = await chrome.storage.local.get(['lastElement', 'lastLocators']);
        if (newResult.lastElement && newResult.lastLocators) {
          clearInterval(checkInterval);
          currentElement = newResult.lastElement;
          currentLocators = newResult.lastLocators;
          currentAILocators = result.lastAILocators;
          
          displayElementInfo(currentElement);
          await displayLocators(currentLocators);
          await displayAILocators(currentAILocators);
          console.log('AI 定位器已显示');
        }
      }, 100);
      
      // 10秒后停止检查
      setTimeout(() => clearInterval(checkInterval), 10000);
    } else {
      resetChatState({ clearStorage: true });
    }
  } catch (error) {
    console.error('加载数据失败:', error);
  }
}

// 显示提示消息
function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  
  if (type === 'error') {
    toast.style.background = '#e74c3c';
  } else if (type === 'warning') {
    toast.style.background = '#f39c12';
  } else if (type === 'success') {
    toast.style.background = '#27ae60';
  }
  
  document.body.appendChild(toast);
  
  setTimeout(() => {
    toast.remove();
  }, 3000);
}

// 自动验证所有定位器
async function autoValidateAllLocators() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    for (let index = 0; index < currentLocators.length; index++) {
      const locator = currentLocators[index];
      const item = document.querySelector(`.locator-item[data-index="${index}"]`);
      
      if (!item) continue;
      
      try {
        const response = await chrome.tabs.sendMessage(tab.id, {
          action: 'testLocator',
          data: locator
        });
        
        updateLocatorStatus(item, response.count);
      } catch (error) {
        console.error(`验证定位器 ${index} 失败:`, error);
        updateLocatorStatus(item, -1);
      }
      
      // 添加小延迟避免过快
      await new Promise(resolve => setTimeout(resolve, 50));
    }
  } catch (error) {
    console.error('自动验证失败:', error);
  }
}

// 更新定位器状态
function updateLocatorStatus(item, count) {
  const statusSpan = item.querySelector('.locator-status');
  
  if (count === -1) {
    // 验证失败
    item.classList.add('not-found');
    statusSpan.className = 'locator-status not-found';
    statusSpan.textContent = '错误';
  } else if (count === 0) {
    // 未找到
    item.classList.add('not-found');
    statusSpan.className = 'locator-status not-found';
    statusSpan.textContent = '未找到';
  } else if (count === 1) {
    // 唯一
    item.classList.add('unique');
    statusSpan.className = 'locator-status unique';
    statusSpan.textContent = '✓ 唯一';
  } else {
    // 重复
    item.classList.add('duplicate');
    statusSpan.className = 'locator-status duplicate';
    statusSpan.textContent = `${count}个`;
  }
}