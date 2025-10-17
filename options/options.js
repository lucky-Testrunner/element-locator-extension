// 默认提示词模板
const DEFAULT_PROMPT = `你是一个专业的UI自动化测试专家。请分析以下HTML元素，生成最稳定、最可靠的元素定位策略。

元素HTML:
{html}

元素属性:
{attributes}

请提供3-5个定位策略，按优先级排序（最稳定的放在前面），格式如下：

1. XPath: <xpath表达式>
2. CSS Selector: <css表达式>
3. ID: <id值>（如果存在）
4. Class: <class值>（如果合适）
5. Name: <name值>（如果存在）

要求：
- 优先使用ID、data-testid等唯一标识属性
- 避免使用容易变化的class名称（如随机生成的）
- XPath尽量简洁，避免使用绝对路径
- 考虑元素的文本内容作为辅助定位
- 每个策略都要能准确定位到该元素

请直接返回定位策略列表，不需要解释。`;

// DOM 元素
const aiUrlInput = document.getElementById('aiUrl');
const aiKeyInput = document.getElementById('aiKey');
const aiModelInput = document.getElementById('aiModel');
const aiMaxTokensInput = document.getElementById('aiMaxTokens');
const aiPromptInput = document.getElementById('aiPrompt');
const toggleKeyBtn = document.getElementById('toggleKeyVisibility');
const testAiBtn = document.getElementById('testAiBtn');
const saveBtn = document.getElementById('saveBtn');
const resetBtn = document.getElementById('resetBtn');
const testResult = document.getElementById('testResult');
const defaultPromptEl = document.getElementById('defaultPrompt');

// 初始化
document.addEventListener('DOMContentLoaded', () => {
  loadSettings();
  displayDefaultPrompt();
  setupEventListeners();
});

// 设置事件监听
function setupEventListeners() {
  toggleKeyBtn.addEventListener('click', toggleKeyVisibility);
  testAiBtn.addEventListener('click', testAiConnection);
  saveBtn.addEventListener('click', saveSettings);
  resetBtn.addEventListener('click', resetSettings);
}

// 加载设置
async function loadSettings() {
  try {
    const result = await chrome.storage.local.get([
      'aiUrl',
      'aiKey',
      'aiModel',
      'aiMaxTokens',
      'aiPrompt'
    ]);
    
    aiUrlInput.value = result.aiUrl || '';
    aiKeyInput.value = result.aiKey || '';
    aiModelInput.value = result.aiModel || 'gpt-4';
    aiMaxTokensInput.value = result.aiMaxTokens || '8000';
    aiPromptInput.value = result.aiPrompt || '';
  } catch (error) {
    console.error('加载设置失败:', error);
    showToast('加载设置失败', 'error');
  }
}

// 保存设置
async function saveSettings() {
  const maxTokens = parseInt(aiMaxTokensInput.value.trim()) || 8000;
  
  const settings = {
    aiUrl: aiUrlInput.value.trim(),
    aiKey: aiKeyInput.value.trim(),
    aiModel: aiModelInput.value.trim() || 'gpt-4',
    aiMaxTokens: maxTokens,
    aiPrompt: aiPromptInput.value.trim()
  };
  
  // 验证必填字段
  if (!settings.aiUrl || !settings.aiKey) {
    showTestResult('请填写 API URL 和 API Key', 'error');
    return;
  }
  
  // 验证 URL 格式
  try {
    new URL(settings.aiUrl);
  } catch (error) {
    showTestResult('API URL 格式不正确', 'error');
    return;
  }
  
  // 验证 max_tokens 范围
  if (maxTokens < 1 || maxTokens > 200000) {
    showTestResult('最大 Token 数必须在 1-200000 之间', 'error');
    return;
  }
  
  try {
    await chrome.storage.local.set(settings);
    showToast('设置已保存', 'success');
    showTestResult('设置保存成功！', 'success');
  } catch (error) {
    console.error('保存设置失败:', error);
    showToast('保存失败', 'error');
    showTestResult('保存失败: ' + error.message, 'error');
  }
}

// 测试 AI 连接
async function testAiConnection() {
  const url = aiUrlInput.value.trim();
  const key = aiKeyInput.value.trim();
  const model = aiModelInput.value.trim() || 'gpt-4';
  
  if (!url || !key) {
    showTestResult('请先填写 API URL 和 API Key', 'error');
    return;
  }
  
  showTestResult('正在测试连接...', 'info');
  testAiBtn.disabled = true;
  testAiBtn.textContent = '⏳ 测试中...';
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${key}`
      },
      body: JSON.stringify({
        model: model,
        messages: [
          {
            role: 'user',
            content: '请回复"连接成功"'
          }
        ],
        max_tokens: 50
      })
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error?.message || `HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    if (data.choices && data.choices.length > 0) {
      showTestResult('✅ 连接成功！AI 服务可以正常使用。', 'success');
      showToast('连接测试成功', 'success');
    } else {
      showTestResult('⚠️ 响应格式异常，请检查配置', 'error');
    }
  } catch (error) {
    console.error('测试连接失败:', error);
    showTestResult(`❌ 连接失败: ${error.message}`, 'error');
    showToast('连接测试失败', 'error');
  } finally {
    testAiBtn.disabled = false;
    testAiBtn.textContent = '🧪 测试连接';
  }
}

// 重置设置
async function resetSettings() {
  if (!confirm('确定要恢复默认设置吗？这将清除所有已保存的配置。')) {
    return;
  }
  
  try {
    await chrome.storage.local.remove(['aiUrl', 'aiKey', 'aiModel', 'aiMaxTokens', 'aiPrompt']);
    
    aiUrlInput.value = '';
    aiKeyInput.value = '';
    aiModelInput.value = 'gpt-4';
    aiMaxTokensInput.value = '8000';
    aiPromptInput.value = '';
    
    showToast('已恢复默认设置', 'info');
    showTestResult('已恢复默认设置', 'info');
  } catch (error) {
    console.error('重置失败:', error);
    showToast('重置失败', 'error');
  }
}

// 切换密钥可见性
function toggleKeyVisibility() {
  if (aiKeyInput.type === 'password') {
    aiKeyInput.type = 'text';
    toggleKeyBtn.textContent = '🙈';
  } else {
    aiKeyInput.type = 'password';
    toggleKeyBtn.textContent = '👁️';
  }
}

// 显示默认提示词
function displayDefaultPrompt() {
  defaultPromptEl.textContent = DEFAULT_PROMPT;
}

// 显示测试结果
function showTestResult(message, type = 'info') {
  testResult.textContent = message;
  testResult.className = `test-result ${type} show`;
  
  setTimeout(() => {
    testResult.classList.remove('show');
  }, 5000);
}

// 显示提示消息
function showToast(message, type = 'info') {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.className = `toast ${type}`;
  toast.style.display = 'block';
  
  setTimeout(() => {
    toast.style.display = 'none';
  }, 3000);
}

// 导出默认提示词供其他模块使用
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { DEFAULT_PROMPT };
}