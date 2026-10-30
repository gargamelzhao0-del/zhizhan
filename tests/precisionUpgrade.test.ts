import { describe, expect, it } from "vitest";
import fs from "node:fs";
import { CHAPTER_DEMOS, demos } from "../src/LearningDemo";
import { textbookCatalog } from "../src/Textbooks";
import { extractPipelineSteps } from "../src/TextbookFigure";
import {
  formatCodeMeta,
  inferFenceLanguage,
  upgradeMarkdownCodeFences,
} from "../src/Markdown";

describe("Phase 1 & 2 precision editorial & interactive embedded demos upgrade", () => {
  it("maps core embedded textbook chapters across all 27 books to interactive micro-animations", () => {
    expect(Object.keys(demos).length).toBeGreaterThanOrEqual(27);
    for (const [key, spec] of Object.entries(demos)) {
      expect(spec.title.length, key).toBeGreaterThan(2);
      expect(spec.labels.length, key).toBe(spec.text.length);
    }

    expect(Object.keys(CHAPTER_DEMOS).length).toBeGreaterThanOrEqual(90);
    // Verify every single one of the 27 books has at least one chapter with an interactive demo
    for (const book of textbookCatalog.books) {
      const hasDemo = book.chapters.some((c) => CHAPTER_DEMOS[c.id]?.length > 0);
      expect(hasDemo, `${book.id} should have at least one interactive demo`).toBe(true);
    }

    expect(CHAPTER_DEMOS["course-b05-m01"]).toContain("clock-tree");
    expect(CHAPTER_DEMOS["course-b05-m02"]).toContain("gpio-circuit");
    expect(CHAPTER_DEMOS["course-b05-m03"]).toContain("nvic-tailchain");
    expect(CHAPTER_DEMOS["course-b05-m04"]).toContain("motor-pwm");
    expect(CHAPTER_DEMOS["course-b05-m06"]).toContain("dma-ring");
    expect(CHAPTER_DEMOS["course-b05-m07"]).toContain("serial-waveform");
    expect(CHAPTER_DEMOS["course-b05-m10"]).toContain("power-modes");
    expect(CHAPTER_DEMOS["course-b06-m01"]).toContain("rtos-scheduler");
    expect(CHAPTER_DEMOS["course-b07-m04"]).toContain("can-arbitration");
    expect(CHAPTER_DEMOS["course-b10-m05"]).toContain("linux-dtree");
    expect(CHAPTER_DEMOS["course-b13-m05"]).toContain("tinyml-quant");
    expect(CHAPTER_DEMOS["course-b17-m09"]).toContain("pcb-return-path");
    expect(CHAPTER_DEMOS["course-b18-m06"]).toContain("cache-dma");
    expect(CHAPTER_DEMOS["course-b20-m01"]).toContain("dsp-aliasing");
    expect(CHAPTER_DEMOS["course-b22-m04"]).toContain("secure-boot");
    expect(CHAPTER_DEMOS["course-b01-ch3"]).toContain("memory-layout");
    expect(CHAPTER_DEMOS["course-b01-ch6"]).toContain("bit-ops");
    expect(CHAPTER_DEMOS["course-b00-m02"]).toContain("data-endian");
    expect(CHAPTER_DEMOS["course-b23-b23-m01"]).toContain("adc-pid-loop");
  });

  it("extracts mobile step cards from horizontal 4-box pipeline SVGs without mutating SVG markup", () => {
    const rawSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 132">
      <rect class="sv-box" x="18" y="34" width="166" height="68" rx="6" fill="var(--cyn-bg)" stroke="var(--cyn)"/>
      <text class="sv-bh" x="101" y="59">1. 预处理与编译</text>
      <text class="sv-bs" x="101" y="80">生成汇编与目标文件</text>
      <rect class="sv-box" x="214" y="34" width="166" height="68" rx="6" fill="var(--grn-bg)" stroke="var(--grn)"/>
      <text class="sv-bh" x="297" y="59">2. 链接器重定位</text>
      <text class="sv-bs" x="297" y="80">合并段并分配地址</text>
      <rect class="sv-box" x="410" y="34" width="166" height="68" rx="6" fill="var(--amb-bg)" stroke="var(--amb)"/>
      <text class="sv-bh" x="493" y="59">3. 烧录到 Flash</text>
      <text class="sv-bs" x="493" y="80">复位向量指向入口</text>
      <rect class="sv-box" x="606" y="34" width="166" height="68" rx="6" fill="var(--vio-bg)" stroke="var(--vio)"/>
      <text class="sv-bh" x="689" y="59">4. Reset_Handler</text>
      <text class="sv-bs" x="689" y="80">搬运 .data 清零 .bss</text>
    </svg>`;
    const steps = extractPipelineSteps(rawSvg);
    expect(steps).toHaveLength(4);
    expect(steps[0]).toEqual({
      title: "1. 预处理与编译",
      subtitle: "生成汇编与目标文件",
      tone: "cyn",
    });
    expect(steps[3].tone).toBe("vio");
  });

  it("infers programming languages for ```text code fences while preserving code content verbatim", () => {
    expect(
      inferFenceLanguage(
        `#include <stdint.h>\nint main(void) {\n  RCC->APB2ENR |= 1U;\n  return 0;\n}`,
      ),
    ).toBe("c");
    expect(
      inferFenceLanguage(
        `#![no_std]\npub fn init_gpio() -> Result<(), Error> {\n  let mut p = Peripherals::take();\n}`,
      ),
    ).toBe("rust");
    expect(
      inferFenceLanguage(
        `sudo apt-get install gcc-arm-none-eabi\narm-none-eabi-gcc -mcpu=cortex-m4 main.c`,
      ),
    ).toBe("bash");
    expect(
      formatCodeMeta("hljs language-c", "mov.w r0, #1\nbx lr\n"),
    ).toBe("ARM ASM · 2 行");

    const md = "```text\n#include <stdio.h>\nint main(void) { return 0; }\n```";
    expect(upgradeMarkdownCodeFences(md)).toBe(
      "```c\n#include <stdio.h>\nint main(void) { return 0; }\n```",
    );
  });

  it("removes legacy internal product references from Glossary.tsx", () => {
    const glossarySource = fs.readFileSync("src/Glossary.tsx", "utf8");
    expect(glossarySource).not.toContain("在灵珠中");
    expect(glossarySource).toContain("工程实践语境");
  });
});
