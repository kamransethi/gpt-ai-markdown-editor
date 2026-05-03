import os
missing=[]
for root, dirs, files in os.walk('specs'):
    for f in files:
        if f=='spec.md':
            path=os.path.join(root,f)
            with open(path, encoding='utf-8') as fh:
                text=fh.read()
            if '**PRD Domains**:' not in text:
                missing.append(path.replace('\\','/'))
print('\n'.join(missing))
print('COUNT', len(missing))
