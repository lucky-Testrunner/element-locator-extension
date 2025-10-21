// 后台服务 Worker
console.log('Element Locator 后台服务已启动');

// 监听插件安装或更新
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('Element Locator 已安装');
    
    // 设置默认配置
    chrome.storage.local.set({
      aiModel: 'gpt-4'
    });
    
    // 打开欢迎页面
    chrome.tabs.create({
      url: chrome.runtime.getURL('options/options.html')
    });
  } else if (details.reason === 'update') {
    console.log('Element Locator 已更新到版本', chrome.runtime.getManifest().version);
  }
});

// 监听来自内容脚本和 popup 的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('🟢 [Background] 收到消息:', message.action);

  // 异步消息处理
  if (message.action === 'generateWithAI' || message.action === 'chatWithAI') {
    (async () => {
      if (message.action === 'generateWithAI') {
        const response = await handleGenerateWithAI(message.data);
        sendResponse(response);
      } else {
        // 对于流式聊天，我们不在此处发送响应，
        // 而是直接将流式数据发送到 popup
        handleChatWithAI(message.data);
        // 立即返回成功，表示已开始处理
        sendResponse({ success: true, streaming: true });
      }
    })();
    return true; // 关键：为异步操作保持通道开放
  }

  // 同步消息处理
  switch (message.action) {
    case 'elementSelected':
      console.log('🟢 [Background] 转发elementSelected到popup（不返回true，这是单向转发）');
      forwardMessageToPopup(message);
      return false; // 单向转发，不需要异步响应
    case 'openPopup':
      console.log('🟢 [Background] 收到打开弹窗请求');
      handleOpenPopup(sender.tab.id);
      return false; // 同步处理
    default:
      console.log(`🟡 [Background] 未知或非后台处理的消息类型: ${message.action}`);
      return false; // 不处理的消息，返回false
  }
});

// 转发消息到 popup
function forwardMessageToPopup(message) {
  chrome.runtime.sendMessage(message).catch(error => {
    if (error.message.includes('Receiving end does not exist')) {
      // 这是预期的行为，当popup关闭时
    } else {
      console.warn('无法转发消息到 popup:', error.message);
    }
  });
}

// 处理打开弹窗请求
async function handleOpenPopup(tabId) {
  try {
    console.log('🟢 [Background] 尝试打开popup，标签页ID:', tabId);
    // Chrome Extension API 中，popup 是自动关联到 action 的
    // 我们需要通过 chrome.action.openPopup() 来打开
    // 注意：这个 API 在 Manifest V3 中可用
    await chrome.action.openPopup();
    console.log('🟢 [Background] Popup已打开');
  } catch (error) {
    console.error('🟢 [Background] 打开popup失败:', error);
    // 如果 openPopup 不可用，可以尝试替代方案
    // 例如：通知用户点击扩展图标
  }
}

// --- AI 处理逻辑 ---

