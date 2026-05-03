import os,re
root=os.path.abspath('c:/Apps/GitHub/gpt-ai-markdown-editor')
prd_files={
    'editor-core':'docs/prd/editor-core.md','tables':'docs/prd/tables.md','ai-features':'docs/prd/ai-features.md','images':'docs/prd/images.md',
    'slash-commands':'docs/prd/slash-commands.md','frontmatter':'docs/prd/frontmatter.md','navigation':'docs/prd/navigation.md',
    'configuration':'docs/prd/configuration.md','knowledge-graph':'docs/prd/knowledge-graph.md','drawio':'docs/prd/drawio.md',
    'export':'docs/prd/export.md','plugin-system':'docs/prd/plugin-system.md'
}
specs=[]
for dirpath,_,filenames in os.walk(os.path.join(root,'specs')):
    for fname in filenames:
        if fname!='spec.md':
            continue
        with open(os.path.join(dirpath,fname),encoding='utf-8') as f:
            text=f.read()
        if '**PRD Domains**:' not in text:
            continue
        doms=[x.strip(' `') for x in re.search(r'\*\*PRD Domains\*\*: `(.*?)`', text).group(1).split('`, `')]
        folder=os.path.relpath(dirpath,root).replace('\\','/')+'/'
        name=folder.strip('/').split('/')[-1]
        specs.append({'name':name,'folder':folder,'domains':doms})
for dom, path in prd_files.items():
    with open(os.path.join(root,path),encoding='utf-8') as f:
        text=f.read()
    entries=set(re.findall(r'\| \[([^\]]+)\]\(', text))
    missing=[s['name'] for s in specs if dom in s['domains'] and s['name'] not in entries]
    print(dom, 'missing', len(missing), missing)
