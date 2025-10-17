// 元素选择器模块
class ElementSelector {
  constructor() {
    this.isActive = false;
    this.currentElement = null;
    this.overlay = null;
    this.onElementSelected = null;
    this.boundHandlers = {
      mouseover: this.handleMouseOver.bind(this),
      mouseout: this.handleMouseOut.bind(this),
      click: this.handleClick.bind(this)
    };
  }

  // 启动选择模式
  start(callback) {
    if (this.isActive) {
      return;
    }

    this.isActive = true;
    this.onElementSelected = callback;
    this.createOverlay();
    this.attachEventListeners();
    
    // 改变鼠标样式
    document.body.style.cursor = 'crosshair';
  }

  // 停止选择模式
  stop() {
    if (!this.isActive) {
      return;
    }

    this.isActive = false;
    this.removeOverlay();
    this.detachEventListeners();
    document.body.style.cursor = '';
    this.currentElement = null;
  }

  // 创建高亮遮罩层
  createOverlay() {
    if (this.overlay) {
      return;
    }

    this.overlay = document.createElement('div');
    this.overlay.id = 'element-locator-overlay';
    this.overlay.style.cssText = `
      position: absolute;
      background: rgba(102, 126, 234, 0.3);
      border: 2px solid #667eea;
      pointer-events: none;
      z-index: 2147483647;
      transition: all 0.1s ease;
      box-shadow: 0 0 0 2px rgba(102, 126, 234, 0.2);
    `;
    document.body.appendChild(this.overlay);
  }

  // 移除遮罩层
  removeOverlay() {
    if (this.overlay && this.overlay.parentNode) {
      this.overlay.parentNode.removeChild(this.overlay);
      this.overlay = null;
    }
  }

  // 附加事件监听器
  attachEventListeners() {
    document.addEventListener('mouseover', this.boundHandlers.mouseover, true);
    document.addEventListener('mouseout', this.boundHandlers.mouseout, true);
    document.addEventListener('click', this.boundHandlers.click, true);
  }

  // 移除事件监听器
  detachEventListeners() {
    document.removeEventListener('mouseover', this.boundHandlers.mouseover, true);
    document.removeEventListener('mouseout', this.boundHandlers.mouseout, true);
    document.removeEventListener('click', this.boundHandlers.click, true);
  }

  // 处理鼠标悬停
  handleMouseOver(event) {
    if (!this.isActive) {
      return;
    }

    event.stopPropagation();
    const element = event.target;

    // 忽略我们自己的遮罩层
    if (element === this.overlay) {
      return;
    }

    this.currentElement = element;
    this.highlightElement(element);
  }

  // 处理鼠标移出
  handleMouseOut(event) {
    if (!this.isActive) {
      return;
    }
    event.stopPropagation();
  }

  // 处理点击
  handleClick(event) {
    if (!this.isActive) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    const element = event.target;

    // 忽略我们自己的遮罩层
    if (element === this.overlay) {
      return;
    }

    // 提取元素信息
    const elementData = this.extractElementData(element);

    // 停止选择模式
    this.stop();

    // 触发回调
    if (this.onElementSelected) {
      this.onElementSelected(elementData);
    }
  }

  // 高亮元素
  highlightElement(element) {
    if (!this.overlay) {
      return;
    }

    const rect = element.getBoundingClientRect();
    const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;

    this.overlay.style.width = rect.width + 'px';
    this.overlay.style.height = rect.height + 'px';
    this.overlay.style.top = (rect.top + scrollTop) + 'px';
    this.overlay.style.left = (rect.left + scrollLeft) + 'px';
  }

  // 提取元素数据
  extractElementData(element) {
    // 获取完整的页面HTML
    const fullPageHTML = document.documentElement.outerHTML;
    const maxHTMLSize = 500000; // 500KB限制
    
    const data = {
      tagName: element.tagName.toLowerCase(),
      text: this.getElementText(element),
      attributes: {},
      xpath: this.getXPath(element),
      cssSelector: this.getCssSelector(element),
      outerHTML: element.outerHTML,
      innerHTML: element.innerHTML,
      // 发送完整页面HTML - 实测效果最好
      fullPageHTML: fullPageHTML.length > maxHTMLSize
        ? fullPageHTML.substring(0, maxHTMLSize) + '\n\n<!-- 注意：HTML超过500KB，已截断 -->'
        : fullPageHTML
    };

    // 提取所有属性
    Array.from(element.attributes).forEach(attr => {
      data.attributes[attr.name] = attr.value;
    });

    return data;
  }

  // 获取元素文本
  getElementText(element) {
    // 获取直接文本内容，不包括子元素
    let text = '';
    for (let node of element.childNodes) {
      if (node.nodeType === Node.TEXT_NODE) {
        text += node.textContent;
      }
    }
    text = text.trim();
    
    // 如果没有直接文本，获取第一层文本
    if (!text) {
      text = element.textContent.trim().substring(0, 100);
    }
    
    return text;
  }

  // 获取 XPath
  getXPath(element) {
    if (element.id) {
      return `//*[@id="${element.id}"]`;
    }

    const paths = [];
    for (; element && element.nodeType === Node.ELEMENT_NODE; element = element.parentNode) {
      let index = 0;
      let hasFollowingSiblings = false;
      
      for (let sibling = element.previousSibling; sibling; sibling = sibling.previousSibling) {
        if (sibling.nodeType === Node.ELEMENT_NODE && sibling.nodeName === element.nodeName) {
          index++;
        }
      }

      for (let sibling = element.nextSibling; sibling && !hasFollowingSiblings; sibling = sibling.nextSibling) {
        if (sibling.nodeType === Node.ELEMENT_NODE && sibling.nodeName === element.nodeName) {
          hasFollowingSiblings = true;
        }
      }

      const tagName = element.nodeName.toLowerCase();
      const pathIndex = (index || hasFollowingSiblings) ? `[${index + 1}]` : '';
      paths.unshift(`${tagName}${pathIndex}`);
    }

    return paths.length ? `/${paths.join('/')}` : '';
  }

  // 获取 CSS Selector
  getCssSelector(element) {
    if (element.id) {
      return `#${element.id}`;
    }

    const path = [];
    let current = element;

    while (current && current.nodeType === Node.ELEMENT_NODE && current.tagName.toLowerCase() !== 'html') {
      let selector = current.tagName.toLowerCase();

      if (current.id) {
        selector += `#${current.id}`;
        path.unshift(selector);
        break;
      } else {
        let sibling = current;
        let nth = 1;
        
        while (sibling.previousElementSibling) {
          sibling = sibling.previousElementSibling;
          if (sibling.tagName === current.tagName) {
            nth++;
          }
        }

        if (nth > 1 || current.nextElementSibling) {
          selector += `:nth-of-type(${nth})`;
        }
      }

      path.unshift(selector);
      current = current.parentNode;
    }

    return path.join(' > ');
  }
}

// 导出供其他模块使用
if (typeof window !== 'undefined') {
  window.ElementSelector = ElementSelector;
}