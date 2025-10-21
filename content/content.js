// 主内容脚本 - 协调所有模块
(function() {
  'use strict';

  console.log('🟢 [Content] Element Locator 内容脚本开始加载');

  // 初始化模块
  console.log('🟢 [Content] 初始化 ElementSelector');
  const selector = new ElementSelector();
  console.log('🟢 [Content] 初始化 LocatorGenerator');
  const generator = new LocatorGenerator();
  console.log('🟢 [Content] 初始化 ElementTester');
  const tester = new ElementTester();

  console.log('🟢 [Content] 所有模块初始化完成');

  // 监听来自 popup 和 background 的消息
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('🟢 [Content] 收到消息:', message.action);

    // 将异步任务转发给 background script
    if (message.action === 'generateWithAI' || message.action === 'chatWithAI') {
      console.log(`🟢 [Content] 转发 '${message.action}' 到 background script，返回true保持通道开放`);
      chrome.runtime.sendMessage(message, sendResponse);
      return true; // 保持通道开放以接收来自 background 的响应
    }

    // 同步消息处理
    switch (message.action) {
      case 'startSelection':
        console.log('🟢 [Content] 处理startSelection（同步消息，会调用sendResponse）');
        handleStartSelection(sendResponse);
        return false; // 同步处理，已经调用sendResponse
        
      case 'stopSelection':
        console.log('🟢 [Content] 处理stopSelection（同步消息，会调用sendResponse）');
        handleStopSelection(sendResponse);
        return false; // 同步处理，已经调用sendResponse
        
      case 'testLocator':
        console.log('🟢 [Content] 处理testLocator（同步消息，会调用sendResponse）');
        handleTestLocator(message.data, sendResponse);
        return false; // 同步处理，已经调用sendResponse
        
      default:
        console.log('🟢 [Content] 未知消息类型，返回错误响应');
        sendResponse({ success: false, error: `Unknown or non-async action: ${message.action}` });
        return false; // 同步处理
    }
  });

  // 处理开始选择
  function handleStartSelection(sendResponse) {
    console.log('🟢 [Content] 处理开始选择');
    try {
      console.log('🟢 [Content] 启动 selector.start()');
      selector.start((elementData) => {
        console.log('🟢 [Content] 元素已选中，开始生成定位器');
        // 生成定位策略
        const locators = generator.generateAll(elementData);
        
        // 添加定位器到元素数据
        elementData.locators = locators;

        // 保存到存储
        chrome.storage.local.set({
          lastElement: elementData,
          lastLocators: locators
        });

        // 发送消息给 popup（单向消息，不需要响应）
        console.log('🟢 [Content] 发送elementSelected消息给popup（单向消息）');
        chrome.runtime.sendMessage({
          action: 'elementSelected',
          data: elementData
        }).catch(error => {
          // popup可能已关闭，这是正常情况
          if (!error.message.includes('Receiving end does not exist')) {
            console.error('🟢 [Content] 发送消息失败:', error);
          }
        });

        // 🎯 新增：元素选择完成后，通知 background 打开弹窗
        console.log('🟢 [Content] 元素选择完成，请求打开弹窗');
        chrome.runtime.sendMessage({
          action: 'openPopup'
        }).catch(error => {
          console.error('🟢 [Content] 请求打开弹窗失败:', error);
        });
      });

      console.log('🟢 [Content] 选择模式启动成功');
      sendResponse({ success: true });
    } catch (error) {
      console.error('❌ [Content] 启动选择失败:', error);
      console.error('❌ [Content] 错误堆栈:', error.stack);
      sendResponse({ success: false, error: error.message });
    }
  }

  // 处理停止选择
  function handleStopSelection(sendResponse) {
    try {
      selector.stop();
      sendResponse({ success: true });
    } catch (error) {
      console.error('停止选择失败:', error);
      sendResponse({ success: false, error: error.message });
    }
  }

  // 处理测试定位器
  function handleTestLocator(locator, sendResponse) {
    try {
      const result = tester.test(locator);
      sendResponse(result);
    } catch (error) {
      console.error('测试定位器失败:', error);
      sendResponse({ 
        success: false, 
        count: 0,
        error: error.message 
      });
    }
  }

  // (此函数将被移至 background.js)

  // 准备 AI 提示词
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