// 处理 AI 生成
async function handleGenerateWithAI(data) {
  console.log('🟢 [Background] 开始处理AI生成请求');
  try {
    const config = await chrome.storage.local.get(['aiUrl', 'aiKey', 'aiModel', 'aiPrompt', 'aiMaxTokens']);
    if (!config.aiUrl || !config.aiKey) {
      return { success: false, error: '请先在设置中配置 AI 服务' };
    }
    const prompt = prepareAIPrompt(data.element, config.aiPrompt);
    const response = await fetch(config.aiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${config.aiKey}` },
      body: JSON.stringify({
        model: config.aiModel || 'kimi-k2-0905',
        messages: [
          { role: 'system', content: '你是一个专业的UI自动化测试专家，擅长生成稳定可靠的元素定位策略。' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.3,
        max_tokens: parseInt(config.aiMaxTokens) || 8000
      })
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error?.message || `HTTP ${response.status}`);
    }
    const result = await response.json();
    const aiContent = result.choices[0]?.message?.content || result.content || '';
    if (!aiContent) throw new Error('AI 响应格式错误：未找到内容字段');
    const aiLocators = parseAIResponse(aiContent);
    await chrome.storage.local.set({ lastAILocators: aiLocators });
    return { success: true, locators: aiLocators };
  } catch (error) {
    console.error('❌ [Background] AI 生成失败:', error);
    return { success: false, error: error.message };
  }
}

// 处理 AI 对话（支持流式输出）
async function handleChatWithAI(data) {
  console.log('🟢 [Background] 开始处理AI对话请求, requestId:', data.requestId);
  try {
    const config = await chrome.storage.local.get(['aiUrl', 'aiKey', 'aiModel', 'aiMaxTokens']);
    if (!config.aiUrl || !config.aiKey) {
      console.log('🟢 [Background] 配置缺失，发送错误消息');
      chrome.runtime.sendMessage({ action: 'aiChatError', requestId: data.requestId, error: '请先在设置中配置 AI 服务' }).catch(err => {
        console.error('🟢 [Background] 发送错误消息失败:', err);
      });
      return;
    }
    
    console.log('🟢 [Background] AI配置:', { url: config.aiUrl, model: config.aiModel });
    
    const messages = [
      { role: 'system', content: prepareChatSystemPrompt(data.element) },
      ...(data.history || []),
      { role: 'user', content: data.prompt }
    ];
    
    console.log('🟢 [Background] 发送请求到AI服务...');
    const response = await fetch(config.aiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${config.aiKey}` },
      body: JSON.stringify({
        model: config.aiModel || 'gpt-4',
        messages: messages,
        temperature: 0.7,
        max_tokens: parseInt(config.aiMaxTokens) || 8000,
        stream: true
      })
    });
    
    console.log('🟢 [Background] AI服务响应状态:', response.status);
    
    if (!response.ok || !response.body) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';
    let fullContent = '';
    let chunkCount = 0;
    
    console.log('🟢 [Background] 开始读取流式响应...');
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        console.log('🟢 [Background] 流式响应读取完成，总chunk数:', chunkCount);
        break;
      }
      
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      
      for (const line of lines) {
        if (!line.startsWith('data:')) continue;
        const jsonStr = line.substring(5).trim();
        if (jsonStr === '[DONE]') {
          console.log('🟢 [Background] 收到[DONE]标记');
          break;
        }
        
        try {
          const chunk = JSON.parse(jsonStr);
          const delta = chunk.choices?.[0]?.delta?.content || '';
          if (delta) {
            chunkCount++;
            fullContent += delta;
            
            console.log(`🟢 [Background] 发送流式更新 #${chunkCount}, delta长度:`, delta.length);
            
            // 尝试发送到 popup，如果失败则说明 popup 已关闭
            chrome.runtime.sendMessage({
              action: 'aiChatStream',
              requestId: data.requestId,
              delta: delta,
              content: fullContent
            }).catch(err => {
              // popup关闭是正常情况，不输出错误
              if (!err.message.includes('Receiving end does not exist')) {
                console.error('🟢 [Background] 发送流式消息失败:', err.message);
              }
            });
          }
          
          if (chunk.choices?.[0]?.finish_reason) {
            console.log('🟢 [Background] 收到finish_reason:', chunk.choices[0].finish_reason);
            break;
          }
        } catch (e) {
          console.warn('🟢 [Background] 解析chunk失败:', e);
        }
      }
    }
    
    console.log('🟢 [Background] 发送完成消息, 内容总长度:', fullContent.length);
    
    // 尝试发送完成消息
    chrome.runtime.sendMessage({
      action: 'aiChatComplete',
      requestId: data.requestId,
      content: fullContent
    }).catch(async (err) => {
      // 如果 popup 关闭了，将结果保存到 storage
      if (err.message.includes('Receiving end does not exist')) {
        console.log('🟢 [Background] Popup已关闭，保存AI对话结果到storage');
        try {
          // 读取当前对话历史
          const result = await chrome.storage.local.get(['lastChatHistory', 'lastChatSignature']);
          if (result.lastChatHistory && Array.isArray(result.lastChatHistory)) {
            const chatHistory = result.lastChatHistory;
            // 找到最后一个streaming的消息（助手消息）
            const lastMessage = chatHistory[chatHistory.length - 1];
            if (lastMessage && lastMessage.streaming) {
              lastMessage.streaming = false;
              lastMessage.content = fullContent.trim();
              lastMessage.timestamp = Date.now();
              // 保存更新后的历史
              await chrome.storage.local.set({ lastChatHistory: chatHistory });
              console.log('🟢 [Background] AI对话结果已保存到storage');
            }
          }
        } catch (saveErr) {
          console.error('🟢 [Background] 保存对话结果失败:', saveErr);
        }
      } else {
        console.error('🟢 [Background] 发送完成消息失败:', err.message);
      }
    });
    
  } catch (error) {
    console.error('❌ [Background] AI 对话失败:', error);
    chrome.runtime.sendMessage({
      action: 'aiChatError',
      requestId: data.requestId,
      error: error.message
    }).catch(err => {
      console.error('🟢 [Background] 发送错误消息失败:', err.message);
    });
  }
}

