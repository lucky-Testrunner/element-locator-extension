// 定位策略生成器模块
class LocatorGenerator {
  constructor() {
    this.strategies = [
      { name: 'generateById', priority: 1 },
      { name: 'generateByDataTestId', priority: 2 },
      { name: 'generateByName', priority: 3 },
      { name: 'generateByClassName', priority: 4 },
      { name: 'generateByCssSelector', priority: 5 },
      { name: 'generateByXPath', priority: 6 },
      { name: 'generateByTagName', priority: 7 },
      { name: 'generateByText', priority: 8 },
      { name: 'generateByLinkText', priority: 9 }
    ];
  }

  // 生成所有可用的定位策略
  generateAll(elementData) {
    const locators = [];

    this.strategies.forEach(strategy => {
      const result = this[strategy.name](elementData);
      if (result) {
        if (Array.isArray(result)) {
          locators.push(...result);
        } else {
          locators.push(result);
        }
      }
    });

    return locators;
  }

  // 通过 ID 生成
  generateById(elementData) {
    const id = elementData.attributes.id;
    if (!id) {
      return null;
    }

    return {
      type: 'ID',
      value: id,
      code: {
        selenium: `driver.find_element(By.ID, "${id}")`,
        playwright: `page.locator("#${id}")`,
        cypress: `cy.get("#${id}")`
      }
    };
  }

  // 通过 data-testid 生成
  generateByDataTestId(elementData) {
    const testId = elementData.attributes['data-testid'] || 
                   elementData.attributes['data-test-id'] ||
                   elementData.attributes['data-test'];
    
    if (!testId) {
      return null;
    }

    return {
      type: 'Data Test ID',
      value: testId,
      code: {
        selenium: `driver.find_element(By.CSS_SELECTOR, "[data-testid='${testId}']")`,
        playwright: `page.locator("[data-testid='${testId}']")`,
        cypress: `cy.get("[data-testid='${testId}']")`
      }
    };
  }

  // 通过 Name 生成
  generateByName(elementData) {
    const name = elementData.attributes.name;
    if (!name) {
      return null;
    }

    return {
      type: 'Name',
      value: name,
      code: {
        selenium: `driver.find_element(By.NAME, "${name}")`,
        playwright: `page.locator("[name='${name}']")`,
        cypress: `cy.get("[name='${name}']")`
      }
    };
  }

  // 通过 ClassName 生成
  generateByClassName(elementData) {
    const className = elementData.attributes.class;
    if (!className) {
      return null;
    }

    const classes = className.trim().split(/\s+/);
    const locators = [];

    // 单个类名
    classes.forEach(cls => {
      // 过滤掉可能动态生成的类名
      if (!this.isDynamicClassName(cls)) {
        locators.push({
          type: 'Class Name',
          value: cls,
          code: {
            selenium: `driver.find_element(By.CLASS_NAME, "${cls}")`,
            playwright: `page.locator(".${cls}")`,
            cypress: `cy.get(".${cls}")`
          }
        });
      }
    });

    // 组合类名
    if (classes.length > 1) {
      const combinedSelector = '.' + classes.join('.');
      locators.push({
        type: 'CSS Selector (Classes)',
        value: combinedSelector,
        code: {
          selenium: `driver.find_element(By.CSS_SELECTOR, "${combinedSelector}")`,
          playwright: `page.locator("${combinedSelector}")`,
          cypress: `cy.get("${combinedSelector}")`
        }
      });
    }

    return locators.length > 0 ? locators : null;
  }

  // 通过 CSS Selector 生成
  generateByCssSelector(elementData) {
    const locators = [];

    // 基础 CSS Selector
    if (elementData.cssSelector) {
      locators.push({
        type: 'CSS Selector',
        value: elementData.cssSelector,
        code: {
          selenium: `driver.find_element(By.CSS_SELECTOR, "${elementData.cssSelector}")`,
          playwright: `page.locator("${elementData.cssSelector}")`,
          cypress: `cy.get("${elementData.cssSelector}")`
        }
      });
    }

    // 通过多个属性组合
    const attrs = elementData.attributes;
    if (attrs.type && attrs.name) {
      const selector = `${elementData.tagName}[type="${attrs.type}"][name="${attrs.name}"]`;
      locators.push({
        type: 'CSS Selector (Type+Name)',
        value: selector,
        code: {
          selenium: `driver.find_element(By.CSS_SELECTOR, "${selector}")`,
          playwright: `page.locator("${selector}")`,
          cypress: `cy.get("${selector}")`
        }
      });
    }

    // 通过 placeholder
    if (attrs.placeholder) {
      const selector = `${elementData.tagName}[placeholder="${attrs.placeholder}"]`;
      locators.push({
        type: 'CSS Selector (Placeholder)',
        value: selector,
        code: {
          selenium: `driver.find_element(By.CSS_SELECTOR, "${selector}")`,
          playwright: `page.locator("${selector}")`,
          cypress: `cy.get("${selector}")`
        }
      });
    }

    return locators.length > 0 ? locators : null;
  }

