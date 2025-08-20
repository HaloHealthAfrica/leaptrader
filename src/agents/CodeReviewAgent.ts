import { Logger } from '../utils/logger';
import { readFileSync, existsSync, readdirSync, statSync } from 'fs';
import { join, extname, basename } from 'path';

interface PackageJson {
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

interface TSConfig {
  compilerOptions?: {
    strict?: boolean;
    paths?: Record<string, string[]>;
    noUncheckedIndexedAccess?: boolean;
  };
}

export interface CodeIssue {
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  category: 'ARCHITECTURE' | 'SECURITY' | 'PERFORMANCE' | 'MAINTAINABILITY' | 'TESTING' | 'CONFIGURATION' | 'DEPENDENCIES';
  file: string;
  line?: number;
  message: string;
  recommendation: string;
  code?: string;
}

export interface CodeReviewReport {
  summary: {
    totalIssues: number;
    criticalIssues: number;
    highIssues: number;
    mediumIssues: number;
    lowIssues: number;
    filesAnalyzed: number;
    testCoverage: number;
  };
  issues: CodeIssue[];
  recommendations: {
    immediate: string[];
    shortTerm: string[];
    longTerm: string[];
  };
  architecture: {
    strengths: string[];
    weaknesses: string[];
    suggestions: string[];
  };
}

/**
 * Code Review Agent - Comprehensive analysis of the LEAPS Trading System
 * Identifies issues, provides recommendations, and ensures code quality standards
 */
export class CodeReviewAgent {
  private readonly log = new Logger('code-review-agent');
  private readonly issues: CodeIssue[] = [];
  private readonly analyzedFiles = new Set<string>();

  constructor() {
    this.log.info('Code Review Agent initialized');
  }

  /**
   * Run comprehensive code review across the entire codebase
   */
  async runFullReview(): Promise<CodeReviewReport> {
    this.log.info('Starting comprehensive code review...');
    
    try {
      // Analyze project structure and configuration
      await this.analyzeProjectStructure();
      await this.analyzeConfiguration();
      await this.analyzeDependencies();
      
      // Analyze source code
      await this.analyzeSourceCode();
      await this.analyzeTests();
      
      // Analyze architecture and patterns
      await this.analyzeArchitecture();
      await this.analyzeCodeQuality();
      
      // Generate comprehensive report
      const report = this.generateReport();
      
      this.log.info('Code review completed', {
        totalIssues: report.summary.totalIssues,
        criticalIssues: report.summary.criticalIssues
      });
      
      return report;
      
    } catch (error) {
      this.log.error('Code review failed', error as Error);
      throw error;
    }
  }

  /**
   * Analyze project structure and file organization
   */
  private async analyzeProjectStructure(): Promise<void> {
    this.log.debug('Analyzing project structure...');
    
    const requiredDirs = ['src', 'test', 'docs', 'config'];
    const requiredFiles = ['package.json', 'tsconfig.json', '.eslintrc.js', 'README.md'];
    
    for (const dir of requiredDirs) {
      if (!existsSync(dir)) {
        this.addIssue('HIGH', 'ARCHITECTURE', 'project-root', 
          `Missing required directory: ${dir}`,
          'Create the missing directory to maintain proper project structure'
        );
      }
    }
    
    for (const file of requiredFiles) {
      if (!existsSync(file)) {
        this.addIssue('HIGH', 'ARCHITECTURE', 'project-root',
          `Missing required file: ${file}`,
          'Create the missing file to ensure proper project configuration'
        );
      }
    }
    
    // Check for proper src organization
    if (existsSync('src')) {
      const srcContents = readdirSync('src');
      const expectedModules = ['core', 'ml', 'features', 'backtest', 'telemetry'];
      
      for (const module of expectedModules) {
        if (!srcContents.includes(module)) {
          this.addIssue('MEDIUM', 'ARCHITECTURE', 'src',
            `Missing expected module: ${module}`,
            'Consider adding this module to maintain clean separation of concerns'
          );
        }
      }
    }
  }