// --- 辅助函数 ---

function prepareAIPrompt(element, customPrompt) {
  const defaultPrompt = `你是一个专业的UI自动化测试专家。你的任务是分析HTML元素并生成**唯一且稳定**的定位策略。
## 完整页面HTML
以下是完整的页面HTML结构，你可以看到所有元素的关系和上下文：
\`\`\`html
${element.fullPageHTML || '(无法获取页面HTML)'}
\`\`\`
---
## 目标元素
**你需要为以下元素生成定位策略：**
\`\`\`html
${element.outerHTML}
\`\`\`
## 分析要求
1. **在完整HTML中搜索目标元素的位置**
2. **分析周围的父级、兄弟元素，特别是包含文本的元素**
3. **优先使用文本内容作为定位锚点**（如label、heading、button的文本）
4. **确保生成的每个定位器在页面中是唯一的**
5. **按稳定性排序：文本定位 > 唯一属性 > 组合策略**
## 输出格式要求（严格遵守）：
**必须**按照以下格式返回，每个定位策略必须带编号：
1. XPath: <xpath表达式>
2. CSS Selector: <css表达式>
`;
  const template = customPrompt || defaultPrompt;
  return template
    .replace(/\{html\}/g, element.outerHTML)
    .replace(/\{attributes\}/g, JSON.stringify(element.attributes, null, 2));
}

function parseAIResponse(content) {
  const locators = [];
  const lines = content.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    let match = trimmed.match(/^\d+\.\s*([^:]+):\s*(.+)$/) || trimmed.match(/^([^:]+):\s*(.+)$/);
    if (match) {
      locators.push({
        type: `${match[1].trim()} (AI)`,
        value: match[2].trim()
      });
    }
  }
  return locators;
}

function prepareChatSystemPrompt(element) {
  return `你是一个专业的UI自动化测试专家和技术顾问。用户正在使用Element Locator工具来分析网页元素并生成定位策略。

## 完整页面HTML
以下是完整的页面HTML结构，你可以看到所有元素的关系和上下文：
\`\`\`html
${element.fullPageHTML || '(无法获取页面HTML)'}
\`\`\`

---

## 当前选中的元素信息
**元素HTML:**
\`\`\`html
${element.outerHTML || '(无法获取)'}
\`\`\`
**元素XPath:**
\`\`\`
${element.xpath || '(无)'}
\`\`\`
**元素属性:**
\`\`\`json
${JSON.stringify(element.attributes || {}, null, 2)}
\`\`\`
## 你的角色和能力
你可以帮助用户：
1. **分析元素定位策略** - 基于完整HTML提供更好的定位方法
2. **解答测试问题** - 回答UI自动化测试相关的问题
3. **优化定位器** - 利用祖先元素、类名和文本内容等优化定位
4. **提供代码示例** - 给出Selenium、Playwright、Cypress等框架的代码示例
## 回答要求
- 直接回答用户的问题，语言简洁专业
- 优先考虑：祖先元素+文本定位 > 文本定位 > 唯一属性 > 稳定类名
- 重点分析：向上查找3-5层祖先元素，寻找具有唯一ID或稳定类名的祖先
- 重点利用：语义化类名和组件库类名
- 提供的定位器必须在页面中是唯一的
- 避免使用动态生成的ID或哈希class
- 优先使用稳定的属性和文本内容
`;
}

// 监听标签页更新
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    console.log('标签页加载完成:', tab.url);
  }
});

// 处理扩展图标点击（如果需要）
chrome.action.onClicked.addListener((tab) => {
  console.log('扩展图标被点击，标签页:', tab.id);
});