  // 通过 XPath 生成
  generateByXPath(elementData) {
    const locators = [];

    // 基础 XPath
    if (elementData.xpath) {
      locators.push({
        type: 'XPath',
        value: elementData.xpath,
        code: {
          selenium: `driver.find_element(By.XPATH, "${elementData.xpath}")`,
          playwright: `page.locator("xpath=${elementData.xpath}")`,
          cypress: `cy.xpath("${elementData.xpath}")`
        }
      });
    }

    // 通过文本内容的 XPath
    if (elementData.text && elementData.text.length < 50) {
      const textXPath = `//${elementData.tagName}[text()="${elementData.text}"]`;
      locators.push({
        type: 'XPath (Text)',
        value: textXPath,
        code: {
          selenium: `driver.find_element(By.XPATH, "${textXPath}")`,
          playwright: `page.locator("xpath=${textXPath}")`,
          cypress: `cy.xpath("${textXPath}")`
        }
      });

      const containsXPath = `//${elementData.tagName}[contains(text(), "${elementData.text}")]`;
      locators.push({
        type: 'XPath (Contains Text)',
        value: containsXPath,
        code: {
          selenium: `driver.find_element(By.XPATH, "${containsXPath}")`,
          playwright: `page.locator("xpath=${containsXPath}")`,
          cypress: `cy.xpath("${containsXPath}")`
        }
      });
    }

    // 通过属性的 XPath
    const attrs = elementData.attributes;
    if (attrs.type) {
      const attrXPath = `//${elementData.tagName}[@type="${attrs.type}"]`;
      locators.push({
        type: 'XPath (Type)',
        value: attrXPath,
        code: {
          selenium: `driver.find_element(By.XPATH, "${attrXPath}")`,
          playwright: `page.locator("xpath=${attrXPath}")`,
          cypress: `cy.xpath("${attrXPath}")`
        }
      });
    }

    return locators.length > 0 ? locators : null;
  }

  // 通过 TagName 生成
  generateByTagName(elementData) {
    // 只为特定标签生成
    const specificTags = ['button', 'input', 'select', 'textarea', 'a', 'img'];
    if (!specificTags.includes(elementData.tagName)) {
      return null;
    }

    return {
      type: 'Tag Name',
      value: elementData.tagName,
      code: {
        selenium: `driver.find_element(By.TAG_NAME, "${elementData.tagName}")`,
        playwright: `page.locator("${elementData.tagName}")`,
        cypress: `cy.get("${elementData.tagName}")`
      }
    };
  }

  // 通过文本内容生成
  generateByText(elementData) {
    if (!elementData.text || elementData.text.length > 100) {
      return null;
    }

    const locators = [];

    // Playwright 文本定位
    locators.push({
      type: 'Text (Playwright)',
      value: elementData.text,
      code: {
        selenium: `driver.find_element(By.XPATH, "//*[contains(text(), '${elementData.text}')]")`,
        playwright: `page.getByText("${elementData.text}")`,
        cypress: `cy.contains("${elementData.text}")`
      }
    });

    return locators;
  }

  // 通过链接文本生成（仅用于 <a> 标签）
  generateByLinkText(elementData) {
    if (elementData.tagName !== 'a' || !elementData.text) {
      return null;
    }

    return {
      type: 'Link Text',
      value: elementData.text,
      code: {
        selenium: `driver.find_element(By.LINK_TEXT, "${elementData.text}")`,
        playwright: `page.getByRole("link", { name: "${elementData.text}" })`,
        cypress: `cy.contains("a", "${elementData.text}")`
      }
    };
  }

  // 判断是否为动态生成的类名
  isDynamicClassName(className) {
    // 检查是否包含随机字符串的模式
    const dynamicPatterns = [
      /^[a-z0-9]{8,}$/i,  // 长随机字符串
      /^_[a-z0-9]+$/i,    // 下划线开头的随机串
      /^[a-z]+-[a-z0-9]{5,}$/i,  // 包含长哈希的类名
      /^css-[a-z0-9]+$/i, // CSS-in-JS 生成的类名
      /^makeStyles-/i,    // Material-UI 生成的类名
      /^jss[0-9]+$/i      // JSS 生成的类名
    ];

    return dynamicPatterns.some(pattern => pattern.test(className));
  }
}

// 导出供其他模块使用
if (typeof window !== 'undefined') {
  window.LocatorGenerator = LocatorGenerator;
}