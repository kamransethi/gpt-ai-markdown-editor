import json, os

specs = []
for root, _, files in os.walk('specs'):
    for f in files:
        if f == 'spec.md':
            path = os.path.join(root, f)
            with open(path, encoding='utf-8') as fh:
                lines = [line.rstrip('\n') for line in fh.readlines()[:120]]
            title = ''
            status = ''
            created = ''
            for line in lines:
                if line.startswith('# '):
                    title = line[2:].strip()
                    break
            for line in lines:
                if line.startswith('**Status**:'):
                    status = line.strip()
                if line.startswith('**Created**:'):
                    created = line.strip()
            body = ' '.join([line.strip() for line in lines[5:15] if line.strip()])
            specs.append({'path': path, 'title': title, 'status': status, 'created': created, 'body': body})
print(json.dumps(specs, indent=2))
