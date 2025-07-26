import { useCallback } from 'react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import * as XLSX from 'xlsx';

interface AnalysisResult {
  fileName: string;
  timestamp: string;
  summary?: {
    userTasks: number;
    integrations: number;
    complexity: string;
    issueCount: number;
  };
  processIntelligence?: {
    insights: string[];
    recommendations: string[];
    riskAssessment: string;
  };
  findings: Array<{
    id: string;
    ruleName: string;
    severity: 'error' | 'warning' | 'info';
    message: string;
    elementId?: string;
    elementName?: string;
    description?: string;
  }>;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
}

export const useExport = () => {
  const exportAnalysisToPDF = useCallback(async (result: AnalysisResult) => {
    try {
      const pdf = new jsPDF();
      const pageWidth = pdf.internal.pageSize.getWidth();
      const margin = 20;
      let yPosition = margin;

      // Title
      pdf.setFontSize(20);
      pdf.text('BPMN Process Analysis Report', margin, yPosition);
      yPosition += 15;

      // File info
      pdf.setFontSize(12);
      pdf.text(`File: ${result.fileName}`, margin, yPosition);
      yPosition += 7;
      pdf.text(`Generated: ${new Date(result.timestamp).toLocaleString()}`, margin, yPosition);
      yPosition += 15;

      // Summary
      if (result.summary) {
        pdf.setFontSize(14);
        pdf.text('Summary', margin, yPosition);
        yPosition += 10;
        
        pdf.setFontSize(10);
        pdf.text(`User Tasks: ${result.summary.userTasks}`, margin, yPosition);
        yPosition += 6;
        pdf.text(`Integrations: ${result.summary.integrations}`, margin, yPosition);
        yPosition += 6;
        pdf.text(`Complexity: ${result.summary.complexity}`, margin, yPosition);
        yPosition += 6;
        pdf.text(`Issues Found: ${result.summary.issueCount}`, margin, yPosition);
        yPosition += 15;
      }

      // AI Insights
      if (result.processIntelligence) {
        pdf.setFontSize(14);
        pdf.text('AI Process Intelligence', margin, yPosition);
        yPosition += 10;

        if (result.processIntelligence.insights.length > 0) {
          pdf.setFontSize(12);
          pdf.text('Insights:', margin, yPosition);
          yPosition += 8;
          
          pdf.setFontSize(10);
          result.processIntelligence.insights.forEach((insight) => {
            const lines = pdf.splitTextToSize(`• ${insight}`, pageWidth - margin * 2);
            pdf.text(lines, margin + 5, yPosition);
            yPosition += lines.length * 5;
          });
          yPosition += 5;
        }

        if (result.processIntelligence.recommendations.length > 0) {
          pdf.setFontSize(12);
          pdf.text('Recommendations:', margin, yPosition);
          yPosition += 8;
          
          pdf.setFontSize(10);
          result.processIntelligence.recommendations.forEach((rec) => {
            const lines = pdf.splitTextToSize(`• ${rec}`, pageWidth - margin * 2);
            pdf.text(lines, margin + 5, yPosition);
            yPosition += lines.length * 5;
          });
          yPosition += 5;
        }

        if (result.processIntelligence.riskAssessment) {
          pdf.setFontSize(12);
          pdf.text('Risk Assessment:', margin, yPosition);
          yPosition += 8;
          
          pdf.setFontSize(10);
          const riskLines = pdf.splitTextToSize(result.processIntelligence.riskAssessment, pageWidth - margin * 2);
          pdf.text(riskLines, margin, yPosition);
          yPosition += riskLines.length * 5 + 10;
        }
      }

      // Findings
      if (result.findings.length > 0) {
        pdf.setFontSize(14);
        pdf.text('Detailed Findings', margin, yPosition);
        yPosition += 10;

        result.findings.forEach((finding, index) => {
          // Check if we need a new page
          if (yPosition > pdf.internal.pageSize.getHeight() - 50) {
            pdf.addPage();
            yPosition = margin;
          }

          pdf.setFontSize(12);
          pdf.text(`${index + 1}. ${finding.ruleName} (${finding.severity.toUpperCase()})`, margin, yPosition);
          yPosition += 8;

          pdf.setFontSize(10);
          const messageLines = pdf.splitTextToSize(finding.message, pageWidth - margin * 2);
          pdf.text(messageLines, margin + 5, yPosition);
          yPosition += messageLines.length * 5;

          if (finding.elementName) {
            pdf.text(`Element: ${finding.elementName}`, margin + 5, yPosition);
            yPosition += 5;
          }

          yPosition += 5;
        });
      }

      pdf.save(`${result.fileName}_analysis.pdf`);
    } catch (error) {
      console.error('Error exporting to PDF:', error);
      throw error;
    }
  }, []);

  const exportAnalysisToExcel = useCallback((result: AnalysisResult) => {
    try {
      const workbook = XLSX.utils.book_new();

      // Summary sheet
      const summaryData = [
        ['File Name', result.fileName],
        ['Generated', new Date(result.timestamp).toLocaleString()],
        [''],
        ['Summary'],
        ['User Tasks', result.summary?.userTasks || 0],
        ['Integrations', result.summary?.integrations || 0],
        ['Complexity', result.summary?.complexity || 'N/A'],
        ['Issues Found', result.summary?.issueCount || 0],
      ];

      const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
      XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary');

      // Findings sheet
      if (result.findings.length > 0) {
        const findingsData = [
          ['Rule Name', 'Severity', 'Message', 'Element Name', 'Element ID'],
          ...result.findings.map(finding => [
            finding.ruleName,
            finding.severity,
            finding.message,
            finding.elementName || '',
            finding.elementId || ''
          ])
        ];

        const findingsSheet = XLSX.utils.aoa_to_sheet(findingsData);
        XLSX.utils.book_append_sheet(workbook, findingsSheet, 'Findings');
      }

      // AI Insights sheet
      if (result.processIntelligence) {
        const insightsData = [
          ['Type', 'Content'],
          ...result.processIntelligence.insights.map(insight => ['Insight', insight]),
          ...result.processIntelligence.recommendations.map(rec => ['Recommendation', rec]),
          ['Risk Assessment', result.processIntelligence.riskAssessment]
        ];

        const insightsSheet = XLSX.utils.aoa_to_sheet(insightsData);
        XLSX.utils.book_append_sheet(workbook, insightsSheet, 'AI Insights');
      }

      XLSX.writeFile(workbook, `${result.fileName}_analysis.xlsx`);
    } catch (error) {
      console.error('Error exporting to Excel:', error);
      throw error;
    }
  }, []);

  const exportChatToPDF = useCallback(async (messages: ChatMessage[], fileName: string) => {
    try {
      const pdf = new jsPDF();
      const pageWidth = pdf.internal.pageSize.getWidth();
      const margin = 20;
      let yPosition = margin;

      // Title
      pdf.setFontSize(16);
      pdf.text('BPMN Process Chat Conversation', margin, yPosition);
      yPosition += 10;

      pdf.setFontSize(10);
      pdf.text(`File: ${fileName}`, margin, yPosition);
      yPosition += 6;
      pdf.text(`Exported: ${new Date().toLocaleString()}`, margin, yPosition);
      yPosition += 15;

      // Messages
      messages.forEach((message, index) => {
        // Check if we need a new page
        if (yPosition > pdf.internal.pageSize.getHeight() - 40) {
          pdf.addPage();
          yPosition = margin;
        }

        // Role header
        pdf.setFontSize(12);
        pdf.text(`${message.role === 'user' ? 'You' : 'AI Assistant'}:`, margin, yPosition);
        yPosition += 8;

        // Message content
        pdf.setFontSize(10);
        const contentLines = pdf.splitTextToSize(message.content, pageWidth - margin * 2);
        pdf.text(contentLines, margin + 5, yPosition);
        yPosition += contentLines.length * 5;

        // Timestamp
        pdf.setFontSize(8);
        pdf.text(new Date(message.created_at).toLocaleString(), margin + 5, yPosition);
        yPosition += 10;
      });

      pdf.save(`${fileName}_chat_conversation.pdf`);
    } catch (error) {
      console.error('Error exporting chat to PDF:', error);
      throw error;
    }
  }, []);

  return {
    exportAnalysisToPDF,
    exportAnalysisToExcel,
    exportChatToPDF,
  };
};