/* eslint-disable no-constant-binary-expression */
/** @jsx createElement */
/** @jsxFrag Fragment */
import { describe, expect, it } from "vitest";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { createElement, Fragment, setup, useEffect, useState } from "../core";
import { TEXT_ELEMENT } from "../core/constants";

const flushMicrotasks = async () => await Promise.resolve();

describe("Chapter 2-2 기본과제: MiniReact", () => {
  describe("1단계: 기본 렌더링", () => {
    describe("createElement > ", () => {
      it("올바른 구조의 vNode를 생성해야 한다", () => {
        const vNode = createElement("div", { id: "test" }, "Hello");
        expect(vNode).toEqual({
          type: "div",
          key: null,
          props: {
            id: "test",
            children: [
              {
                type: TEXT_ELEMENT,
                key: null,
                props: { children: [], nodeValue: "Hello" },
              },
            ],
          },
        });
      });

      it("여러 자식을 처리해야 한다", () => {
        const vNode = createElement("div", null, "Hello", "world");
        expect(vNode.props.children).toEqual([
          {
            type: TEXT_ELEMENT,
            key: null,
            props: { children: [], nodeValue: "Hello" },
          },
          {
            type: TEXT_ELEMENT,
            key: null,
            props: { children: [], nodeValue: "world" },
          },
        ]);
      });

      it("자식 배열을 평탄화해야 한다", () => {
        const vNode = createElement("div", null, ["Hello", ["world", "!"]]);
        expect(vNode.props.children).toEqual([
          {
            type: TEXT_ELEMENT,
            key: null,
            props: { children: [], nodeValue: "Hello" },
          },
          {
            type: TEXT_ELEMENT,
            key: null,
            props: { children: [], nodeValue: "world" },
          },
          {
            type: TEXT_ELEMENT,
            key: null,
            props: { children: [], nodeValue: "!" },
          },
        ]);
      });

      it("중첩 구조를 올바르게 표현해야 한다", () => {
        const vNode = createElement(
          "div",
          null,
          createElement("span", null, "Hello"),
          createElement("b", null, "world"),
        );
        expect(vNode.type).toBe("div");
        expect(vNode.props.children?.length).toBe(2);
        expect(vNode.props.children?.[0].type).toBe("span");
        expect(vNode.props.children?.[1].type).toBe("b");
      });

      describe("JSX로 표현한 결과가 createElement 함수 호출과 동일해야 한다", () => {
        const TestComponent = ({ message }: { message: string }) => <div>{message}</div>;
        const ComplexComponent = ({
          items,
          onClick,
        }: {
          items: { id: number; text: string }[];
          onClick: () => void;
        }) => (
          <div className="container">
            {items.map((item) => (
              <span key={item.id}>{item.text}</span>
            ))}
            <button onClick={onClick}>Click me</button>
          </div>
        );

        it.each([
          {
            name: "기본적인 단일 엘리먼트",
            vNode: <div>Hello</div>,
            expected: {
              type: "div",
              key: null,
              props: {
                children: [
                  {
                    type: TEXT_ELEMENT,
                    key: null,
                    props: { children: [], nodeValue: "Hello" },
                  },
                ],
              },
            },
          },
          {
            name: "속성이 있는 엘리먼트",
            vNode: (
              <div id="test" className="container">
                Content
              </div>
            ),
            expected: {
              type: "div",
              key: null,
              props: {
                id: "test",
                className: "container",
                children: [{ type: TEXT_ELEMENT, key: null, props: { children: [], nodeValue: "Content" } }],
              },
            },
          },
          {
            name: "중첩된 엘리먼트",
            vNode: (
              <div id="parent">
                <span className="child">Child</span>
              </div>
            ),
            expected: {
              type: "div",
              key: null,
              props: {
                id: "parent",
                children: [
                  {
                    type: "span",
                    key: null,
                    props: {
                      className: "child",
                      children: [{ type: TEXT_ELEMENT, key: null, props: { children: [], nodeValue: "Child" } }],
                    },
                  },
                ],
              },
            },
          },
          {
            name: "배열 렌더링",
            vNode: (
              <ul>
                {[1, 2, 3].map((n, index) => (
                  <li key={n}>
                    Item {index}: {n}
                  </li>
                ))}
              </ul>
            ),
            expected: {
              type: "ul",
              key: null,
              props: {
                children: [
                  {
                    type: "li",
                    key: 1,
                    props: {
                      children: [
                        { type: TEXT_ELEMENT, key: null, props: { children: [], nodeValue: "Item " } },
                        { type: TEXT_ELEMENT, key: null, props: { children: [], nodeValue: "0" } },
                        { type: TEXT_ELEMENT, key: null, props: { children: [], nodeValue: ": " } },
                        { type: TEXT_ELEMENT, key: null, props: { children: [], nodeValue: "1" } },
                      ],
                    },
                  },
                  {
                    type: "li",
                    key: 2,
                    props: {
                      children: [
                        { type: TEXT_ELEMENT, key: null, props: { children: [], nodeValue: "Item " } },
                        { type: TEXT_ELEMENT, key: null, props: { children: [], nodeValue: "1" } },
                        { type: TEXT_ELEMENT, key: null, props: { children: [], nodeValue: ": " } },
                        { type: TEXT_ELEMENT, key: null, props: { children: [], nodeValue: "2" } },
                      ],
                    },
                  },
                  {
                    type: "li",
                    key: 3,
                    props: {
                      children: [
                        { type: TEXT_ELEMENT, key: null, props: { children: [], nodeValue: "Item " } },
                        { type: TEXT_ELEMENT, key: null, props: { children: [], nodeValue: "2" } },
                        { type: TEXT_ELEMENT, key: null, props: { children: [], nodeValue: ": " } },
                        { type: TEXT_ELEMENT, key: null, props: { children: [], nodeValue: "3" } },
                      ],
                    },
                  },
                ],
              },
            },
          },
          {
            name: "함수형 컴포넌트",
            vNode: <TestComponent message="Hello World" />,
            expected: {
              type: TestComponent,
              key: null,
              props: {
                message: "Hello World",
              },
            },
          },
          {
            name: "이벤트 핸들러가 있는 엘리먼트",
            vNode: <button onClick={() => {}}>Click</button>,
            expected: {
              type: "button",
              key: null,
              props: {
                onClick: expect.any(Function),
                children: [{ type: TEXT_ELEMENT, key: null, props: { children: [], nodeValue: "Click" } }],
              },
            },
          },
          {
            name: "조건부 렌더링",
            vNode: (
              <div>
                {true && <span>Shown</span>}
                {false && <span>Hidden</span>}
              </div>
            ),
            expected: {
              type: "div",
              key: null,
              props: {
                children: [
                  {
                    type: "span",
                    key: null,
                    props: {
                      children: [{ type: TEXT_ELEMENT, key: null, props: { children: [], nodeValue: "Shown" } }],
                    },
                  },
                ],
              },
            },
          },
          {
            name: "복잡한 컴포넌트 구조",
            vNode: (
              <ComplexComponent
                items={[
                  { id: 1, text: "First" },
                  { id: 2, text: "Second" },
                ]}
                onClick={() => {}}
              />
            ),
            expected: {
              type: ComplexComponent,
              key: null,
              props: {
                items: [
                  { id: 1, text: "First" },
                  { id: 2, text: "Second" },
                ],
                onClick: expect.any(Function),
              },
            },
          },
          {
            name: "null과 undefined 처리",
            vNode: (
              <div>
                {null}
                {undefined}
                <span>Valid</span>
              </div>
            ),
            expected: {
              type: "div",
              key: null,
              props: {
                children: [
                  {
                    type: "span",
                    key: null,
                    props: {
                      children: [{ type: TEXT_ELEMENT, key: null, props: { children: [], nodeValue: "Valid" } }],
                    },
                  },
                ],
              },
            },
          },
        ])("$name", ({ vNode, expected }) => {
          expect(vNode).toEqual(expected);
        });
      });
    });
    describe("setup > ", () => {
      it("렌더 타깃 컨테이너가 없으면 에러를 던진다", () => {
        expect(() => setup(<div />, null as never)).toThrowError();
      });

      it("null 루트 엘리먼트는 렌더할 수 없다", () => {
        const container = document.createElement("div");
        expect(() => setup(null, container)).toThrowError();
      });

      it("렌더는 컨테이너 내용을 새 DOM으로 교체한다", () => {
        const container = document.createElement("div");
        container.appendChild(document.createElement("span")).textContent = "old";
        // <div><span>old</span></div>
        setup(<p>new</p>, container);
        // <div><p>new</p></div>

        expect(container.childNodes).toHaveLength(1);
        expect(container.firstChild?.nodeName).toBe("P");
        expect(container.firstChild?.textContent).toBe("new");
      });

      it("네이티브 요소를 DOM으로 생성한다", () => {
        const container = document.createElement("div");
        setup(
          <div className="wrapper">
            <span>hello</span>
          </div>,
          container,
        );

        const span = container.querySelector("span");
        expect(span).not.toBeNull();
        expect(span?.textContent).toBe("hello");
        expect((span?.parentElement as HTMLElement)?.className).toBe("wrapper");
      });
    });
  });

  describe("2단계: Fragment와 자식 정규화", () => {
    it("Fragment와 다중 자식을 지원한다", () => {
      const container = document.createElement("div");

      setup(
        <>
          <p>first</p>
          <p>second</p>
        </>,
        container,
      );

      const paragraphs = container.querySelectorAll("p");
      expect(paragraphs).toHaveLength(2);
      expect([...paragraphs].map((p) => p.textContent)).toEqual(["first", "second"]);
    });

    it("props.children과 배열 자식을 정규화한다", () => {
      const container = document.createElement("div");

      setup(
        <div>
          from-props
          {["from-array"]}
          <span id="nested">node</span>
          <>
            fragment text{null}
            {true}
          </>
          {0}
          {false}
        </div>,
        container,
      );

      const div = container.firstElementChild as HTMLElement;
      expect(div).not.toBeNull();
      const childNodes = [...(div?.childNodes ?? [])];
      expect(childNodes).toHaveLength(5);
      expect(childNodes[0]?.textContent).toBe("from-props");
      expect(childNodes[1]?.textContent).toBe("from-array");
      expect(div?.querySelector("#nested")?.textContent).toBe("node");
      expect(childNodes[3]?.textContent).toBe("fragment text");
      expect(childNodes[4]?.textContent).toBe("0");
    });

    it("null과 undefined 자식들이 올바르게 처리되어야 한다", async () => {
      const container = document.createElement("div");

      function ConditionalRender({ showOptional = false }) {
        return (
          <div>
            <span>Always shown</span>
            {showOptional && <span id="optional">Optional content</span>}
            {null}
            {undefined}
            {}
            {false && <span>Hidden</span>}
            <span>Also always shown</span>
          </div>
        );
      }

      setup(<ConditionalRender />, container);
      expect(container.outerHTML).toBe("<div><div><span>Always shown</span><span>Also always shown</span></div></div>"); // null, undefined, false는 렌더링되지 않음

      setup(<ConditionalRender showOptional />, container);
      expect(container.outerHTML).toBe(
        '<div><div><span>Always shown</span><span id="optional">Optional content</span><span>Also always shown</span></div></div>',
      );
    });
  });

  describe("3단계: 속성과 스타일 처리", () => {
    it("style 객체를 DOM에 반영한다", () => {
      const container = document.createElement("div");

      setup(<div style={{ backgroundColor: "red", display: "flex" }}>styled</div>, container);

      const div = container.firstElementChild as HTMLElement;
      expect(div).not.toBeNull();
      expect(div?.style.backgroundColor).toBe("red");
      expect(div?.style.display).toBe("flex");
    });

    it("boolean 속성의 토글이 DOM에서 올바르게 처리되어야 한다", async () => {
      const container = document.createElement("div");

      function BooleanPropsTest({ disabled = false, readonly = false, checked = false }) {
        return (
          <div>
            <input id="text-input" type="text" disabled={disabled} readOnly={readonly} />
            <input id="checkbox" type="checkbox" checked={checked} />
            <button id="button" disabled={disabled}>
              Submit
            </button>
          </div>
        );
      }

      setup(<BooleanPropsTest />, container);

      let textInput = container.querySelector("#text-input") as HTMLInputElement;
      let checkbox = container.querySelector("#checkbox") as HTMLInputElement;
      let button = container.querySelector("#button") as HTMLButtonElement;

      // 초기 상태 확인
      expect(textInput.disabled).toBe(false);
      expect(textInput.readOnly).toBe(false);
      expect(checkbox.checked).toBe(false);
      expect(button.disabled).toBe(false);

      // 모든 boolean 속성을 true로 변경
      setup(<BooleanPropsTest disabled readonly checked />, container);

      textInput = container.querySelector("#text-input") as HTMLInputElement;
      checkbox = container.querySelector("#checkbox") as HTMLInputElement;
      button = container.querySelector("#button") as HTMLButtonElement;

      expect(textInput.disabled).toBe(true);
      expect(textInput.readOnly).toBe(true);
      expect(checkbox.checked).toBe(true);
      expect(button.disabled).toBe(true);
    });

    it("className 속성이 DOM에 올바르게 반영된다", async () => {
      const container = document.createElement("div");
      let setClasses: ((classes: string) => void) | undefined;

      function ClassNameTest() {
        const [classes, setClassesState] = useState("initial-class");
        setClasses = setClassesState;
        return (
          <div>
            <span id="single-class" className="static-class">
              Static class
            </span>
            <div id="dynamic-class" className={classes}>
              Dynamic class
            </div>
            <p id="multiple-classes" className="class1 class2 class3">
              Multiple classes
            </p>
          </div>
        );
      }

      setup(<ClassNameTest />, container);

      const singleClass = container.querySelector("#single-class") as HTMLElement;
      const dynamicClass = container.querySelector("#dynamic-class") as HTMLElement;
      const multipleClasses = container.querySelector("#multiple-classes") as HTMLElement;

      expect(singleClass.className).toBe("static-class");
      expect(dynamicClass.className).toBe("initial-class");
      expect(multipleClasses.className).toBe("class1 class2 class3");

      setClasses!("updated-class another-class");
      await flushMicrotasks();

      expect(dynamicClass.className).toBe("updated-class another-class");
    });

    it("data attributes가 DOM에 올바르게 설정된다", async () => {
      const container = document.createElement("div");
      let setDataValue: ((value: string) => void) | undefined;

      function DataAttributeTest() {
        const [dataValue, setData] = useState("initial");
        setDataValue = setData;
        return (
          <div>
            <div id="static-data" data-testid="static-element" data-role="button">
              Static data
            </div>
            <span id="dynamic-data" data-value={dataValue} data-count={42}>
              Dynamic data
            </span>
            <p id="boolean-data" data-visible="true" data-hidden="false">
              Boolean data
            </p>
          </div>
        );
      }

      setup(<DataAttributeTest />, container);

      const staticData = container.querySelector("#static-data") as HTMLElement;
      const dynamicData = container.querySelector("#dynamic-data") as HTMLElement;
      const booleanData = container.querySelector("#boolean-data") as HTMLElement;

      expect(staticData.getAttribute("data-testid")).toBe("static-element");
      expect(staticData.getAttribute("data-role")).toBe("button");
      expect(dynamicData.getAttribute("data-value")).toBe("initial");
      expect(dynamicData.getAttribute("data-count")).toBe("42");
      expect(booleanData.getAttribute("data-visible")).toBe("true");
      expect(booleanData.getAttribute("data-hidden")).toBe("false");

      setDataValue!("updated");
      await flushMicrotasks();

      expect(dynamicData.getAttribute("data-value")).toBe("updated");
    });

    it("이벤트 핸들러가 올바르게 등록되고 실행된다", async () => {
      const container = document.createElement("div");
      const clickEvents: string[] = [];
      let setButtonText: ((text: string) => void) | undefined;

      function EventTest() {
        const [buttonText, setText] = useState("Click me");
        setButtonText = setText;

        const handleClick = (event: Event) => {
          clickEvents.push(`clicked-${buttonText}`);
          const target = event.target as HTMLElement;
          clickEvents.push(`target-${target.id}`);
        };

        const handleMouseOver = () => {
          clickEvents.push("mouseover");
        };

        return (
          <div>
            <button id="click-button" onClick={handleClick} onMouseOver={handleMouseOver}>
              {buttonText}
            </button>
            <input
              id="input-field"
              type="text"
              onChange={(e: MouseEvent) => clickEvents.push(`input-${(e.target as HTMLInputElement).value}`)}
            />
          </div>
        );
      }

      setup(<EventTest />, container);

      const button = container.querySelector("#click-button") as HTMLButtonElement;
      const input = container.querySelector("#input-field") as HTMLInputElement;

      // 클릭 이벤트 테스트
      button.click();
      expect(clickEvents).toContain("clicked-Click me");
      expect(clickEvents).toContain("target-click-button");

      // 마우스오버 이벤트 테스트
      button.dispatchEvent(new Event("mouseover"));
      expect(clickEvents).toContain("mouseover");

      // 상태 변경 후 이벤트 핸들러 동작 확인
      clickEvents.length = 0;
      setButtonText!("Updated");
      await flushMicrotasks();

      button.click();
      expect(clickEvents).toContain("clicked-Updated");

      // input change 이벤트 테스트
      clickEvents.length = 0;
      input.value = "test input";
      input.dispatchEvent(new Event("change"));
      expect(clickEvents).toContain("input-test input");
    });

    it("일반 HTML 속성들이 DOM에 올바르게 설정된다", async () => {
      const container = document.createElement("div");
      let setFormData: ((data: { placeholder: string; value: string; maxLength: number }) => void) | undefined;

      function AttributeTest() {
        const [formData, setData] = useState({
          placeholder: "Enter text",
          value: "",
          maxLength: 100,
        });
        setFormData = setData;

        return (
          <div>
            <input
              id="text-input"
              type="text"
              placeholder={formData.placeholder}
              value={formData.value}
              maxLength={formData.maxLength}
              required
            />
            <img id="image" src="/test.jpg" alt="Test image" width={200} height={150} />
            <a id="link" href="https://example.com" target="_blank" rel="noopener">
              Link
            </a>
          </div>
        );
      }

      setup(<AttributeTest />, container);

      const input = container.querySelector("#text-input") as HTMLInputElement;
      const img = container.querySelector("#image") as HTMLImageElement;
      const link = container.querySelector("#link") as HTMLAnchorElement;

      expect(input.placeholder).toBe("Enter text");
      expect(input.value).toBe("");
      expect(input.maxLength).toBe(100);
      expect(input.required).toBe(true);
      expect(img.src).toBe("http://localhost:3000/test.jpg"); // jsdom adds localhost
      expect(img.alt).toBe("Test image");
      expect(img.width).toBe(200);
      expect(img.height).toBe(150);
      expect(link.href).toBe("https://example.com/");
      expect(link.target).toBe("_blank");
      expect(link.rel).toBe("noopener");

      setFormData!({
        placeholder: "Updated placeholder",
        value: "new value",
        maxLength: 50,
      });
      await flushMicrotasks();

      expect(input.placeholder).toBe("Updated placeholder");
      expect(input.value).toBe("new value");
      expect(input.maxLength).toBe(50);
    });
  });

  describe("4단계: useState 기본 구현", () => {
    it("컴포넌트 외부에서 useState를 호출하면 에러가 발생한다", () => {
      expect(() => useState(0)).toThrowError();
    });

    it("useState 함수 이니셜라이저는 최초 한 번만 실행된다", async () => {
      const container = document.createElement("div");
      let setValue: ((value: number) => void) | undefined;
      let initializerCalls = 0;

      function Sample() {
        const [value, update] = useState(() => {
          initializerCalls += 1;
          return 1;
        });
        setValue = update;
        return <div>{value}</div>;
      }

      setup(<Sample />, container);

      let div = container.firstElementChild as HTMLElement;
      expect(initializerCalls).toBe(1);
      expect(div?.textContent).toBe("1");

      setValue!(5);
      await flushMicrotasks();

      div = container.firstElementChild as HTMLElement;
      expect(initializerCalls).toBe(1);
      expect(div?.textContent).toBe("5");
    });

    it("상태가 변경되면 다시 렌더링한다", async () => {
      const container = document.createElement("div");
      let setCount: ((updater: (value: number) => number) => void) | undefined;

      function Counter() {
        const [count, update] = useState(0);
        setCount = update;
        return <button onClick={() => update((value) => value + 1)}>{count}</button>;
      }

      setup(<Counter />, container);

      let button = container.querySelector("button") as HTMLButtonElement;
      expect(button).not.toBeNull();
      expect(button?.textContent).toBe("0");

      setCount!((value) => value + 1);
      await flushMicrotasks();
      button = container.querySelector("button") as HTMLButtonElement;
      expect(button?.textContent).toBe("1");

      button?.click();
      await flushMicrotasks();
      button = container.querySelector("button") as HTMLButtonElement;
      expect(button?.textContent).toBe("2");
    });

    it("동일한 값으로 상태를 설정하면 재렌더를 건너뛴다", async () => {
      const container = document.createElement("div");
      let setValue: ((value: number) => void) | undefined;
      let renderCount = 0;

      function Sample() {
        renderCount += 1;
        const [value, update] = useState(0);
        setValue = update;
        return <div>{value}</div>;
      }

      setup(<Sample />, container);
      expect(renderCount).toBe(1);

      setValue!(0);
      await flushMicrotasks();

      expect(renderCount).toBe(1);
      const div = container.firstElementChild as HTMLElement;
      expect(div?.textContent).toBe("0");
    });

    it("중첩된 컴포넌트에서 useState가 각각 독립적으로 동작한다", async () => {
      const container = document.createElement("div");
      let setItemCount: ((count: number) => void) | undefined;
      let incrementFooter: (() => void) | undefined;
      const itemIncrements: (() => void)[] = [];

      const Item = ({ id }: { id: number }) => {
        const [count, setCount] = useState(0);
        const increment = () => setCount((prev) => prev + 1);

        // 외부에서 접근할 수 있도록 등록
        if (itemIncrements[id] !== increment) {
          itemIncrements[id] = increment;
        }

        return (
          <div data-testid={`item-${id}`} data-count={count}>
            Item {id}: {count}
          </div>
        );
      };

      const Footer = () => {
        const [footerCount, setFooterCount] = useState(100);
        incrementFooter = () => setFooterCount((prev) => prev + 1);
        return <footer data-testid="footer">Footer: {footerCount}</footer>;
      };

      const Root = () => {
        const [itemCount, setCount] = useState(3);
        setItemCount = setCount;

        return (
          <div>
            <h1>Dynamic List</h1>
            {Array.from({ length: itemCount }, (_, i) => (
              <Item id={i} />
            ))}
            <Footer />
          </div>
        );
      };

      setup(<Root />, container);

      // 초기 상태 확인
      expect(container.querySelectorAll('[data-testid^="item-"]')).toHaveLength(3);
      expect(container.querySelector('[data-testid="item-0"]')?.getAttribute("data-count")).toBe("0");
      expect(container.querySelector('[data-testid="item-1"]')?.getAttribute("data-count")).toBe("0");
      expect(container.querySelector('[data-testid="item-2"]')?.getAttribute("data-count")).toBe("0");
      expect(container.querySelector('[data-testid="footer"]')?.textContent).toBe("Footer: 100");

      // 각 Item의 상태를 개별적으로 증가
      itemIncrements[0]?.();
      await flushMicrotasks();
      expect(container.querySelector('[data-testid="item-0"]')?.getAttribute("data-count")).toBe("1");
      expect(container.querySelector('[data-testid="item-1"]')?.getAttribute("data-count")).toBe("0");

      itemIncrements[1]?.();
      itemIncrements[1]?.();
      await flushMicrotasks();
      expect(container.querySelector('[data-testid="item-0"]')?.getAttribute("data-count")).toBe("1");
      expect(container.querySelector('[data-testid="item-1"]')?.getAttribute("data-count")).toBe("2");
      expect(container.querySelector('[data-testid="item-2"]')?.getAttribute("data-count")).toBe("0");

      // Footer 상태 증가
      incrementFooter!();
      await flushMicrotasks();
      expect(container.querySelector('[data-testid="footer"]')?.textContent).toBe("Footer: 101");

      // Item 상태는 영향받지 않아야 함
      expect(container.querySelector('[data-testid="item-0"]')?.getAttribute("data-count")).toBe("1");
      expect(container.querySelector('[data-testid="item-1"]')?.getAttribute("data-count")).toBe("2");

      // Item 개수를 줄임 (기존 상태는 유지되어야 함)
      setItemCount!(2);
      await flushMicrotasks();
      expect(container.querySelectorAll('[data-testid^="item-"]')).toHaveLength(2);
      expect(container.querySelector('[data-testid="item-0"]')?.getAttribute("data-count")).toBe("1");
      expect(container.querySelector('[data-testid="item-1"]')?.getAttribute("data-count")).toBe("2");
      expect(container.querySelector('[data-testid="item-2"]')).toBeNull();

      // Footer 상태는 여전히 유지되어야 함
      expect(container.querySelector('[data-testid="footer"]')?.textContent).toBe("Footer: 101");

      // Item 개수를 다시 늘림 (새 Item은 초기 상태여야 함)
      setItemCount!(4);
      await flushMicrotasks();
      expect(container.querySelectorAll('[data-testid^="item-"]')).toHaveLength(4);
      expect(container.querySelector('[data-testid="item-0"]')?.getAttribute("data-count")).toBe("1");
      expect(container.querySelector('[data-testid="item-1"]')?.getAttribute("data-count")).toBe("2");
      expect(container.querySelector('[data-testid="item-2"]')?.getAttribute("data-count")).toBe("0"); // 새로 생성된 Item
      expect(container.querySelector('[data-testid="item-3"]')?.getAttribute("data-count")).toBe("0"); // 새로 생성된 Item

      // Footer 상태는 여전히 유지되어야 함
      expect(container.querySelector('[data-testid="footer"]')?.textContent).toBe("Footer: 101");
    });

    it("중간 아이템 삭제 시 상태가 올바르게 보존된다", async () => {
      const container = document.createElement("div");
      let setCartItems: ((items: Array<{ id: number; name: string }>) => void) | undefined;
      const itemStates = new Map<number, { getValue: () => number; increment: () => void }>();

      // CartItem과 유사한 컴포넌트
      const CartItem = ({ id, name }: { id: number; name: string; key?: number }) => {
        const [quantity, setQuantity] = useState(1);
        const increment = () => setQuantity((prev) => prev + 1);

        // 외부에서 접근할 수 있도록 상태 등록
        itemStates.set(id, { getValue: () => quantity, increment });

        return (
          <div data-testid={`cart-item-${id}`} data-quantity={quantity}>
            {name}: {quantity}개
          </div>
        );
      };

      // CartModal과 유사한 컴포넌트
      const CartModal = () => {
        const [items, setItems] = useState([
          { id: 10, name: "상품A" },
          { id: 20, name: "상품B" },
          { id: 30, name: "상품C" },
        ]);
        setCartItems = setItems;

        return (
          <div>
            <h2>장바구니</h2>
            {items.map((item) => (
              <CartItem key={item.id} id={item.id} name={item.name} />
            ))}
          </div>
        );
      };

      setup(<CartModal />, container);

      // 초기 상태 확인
      expect(container.querySelectorAll('[data-testid^="cart-item-"]')).toHaveLength(3);
      expect(container.querySelector('[data-testid="cart-item-10"]')?.getAttribute("data-quantity")).toBe("1");
      expect(container.querySelector('[data-testid="cart-item-20"]')?.getAttribute("data-quantity")).toBe("1");
      expect(container.querySelector('[data-testid="cart-item-30"]')?.getAttribute("data-quantity")).toBe("1");

      // 각 아이템의 수량을 개별적으로 증가
      itemStates.get(10)?.increment();
      await flushMicrotasks();
      expect(container.querySelector('[data-testid="cart-item-10"]')?.getAttribute("data-quantity")).toBe("2");

      itemStates.get(20)?.increment();
      itemStates.get(20)?.increment();
      itemStates.get(20)?.increment();
      await flushMicrotasks();
      expect(container.querySelector('[data-testid="cart-item-20"]')?.getAttribute("data-quantity")).toBe("4");

      itemStates.get(30)?.increment();
      itemStates.get(30)?.increment();
      await flushMicrotasks();
      expect(container.querySelector('[data-testid="cart-item-30"]')?.getAttribute("data-quantity")).toBe("3");

      // 현재 상태: 상품A(2개), 상품B(4개), 상품C(3개)

      // 첫 번째 아이템(상품A) 삭제 - 이때 상품B와 상품C의 상태가 유지되어야 함
      setCartItems!([
        { id: 20, name: "상품B" },
        { id: 30, name: "상품C" },
      ]);
      await flushMicrotasks();

      expect(container.querySelectorAll('[data-testid^="cart-item-"]')).toHaveLength(2);
      expect(container.querySelector('[data-testid="cart-item-10"]')).toBeNull();
      expect(container.querySelector('[data-testid="cart-item-20"]')?.getAttribute("data-quantity")).toBe("4"); // 유지되어야 함
      expect(container.querySelector('[data-testid="cart-item-30"]')?.getAttribute("data-quantity")).toBe("3"); // 유지되어야 함

      // 중간 아이템(상품B) 삭제 - 상품C의 상태가 유지되어야 함
      setCartItems!([{ id: 30, name: "상품C" }]);
      await flushMicrotasks();

      expect(container.querySelectorAll('[data-testid^="cart-item-"]')).toHaveLength(1);
      expect(container.querySelector('[data-testid="cart-item-20"]')).toBeNull();
      expect(container.querySelector('[data-testid="cart-item-30"]')?.getAttribute("data-quantity")).toBe("3"); // 유지되어야 함

      // 새 아이템 추가 - 기존 아이템 상태는 유지, 새 아이템은 초기값
      setCartItems!([
        { id: 30, name: "상품C" },
        { id: 40, name: "상품D" },
      ]);
      await flushMicrotasks();

      expect(container.querySelectorAll('[data-testid^="cart-item-"]')).toHaveLength(2);
      expect(container.querySelector('[data-testid="cart-item-30"]')?.getAttribute("data-quantity")).toBe("3"); // 기존 상태 유지
      expect(container.querySelector('[data-testid="cart-item-40"]')?.getAttribute("data-quantity")).toBe("1"); // 새 아이템 초기값
    });

    it("key가 없을 때 중간 아이템 삭제 시 타입 기반으로 상태가 보존된다", async () => {
      const container = document.createElement("div");
      let setCartItems: ((items: Array<{ id: number; name: string }>) => void) | undefined;
      const itemStates = new Map<number, { getValue: () => number; increment: () => void }>();

      // key가 없는 CartItem 컴포넌트
      const CartItem = ({ id, name }: { id: number; name: string }) => {
        const [quantity, setQuantity] = useState(1);
        const increment = () => setQuantity((prev) => prev + 1);

        // 외부에서 접근할 수 있도록 상태 등록
        itemStates.set(id, { getValue: () => quantity, increment });

        return (
          <div data-testid={`cart-item-${id}`} data-quantity={quantity}>
            {name}: {quantity}개
          </div>
        );
      };

      // key 없이 렌더링하는 CartModal
      const CartModal = () => {
        const [items, setItems] = useState([
          { id: 10, name: "상품A" },
          { id: 20, name: "상품B" },
          { id: 30, name: "상품C" },
        ]);
        setCartItems = setItems;

        return (
          <div>
            <h2>장바구니</h2>
            {items.map((item) => (
              // key 없이 렌더링 - 타입별 카운터 기반 path 사용
              <CartItem id={item.id} name={item.name} />
            ))}
          </div>
        );
      };

      setup(<CartModal />, container);

      // 초기 상태 확인
      expect(container.querySelectorAll('[data-testid^="cart-item-"]')).toHaveLength(3);
      expect(container.querySelector('[data-testid="cart-item-10"]')?.getAttribute("data-quantity")).toBe("1");
      expect(container.querySelector('[data-testid="cart-item-20"]')?.getAttribute("data-quantity")).toBe("1");
      expect(container.querySelector('[data-testid="cart-item-30"]')?.getAttribute("data-quantity")).toBe("1");

      // 각 아이템의 수량을 개별적으로 증가
      itemStates.get(10)?.increment();
      await flushMicrotasks();
      expect(container.querySelector('[data-testid="cart-item-10"]')?.getAttribute("data-quantity")).toBe("2");

      itemStates.get(20)?.increment();
      itemStates.get(20)?.increment();
      itemStates.get(20)?.increment();
      await flushMicrotasks();
      expect(container.querySelector('[data-testid="cart-item-20"]')?.getAttribute("data-quantity")).toBe("4");

      itemStates.get(30)?.increment();
      itemStates.get(30)?.increment();
      await flushMicrotasks();
      expect(container.querySelector('[data-testid="cart-item-30"]')?.getAttribute("data-quantity")).toBe("3");

      // 현재 상태: 상품A(2개), 상품B(4개), 상품C(3개)
      // path: 0.i0.cCartItem_0, 0.i0.cCartItem_1, 0.i0.cCartItem_2

      // 첫 번째 아이템(상품A) 삭제 - key가 없으므로 타입 기반 path 사용
      // 기존: [상품A(path:0), 상품B(path:1), 상품C(path:2)]
      // 변경: [상품B(path:0), 상품C(path:1)]
      // 결과: 상품B가 상품A의 상태(2개)를 가져옴, 상품C가 상품B의 상태(4개)를 가져옴
      setCartItems!([
        { id: 20, name: "상품B" },
        { id: 30, name: "상품C" },
      ]);
      await flushMicrotasks();

      expect(container.querySelectorAll('[data-testid^="cart-item-"]')).toHaveLength(2);
      expect(container.querySelector('[data-testid="cart-item-10"]')).toBeNull();

      // key가 없으므로 path가 index 기반으로 변경됨
      // 상품B가 첫 번째 CartItem path(cCartItem_0)를 사용 → 상품A의 상태(2개) 가져옴
      expect(container.querySelector('[data-testid="cart-item-20"]')?.getAttribute("data-quantity")).toBe("2"); // 상품A의 상태
      // 상품C가 두 번째 CartItem path(cCartItem_1)를 사용 → 상품B의 상태(4개) 가져옴
      expect(container.querySelector('[data-testid="cart-item-30"]')?.getAttribute("data-quantity")).toBe("4"); // 상품B의 상태

      // 이것이 key 없이 발생하는 문제: 상태가 잘못된 컴포넌트에 매핑됨
    });
  });

  describe("5단계: useEffect 기본 구현", () => {
    it("useEffect는 렌더 이후 비동기로 실행된다", async () => {
      const container = document.createElement("div");
      const callOrder: string[] = [];

      function Sample() {
        callOrder.push("render");
        useEffect(() => {
          callOrder.push("effect");
        });
        return <div>effect</div>;
      }

      setup(<Sample />, container);

      expect(callOrder).toEqual(["render"]);

      await flushMicrotasks();
      expect(callOrder).toEqual(["render", "effect"]);
    });

    it("useEffect는 의존성이 변경될 때만 실행된다", async () => {
      const container = document.createElement("div");
      const runs: number[] = [];
      let setValue: ((value: number) => void) | undefined;

      function Sample() {
        const [value, update] = useState(0);
        setValue = update;
        useEffect(() => {
          runs.push(value);
        }, [value]);
        return <div>{value}</div>;
      }

      setup(<Sample />, container);
      await flushMicrotasks();
      expect(runs).toEqual([0]);

      setValue!(1);
      await flushMicrotasks();
      expect(runs).toEqual([0, 1]);

      setValue!(1);
      await flushMicrotasks();
      expect(runs).toEqual([0, 1]);

      setValue!(2);
      await flushMicrotasks();
      expect(runs).toEqual([0, 1, 2]);
    });

    it("useEffect 클린업은 재실행과 언마운트 시 호출된다", async () => {
      const container = document.createElement("div");
      let cleanupCount = 0;
      let effectRuns = 0;
      let updateValue: ((value: string) => void) | undefined;
      let toggle: (() => void) | undefined;

      function Child({ value }: { value: string }) {
        useEffect(() => {
          effectRuns += 1;
          return () => {
            cleanupCount += 1;
          };
        }, [value]);
        return <span>{value}</span>;
      }

      function Wrapper() {
        const [value, setValue] = useState("first");
        const [visible, setVisible] = useState(true);
        updateValue = setValue;
        toggle = () => setVisible((prev) => !prev);
        return <div>{visible ? <Child value={value} /> : null}</div>;
      }

      setup(<Wrapper />, container);
      await flushMicrotasks();
      expect(effectRuns).toBe(1);
      expect(cleanupCount).toBe(0);

      updateValue!("second");
      await flushMicrotasks();
      expect(effectRuns).toBe(2);
      expect(cleanupCount).toBe(1);

      toggle!();
      await flushMicrotasks();
      expect(cleanupCount).toBe(2);

      toggle!();
      await flushMicrotasks();
      expect(effectRuns).toBe(3);
      expect(cleanupCount).toBe(2);
    });
  });

  describe("6단계: DOM 재사용과 reconciliation", () => {
    it("동일 컨테이너에서 상태 업데이트로도 DOM을 유지한다", async () => {
      const container = document.createElement("div");
      let setCount: ((updater: (value: number) => number) => void) | undefined;
      let renderCount = 0;

      function Counter() {
        renderCount += 1;
        const [count, update] = useState(0);
        setCount = update;
        return (
          <div id="wrapper">
            <span id="value">{count}</span>
            <button type="button">increment</button>
          </div>
        );
      }

      setup(<Counter />, container);

      const wrapper = container.firstElementChild as HTMLElement;
      const valueSpan = wrapper?.querySelector("#value") ?? null;
      const button = wrapper?.querySelector("button") ?? null;
      expect(wrapper).not.toBeNull();
      expect(valueSpan).not.toBeNull();
      expect(button).not.toBeNull();
      expect(valueSpan?.textContent).toBe("0");

      setCount!((value) => value + 1);
      await flushMicrotasks();

      expect(renderCount).toBe(2);
      expect(container.firstElementChild).toBe(wrapper);
      expect(wrapper?.querySelector("#value")).toBe(valueSpan);
      expect(wrapper?.querySelector("button")).toBe(button);
      expect(valueSpan?.textContent).toBe("1");
    });

    it("속성만 변경될 때 같은 DOM 요소를 재사용해야 한다", async () => {
      const container = document.createElement("div");
      let setClassName: ((className: string) => void) | undefined;

      function AttributeTest() {
        const [className, setClass] = useState("initial");
        setClassName = setClass;
        return (
          <div id="test" className={className}>
            Content
          </div>
        );
      }

      setup(<AttributeTest />, container);

      const originalElement = container.querySelector("#test");
      expect(originalElement?.className).toBe("initial");

      setClassName!("updated");
      await flushMicrotasks();

      const updatedElement = container.querySelector("#test");
      expect(updatedElement?.className).toBe("updated");
      expect(updatedElement).toBe(originalElement); // 같은 요소 재사용
    });

    it("다른 타입의 요소로 교체 시 새로운 DOM 요소를 생성해야 한다", async () => {
      const container = document.createElement("div");
      let setElementType: ((type: "div" | "span") => void) | undefined;

      function DynamicElement() {
        const [elementType, setType] = useState<"div" | "span">("div");
        setElementType = setType;
        return elementType === "div" ? <div id="element">Content</div> : <span id="element">Content</span>;
      }

      setup(<DynamicElement />, container);

      const originalElement = container.querySelector("#element");
      expect(originalElement?.tagName).toBe("DIV");

      setElementType!("span");
      await flushMicrotasks();

      const newElement = container.querySelector("#element");
      expect(newElement?.tagName).toBe("SPAN");
      expect(newElement).not.toBe(originalElement); // 다른 요소 참조여야 함
    });

    it("중간에 새 자식을 삽입해도 기존 DOM을 유지한다", async () => {
      const container = document.createElement("div");
      let setVisible: ((visible: boolean) => void) | undefined;

      function Items() {
        return (
          <ul id="list">
            <li id="first">first</li>
            <li id="second">second</li>
          </ul>
        );
      }

      function Dynamic({ visible }: { visible: boolean }) {
        return <>{visible && <p id="dynamic">dynamic</p>}</>;
      }

      function Sample() {
        const [visible, update] = useState(false);
        setVisible = update;
        return (
          <div>
            <span id="static">static</span>
            <Dynamic visible={visible} />
            <Items />
          </div>
        );
      }

      setup(<Sample />, container);

      const wrapper = container.firstElementChild as HTMLElement;
      const list = wrapper?.querySelector("#list") ?? null;
      const first = wrapper?.querySelector("#first") ?? null;
      const second = wrapper?.querySelector("#second") ?? null;

      expect(wrapper).not.toBeNull();
      expect(list).not.toBeNull();
      expect(first).not.toBeNull();
      expect(second).not.toBeNull();

      setVisible!(true);
      await flushMicrotasks();

      expect(container.firstElementChild).toBe(wrapper);
      expect(wrapper?.querySelector("#list")).toBe(list);
      expect(wrapper?.querySelector("#first")).toBe(first);
      expect(wrapper?.querySelector("#second")).toBe(second);
      expect(wrapper?.querySelector("#dynamic")?.outerHTML).toEqual(`<p id="dynamic">dynamic</p>`);
    });
  });

  describe("7단계: 자식 노드 동적 처리", () => {
    it("자식 노드 개수가 줄어들 때 초과하는 자식들이 제거되어야 한다", async () => {
      const container = document.createElement("div");
      let setItemCount: ((count: number) => void) | undefined;

      function DynamicList() {
        const [itemCount, setCount] = useState(5);
        setItemCount = setCount;
        return (
          <ul>
            {Array.from({ length: itemCount }, (_, i) => (
              <li key={i}>Item {i + 1}</li>
            ))}
          </ul>
        );
      }

      setup(<DynamicList />, container);

      const list = container.querySelector("ul");
      expect(list?.children.length).toBe(5);

      setItemCount!(2);
      await flushMicrotasks();

      expect(list?.children.length).toBe(2);
      expect(list?.children[0]?.textContent).toBe("Item 1");
      expect(list?.children[1]?.textContent).toBe("Item 2");
    });

    it("자식 노드가 모두 제거될 때 빈 컨테이너가 되어야 한다", async () => {
      const container = document.createElement("div");
      let setHasChildren: ((hasChildren: boolean) => void) | undefined;

      function EmptyTest() {
        const [hasChildren, setChildren] = useState(true);
        setHasChildren = setChildren;
        return (
          <div>
            {hasChildren && (
              <>
                <span>Child 1</span>
                <span>Child 2</span>
                <span>Child 3</span>
              </>
            )}
          </div>
        );
      }

      setup(<EmptyTest />, container);

      const wrapper = container.firstElementChild;
      expect(wrapper?.children.length).toBe(3);

      setHasChildren!(false);
      await flushMicrotasks();

      expect(wrapper?.children.length).toBe(0);
    });

    it("Fragment를 사용한 동적 렌더링에서 올바른 DOM 구조를 유지해야 한다", async () => {
      const container = document.createElement("div");
      let setMode: ((mode: "single" | "multiple" | "empty") => void) | undefined;

      function FragmentTest() {
        const [mode, setTestMode] = useState<"single" | "multiple" | "empty">("single");
        setMode = setTestMode;

        const renderContent = () => {
          switch (mode) {
            case "single":
              return <span id="single">Single element</span>;
            case "multiple":
              return (
                <>
                  <span id="first">First</span>
                  <span id="second">Second</span>
                  <span id="third">Third</span>
                </>
              );
            case "empty":
              return <></>;
          }
        };

        return (
          <div>
            <p>Before content</p>
            {renderContent()}
            <p>After content</p>
          </div>
        );
      }

      setup(<FragmentTest />, container);

      const wrapper = container.firstElementChild;
      expect(wrapper?.children.length).toBe(3); // p + span + p
      expect(container.querySelector("#single")).toBeTruthy();

      setMode!("multiple");
      await flushMicrotasks();

      expect(wrapper?.children.length).toBe(5); // p + span + span + span + p
      expect(container.querySelector("#first")).toBeTruthy();
      expect(container.querySelector("#second")).toBeTruthy();
      expect(container.querySelector("#third")).toBeTruthy();

      setMode!("empty");
      await flushMicrotasks();

      expect(wrapper?.children.length).toBe(2); // p + p
      expect(container.querySelector("#first")).toBeNull();

      setMode!("single");
      await flushMicrotasks();

      expect(wrapper?.children.length).toBe(3); // p + span + p
      expect(container.querySelector("#single")).toBeTruthy();
    });
  });

  describe("8단계: key 기반 처리", () => {
    it("key가 있는 자식을 재배치할 때 기존 DOM을 재사용한다", async () => {
      const container = document.createElement("div");
      let reorder: (() => void) | undefined;

      interface Item {
        id: string;
        label: string;
      }

      function List() {
        const [items, setItems] = useState<Item[]>([
          { id: "a", label: "A" },
          { id: "b", label: "B" },
          { id: "c", label: "C" },
        ]);
        reorder = () => setItems(([first, ...rest]) => [...rest, first]);
        return (
          <ul id="keyed-list">
            {items.map((item) => (
              <li key={item.id} data-id={item.id}>
                {item.label}
              </li>
            ))}
          </ul>
        );
      }

      setup(<List />, container);

      const list = container.querySelector("#keyed-list") as HTMLElement;
      const initialOrder = [...list.children];

      reorder!();
      await flushMicrotasks();

      expect([...list.children]).toEqual([initialOrder[1], initialOrder[2], initialOrder[0]]);
    });

    it("key가 변경되면 이전 인스턴스를 언마운트하고 새로 마운트한다", async () => {
      const container = document.createElement("div");
      let swap: (() => void) | undefined;
      let cleanupRuns = 0;

      function Child() {
        useEffect(
          () => () => {
            cleanupRuns += 1;
          },
          [],
        );
        return <span id="child">child</span>;
      }

      function Wrapper() {
        const [key, setKey] = useState("first");
        swap = () => setKey((current) => (current === "first" ? "second" : "first"));
        return (
          <div>
            <Child key={key} />
          </div>
        );
      }

      setup(<Wrapper />, container);
      expect(container.querySelectorAll("#child")).toHaveLength(1);

      await flushMicrotasks();
      expect(cleanupRuns).toBe(0);

      swap!();
      await flushMicrotasks();

      expect(container.querySelectorAll("#child")).toHaveLength(1);
      expect(cleanupRuns).toBe(1);
    });
  });

  describe("9단계: 언마운트와 정리", () => {
    it("언마운트된 컴포넌트의 훅 상태를 정리한다", async () => {
      const container = document.createElement("div");
      let toggle: (() => void) | undefined;
      let childInitializations = 0;

      function Child() {
        const [value] = useState(() => {
          childInitializations += 1;
          return "ready";
        });
        return <span>{value}</span>;
      }

      function Parent() {
        const [visible, setVisible] = useState(true);
        toggle = () => setVisible((prev) => !prev);
        return <div>{visible ? <Child /> : null}</div>;
      }

      setup(<Parent />, container);
      expect(childInitializations).toBe(1);

      toggle!();
      await flushMicrotasks();

      toggle!();
      await flushMicrotasks();

      expect(childInitializations).toBe(2);
      expect(container.querySelectorAll("span")).toHaveLength(1);
    });
  });

  describe("10단계: 복잡한 엣지케이스", () => {
    it("복잡한 중첩 구조에서 부분적 업데이트가 올바르게 작동해야 한다", async () => {
      const container = document.createElement("div");
      let setNestedData: ((data: { title: string; items: string[] }) => void) | undefined;

      function NestedStructure() {
        const [data, setData] = useState({
          title: "Original Title",
          items: ["Item 1", "Item 2", "Item 3"],
        });
        setNestedData = setData;

        return (
          <div>
            <header>
              <h1 id="title">{data.title}</h1>
            </header>
            <main>
              <ul id="items">
                {data.items.map((item, index) => (
                  <li key={index} id={`item-${index}`}>
                    {item}
                  </li>
                ))}
              </ul>
            </main>
          </div>
        );
      }

      setup(<NestedStructure />, container);

      const title = container.querySelector("#title");
      const items = container.querySelector("#items");
      const originalFirstItem = container.querySelector("#item-0");

      expect(title?.textContent).toBe("Original Title");
      expect(items?.children.length).toBe(3);

      // 타이틀만 변경
      setNestedData!({
        title: "Updated Title",
        items: ["Item 1", "Item 2", "Item 3"],
      });
      await flushMicrotasks();

      expect(container.querySelector("#title")).toBe(title); // 같은 요소
      expect(container.querySelector("#items")).toBe(items); // 같은 요소
      expect(container.querySelector("#item-0")).toBe(originalFirstItem); // 같은 요소
      expect(title?.textContent).toBe("Updated Title");

      // 아이템 개수 변경
      setNestedData!({
        title: "Updated Title",
        items: ["New Item 1"],
      });
      await flushMicrotasks();

      expect(items?.children.length).toBe(1);
      expect(items?.children[0]?.textContent).toBe("New Item 1");
    });

    it("깊은 중첩에서 역순 제거가 올바르게 작동해야 한다", async () => {
      const container = document.createElement("div");
      let setStructure: ((structure: "full" | "minimal") => void) | undefined;

      function DeepNested() {
        const [structure, setStruct] = useState<"full" | "minimal">("full");
        setStructure = setStruct;

        return structure === "full" ? (
          <div>
            <section>
              <article>
                <header id="header-1">Header 1</header>
                <header id="header-2">Header 2</header>
                <header id="header-3">Header 3</header>
              </article>
            </section>
            <section>
              <article>
                <header id="header-4">Header 4</header>
              </article>
            </section>
          </div>
        ) : (
          <div>
            <section>
              <article>
                <header id="header-1">Header 1 Updated</header>
              </article>
            </section>
          </div>
        );
      }

      setup(<DeepNested />, container);

      expect(container.querySelectorAll("section").length).toBe(2);
      expect(container.querySelectorAll("header").length).toBe(4);

      setStructure!("minimal");
      await flushMicrotasks();

      expect(container.querySelectorAll("section").length).toBe(1);
      expect(container.querySelectorAll("header").length).toBe(1);
      expect(container.querySelector("#header-1")?.textContent).toBe("Header 1 Updated");
    });

    it("동시 실행 시나리오", async () => {
      const container = document.createElement("div");
      const effectRuns: string[] = [];
      let triggerMultiple: (() => void) | undefined;

      function Sample() {
        const [trigger, setTrigger] = useState(0);
        triggerMultiple = () => {
          // 빠른 연속 호출 - withSchedule이 중복 실행을 막을 수 있음
          setTrigger(1);
          setTrigger(2);
          setTrigger(3);
        };

        useEffect(() => {
          effectRuns.push(`effect-${trigger}`);
        }, [trigger]);

        return <div>{trigger}</div>;
      }

      setup(<Sample />, container);
      await flushMicrotasks();
      expect(effectRuns).toEqual(["effect-0"]);

      effectRuns.length = 0;
      triggerMultiple!();
      await flushMicrotasks();

      // 마지막 상태 변경만 반영되어야 하지만, effect는 모든 변경을 감지해야 함
      const div = container.firstElementChild as HTMLElement;
      expect(div?.textContent).toBe("3");
      expect(effectRuns.length).toBe(1); // 실제로는 3번이 아닌 1번만 실행될 수 있음
    });

    it("동일 참조 객체 deps 비교에서 예상과 다른 동작", async () => {
      const container = document.createElement("div");
      const effectRuns: number[] = [];
      let updateRef: ((obj: { id: number }) => void) | undefined;

      function Sample() {
        const [obj, setObj] = useState({ id: 1 });
        updateRef = setObj;

        useEffect(() => {
          effectRuns.push(obj.id);
        }, [obj]);

        return <div>{obj.id}</div>;
      }

      setup(<Sample />, container);
      await flushMicrotasks();
      expect(effectRuns).toEqual([1]);

      // 같은 참조 객체 업데이트 - effect가 실행되지 않아야 함
      const currentObj = { id: 1 };
      updateRef!(currentObj);
      await flushMicrotasks();

      updateRef!(currentObj); // 동일 참조
      await flushMicrotasks();

      expect(effectRuns.length).toBeGreaterThan(1); // shallowEquals 문제로 재실행됨
    });

    it("useRef 없이 hook 상태 참조 문제 시뮬레이션", async () => {
      const container = document.createElement("div");
      let capturedState: number;

      function Sample() {
        const [count, setCount] = useState(0);

        useEffect(() => {
          // context.hooks.currentHooks 참조가 변경될 수 있는 문제
          capturedState = count;
        });

        return <button onClick={() => setCount((c) => c + 1)}>{count}</button>;
      }

      setup(<Sample />, container);
      await flushMicrotasks();

      const button = container.querySelector("button") as HTMLButtonElement;
      button.click();
      await flushMicrotasks();

      // 상태가 제대로 캡처되었는지 확인
      expect(capturedState!).toBe(1);
    });

    it("effect cleanup 실행 시점 검증", async () => {
      const container = document.createElement("div");
      const cleanupOrder: string[] = [];
      let toggle: (() => void) | undefined;

      function Child() {
        useEffect(() => {
          cleanupOrder.push("effect-start");
          return () => {
            cleanupOrder.push("cleanup");
          };
        }, []);
        return <span>child</span>;
      }

      function Parent() {
        const [visible, setVisible] = useState(true);
        toggle = () => setVisible(false);
        return <div>{visible ? <Child /> : null}</div>;
      }

      setup(<Parent />, container);

      await flushMicrotasks();
      expect(cleanupOrder).toEqual(["effect-start"]);

      cleanupOrder.length = 0;
      toggle!();

      await flushMicrotasks();
      expect(cleanupOrder).toEqual(["cleanup"]);
    });
  });
});
