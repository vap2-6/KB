import { jsPDF } from 'jspdf';

export function generatePdfFromData(
  title: string,
  headers: string[],
  rows: any[],
  filename: string
) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.getWidth(); // A4 width: 210mm
  const pageHeight = doc.internal.pageSize.getHeight(); // A4 height: 297mm

  const marginX = 14;
  const startY = 42;
  const usableWidth = pageWidth - (marginX * 2); // 182mm usable width

  // Helper function to safely truncate text based on unit millimeter limits
  const truncateText = (text: string, maxWidthMm: number): string => {
    if (!text) return '';
    const textStr = String(text);
    if (doc.getTextWidth(textStr) <= maxWidthMm) return textStr;
    
    let truncated = textStr;
    while (truncated.length > 0 && doc.getTextWidth(truncated + '...') > maxWidthMm) {
      truncated = truncated.slice(0, -1);
    }
    return truncated + '...';
  };

  // Draw Header and Metadata box
  const drawPageHeader = (pageNumber: number) => {
    // Dynamic top border banner accent
    doc.setFillColor(255, 153, 51); // Saffron-500
    doc.rect(marginX, 12, usableWidth, 1.5, 'F');

    // Title header
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(15, 23, 42); // slate-900
    doc.text(title.toUpperCase(), marginX, 20);

    // File metadata block
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(100, 116, 139); // slate-500
    
    const dateStr = new Date().toLocaleDateString() + ' ' + new Date().toLocaleTimeString();
    doc.text(`Source File: ${filename}`, marginX, 26);
    doc.text(`Exported At: ${dateStr}`, marginX, 31);
    doc.text(`Total Rows: ${rows.length}`, marginX + 110, 26);
    doc.text(`Page Format: A4 Standard Layout`, marginX + 110, 31);

    // Slate separating line
    doc.setDrawColor(226, 232, 240); // slate-200
    doc.setLineWidth(0.2);
    doc.line(marginX, 35, marginX + usableWidth, 35);
  };

  // Draw standard report footer
  const drawPageFooter = (pageNumber: number, totalPages: number) => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184); // slate-400
    
    const footerText = `Page ${pageNumber} of ${totalPages}`;
    doc.text(footerText, pageWidth / 2, pageHeight - 10, { align: 'center' });
    doc.text('RKMVC MealFlow Dining System Export', marginX, pageHeight - 10);
  };

  // Draw Page 1 header
  drawPageHeader(1);

  // Column width calculations (distribute width evenly among headers)
  const colCount = Math.max(headers.length, 1);
  const colWidth = usableWidth / colCount;

  let currentY = startY;
  
  // Helper to render table headers
  const drawTableHeaderRow = (y: number) => {
    // Header row container box
    doc.setFillColor(15, 23, 42); // slate-900 (Dark Slate)
    doc.rect(marginX, y, usableWidth, 8, 'F');

    // Header labels
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(255, 255, 255); // White text

    headers.forEach((header, index) => {
      const colX = marginX + (index * colWidth);
      const cleanHeader = String(header).toUpperCase();
      const truncated = truncateText(cleanHeader, colWidth - 4);
      doc.text(truncated, colX + 2, y + 5.5);
    });

    return y + 8;
  };

  currentY = drawTableHeaderRow(currentY);

  // Stagger data rows and handle page overflows
  rows.forEach((row, rowIndex) => {
    // If the next row is going to exceed bottom margin (20mm safety margin)
    if (currentY > pageHeight - 20) {
      doc.addPage();
      currentY = startY;
      
      // Draw header on the new page
      const newPageNum = doc.getNumberOfPages();
      drawPageHeader(newPageNum);
      currentY = drawTableHeaderRow(currentY);
    }

    // Row alternating backgrounds for beautiful readability
    if (rowIndex % 2 === 1) {
      doc.setFillColor(248, 250, 252); // slate-50 (Very light gray-blue)
    } else {
      doc.setFillColor(255, 255, 255); // Pure White
    }
    doc.rect(marginX, currentY, usableWidth, 7, 'F');

    // Subtle row bottom separation line
    doc.setDrawColor(241, 245, 249); // slate-100
    doc.setLineWidth(0.1);
    doc.line(marginX, currentY + 7, marginX + usableWidth, currentY + 7);

    // Text color and styling for cell items
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(51, 65, 85); // slate-700

    headers.forEach((header, index) => {
      const colX = marginX + (index * colWidth);
      const cellValue = row[header];
      const valStr = cellValue === null || cellValue === undefined ? '' : String(cellValue);
      const truncated = truncateText(valStr, colWidth - 4);
      doc.text(truncated, colX + 2, currentY + 4.5);
    });

    currentY += 7;
  });

  // Calculate overall pages and add footers retroactively to keep accurate totals
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    drawPageFooter(i, totalPages);
  }

  // Save/Download file locally
  doc.save(filename);
}
