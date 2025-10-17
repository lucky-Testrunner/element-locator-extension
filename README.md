# Element Locator - UI测试助手 🎯

一个强大的浏览器扩展，帮助测试人员快速定位页面元素，生成多种定位策略，提高UI自动化测试效率。

## 实际图
<table align="center">
<tr>
<td align="center"><img width="400" alt="image" src="https://github.com/user-attachments/assets/81934e6f-d85b-4c95-990d-47d3e8c8e7cf" /></td>
<td align="center"><img width="400" alt="image" src="https://github.com/user-attachments/assets/232aaf63-0eb7-482b-a6f7-8961813ea13b" /></td>
</tr>
</table>


<img width="2560" height="1247" alt="image" src="https://github.com/user-attachments/assets/82f5c572-d43d-41bf-96a5-2e29e53d9636" />

##
现在你可以通过[Models | 心流开放平台](https://platform.iflow.cn/models)免费使用GLM-4.5、Kimi-K2、Qwen3-Coder-480B-A35B、DeepSeek v3.1等模型。
##

## ✨ 主要功能

### 🖱️ 智能元素选择
- 点击按钮进入选择模式
- 鼠标悬停实时高亮元素
- 点击选中目标元素

### 📋 多种定位策略
自动生成多种元素定位表达式：
- **XPath** - 完整路径和优化路径
- **CSS Selector** - 多种CSS选择器组合
- **ID** - 元素ID（最优先）
- **Name** - 元素name属性
- **Class** - 单个或组合class
- **Data Test ID** - data-testid等测试属性
- **Text** - 基于文本内容的定位
- **Link Text** - 链接文本定位

### 🧪 定位器测试
- 实时测试定位表达式
- 显示匹配元素数量
- 验证定位器唯一性
- 高亮所有匹配元素
- 自动滚动到匹配元素

### 🤖 AI智能优化
- 集成AI服务
- 分析HTML结构
- 生成最优定位策略
- 避免脆弱的定位方式

### 📦 多格式导出
支持多种测试框架的代码格式：
- **纯表达式** - 直接使用的定位表达式
- **Selenium (Python)** - `driver.find_element(By.XPATH, "...")`
- **Selenium (Java)** - `driver.findElement(By.xpath("..."))`
- **Playwright** - `page.locator("...")`
- **Cypress** - `cy.get("...")`

## 📦 安装方法

### 方法 1：从源代码安装（开发模式）

1. **克隆或下载项目**
   ```bash
   git clone https://github.com/lucky-Testrunner/element-locator-extension.git
   ```
2. **在Chrome/Edge中加载扩展**
   - 打开浏览器，访问 `chrome://extensions/` 或 `edge://extensions/`
   - 启用"开发者模式"（右上角开关）
   - 点击"加载已解压的扩展程序"
   - 选择 `element-locator-extension` 目录

### 方法 2：从Chrome Web Store安装（未来）

待发布到Chrome Web Store后，可直接在线安装。

## 🚀 使用指南

### 1. 基础使用流程

1. **打开目标网页**
   - 在浏览器中打开需要测试的网页

2. **启动元素选择**
   - 点击浏览器工具栏中的扩展图标
   - 点击"开始选择元素"按钮

3. **选择目标元素**
   - 移动鼠标到目标元素上（会高亮显示）
   - 点击选中元素

4. **查看定位策略**
   - 自动生成多种定位表达式
   - 查看元素详细信息

5. **测试定位器**
   - 从下拉列表选择要测试的定位器
   - 点击"测试"按钮
   - 查看匹配结果（唯一性验证）

6. **复制使用**
   - 点击定位器旁的复制按钮
   - 选择目标格式（Selenium、Playwright等）
   - 粘贴到测试代码中

### 2. AI功能配置

1. **打开设置页面**
   - 点击扩展弹窗底部的"⚙️ 设置"

2. **配置AI服务**
   - **API URL**: 输入AI服务的API端点（支持OpenAI兼容格式）
   - **API Key**: 输入您的API密钥
   - **模型名称**: 选择AI模型（推荐gpt-4）
   - **提示词模板**: 可选，自定义提示词

3. **测试连接**
   - 点击"🧪 测试连接"按钮
   - 确认配置正确

4. **保存设置**
   - 点击"💾 保存设置"

5. **使用AI生成**
   - 选择元素后
   - 点击"🤖 AI优化"按钮
   - AI会分析元素并生成最优定位策略

### 3. 高级技巧

#### 选择难以定位的元素
- 使用XPath文本匹配：`//*[contains(text(), "关键词")]`
- 使用属性组合：`input[type="text"][name="username"]`
- 使用父子关系：`div.container > button.submit`

#### 提高定位稳定性
- 优先使用ID和data-testid
- 避免使用动态生成的class名
- 使用相对路径而非绝对路径
- 结合多个属性提高唯一性

#### 批量处理
- 使用测试功能验证每个定位器
- 选择唯一性最好的定位策略
- 记录并整理元素定位库

## 🛠️ 项目结构

```
element-locator-extension/
├── manifest.json              # 扩展配置文件
├── icons/                     # 图标资源
│   ├── icon16.png
│   ├── icon48.png
│   ├── icon128.png
│   └── generate_icons.py     # 图标生成脚本
├── popup/                     # 弹出窗口
│   ├── popup.html            # 主界面
│   ├── popup.js              # 交互逻辑
│   └── popup.css             # 样式
├── options/                   # 设置页面
│   ├── options.html          # 设置界面
│   ├── options.js            # 配置逻辑
│   └── options.css           # 样式
├── content/                   # 内容脚本
│   ├── content.js            # 主控制器
│   ├── content.css           # 页面样式
│   ├── element-selector.js   # 元素选择器
│   ├── locator-generator.js  # 定位策略生成器
│   └── element-tester.js     # 表达式测试器
├── background/               # 后台服务
│   └── background.js         # 后台脚本
└── README.md                 # 项目文档
```

## 🔧 技术栈

- **Manifest V3** - Chrome扩展最新标准
- **Vanilla JavaScript** - 无框架依赖
- **CSS3** - 现代样式
- **Chrome Extension APIs** - 浏览器扩展API

## 📝 支持的浏览器

- ✅ Chrome 88+
- ✅ Microsoft Edge 88+
- ⚠️ Firefox（需要适配）
- ⚠️ Safari（需要适配）

## 🤝 贡献指南

欢迎提交Issue和Pull Request！

### 开发环境设置

1. Fork本仓库
2. 创建特性分支：`git checkout -b feature/AmazingFeature`
3. 提交更改：`git commit -m 'Add some AmazingFeature'`
4. 推送到分支：`git push origin feature/AmazingFeature`
5. 提交Pull Request

### 代码规范

- 使用ES6+语法
- 添加适当的注释
- 遵循现有代码风格
- 确保功能正常运行

## 🐛 问题反馈

如果遇到问题或有功能建议，请：

1. 查看[FAQ](#faq)
2. 搜索已有的[Issues](issues)
3. 创建新的Issue，详细描述问题

## 📄 许可证

MIT License - 详见 [LICENSE](LICENSE) 文件

## 🙏 致谢

感谢所有为这个项目做出贡献的开发者！

## FAQ

### Q: 扩展无法在某些网站上工作？
A: 某些网站有严格的CSP策略，可能会阻止内容脚本。可以尝试在隐私模式或其他网站上测试。

### Q: AI功能需要付费吗？
A: AI功能需要您自己的API密钥。您可以使用OpenAI或其他兼容的AI服务，费用取决于您选择的服务。


### Q: 生成的定位器不唯一怎么办？
A: 使用测试功能验证，选择唯一的定位器。也可以尝试AI优化功能生成更稳定的策略。

### Q: 支持iframe中的元素吗？
A: 当前版本需要手动切换到iframe上下文。未来版本会增强iframe支持。

---

**Element Locator** - 让UI自动化测试更简单！ 🚀
