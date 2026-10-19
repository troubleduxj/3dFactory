import { describe, expect, it } from 'vitest';
import { esc } from '../../src/core/html';

describe('esc', () => {
  it('转义尖括号，脚本标签无法注入', () => {
    const out = esc('<script>alert(1)</script>');
    expect(out).not.toMatch(/[<>]/);
    expect(out).toBe('&lt;script&gt;alert(1)&lt;/script&gt;');
  });

  it('转义双引号，无法跳出属性值', () => {
    const out = esc('" onerror="x');
    expect(out).not.toContain('"');
    expect(out).toBe('&quot; onerror=&quot;x');
  });

  it('转义单引号与 &（先转义 &，不重复转义）', () => {
    expect(esc("'")).toBe('&#39;');
    expect(esc('&')).toBe('&amp;');
    expect(esc('&lt;')).toBe('&amp;lt;');
  });

  it('null / undefined 输出空串，数字转为字符串', () => {
    expect(esc(null)).toBe('');
    expect(esc(undefined)).toBe('');
    expect(esc(42)).toBe('42');
  });
});
