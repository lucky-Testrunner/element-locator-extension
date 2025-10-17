// 元素测试器模块
class ElementTester {
  constructor() {
    this.highlightedElements = [];
    this.highlightClass = 'element-locator-highlight';
    this.createHighlightStyle();
  }

  // 创建高亮样式
  createHighlightStyle() {
    if (document.getElementById('element-locator-highlight-style')) {
      return;
    }

    const style = document.createElement('style');
    style.id = 'element-locator-highlight-style';
    style.textContent = `
      .${this.highlightClass} {
        outline: 3px solid #f39c12 !important;
        outline-offset: 2px !important;
        background-color: rgba(243, 156, 18, 0.1) !important;
        position: relative !important;
      }
      
      .${this.highlightClass}::before {
        content: attr(data-locator-index) !important;
        position: absolute !important;
        top: -24px !important;
        left: 0 !important;
        background: #f39c12 !important;
        color: white !important;
        padding: 2px 8px !important;
        border-radius: 3px !important;
        font-size: 12px !important;
        font-weight: bold !important;
        z-index: 2147483647 !important;
        font-family: Arial, sans-serif !important;
      }
    `;
    document.head.appendChild(style);
  }

  // 测试定位器
  test(locator) {
    // 先清除之前的高亮
    this.clearHighlights();

    let elements = [];
    
    try {
      // 提取实际的类型（去掉 (AI) 等后缀）
      const actualType = locator.type.replace(/\s*\(.*?\)\s*$/, '').trim();
      
      // 根据类型关键词判断
      if (actualType === 'ID') {
        elements = this.testById(locator.value);
      } else if (actualType === 'Name') {
        elements = this.testByName(locator.value);
      } else if (actualType === 'Class Name' || actualType === 'Class') {
        elements = this.testByClassName(locator.value);
      } else if (actualType === 'Tag Name' || actualType === 'Tag') {
        elements = this.testByTagName(locator.value);
      } else if (actualType.includes('CSS') || actualType === 'CSS Selector') {
        // 匹配所有包含 CSS 的类型
        elements = this.testByCssSelector(locator.value);
      } else if (actualType.includes('XPath') || actualType === 'XPath') {
        // 匹配所有包含 XPath 的类型
        elements = this.testByXPath(locator.value);
      } else if (actualType === 'Text' || actualType.includes('Playwright')) {
        elements = this.testByText(locator.value);
      } else if (actualType === 'Link Text') {
        elements = this.testByLinkText(locator.value);
      } else if (actualType === 'Data Test ID') {
        elements = this.testByDataTestId(locator.value);
      } else {
        // 默认尝试 XPath，如果失败再尝试 CSS
        try {
          elements = this.testByXPath(locator.value);
          if (elements.length === 0) {
            elements = this.testByCssSelector(locator.value);
          }
        } catch {
          elements = this.testByCssSelector(locator.value);
        }
      }

      // 高亮找到的元素
      if (elements.length > 0) {
        this.highlightElements(elements);
      }

      return {
        success: true,
        count: elements.length,
        elements: elements
      };
    } catch (error) {
      console.error('测试定位器失败:', error);
      return {
        success: false,
        count: 0,
        error: error.message
      };
    }
  }

  // 通过 ID 测试
  testById(id) {
    const element = document.getElementById(id);
    return element ? [element] : [];
  }

  // 通过 Name 测试
  testByName(name) {
    return Array.from(document.getElementsByName(name));
  }

  // 通过 ClassName 测试
  testByClassName(className) {
    return Array.from(document.getElementsByClassName(className));
  }

  // 通过 TagName 测试
  testByTagName(tagName) {
    return Array.from(document.getElementsByTagName(tagName));
  }

  // 通过 CSS Selector 测试
  testByCssSelector(selector) {
    try {
      return Array.from(document.querySelectorAll(selector));
    } catch (error) {
      console.error('CSS Selector 无效:', error);
      return [];
    }
  }

  // 通过 XPath 测试
  testByXPath(xpath) {
    try {
      const result = document.evaluate(
        xpath,
        document,
        null,
        XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
        null
      );

      const elements = [];
      for (let i = 0; i < result.snapshotLength; i++) {
        elements.push(result.snapshotItem(i));
      }
      return elements;
    } catch (error) {
      console.error('XPath 无效:', error);
      return [];
    }
  }

  // 通过文本内容测试
  testByText(text) {
    const xpath = `//*[contains(text(), "${text}")]`;
    return this.testByXPath(xpath);
  }

  // 通过链接文本测试
  testByLinkText(text) {
    return Array.from(document.querySelectorAll('a')).filter(
      a => a.textContent.trim() === text
    );
  }

  // 通过 Data Test ID 测试
  testByDataTestId(testId) {
    const selectors = [
      `[data-testid="${testId}"]`,
      `[data-test-id="${testId}"]`,
      `[data-test="${testId}"]`
    ];

    for (const selector of selectors) {
      const elements = this.testByCssSelector(selector);
      if (elements.length > 0) {
        return elements;
      }
    }
    return [];
  }

  // 高亮元素
  highlightElements(elements) {
    elements.forEach((element, index) => {
      if (element && element.nodeType === Node.ELEMENT_NODE) {
        element.classList.add(this.highlightClass);
        element.setAttribute('data-locator-index', `${index + 1}`);
        this.highlightedElements.push(element);

        // 滚动到第一个元素
        if (index === 0) {
          element.scrollIntoView({
            behavior: 'smooth',
            block: 'center'
          });
        }
      }
    });
  }

  // 清除高亮
  clearHighlights() {
    this.highlightedElements.forEach(element => {
      if (element && element.classList) {
        element.classList.remove(this.highlightClass);
        element.removeAttribute('data-locator-index');
      }
    });
    this.highlightedElements = [];
  }

  // 获取元素的详细信息
  getElementInfo(element) {
    return {
      tagName: element.tagName.toLowerCase(),
      id: element.id,
      className: element.className,
      text: element.textContent.trim().substring(0, 100),
      attributes: this.getElementAttributes(element)
    };
  }

  // 获取元素属性
  getElementAttributes(element) {
    const attrs = {};
    Array.from(element.attributes).forEach(attr => {
      attrs[attr.name] = attr.value;
    });
    return attrs;
  }
}

// 导出供其他模块使用
if (typeof window !== 'undefined') {
  window.ElementTester = ElementTester;
}