"""Apply the reviewed, narrowly scoped source corrections before rebuilding books.

Idempotent; the pre-repair source/mobile/app snapshot is in backups/.
"""
from pathlib import Path
import json
import re
import sys

sys.stdout.reconfigure(encoding='utf-8')
root = Path(sys.argv[1] if len(sys.argv) > 1 else r'C:\Users\Administrator\Documents\嵌入式书库原本')
fixes = {
    'parts/08-ch6.html': [('include <assert.h>', 'include &lt;assert.h&gt;', 1)],
    'b03a/parts/05-m04.html': [('Option<T> 表达', 'Option&lt;T&gt; 表达', 1)],
    'b03/parts/03-m02.html': [('类型变为 Uart<Ready>', '类型变为 Uart&lt;Ready&gt;', 1)],
    'b03/parts/06-m05.html': [('Cell<u32> 不是 Sync', 'Cell&lt;u32&gt; 不是 Sync', 1)],
    'b06/tools/chapters_b.py': [('exec<n', 'exec&lt;n', 1)],
    'b16/tools/chapters_a.py': [('blob <len>', 'blob &lt;len&gt;', 1)],
    'b16/tools/chapters_b.py': [('tools/env.sh', 'labs/env.sh', 2)],
    'b17/tools/chapters_a.py': [('fc<Nyquist', 'fc&lt;Nyquist', 2)],
    'b04/parts/06-m05.html': [('python tools/build_all.py --dry-run', 'python tools/probes/m05_src/build_all.py --dry-run', 1)],
}
changes = []
for name, edits in fixes.items():
    file = root / name
    source = file.read_text(encoding='utf-8')
    for before, after, count in edits:
        if before not in source and source.count(after) >= count:
            continue
        assert source.count(before) == count, (name, before, source.count(before))
        source = source.replace(before, after)
        changes.append({'file': name, 'before': before, 'after': after, 'occurrences': count})
    file.write_text(source, encoding='utf-8', newline='\n')

for name in ['parts/05-ch3.html', 'parts/06-ch4.html', 'parts/08-ch6.html']:
    file = root / name
    source = file.read_text(encoding='utf-8')
    def fix_svg(match):
        svg = match[0]
        for tag, style in [('strong', 'font-weight="700"'), ('em', 'font-style="italic"'), ('code', 'style="font-family:var(--mono)"')]:
            svg, count = re.subn(r'<' + tag + r'\b[^>]*>([\s\S]*?)</' + tag + '>', lambda m: '<tspan ' + style + '>' + m[1] + '</tspan>', svg)
            if count:
                changes.append({'file': name, 'before': tag + ' inside SVG', 'after': 'tspan', 'occurrences': count})
        return svg
    source = re.sub(r'<svg\b[\s\S]*?</svg>', fix_svg, source)
    # The restored final line ends at y=288; allow its descenders and padding.
    source = source.replace('<svg viewBox="0 0 660 290" width="660" height="290" role="img" aria-label="指针类型的解释差异">',
                            '<svg viewBox="0 0 660 308" width="660" height="308" role="img" aria-label="指针类型的解释差异">')
    file.write_text(source, encoding='utf-8', newline='\n')
print(json.dumps(changes, ensure_ascii=False, indent=2))
