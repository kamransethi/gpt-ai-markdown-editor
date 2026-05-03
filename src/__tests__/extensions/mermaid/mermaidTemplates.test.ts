import { MERMAID_TEMPLATES } from '../../../webview/mermaidTemplates';

describe('Mermaid Templates', () => {
  describe('MERMAID_TEMPLATES array', () => {
    it('should export an array of templates', () => {
      expect(Array.isArray(MERMAID_TEMPLATES)).toBe(true);
      expect(MERMAID_TEMPLATES.length).toBeGreaterThan(0);
    });

    it('should contain exactly 15 templates', () => {
      expect(MERMAID_TEMPLATES.length).toBe(15);
    });

    it('should have all templates with label and diagram properties', () => {
      MERMAID_TEMPLATES.forEach(template => {
        expect(template).toHaveProperty('label');
        expect(template).toHaveProperty('diagram');
        expect(typeof template.label).toBe('string');
        expect(typeof template.diagram).toBe('string');
      });
    });

    it('should have non-empty labels and diagrams', () => {
      MERMAID_TEMPLATES.forEach(template => {
        expect(template.label.length).toBeGreaterThan(0);
        expect(template.diagram.length).toBeGreaterThan(0);
      });
    });

    it('should have unique labels', () => {
      const labels = MERMAID_TEMPLATES.map(t => t.label);
      const uniqueLabels = new Set(labels);
      expect(uniqueLabels.size).toBe(labels.length);
    });
  });

  describe('Template content validation', () => {
    it('should include Flowchart template', () => {
      const flowchart = MERMAID_TEMPLATES.find(t => t.label === 'Flowchart');
      expect(flowchart).toBeDefined();
      expect(flowchart?.diagram).toContain('graph TD');
      expect(flowchart?.diagram).toContain('Start');
    });

    it('should include Sequence Diagram template', () => {
      const sequence = MERMAID_TEMPLATES.find(t => t.label === 'Sequence Diagram');
      expect(sequence).toBeDefined();
      expect(sequence?.diagram).toContain('sequenceDiagram');
      expect(sequence?.diagram).toContain('participant');
    });

    it('should include Class Diagram template', () => {
      const classDiagram = MERMAID_TEMPLATES.find(t => t.label === 'Class Diagram');
      expect(classDiagram).toBeDefined();
      expect(classDiagram?.diagram).toContain('classDiagram');
      expect(classDiagram?.diagram).toContain('class');
    });

    it('should include State Diagram template', () => {
      const state = MERMAID_TEMPLATES.find(t => t.label === 'State Diagram');
      expect(state).toBeDefined();
      expect(state?.diagram).toContain('stateDiagram-v2');
    });

    it('should include Entity Relationship Diagram template', () => {
      const erd = MERMAID_TEMPLATES.find(t => t.label === 'Entity Relationship Diagram');
      expect(erd).toBeDefined();
      expect(erd?.diagram).toContain('erDiagram');
      expect(erd?.diagram).toContain('CUSTOMER');
    });

    it('should include Gantt Chart template', () => {
      const gantt = MERMAID_TEMPLATES.find(t => t.label === 'Gantt Chart');
      expect(gantt).toBeDefined();
      expect(gantt?.diagram).toContain('gantt');
      expect(gantt?.diagram).toContain('title');
    });

    it('should include Pie Chart template', () => {
      const pie = MERMAID_TEMPLATES.find(t => t.label === 'Pie Chart');
      expect(pie).toBeDefined();
      expect(pie?.diagram).toContain('pie title');
      expect(pie?.diagram).toContain('Category');
    });

    it('should include User Journey template', () => {
      const journey = MERMAID_TEMPLATES.find(t => t.label === 'User Journey');
      expect(journey).toBeDefined();
      expect(journey?.diagram).toContain('journey');
      expect(journey?.diagram).toContain('section');
    });

    it('should include Git Graph (Timeline) template', () => {
      const git = MERMAID_TEMPLATES.find(t => t.label === 'Git Graph (Timeline)');
      expect(git).toBeDefined();
      expect(git?.diagram).toContain('gitGraph');
      expect(git?.diagram).toContain('commit');
    });

    it('should include Mindmap template', () => {
      const mindmap = MERMAID_TEMPLATES.find(t => t.label === 'Mindmap');
      expect(mindmap).toBeDefined();
      expect(mindmap?.diagram).toContain('mindmap');
      expect(mindmap?.diagram).toContain('root');
    });

    it('should include Requirement Diagram template', () => {
      const req = MERMAID_TEMPLATES.find(t => t.label === 'Requirement Diagram');
      expect(req).toBeDefined();
      expect(req?.diagram).toContain('requirementDiagram');
      expect(req?.diagram).toContain('requirement');
    });

    it('should include C4 Diagram template', () => {
      const c4 = MERMAID_TEMPLATES.find(t => t.label === 'C4 Diagram');
      expect(c4).toBeDefined();
      expect(c4?.diagram).toContain('C4Context');
    });

    it('should include Sankey Diagram template', () => {
      const sankey = MERMAID_TEMPLATES.find(t => t.label === 'Sankey Diagram');
      expect(sankey).toBeDefined();
      expect(sankey?.diagram).toContain('sankey-beta');
    });

    it('should include XY Chart template', () => {
      const xy = MERMAID_TEMPLATES.find(t => t.label === 'XY Chart');
      expect(xy).toBeDefined();
      expect(xy?.diagram).toContain('xychart-beta');
    });

    it('should include Quadrant Chart template', () => {
      const quadrant = MERMAID_TEMPLATES.find(t => t.label === 'Quadrant Chart');
      expect(quadrant).toBeDefined();
      expect(quadrant?.diagram).toContain('quadrantChart');
      expect(quadrant?.diagram).toContain('x-axis');
      expect(quadrant?.diagram).toContain('y-axis');
    });
  });

  describe('Template syntax validation', () => {
    it('should have valid multi-line formatting (no \\n escape sequences)', () => {
      MERMAID_TEMPLATES.forEach(template => {
        // Templates should use actual newlines, not escaped \n
        expect(template.diagram).not.toContain('\\n');
      });
    });

    it('should have proper indentation (contains whitespace)', () => {
      // Most templates should have some indentation
      const templatesWithIndentation = MERMAID_TEMPLATES.filter(
        t => t.diagram.includes('    ') || t.diagram.includes('  ')
      );
      expect(templatesWithIndentation.length).toBeGreaterThan(10);
    });

    it('should contain newline characters for multi-line diagrams', () => {
      MERMAID_TEMPLATES.forEach(template => {
        // All templates should be multi-line
        expect(template.diagram).toContain('\n');
      });
    });
  });
});
