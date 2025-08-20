import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { CodeReviewAgent, CodeIssue, CodeReviewReport } from '../../src/agents/CodeReviewAgent';
import { Logger } from '../../src/utils/logger';

// Mock the logger to avoid console output during tests
vi.mock('../../src/utils/logger', () => ({
  Logger: vi.fn().mockImplementation(() => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    fatal: vi.fn(),
    child: vi.fn()
  }))
}));

// Mock fs module for testing
const mockFs = {
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
  readdirSync: vi.fn(),
  statSync: vi.fn()
};

vi.mock('fs', () => mockFs);
vi.mock('path', () => ({
  join: (...args: string[]) => args.join('/'),
  extname: (path: string) => path.includes('.') ? '.' + path.split('.').pop() : '',
  basename: (path: string) => path.split('/').pop() || ''
}));

describe('CodeReviewAgent', () => {
  let agent: CodeReviewAgent;
  let mockLogger: any;

  beforeEach(() => {
    vi.clearAllMocks();
    agent = new CodeReviewAgent();
    mockLogger = new Logger('test');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Project Structure Analysis', () => {
    it('should detect missing required directories', async () => {
      mockFs.existsSync.mockImplementation((path: string) => {
        return path === 'src' || path === 'package.json' || path === 'tsconfig.json' || path === '.eslintrc.js';
      });

      const report = await agent.runFullReview();
      
      expect(report.summary.totalIssues).toBeGreaterThan(0);
      expect(report.issues.some(i => 
        i.message.includes('Missing required directory: test') && 
        i.severity === 'HIGH'
      )).toBe(true);
    });

    it('should detect missing required files', async () => {
      mockFs.existsSync.mockImplementation((path: string) => {
        return path === 'src' || path === 'test' || path === 'docs';
      });

      const report = await agent.runFullReview();
      
      expect(report.issues.some(i => 
        i.message.includes('Missing required file: package.json') && 
        i.severity === 'HIGH'
      )).toBe(true);
    });

    it('should detect missing expected modules', async () => {
      mockFs.existsSync.mockImplementation((path: string) => {
        if (path === 'src') return true;
        if (path === 'src/core') return true;
        return false;
      });

      mockFs.readdirSync.mockReturnValue(['core']);

      const report = await agent.runFullReview();
      
      expect(report.issues.some(i => 
        i.message.includes('Missing expected module: ml') && 
        i.severity === 'MEDIUM'
      )).toBe(true);
    });
  });

  describe('Configuration Analysis', () => {
    it('should detect missing TypeScript dependency', async () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockImplementation((path: string) => {
        if (path === 'package.json') {
          return JSON.stringify({
            scripts: { dev: 'tsx watch src/server/app.ts' },
            dependencies: { express: '^4.18.0' },
            devDependencies: { eslint: '^8.0.0' }
          });
        }
        if (path === 'tsconfig.json') {
          return JSON.stringify({
            compilerOptions: { strict: true, target: 'ES2022' }
          });
        }
        return '{}';
      });

      const report = await agent.runFullReview();
      
      expect(report.issues.some(i => 
        i.message.includes('Missing TypeScript dependency') && 
        i.severity === 'CRITICAL'
      )).toBe(true);
    });

    it('should detect disabled TypeScript strict mode', async () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockImplementation((path: string) => {
        if (path === 'package.json') {
          return JSON.stringify({
            scripts: { dev: 'tsx watch src/server/app.ts' },
            dependencies: { express: '^4.18.0' },
            devDependencies: { typescript: '^5.2.0' }
          });
        }
        if (path === 'tsconfig.json') {
          return JSON.stringify({
            compilerOptions: { strict: false, target: 'ES2022' }
          });
        }
        return '{}';
      });

      const report = await agent.runFullReview();
      
      expect(report.issues.some(i => 
        i.message.includes('TypeScript strict mode is disabled') && 
        i.severity === 'HIGH'
      )).toBe(true);
    });

    it('should detect missing security packages', async () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockImplementation((path: string) => {
        if (path === 'package.json') {
          return JSON.stringify({
            scripts: { dev: 'tsx watch src/server/app.ts' },
            dependencies: { express: '^4.18.0' },
            devDependencies: { typescript: '^5.2.0' }
          });
        }
        if (path === 'tsconfig.json') {
          return JSON.stringify({
            compilerOptions: { strict: true, target: 'ES2022' }
          });
        }
        return '{}';
      });

      const report = await agent.runFullReview();
      
      expect(report.issues.some(i => 
        i.message.includes('Missing security package: helmet') && 
        i.severity === 'HIGH'
      )).toBe(true);
    });

    it('should detect missing .gitignore file', async () => {
      mockFs.existsSync.mockImplementation((path: string) => {
        return path !== '.gitignore';
      });

      const report = await agent.runFullReview();
      
      expect(report.issues.some(i => 
        i.message.includes('Missing .gitignore file') && 
        i.severity === 'HIGH'
      )).toBe(true);
    });
  });

  describe('Source Code Analysis', () => {
    it('should detect console.log statements', async () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockImplementation((path: string) => {
        if (path === 'package.json') {
          return JSON.stringify({
            scripts: { dev: 'tsx watch src/server/app.ts' },
            dependencies: { express: '^4.18.0' },
            devDependencies: { typescript: '^5.2.0' }
          });
        }
        if (path === 'tsconfig.json') {
          return JSON.stringify({
            compilerOptions: { strict: true, target: 'ES2022' }
          });
        }
        if (path.includes('.ts')) {
          return 'console.log("test");\nconsole.warn("warning");';
        }
        return '{}';
      });

      mockFs.readdirSync.mockImplementation((path: string) => {
        if (path === 'src') return ['test.ts'];
        return [];
      });

      mockFs.statSync.mockImplementation((path: string) => ({
        isDirectory: () => false,
        isFile: () => true
      }));

      const report = await agent.runFullReview();
      
      expect(report.issues.some(i => 
        i.message.includes('Found 2 console statement(s)') && 
        i.severity === 'MEDIUM'
      )).toBe(true);
    });

    it('should detect any types', async () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockImplementation((path: string) => {
        if (path === 'package.json') {
          return JSON.stringify({
            scripts: { dev: 'tsx watch src/server/app.ts' },
            dependencies: { express: '^4.18.0' },
            devDependencies: { typescript: '^5.2.0' }
          });
        }
        if (path === 'tsconfig.json') {
          return JSON.stringify({
            compilerOptions: { strict: true, target: 'ES2022' }
          });
        }
        if (path.includes('.ts')) {
          return 'const data: any = {};\nfunction process(input: any) {}';
        }
        return '{}';
      });

      mockFs.readdirSync.mockImplementation((path: string) => {
        if (path === 'src') return ['test.ts'];
        return [];
      });

      mockFs.statSync.mockImplementation((path: string) => ({
        isDirectory: () => false,
        isFile: () => true
      }));

      const report = await agent.runFullReview();
      
      expect(report.issues.some(i => 
        i.message.includes("Found 2 'any' type usage(s)") && 
        i.severity === 'HIGH'
      )).toBe(true);
    });

    it('should detect TODO comments', async () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockImplementation((path: string) => {
        if (path === 'package.json') {
          return JSON.stringify({
            scripts: { dev: 'tsx watch src/server/app.ts' },
            dependencies: { express: '^4.18.0' },
            devDependencies: { typescript: '^5.2.0' }
          });
        }
        if (path === 'tsconfig.json') {
          return JSON.stringify({
            compilerOptions: { strict: true, target: 'ES2022' }
          });
        }
        if (path.includes('.ts')) {
          return '// TODO: Implement this feature\n// TODO: Add tests';
        }
        return '{}';
      });

      mockFs.readdirSync.mockImplementation((path: string) => {
        if (path === 'src') return ['test.ts'];
        return [];
      });

      mockFs.statSync.mockImplementation((path: string) => ({
        isDirectory: () => false,
        isFile: () => true
      }));

      const report = await agent.runFullReview();
      
      expect(report.issues.some(i => 
        i.message.includes('Found 2 TODO comment(s)') && 
        i.severity === 'LOW'
      )).toBe(true);
    });
  });

  describe('Test Analysis', () => {
    it('should detect missing test directory', async () => {
      mockFs.existsSync.mockImplementation((path: string) => {
        return path !== 'test';
      });

      const report = await agent.runFullReview();
      
      expect(report.issues.some(i => 
        i.message.includes('Missing test directory') && 
        i.severity === 'HIGH'
      )).toBe(true);
    });

    it('should calculate test coverage correctly', async () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockImplementation((path: string) => {
        if (path === 'package.json') {
          return JSON.stringify({
            scripts: { dev: 'tsx watch src/server/app.ts' },
            dependencies: { express: '^4.18.0' },
            devDependencies: { typescript: '^5.2.0' }
          });
        }
        if (path === 'tsconfig.json') {
          return JSON.stringify({
            compilerOptions: { strict: true, target: 'ES2022' }
          });
        }
        return '{}';
      });

      mockFs.readdirSync.mockImplementation((path: string) => {
        if (path === 'src') return ['file1.ts', 'file2.ts', 'file3.ts'];
        if (path === 'test') return ['file1.test.ts'];
        return [];
      });

      mockFs.statSync.mockImplementation((path: string) => ({
        isDirectory: () => path === 'src' || path === 'test',
        isFile: () => !path.includes('src') && !path.includes('test')
      }));

      const report = await agent.runFullReview();
      
      // 1 test file / 3 source files = 33.3%
      expect(report.summary.testCoverage).toBeCloseTo(33.3, 1);
    });
  });

  describe('Report Generation', () => {
    it('should generate correct summary statistics', async () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockImplementation((path: string) => {
        if (path === 'package.json') {
          return JSON.stringify({
            scripts: { dev: 'tsx watch src/server/app.ts' },
            dependencies: { express: '^4.18.0' },
            devDependencies: { typescript: '^5.2.0' }
          });
        }
        if (path === 'tsconfig.json') {
          return JSON.stringify({
            compilerOptions: { strict: true, target: 'ES2022' }
          });
        }
        return '{}';
      });

      const report = await agent.runFullReview();
      
      expect(report.summary).toHaveProperty('totalIssues');
      expect(report.summary).toHaveProperty('criticalIssues');
      expect(report.summary).toHaveProperty('highIssues');
      expect(report.summary).toHaveProperty('mediumIssues');
      expect(report.summary).toHaveProperty('lowIssues');
      expect(report.summary).toHaveProperty('filesAnalyzed');
      expect(report.summary).toHaveProperty('testCoverage');
    });

    it('should prioritize issues by severity', async () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockImplementation((path: string) => {
        if (path === 'package.json') {
          return JSON.stringify({
            scripts: { dev: 'tsx watch src/server/app.ts' },
            dependencies: { express: '^4.18.0' },
            devDependencies: { typescript: '^5.2.0' }
          });
        }
        if (path === 'tsconfig.json') {
          return JSON.stringify({
            compilerOptions: { strict: false, target: 'ES2022' }
          });
        }
        return '{}';
      });

      const report = await agent.runFullReview();
      
      // Issues should be sorted by severity (CRITICAL first)
      const severityOrder = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];
      const actualOrder = report.issues.map(i => i.severity);
      
      for (let i = 0; i < actualOrder.length - 1; i++) {
        const currentIndex = severityOrder.indexOf(actualOrder[i]);
        const nextIndex = severityOrder.indexOf(actualOrder[i + 1]);
        expect(currentIndex).toBeLessThanOrEqual(nextIndex);
      }
    });

    it('should generate appropriate recommendations', async () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockImplementation((path: string) => {
        if (path === 'package.json') {
          return JSON.stringify({
            scripts: { dev: 'tsx watch src/server/app.ts' },
            dependencies: { express: '^4.18.0' },
            devDependencies: { typescript: '^5.2.0' }
          });
        }
        if (path === 'tsconfig.json') {
          return JSON.stringify({
            compilerOptions: { strict: false, target: 'ES2022' }
          });
        }
        return '{}';
      });

      const report = await agent.runFullReview();
      
      expect(report.recommendations).toHaveProperty('immediate');
      expect(report.recommendations).toHaveProperty('shortTerm');
      expect(report.recommendations).toHaveProperty('longTerm');
      
      // Should have immediate actions for critical/high issues
      if (report.summary.criticalIssues > 0 || report.summary.highIssues > 0) {
        expect(report.recommendations.immediate.length).toBeGreaterThan(0);
      }
    });

    it('should generate architecture assessment', async () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockImplementation((path: string) => {
        if (path === 'package.json') {
          return JSON.stringify({
            scripts: { dev: 'tsx watch src/server/app.ts' },
            dependencies: { express: '^4.18.0' },
            devDependencies: { typescript: '^5.2.0' }
          });
        }
        if (path === 'tsconfig.json') {
          return JSON.stringify({
            compilerOptions: { strict: true, target: 'ES2022' }
          });
        }
        return '{}';
      });

      const report = await agent.runFullReview();
      
      expect(report.architecture).toHaveProperty('strengths');
      expect(report.architecture).toHaveProperty('weaknesses');
      expect(report.architecture).toHaveProperty('suggestions');
      
      expect(Array.isArray(report.architecture.strengths)).toBe(true);
      expect(Array.isArray(report.architecture.weaknesses)).toBe(true);
      expect(Array.isArray(report.architecture.suggestions)).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle file read errors gracefully', async () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockImplementation(() => {
        throw new Error('File read error');
      });

      const report = await agent.runFullReview();
      
      expect(report.issues.some(i => 
        i.message.includes('Invalid JSON in package.json') && 
        i.severity === 'CRITICAL'
      )).toBe(true);
    });

    it('should handle directory access errors gracefully', async () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readdirSync.mockImplementation(() => {
        throw new Error('Permission denied');
      });

      const report = await agent.runFullReview();
      
      expect(report.issues.some(i => 
        i.message.includes('Failed to analyze directory') && 
        i.severity === 'MEDIUM'
      )).toBe(true);
    });
  });

  describe('Integration', () => {
    it('should complete full review without errors', async () => {
      // Mock a complete, valid project structure
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockImplementation((path: string) => {
        if (path === 'package.json') {
          return JSON.stringify({
            scripts: { 
              dev: 'tsx watch src/server/app.ts',
              build: 'tsc',
              test: 'vitest',
              lint: 'eslint src --ext .ts',
              typecheck: 'tsc --noEmit'
            },
            dependencies: { 
              express: '^4.18.0',
              helmet: '^7.1.0',
              'express-rate-limit': '^7.1.0'
            },
            devDependencies: { 
              typescript: '^5.2.0',
              '@typescript-eslint/eslint-plugin': '^6.0.0',
              '@typescript-eslint/parser': '^6.0.0'
            }
          });
        }
        if (path === 'tsconfig.json') {
          return JSON.stringify({
            compilerOptions: { 
              strict: true, 
              target: 'ES2022',
              noUncheckedIndexedAccess: true,
              paths: { '@/*': ['./src/*'] }
            }
          });
        }
        if (path.includes('.ts')) {
          return '// Clean TypeScript file\nconst data = { value: 42 };\nconsole.log(data.value);';
        }
        return '{}';
      });

      mockFs.readdirSync.mockImplementation((path: string) => {
        if (path === 'src') return ['core', 'ml', 'features', 'backtest', 'telemetry'];
        if (path === 'test') return ['test1.spec.ts', 'test2.spec.ts'];
        if (path === 'src/core') return ['ports.ts', 'types.ts'];
        return [];
      });

      mockFs.statSync.mockImplementation((path: string) => ({
        isDirectory: () => path.includes('src') || path.includes('test'),
        isFile: () => !path.includes('src') && !path.includes('test')
      }));

      const report = await agent.runFullReview();
      
      expect(report.summary.totalIssues).toBeGreaterThanOrEqual(0);
      expect(report.summary.filesAnalyzed).toBeGreaterThan(0);
      expect(report.summary.testCoverage).toBeGreaterThan(0);
      
      // Should have some strengths for a well-structured project
      expect(report.architecture.strengths.length).toBeGreaterThan(0);
    });
  });
});
