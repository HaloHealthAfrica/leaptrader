#!/usr/bin/env tsx

import { CodeReviewAgent, CodeReviewReport, CodeIssue } from './CodeReviewAgent';
import { Logger } from '../utils/logger';

/**
 * Code Review Runner - Executes the Code Review Agent and displays results
 */
async function runCodeReview(): Promise<void> {
  const logger = new Logger('code-review-runner');
  
  try {
    logger.info('🚀 Starting Code Review Agent...');
    
    const agent = new CodeReviewAgent();
    const report = await agent.runFullReview();
    
    // Display comprehensive report
    displayReport(report);
    
    // Exit with appropriate code based on critical issues
    if (report.summary.criticalIssues > 0) {
      logger.error('❌ Critical issues found - review required before deployment');
      process.exit(1);
    } else if (report.summary.highIssues > 0) {
      logger.warn('⚠️  High priority issues found - address before production');
      process.exit(0);
    } else {
      logger.info('✅ Code review passed - system ready for deployment');
      process.exit(0);
    }
    
  } catch (error) {
    logger.error('💥 Code review failed', error as Error);
    process.exit(1);
  }
}

/**
 * Display the code review report in a formatted way
 */
function displayReport(report: CodeReviewReport): void {
  console.log('\n' + '='.repeat(80));
  console.log('🔍 CODE REVIEW REPORT - LEAPS Trading System');
  console.log('='.repeat(80));
  
  // Summary
  console.log('\n📊 SUMMARY');
  console.log('-'.repeat(40));
  console.log(`Total Issues: ${report.summary.totalIssues}`);
  console.log(`Critical: ${report.summary.criticalIssues} 🔴`);
  console.log(`High: ${report.summary.highIssues} 🟠`);
  console.log(`Medium: ${report.summary.mediumIssues} 🟡`);
  console.log(`Low: ${report.summary.lowIssues} 🟢`);
  console.log(`Files Analyzed: ${report.summary.filesAnalyzed}`);
  console.log(`Test Coverage: ${report.summary.testCoverage.toFixed(1)}%`);
  
  // Critical Issues
  if (report.summary.criticalIssues > 0) {
    console.log('\n🚨 CRITICAL ISSUES (IMMEDIATE ACTION REQUIRED)');
    console.log('-'.repeat(50));
    report.issues
      .filter((i: CodeIssue) => i.severity === 'CRITICAL')
      .forEach((issue: CodeIssue, index: number) => {
        console.log(`${index + 1}. ${issue.file}`);
        console.log(`   ${issue.message}`);
        console.log(`   💡 ${issue.recommendation}`);
        console.log('');
      });
  }
  
  // High Issues
  if (report.summary.highIssues > 0) {
    console.log('\n⚠️  HIGH PRIORITY ISSUES (ADDRESS BEFORE PRODUCTION)');
    console.log('-'.repeat(50));
    report.issues
      .filter((i: CodeIssue) => i.severity === 'HIGH')
      .forEach((issue: CodeIssue, index: number) => {
        console.log(`${index + 1}. ${issue.file}`);
        console.log(`   ${issue.message}`);
        console.log(`   💡 ${issue.recommendation}`);
        console.log('');
      });
  }
  
  // Medium Issues
  if (report.summary.mediumIssues > 0) {
    console.log('\n🟡 MEDIUM PRIORITY ISSUES (ADDRESS SOON)');
    console.log('-'.repeat(40));
    report.issues
      .filter((i: CodeIssue) => i.severity === 'MEDIUM')
      .forEach((issue: CodeIssue, index: number) => {
        console.log(`${index + 1}. ${issue.file}: ${issue.message}`);
      });
  }
  
  // Low Issues
  if (report.summary.lowIssues > 0) {
    console.log('\n🟢 LOW PRIORITY ISSUES (ADDRESS WHEN CONVENIENT)');
    console.log('-'.repeat(40));
    report.issues
      .filter((i: CodeIssue) => i.severity === 'LOW')
      .forEach((issue: CodeIssue, index: number) => {
        console.log(`${index + 1}. ${issue.file}: ${issue.message}`);
      });
  }
  
  // Recommendations
  console.log('\n📋 RECOMMENDATIONS');
  console.log('-'.repeat(40));
  
  if (report.recommendations.immediate.length > 0) {
    console.log('\n🚨 IMMEDIATE ACTIONS:');
    report.recommendations.immediate.forEach((rec: string, index: number) => {
      console.log(`   ${index + 1}. ${rec}`);
    });
  }
  
  if (report.recommendations.shortTerm.length > 0) {
    console.log('\n⏰ SHORT TERM (Next Sprint):');
    report.recommendations.shortTerm.forEach((rec: string, index: number) => {
      console.log(`   ${index + 1}. ${rec}`);
    });
  }
  
  if (report.recommendations.longTerm.length > 0) {
    console.log('\n📅 LONG TERM (Future Releases):');
    report.recommendations.longTerm.forEach((rec: string, index: number) => {
      console.log(`   ${index + 1}. ${rec}`);
    });
  }
  
  // Architecture Assessment
  console.log('\n🏗️  ARCHITECTURE ASSESSMENT');
  console.log('-'.repeat(40));
  
  if (report.architecture.strengths.length > 0) {
    console.log('\n✅ STRENGTHS:');
    report.architecture.strengths.forEach((strength: string, index: number) => {
      console.log(`   ${index + 1}. ${strength}`);
    });
  }
  
  if (report.architecture.weaknesses.length > 0) {
    console.log('\n❌ WEAKNESSES:');
    report.architecture.weaknesses.forEach((weakness: string, index: number) => {
      console.log(`   ${index + 1}. ${weakness}`);
    });
  }
  
  if (report.architecture.suggestions.length > 0) {
    console.log('\n💡 SUGGESTIONS:');
    report.architecture.suggestions.forEach((suggestion: string, index: number) => {
      console.log(`   ${index + 1}. ${suggestion}`);
    });
  }
  
  // Final Status
  console.log('\n' + '='.repeat(80));
  if (report.summary.criticalIssues > 0) {
    console.log('❌ SYSTEM STATUS: CRITICAL ISSUES DETECTED');
    console.log('   Deployment blocked until critical issues are resolved');
  } else if (report.summary.highIssues > 0) {
    console.log('⚠️  SYSTEM STATUS: HIGH PRIORITY ISSUES DETECTED');
    console.log('   Address high priority issues before production deployment');
  } else if (report.summary.mediumIssues > 0) {
    console.log('🟡 SYSTEM STATUS: MEDIUM PRIORITY ISSUES DETECTED');
    console.log('   System ready for deployment, but address medium issues soon');
  } else {
    console.log('✅ SYSTEM STATUS: READY FOR DEPLOYMENT');
    console.log('   All critical and high priority issues resolved');
  }
  console.log('='.repeat(80));
}

// Run the code review if this file is executed directly
if (require.main === module) {
  runCodeReview().catch((error) => {
    console.error('💥 Code review runner failed:', error);
    process.exit(1);
  });
}

export { runCodeReview };