  /**
   * Analyze configuration files for issues
   */
  private async analyzeConfiguration(): Promise<void> {
    this.log.debug('Analyzing configuration files...');
    
    // Analyze package.json
    if (existsSync('package.json')) {
      try {
        const packageJson: PackageJson = JSON.parse(readFileSync('package.json', 'utf8'));
        
        // Check for missing scripts
        const requiredScripts = ['dev', 'build', 'test', 'lint', 'typecheck'];
        for (const script of requiredScripts) {
          if (!packageJson.scripts || !packageJson.scripts[script]) {
            this.addIssue('MEDIUM', 'CONFIGURATION', 'package.json',
              `Missing required script: ${script}`,
              'Add the missing script to ensure proper development workflow'
            );
          }
        }
        
        // Check for security vulnerabilities in dependencies
        const securityPackages = ['helmet', 'express-rate-limit'];
        for (const pkg of securityPackages) {
          if (!packageJson.dependencies || !packageJson.dependencies[pkg]) {
            this.addIssue('HIGH', 'SECURITY', 'package.json',
              `Missing security package: ${pkg}`,
              'Add this security package to protect against common vulnerabilities'
            );
          }
        }
        
        // Check for proper TypeScript setup
        if (!packageJson.devDependencies || !packageJson.devDependencies['typescript']) {
          this.addIssue('CRITICAL', 'CONFIGURATION', 'package.json',
            'Missing TypeScript dependency',
            'Add TypeScript as a dev dependency for proper type checking'
          );
        }
        
      } catch (error) {
        this.addIssue('CRITICAL', 'CONFIGURATION', 'package.json',
          'Invalid JSON in package.json',
          'Fix the JSON syntax error in package.json'
        );
      }
    }
    
    // Analyze tsconfig.json
    if (existsSync('tsconfig.json')) {
      try {
        const tsConfig: TSConfig = JSON.parse(readFileSync('tsconfig.json', 'utf8'));
        
        // Check for strict mode
        if (!tsConfig.compilerOptions || !tsConfig.compilerOptions.strict) {
          this.addIssue('HIGH', 'CONFIGURATION', 'tsconfig.json',
            'TypeScript strict mode is disabled',
            'Enable strict mode for better type safety and error catching'
          );
        }
        
        // Check for proper path mapping
        if (!tsConfig.compilerOptions || !tsConfig.compilerOptions.paths) {
          this.addIssue('MEDIUM', 'CONFIGURATION', 'tsconfig.json',
            'Missing path mapping configuration',
            'Add path mapping for cleaner imports and better maintainability'
          );
        }
        
      } catch (error) {
        this.addIssue('CRITICAL', 'CONFIGURATION', 'tsconfig.json',
          'Invalid JSON in tsconfig.json',
          'Fix the JSON syntax error in tsconfig.json'
        );
      }
    }
    
    // Check for missing .env.example
    if (!existsSync('.env.example')) {
      this.addIssue('MEDIUM', 'CONFIGURATION', 'project-root',
        'Missing .env.example file',
        'Create .env.example to document required environment variables'
      );
    }
    
    // Check for missing .gitignore
    if (!existsSync('.gitignore')) {
      this.addIssue('HIGH', 'SECURITY', 'project-root',
        'Missing .gitignore file',
        'Create .gitignore to prevent sensitive files from being committed'
      );
    }
  }

  /**
   * Analyze dependencies for security and compatibility issues
   */
  private async analyzeDependencies(): Promise<void> {
    this.log.debug('Analyzing dependencies...');
    
    if (existsSync('package.json')) {
      try {
        const packageJson: PackageJson = JSON.parse(readFileSync('package.json', 'utf8'));
        
        // Check for outdated dependencies
        const dependencies = { ...packageJson.dependencies, ...packageJson.devDependencies };
        
        // Check for known vulnerable packages
        const vulnerablePackages = ['axios@<1.6.0', 'express@<4.18.0'];
        for (const pkg of vulnerablePackages) {
          const parts = pkg.split('@');
          const name = parts[0];
          const version = parts[1];
          if (name && version && dependencies && dependencies[name] && dependencies[name] < version) {
            this.addIssue('HIGH', 'SECURITY', 'package.json',
              `Outdated package with potential vulnerabilities: ${name}`,
              `Update ${name} to version ${version} or later for security patches`
            );
          }
        }
        
        // Check for missing peer dependencies
        if (dependencies && dependencies['@typescript-eslint/eslint-plugin'] && !dependencies['@typescript-eslint/parser']) {
          this.addIssue('MEDIUM', 'CONFIGURATION', 'package.json',
            'Missing @typescript-eslint/parser peer dependency',
            'Add @typescript-eslint/parser to ensure ESLint works properly with TypeScript'
          );
        }
        
      } catch (error) {
        this.addIssue('CRITICAL', 'CONFIGURATION', 'package.json',
          'Failed to analyze dependencies',
          'Fix package.json to enable dependency analysis'
        );
      }
    }
  }

