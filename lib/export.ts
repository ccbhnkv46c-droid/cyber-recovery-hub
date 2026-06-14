import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatDate, escalationLabel } from './utils';

interface ExportFinding {
  findingId: string;
  title: string;
  severity: string;
  cvssScore: number;
  businessService?: string;
  application?: { name: string } | null;
  technology?: string;
  owner?: { name: string } | null;
  status: string;
  targetDate: string;
  daysRemaining: number;
  escalationLevel: string;
}

export function exportFindingsPDF(findings: ExportFinding[], title = 'Vulnerability Register') {
  const doc = new jsPDF({ orientation: 'landscape' });
  const date = new Date().toLocaleDateString('en-GB');

  doc.setFontSize(18);
  doc.text('Cyber Recovery Hub', 14, 18);
  doc.setFontSize(12);
  doc.text(title, 14, 26);
  doc.setFontSize(9);
  doc.setTextColor(100);
  doc.text(`Generated: ${date} | Total: ${findings.length} findings`, 14, 32);

  autoTable(doc, {
    startY: 38,
    head: [['ID', 'Title', 'Severity', 'CVSS', 'Owner', 'Status', 'Target', 'Days', 'Escalation']],
    body: findings.map((f) => [
      f.findingId,
      f.title.slice(0, 40),
      f.severity,
      f.cvssScore.toFixed(1),
      f.owner?.name || '—',
      f.status.replace(/_/g, ' '),
      formatDate(f.targetDate),
      f.daysRemaining < 0 ? `${Math.abs(f.daysRemaining)}d overdue` : `${f.daysRemaining}d`,
      escalationLabel(f.escalationLevel),
    ]),
    styles: { fontSize: 7, cellPadding: 2 },
    headStyles: { fillColor: [26, 130, 245] },
    alternateRowStyles: { fillColor: [248, 250, 252] },
  });

  doc.save(`crh-${title.toLowerCase().replace(/\s/g, '-')}-${date.replace(/\//g, '-')}.pdf`);
}

export function exportBoardPDF(data: {
  totalCyberRisk: number;
  criticalFindings: number;
  openFindings: number;
  slaCompliance: number;
  overdueFindings: number;
  recoveryPerformance: number;
}) {
  const doc = new jsPDF();
  const date = new Date().toLocaleDateString('en-GB');

  doc.setFontSize(20);
  doc.text('Cyber Recovery Hub', 14, 20);
  doc.setFontSize(14);
  doc.text('Board Executive Summary', 14, 30);
  doc.setFontSize(9);
  doc.setTextColor(100);
  doc.text(`Report Date: ${date}`, 14, 38);

  autoTable(doc, {
    startY: 48,
    head: [['Metric', 'Value']],
    body: [
      ['Total Cyber Risk Score', `${data.totalCyberRisk}/100`],
      ['Critical Findings', String(data.criticalFindings)],
      ['Open Findings', String(data.openFindings)],
      ['Overdue Findings', String(data.overdueFindings)],
      ['SLA Compliance', `${data.slaCompliance}%`],
      ['Recovery Performance', `${data.recoveryPerformance}%`],
    ],
    styles: { fontSize: 11 },
    headStyles: { fillColor: [26, 130, 245] },
  });

  doc.setFontSize(8);
  doc.setTextColor(120);
  doc.text('CONFIDENTIAL — For Board of Directors use only', 14, doc.internal.pageSize.height - 10);

  doc.save(`crh-board-summary-${date.replace(/\//g, '-')}.pdf`);
}