### 当前XPath参考
\`\`\`
${element.xpath || '(无)'}
\`\`\`

### 元素属性
\`\`\`json
${JSON.stringify(element.attributes, null, 2)}
\`\`\`

---

## 分析要求

1. **在完整HTML中搜索目标元素的位置**
2. **深度分析元素的祖先链**：向上查找3-5层祖先元素，寻找具有唯一标识的祖先
3. **分析周围的父级、兄弟元素，特别是包含文本的元素**
4. **识别稳定的类名**：优先使用语义化类名（如 .header、.user-form）和组件库类名（如 .el-dialog、.ant-btn），避免哈希类名
5. **优先使用文本内容作为定位锚点**（如label、heading、button的文本）
6. **确保生成的每个定位器在页面中是唯一的**
7. **按稳定性排序：唯一祖先+文本定位 > 文本定位 > 唯一属性 > 稳定类名组合 > 组合策略**

## 核心要求

**你必须生成的每个定位策略都要在页面上是唯一的（只匹配1个元素）**

### 分析方法（优先级从高到低）：

1. **检查直接属性**（优先级最高）：
   - ID（如果存在且唯一，但要避免动态生成的ID如 #el-id-6695-119）
   - data-testid、data-test-id、data-test
   - name属性（验证是否唯一）
   - 稳定的 class 组合
   
   **Class 稳定性判断：**
   - ✅ **稳定可用**：组件库 class（如 .el-dialog、.el-input、.ant-btn）、语义化 class（如 .header、.user-form）
   - ❌ **不稳定禁用**：包含哈希的 class（如 .css-1h8iw9x、.Button_button__2Fp3q）

2. **利用文本内容定位**（强烈推荐 - 文本通常唯一且稳定）：
   - 优先通过包含文本的父级元素定位
   - 优先通过包含文本的兄弟元素定位
   - 文本是最稳定的标识符，即使DOM结构改变，文本关系通常保持不变
   - 示例1：//label[text()='用户名']/..//input (通过label文本定位同级input)
   - 示例2：//label[contains(.,'触发器名称')]/following-sibling::*//input[@placeholder='请输入触发器名称'] (真实场景：通过label文本+属性组合定位)
   - 示例3：//span[text()='保存']/ancestor::button (通过文本找按钮)
   - 示例4：//div[contains(text(),'标题')]//following-sibling::input (通过兄弟节点文本)
   - 示例5：//th[text()='操作']/../following-sibling::tr[1]//button (表格场景)

3. **分析DOM层级关系**：
   - 找到最近的有唯一标识或唯一文本的父元素/祖先元素
   - 优先选择包含可见文本的元素作为锚点
   - 从唯一父元素向下定位到目标
   - 示例1：//div[@id='parent']//button[@class='submit']
   - 示例2：//h3[text()='个人信息']/..//input[@type='text']

4. **利用兄弟元素关系**：
   - 优先使用包含文本的兄弟元素作为参照
   - 使用preceding-sibling、following-sibling
   - 结合相邻兄弟元素的文本特征和属性进行精确定位
   - 示例1：//label[text()='密码']/following-sibling::input[1]
   - 示例2：//span[contains(text(),'邮箱')]/../input
   - 示例3：//label[contains(.,'触发器名称')]/following-sibling::*//input[@placeholder='请输入触发器名称'] (组合文本+属性)
   - 如果没有文本兄弟元素，再考虑nth-child、nth-of-type

5. **组合策略确保唯一性**：
   - 父元素唯一标识 + 子元素特征
   - 文本内容 + 其他属性（强烈推荐）
   - 文本祖先 + 相对路径
   - 多个属性组合

### 输出格式要求（严格遵守）：

**必须**按照以下格式返回，每个定位策略必须带编号：

1. XPath: <xpath表达式>
2. CSS Selector: <css表达式>
3. XPath: <另一个xpath表达式>
4. CSS Selector: <另一个css表达式>

**格式说明：**
- 必须使用"数字. 类型: 表达式"的格式
- 每行一个定位策略
- 不要添加任何解释或注释
- 提供3-5个定位策略

**示例输出：**
1. XPath: //input[@id='username']
2. CSS Selector: #username
3. XPath: //form[@id='login']//input[@type='text']
4. CSS Selector: form#login input[type='text']

### 质量要求：

✅ **必须**：
- 每个策略必须唯一（页面只匹配1个元素）
- 优先使用文本定位（通过父级/兄弟节点的文本）
- 可以使用组件库的稳定 class（如 .el-dialog、.ant-btn）
- 可以使用语义化的业务 class（如 .user-profile、.form-section）
- 避免使用绝对路径
- 优先使用稳定属性
- 如果简单定位不唯一，必须组合有文本的父元素或兄弟元素

❌ **禁止**：
- 不能使用动态生成的ID（如 #el-id-6695-119、#__next_123）
- 不能使用哈希 class（如 .css-1h8iw9x、.Button_button__2Fp3q、.sc-xyz123）
- 不能返回会匹配多个元素的策略
- 不能仅依赖位置索引（除非结合唯一父元素）
- 不要忽略有文本的相关元素（它们通常是最好的锚点）

**Class 识别规则：**
- 组件库 class（.el-xxx、.ant-xxx、.mui-xxx）→ ✅ 稳定可用
- 语义化 class（.header、.footer、.user-form）→ ✅ 稳定可用
- 包含哈希的 class（.css-xxxxx、.Button_xxx__hash）→ ❌ 不稳定禁用

🌟 **文本定位的优势**：
- 文本通常在整个页面中是唯一的
- 文本对用户可见，更容易维护和理解
- 文本相对稳定，不易随版本变化
- 即使DOM结构改变，文本关系通常保持不变

请严格按照上述格式返回定位策略列表。`;

    const template = customPrompt || defaultPrompt;
    
    return template
      .replace(/\{html\}/g, element.outerHTML)
      .replace(/\{attributes\}/g, JSON.stringify(element.attributes, null, 2));
  }

  // 解析 AI 响应
  function parseAIResponse(content) {
    const locators = [];
    const lines = content.split('\n');

    console.log('解析 AI 响应，总行数:', lines.length);

    for (const line of lines) {
      const trimmed = line.trim();
      
      if (!trimmed) continue; // 跳过空行
      
      // 匹配格式1: "1. XPath: //div[@id='test']"
      let match = trimmed.match(/^\d+\.\s*([^:]+):\s*(.+)$/);
      
      // 匹配格式2: "XPath: //div[@id='test']" (无编号)
      if (!match) {
        match = trimmed.match(/^([^:]+):\s*(.+)$/);
      }
      
      if (match) {
        const type = match[1].trim();
        const value = match[2].trim();
        
        console.log('解析到定位器:', { type, value });
        
        locators.push({
          type: `${type} (AI)`,
          value: value,
          code: {
            selenium: generateSeleniumCode(type, value),
            playwright: generatePlaywrightCode(type, value),
            cypress: generateCypressCode(type, value)
          }
        });
      }
    }

    console.log('解析完成，定位器数量:', locators.length);
    return locators;
  }

  // 生成 Selenium 代码
  function generateSeleniumCode(type, value) {
    const typeMap = {
      'XPath': 'XPATH',
      'CSS Selector': 'CSS_SELECTOR',
      'ID': 'ID',
      'Name': 'NAME',
      'Class': 'CLASS_NAME',
      'Tag Name': 'TAG_NAME'
    };

    const byType = typeMap[type] || 'XPATH';
    return `driver.find_element(By.${byType}, "${value}")`;
  }

  // 生成 Playwright 代码
  function generatePlaywrightCode(type, value) {
    if (type === 'CSS Selector') {
      return `page.locator("${value}")`;
    } else if (type === 'XPath') {
      return `page.locator("xpath=${value}")`;
    } else if (type === 'ID') {
      return `page.locator("#${value}")`;
    }
    return `page.locator("${value}")`;
  }

  // 生成 Cypress 代码
  function generateCypressCode(type, value) {
    if (type === 'CSS Selector') {
      return `cy.get("${value}")`;
    } else if (type === 'XPath') {
      return `cy.xpath("${value}")`;
    } else if (type === 'ID') {
      return `cy.get("#${value}")`;
    }
    return `cy.get("${value}")`;
  }

  // (此函数将被移至 background.js)

  // 准备对话系统提示词
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
1. **分析元素定位策略** - 提供更好的定位方法建议
2. **解答测试问题** - 回答UI自动化测试相关的问题
3. **优化定位器** - 针对特殊需求优化定位表达式
4. **解决定位问题** - 帮助解决元素难以定位的问题
5. **提供代码示例** - 给出Selenium、Playwright、Cypress等框架的代码示例
6. **技术咨询** - 解答自动化测试最佳实践

## 回答要求

- 直接回答用户的问题，语言简洁专业
- 如果涉及定位策略，优先考虑：**祖先元素+文本定位 > 祖先元素定位 > 文本定位 > 唯一属性 > 稳定类名组合**
- 重点分析：向上查找3-5层祖先元素，寻找具有唯一ID或稳定类名的祖先
- 重点利用：语义化类名（如 .header、.user-form）和组件库类名（如 .el-dialog、.ant-btn）
- 提供的定位器必须在页面中是唯一的
- 避免使用动态生成的ID或哈希class
- 优先使用稳定的属性和文本内容
- 如果给出代码，注明使用的框架（Selenium/Playwright/Cypress）

请根据用户的具体需求提供帮助。`;
  }

  console.log('Element Locator 内容脚本已加载');
})();