  /**
   * Analyze source code for quality issues
   */
  private async analyzeSourceCode(): Promise<void> {
    this.log.debug('Analyzing source code...');
    
    if (!existsSync('src')) {
      this.addIssue('CRITICAL', 'ARCHITECTURE', 'project-root',
        'Missing src directory',
        'Create src directory to contain source code'
      );
      return;
    }
    
    this.analyzeDirectory('src');
  }

  /**
   * Recursively analyze a directory for code issues
   */
  private analyzeDirectory(dirPath: string): void {
    try {
      const items = readdirSync(dirPath);
      
      for (const item of items) {
        const fullPath = join(dirPath, item);
        const stat = statSync(fullPath);
        
        if (stat.isDirectory()) {
          this.analyzeDirectory(fullPath);
        } else if (stat.isFile() && extname(item) === '.ts') {
          this.analyzeTypeScriptFile(fullPath);
        }
      }
    } catch (error) {
      this.addIssue('MEDIUM', 'MAINTAINABILITY', dirPath,
        `Failed to analyze directory: ${dirPath}`,
        'Check file permissions and ensure directory is accessible'
      );
    }
  }

  /**
   * Analyze individual TypeScript files for issues
   */
  private analyzeTypeScriptFile(filePath: string): void {
    try {
      const content = readFileSync(filePath, 'utf8');
      this.analyzedFiles.add(filePath);
      
      // Check for common issues
      this.checkForCommonIssues(filePath, content);
      
      // Check for proper imports
      this.checkImportStatements(filePath, content);
      
      // Check for proper error handling
      this.checkErrorHandling(filePath, content);
      
      // Check for proper logging
      this.checkLogging(filePath, content);
      
      // Check for proper async/await usage
      this.checkAsyncUsage(filePath, content);
      
    } catch (error) {
      this.addIssue('MEDIUM', 'MAINTAINABILITY', filePath,
        'Failed to read file',
        'Check file permissions and ensure file is accessible'
      );
    }
  }

  /**
   * Check for common code quality issues
   */
  private checkForCommonIssues(filePath: string, content: string): void {
    // Check for TODO comments
    const todoMatches = content.match(/TODO:/g);
    if (todoMatches) {
      this.addIssue('LOW', 'MAINTAINABILITY', filePath,
        `Found ${todoMatches.length} TODO comment(s)`,
        'Address TODO comments before production deployment'
      );
    }
    
    // Check for console.log statements
    const consoleMatches = content.match(/console\.(log|warn|error|debug)/g);
    if (consoleMatches) {
      this.addIssue('MEDIUM', 'MAINTAINABILITY', filePath,
        `Found ${consoleMatches.length} console statement(s)`,
        'Replace console statements with proper logging framework'
      );
    }
    
    // Check for hardcoded values
    const hardcodedMatches = content.match(/\b\d{4,}\b/g);
    if (hardcodedMatches && hardcodedMatches.length > 5) {
      this.addIssue('LOW', 'MAINTAINABILITY', filePath,
        'Multiple hardcoded numeric values detected',
        'Consider extracting magic numbers to named constants'
      );
    }
    
    // Check for any types
    const anyMatches = content.match(/\bany\b/g);
    if (anyMatches) {
      this.addIssue('HIGH', 'MAINTAINABILITY', filePath,
        `Found ${anyMatches.length} 'any' type usage(s)`,
        'Replace any types with proper TypeScript types for better type safety'
      );
    }
  }

  /**
   * Check import statements for issues
   */
  private checkImportStatements(filePath: string, content: string): void {
    // Check for relative imports that could be absolute
    const relativeImports = content.match(/from\s+['"]\.\.\/\.\.\//g);
    if (relativeImports && relativeImports.length > 3) {
      this.addIssue('LOW', 'MAINTAINABILITY', filePath,
        'Multiple deep relative imports detected',
        'Consider using absolute imports with path mapping for better maintainability'
      );
    }
    
    // Check for unused imports
    const importLines = content.match(/import\s+.*\s+from\s+['"][^'"]+['"]/g);
    if (importLines) {
      // This is a simplified check - in practice, you'd need a more sophisticated analysis
      this.addIssue('LOW', 'MAINTAINABILITY', filePath,
        'Import statements detected - verify all are used',
        'Ensure all imports are actually used in the code'
      );
    }
  }

  /**
   * Check error handling patterns
   */
  private checkErrorHandling(filePath: string, content: string): void {
    // Check for proper try-catch blocks
    const tryBlocks = content.match(/try\s*{/g);
    const catchBlocks = content.match(/catch\s*\(/g);
    
    if (tryBlocks && catchBlocks && tryBlocks.length !== catchBlocks.length) {
      this.addIssue('HIGH', 'MAINTAINABILITY', filePath,
        'Mismatched try-catch blocks detected',
        'Ensure all try blocks have corresponding catch blocks for proper error handling'
      );
    }
    
    // Check for proper error logging
    const errorLogs = content.match(/\.log\.error\(/g);
    if (tryBlocks && !errorLogs) {
      this.addIssue('MEDIUM', 'MAINTAINABILITY', filePath,
        'Try blocks without error logging detected',
        'Add proper error logging in catch blocks for debugging and monitoring'
      );
    }
  }

  /**
   * Check logging patterns
   */
  private checkLogging(filePath: string, content: string): void {
    // Check for proper logging levels
    const logStatements = content.match(/\.log\.(debug|info|warn|error|fatal)\(/g);
    if (logStatements) {
      // Check for appropriate log level usage
      const debugLogs = content.match(/\.log\.debug\(/g);
      const infoLogs = content.match(/\.log\.info\(/g);
      
      if (debugLogs && infoLogs && debugLogs.length > infoLogs.length) {
        this.addIssue('LOW', 'PERFORMANCE', filePath,
          'More debug logs than info logs detected',
          'Consider reducing debug logging in production for better performance'
        );
      }
    }
  }

  /**
   * Check async/await usage
   */
  private checkAsyncUsage(filePath: string, content: string): void {
    // Check for proper async function declarations
    const asyncFunctions = content.match(/async\s+function\s+\w+/g);
    const awaitUsage = content.match(/await\s+/g);
    
    if (asyncFunctions && !awaitUsage) {
      this.addIssue('MEDIUM', 'MAINTAINABILITY', filePath,
        'Async functions without await detected',
        'Consider removing async keyword if no await is used, or add await where needed'
      );
    }
    
    // Check for proper Promise handling
    const promiseChains = content.match(/\.then\(/g);
    if (promiseChains && asyncFunctions) {
      this.addIssue('LOW', 'MAINTAINABILITY', filePath,
        'Mixed Promise chains and async/await detected',
        'Consider using consistent async/await pattern throughout the file'
      );
    }
  }

  /**
   * Analyze test files and coverage
   */
  private async analyzeTests(): Promise<void> {
    this.log.debug('Analyzing test files...');
    
    if (!existsSync('test')) {
      this.addIssue('HIGH', 'TESTING', 'project-root',
        'Missing test directory',
        'Create test directory and add unit tests for critical functionality'
      );
      return;
    }
    
    const testFiles = this.countTestFiles('test');
    const sourceFiles = this.countSourceFiles('src');
    
    if (sourceFiles > 0) {
      const testRatio = testFiles / sourceFiles;
      
      if (testRatio < 0.5) {
        this.addIssue('MEDIUM', 'TESTING', 'test',
          `Low test coverage ratio: ${(testRatio * 100).toFixed(1)}%`,
          'Increase test coverage to at least 80% for production readiness'
        );
      } else if (testRatio < 0.8) {
        this.addIssue('LOW', 'TESTING', 'test',
          `Moderate test coverage ratio: ${(testRatio * 100).toFixed(1)}%`,
          'Consider increasing test coverage to 80%+ for better quality assurance'
        );
      }
    }
    
    // Check for test configuration
    if (!existsSync('vitest.config.ts') && !existsSync('vitest.config.js')) {
      this.addIssue('MEDIUM', 'TESTING', 'project-root',
        'Missing Vitest configuration file',
        'Create vitest.config.ts for proper test configuration and coverage reporting'
      );
    }
  }

  /**
   * Count test files recursively
   */
  private countTestFiles(dirPath: string): number {
    let count = 0;
    
    try {
      const items = readdirSync(dirPath);
      
      for (const item of items) {
        const fullPath = join(dirPath, item);
        const stat = statSync(fullPath);
        
        if (stat.isDirectory()) {
          count += this.countTestFiles(fullPath);
        } else if (stat.isFile() && (item.includes('.test.') || item.includes('.spec.'))) {
          count++;
        }
      }
    } catch (error) {
      // Ignore errors in counting
    }
    
    return count;
  }

  /**
   * Count source files recursively
   */
  private countSourceFiles(dirPath: string): number {
    let count = 0;
    
    try {
      const items = readdirSync(dirPath);
      
      for (const item of items) {
        const fullPath = join(dirPath, item);
        const stat = statSync(fullPath);
        
        if (stat.isDirectory()) {
          count += this.countSourceFiles(fullPath);
        } else if (stat.isFile() && extname(item) === '.ts' && !item.includes('.d.ts')) {
          count++;
        }
      }
    } catch (error) {
      // Ignore errors in counting
    }
    
    return count;
  }

  /**
   * Analyze overall architecture and patterns
   */
  private async analyzeArchitecture(): Promise<void> {
    this.log.debug('Analyzing architecture...');
    
    // Check for proper separation of concerns
    if (existsSync('src/core') && existsSync('src/ml') && existsSync('src/features')) {
      this.addIssue('LOW', 'ARCHITECTURE', 'src',
        'Good separation of concerns detected',
        'Maintain this clean architecture pattern'
      );
    }
    
    // Check for proper interface definitions
    if (existsSync('src/core/ports.ts')) {
      this.addIssue('LOW', 'ARCHITECTURE', 'src/core/ports.ts',
        'Port interfaces defined - good for dependency inversion',
        'Continue using interface-based design for better testability'
      );
    }
    
    // Check for proper error handling patterns
    if (existsSync('src/core/errors.ts')) {
      this.addIssue('LOW', 'ARCHITECTURE', 'src/core/errors.ts',
        'Custom error types defined - good for error handling',
        'Continue using custom error types for better error categorization'
      );
    }
  }

  /**
   * Analyze overall code quality
   */
  private async analyzeCodeQuality(): Promise<void> {
    this.log.debug('Analyzing code quality...');
    
    // Check for proper TypeScript configuration
    if (existsSync('tsconfig.json')) {
      try {
        const tsConfig: TSConfig = JSON.parse(readFileSync('tsconfig.json', 'utf8'));
        
        if (tsConfig.compilerOptions?.strict) {
          this.addIssue('LOW', 'MAINTAINABILITY', 'tsconfig.json',
            'Strict TypeScript mode enabled - good for code quality',
            'Maintain strict mode for better type safety'
          );
        }
        
        if (tsConfig.compilerOptions?.noUncheckedIndexedAccess) {
          this.addIssue('LOW', 'MAINTAINABILITY', 'tsconfig.json',
            'Unchecked indexed access disabled - good for safety',
            'Maintain this setting for better array/object access safety'
          );
        }
        
      } catch (error) {
        // Ignore parsing errors here as they're handled elsewhere
      }
    }
    
    // Check for proper linting configuration
    if (existsSync('.eslintrc.js')) {
      this.addIssue('LOW', 'MAINTAINABILITY', '.eslintrc.js',
        'ESLint configuration present - good for code quality',
        'Maintain ESLint rules for consistent code style'
      );
    }
  }

  /**
   * Add an issue to the review
   */
  private addIssue(
    severity: CodeIssue['severity'],
    category: CodeIssue['category'],
    file: string,
    message: string,
    recommendation: string,
    line?: number,
    code?: string
  ): void {
    this.issues.push({
      severity,
      category,
      file,
      line,
      message,
      recommendation,
      code
    });
  }

  /**
   * Generate comprehensive review report
   */
  private generateReport(): CodeReviewReport {
    const criticalIssues = this.issues.filter(i => i.severity === 'CRITICAL');
    const highIssues = this.issues.filter(i => i.severity === 'HIGH');
    const mediumIssues = this.issues.filter(i => i.severity === 'MEDIUM');
    const lowIssues = this.issues.filter(i => i.severity === 'LOW');
    
    const report: CodeReviewReport = {
      summary: {
        totalIssues: this.issues.length,
        criticalIssues: criticalIssues.length,
        highIssues: highIssues.length,
        mediumIssues: mediumIssues.length,
        lowIssues: lowIssues.length,
        filesAnalyzed: this.analyzedFiles.size,
        testCoverage: this.calculateTestCoverage()
      },
      issues: this.issues.sort((a, b) => {
        const severityOrder = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
        return severityOrder[a.severity] - severityOrder[b.severity];
      }),
      recommendations: this.generateRecommendations(),
      architecture: this.generateArchitectureAssessment()
    };
    
    return report;
  }

  /**
   * Calculate test coverage percentage
   */
  private calculateTestCoverage(): number {
    const testFiles = this.countTestFiles('test');
    const sourceFiles = this.countSourceFiles('src');
    
    if (sourceFiles === 0) return 0;
    return Math.min(100, (testFiles / sourceFiles) * 100);
  }

  /**
   * Generate prioritized recommendations
   */
  private generateRecommendations(): CodeReviewReport['recommendations'] {
    const criticalAndHigh = this.issues.filter(i => 
      i.severity === 'CRITICAL' || i.severity === 'HIGH'
    );
    
    const medium = this.issues.filter(i => i.severity === 'MEDIUM');
    const low = this.issues.filter(i => i.severity === 'LOW');
    
    return {
      immediate: criticalAndHigh.map(i => `${i.file}: ${i.message}`),
      shortTerm: medium.map(i => `${i.file}: ${i.message}`),
      longTerm: low.map(i => `${i.file}: ${i.message}`)
    };
  }

  /**
   * Generate architecture assessment
   */
  private generateArchitectureAssessment(): CodeReviewReport['architecture'] {
    const strengths: string[] = [];
    const weaknesses: string[] = [];
    const suggestions: string[] = [];
    
    // Analyze strengths
    if (existsSync('src/core/ports.ts')) {
      strengths.push('Clean interface definitions with ports pattern');
    }
    
    if (existsSync('src/core/types.ts')) {
      strengths.push('Well-defined domain types');
    }
    
    if (existsSync('src/ml/engine')) {
      strengths.push('Modular ML engine architecture');
    }
    
    // Analyze weaknesses
    const criticalIssues = this.issues.filter(i => i.severity === 'CRITICAL');
    if (criticalIssues.length > 0) {
      weaknesses.push(`${criticalIssues.length} critical issues need immediate attention`);
    }
    
    if (!existsSync('src/utils/logger.ts')) {
      weaknesses.push('Missing centralized logging utility');
    }
    
    if (!existsSync('src/config.ts')) {
      weaknesses.push('Missing centralized configuration management');
    }
    
    // Generate suggestions
    if (this.issues.filter(i => i.category === 'SECURITY').length > 0) {
      suggestions.push('Prioritize security fixes before deployment');
    }
    
    if (this.issues.filter(i => i.category === 'TESTING').length > 0) {
      suggestions.push('Improve test coverage for better quality assurance');
    }
    
    if (this.issues.filter(i => i.category === 'PERFORMANCE').length > 0) {
      suggestions.push('Address performance issues for better scalability');
    }
    
    return { strengths, weaknesses, suggestions };
  }
}
