import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { PrefectoralPost, PostAssignment } from '@/types/duty-service';
import { format } from 'date-fns';
import { SchoolSettingsService } from '../services/school-settings.service';

interface PrefectoralPDFGeneratorOptions {
  posts: PrefectoralPost[];
  assignments: PostAssignment[];
  viewType: 'tree' | 'minimized' | 'list';
  paperSize: 'A3' | 'A4';
  getPupilName: (pupilId: string) => string;
  getPupilClass: (pupilId: string) => string;
  getPupilPhoto?: (pupilId: string) => string;
}

export const generatePrefectoralPDF = async ({
  posts,
  assignments,
  viewType,
  paperSize,
  getPupilName,
  getPupilClass,
  getPupilPhoto
}: PrefectoralPDFGeneratorOptions) => {
  // Create PDF with specified paper size
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: paperSize === 'A3' ? 'a3' : 'a4'
  });

  // Fetch school settings for school name
  const schoolSettings = await SchoolSettingsService.getSchoolSettings();
  const schoolName = schoolSettings?.schoolName || 'Trinity Family Schools';

  // Add header
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(schoolName, doc.internal.pageSize.width / 2, 20, { align: 'center' });

  doc.setFontSize(14);
  const reportTitle = 'Prefectoral Body Hierarchy';
  doc.text(reportTitle, doc.internal.pageSize.width / 2, 30, { align: 'center' });

  // Add generation date
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  const generationDate = `Generated on: ${format(new Date(), 'MMM dd, yyyy HH:mm')}`;
  doc.text(generationDate, doc.internal.pageSize.width / 2, 40, { align: 'center' });

  if (viewType === 'list') {
    await generateListViewPDF(doc, posts, assignments, getPupilName, getPupilClass);
  } else {
    await generateTreeViewPDF(doc, posts, assignments, viewType, getPupilName, getPupilClass, getPupilPhoto);
  }

  // Save the PDF
  const fileName = `Prefectoral_Body_${viewType}_${paperSize}_${format(new Date(), 'yyyy-MM-dd')}.pdf`;
  doc.save(fileName);
};

const generateListViewPDF = async (
  doc: jsPDF,
  posts: PrefectoralPost[],
  assignments: PostAssignment[],
  getPupilName: (pupilId: string) => string,
  getPupilClass: (pupilId: string) => string
) => {
  // Sort posts by position of honour
  const sortedPosts = [...posts].sort((a, b) => a.positionOfHonour - b.positionOfHonour);

  // Prepare table data
  const tableData = sortedPosts.map(post => {
    const postAssignments = assignments.filter(a => a.postId === post.id);
    const activeAssignment = postAssignments.find(a => a.isActive);
    
    return [
      post.positionOfHonour.toString(),
      post.postName,
      activeAssignment ? getPupilName(activeAssignment.pupilId) : 'Vacant',
      activeAssignment ? getPupilClass(activeAssignment.pupilId) : '-',
      activeAssignment ? format(new Date(activeAssignment.startDate), 'MMM dd, yyyy') : '-',
      activeAssignment ? format(new Date(activeAssignment.endDate), 'MMM dd, yyyy') : '-',
      post.allowance ? `$${post.allowance}` : 'None'
    ];
  });

  // Calculate dynamic column widths based on page size
  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;
  const availableWidth = pageWidth - 20; // Account for margins
  
  // Calculate available height for table
  const headerSpace = 50; // Space for header
  const footerSpace = 30; // Space for footer and page number
  const availableHeight = pageHeight - headerSpace - footerSpace;
  
  // Define column width percentages that add up to 100%
  const columnWidths = {
    0: availableWidth * 0.08,  // Rank (8%)
    1: availableWidth * 0.25,  // Post Name (25%)
    2: availableWidth * 0.25,  // Current Holder (25%)
    3: availableWidth * 0.12,  // Class (12%)
    4: availableWidth * 0.12,  // Start Date (12%)
    5: availableWidth * 0.12,  // End Date (12%)
    6: availableWidth * 0.06   // Allowance (6%)
  };

  // Calculate dynamic font size based on available space and number of rows
  const baseFontSize = Math.min(10, Math.max(7, availableWidth / 100));
  
  // Calculate optimal row height based on available height and number of rows
  const estimatedRowHeight = Math.min(12, Math.max(8, availableHeight / (tableData.length + 1))); // +1 for header

  // Add the table
  autoTable(doc, {
    head: [
      ['Rank', 'Post Name', 'Current Holder', 'Class', 'Start Date', 'End Date', 'Allowance']
    ],
    body: tableData,
    startY: headerSpace,
    styles: {
      fontSize: baseFontSize,
      cellPadding: Math.max(2, baseFontSize / 3),
      overflow: 'linebreak',
      halign: 'left',
      valign: 'middle',
      minCellHeight: estimatedRowHeight,
    },
    headStyles: {
      fillColor: [41, 128, 185],
      textColor: 255,
      fontStyle: 'bold',
      fontSize: baseFontSize,
      minCellHeight: estimatedRowHeight,
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    columnStyles: columnWidths,
    margin: { top: headerSpace, right: 10, bottom: footerSpace, left: 10 },
    didDrawPage: function (data) {
      // Add page number
      const pageCount = doc.getNumberOfPages();
      doc.setFontSize(8);
      doc.text(`Page ${data.pageNumber} of ${pageCount}`, data.settings.margin.left, doc.internal.pageSize.height - 10);
    },
    tableWidth: 'auto',
    theme: 'grid',
    pageBreak: 'auto', // Allow page breaks if needed
    showFoot: 'lastPage',
  });
};

const generateTreeViewPDF = async (
  doc: jsPDF,
  posts: PrefectoralPost[],
  assignments: PostAssignment[],
  viewType: 'tree' | 'minimized',
  getPupilName: (pupilId: string) => string,
  getPupilClass: (pupilId: string) => string,
  getPupilPhoto?: (pupilId: string) => string
) => {
  // Sort posts by position of honour
  const sortedPosts = [...posts].sort((a, b) => a.positionOfHonour - b.positionOfHonour);
  
  // Group posts by position of honour
  const postsByRank = sortedPosts.reduce((acc, post) => {
    if (!acc[post.positionOfHonour]) {
      acc[post.positionOfHonour] = [];
    }
    acc[post.positionOfHonour].push(post);
    return acc;
  }, {} as Record<number, PrefectoralPost[]>);

  const ranks = Object.keys(postsByRank).map(Number).sort((a, b) => a - b);
  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;
  const margin = 15;
  const availableWidth = pageWidth - (2 * margin);
  
  // Calculate available height more precisely
  const headerHeight = 50; // Header space
  const footerHeight = 20; // Footer space
  const availableHeight = pageHeight - headerHeight - footerHeight - (2 * margin);

  // Calculate dynamic layout parameters
  const maxCardsPerRow = Math.max(...ranks.map(rank => postsByRank[rank].length));
  const minCardWidth = 40;
  const maxCardWidth = viewType === 'minimized' ? 70 : 90;
  
  // Calculate optimal card width and spacing
  let cardWidth = Math.min(maxCardWidth, Math.max(minCardWidth, (availableWidth - (maxCardsPerRow - 1) * 10) / maxCardsPerRow));
  let cardSpacing = Math.max(5, (availableWidth - (maxCardsPerRow * cardWidth)) / Math.max(1, maxCardsPerRow - 1));
  
  // Ensure minimum spacing
  if (cardSpacing < 5) {
    cardSpacing = 5;
    cardWidth = Math.min(maxCardWidth, (availableWidth - (maxCardsPerRow - 1) * cardSpacing) / maxCardsPerRow);
  }

  // Calculate maximum card height based on available height and number of ranks
  const maxCardHeight = Math.min(
    viewType === 'minimized' ? 35 : 50,
    (availableHeight - (ranks.length * 15)) / ranks.length // Reserve 15mm per rank for spacing
  );
  
  // Calculate row height to ensure proper spacing and fit within page
  const rowHeight = Math.min(
    maxCardHeight + 15, // Card height + spacing
    availableHeight / ranks.length
  );
  
  // Recalculate card height to fit within row height
  const cardHeight = Math.min(maxCardHeight, rowHeight - 15);

  let currentY = headerHeight + margin; // Start below header

  ranks.forEach((rank, rankIndex) => {
    const rankPosts = postsByRank[rank];
    const isTopRank = rank === 1;
    
    // Check if this rank would exceed page height
    if (currentY + cardHeight > pageHeight - footerHeight - margin) {
      // If it would exceed, we need to adjust or truncate
      console.warn(`Rank ${rank} would exceed page height. Current Y: ${currentY}, Card Height: ${cardHeight}, Page Height: ${pageHeight}`);
      return; // Skip this rank to prevent overflow
    }
    
    // Calculate total width needed for this specific rank
    const totalCardsWidth = (rankPosts.length * cardWidth) + ((rankPosts.length - 1) * cardSpacing);
    const startX = margin + (availableWidth - totalCardsWidth) / 2;
    
    // Calculate font sizes based on card dimensions
    const titleFontSize = Math.min(9, Math.max(6, cardWidth / 8));
    const nameFontSize = Math.min(8, Math.max(5, cardWidth / 10));
    const classFontSize = Math.min(7, Math.max(4, cardWidth / 12));
    
    // Draw cards for this rank
    rankPosts.forEach((post, postIndex) => {
      const cardX = startX + (postIndex * (cardWidth + cardSpacing));
      const cardY = currentY;
      
      // Draw card background with proper colors
      const bgColor = isTopRank ? [255, 255, 240] : [248, 250, 252];
      doc.setFillColor(bgColor[0], bgColor[1], bgColor[2]);
      doc.rect(cardX, cardY, cardWidth, cardHeight, 'F');
      doc.setDrawColor(200, 200, 200);
      doc.rect(cardX, cardY, cardWidth, cardHeight, 'S');
      
      // Get current assignment
      const postAssignments = assignments.filter(a => a.postId === post.id);
      const activeAssignment = postAssignments.find(a => a.isActive);
      
      // Draw the card using the app's design style
      drawAppStyleCard(doc, cardX, cardY, cardWidth, cardHeight, post, activeAssignment, getPupilName, getPupilClass, getPupilPhoto);
    });
    
    // Draw connecting lines between cards in the same rank (only if more than one card)
    if (rankPosts.length > 1) {
      doc.setDrawColor(100, 100, 100);
      doc.setLineWidth(0.3);
      for (let i = 0; i < rankPosts.length - 1; i++) {
        const card1X = startX + (i * (cardWidth + cardSpacing)) + cardWidth;
        const card2X = startX + ((i + 1) * (cardWidth + cardSpacing));
        const lineY = currentY + cardHeight / 2;
        doc.line(card1X, lineY, card2X, lineY);
      }
    }
    
    // Draw connecting lines to next rank (simplified to avoid clutter)
    if (rankIndex < ranks.length - 1) {
      const nextRankPosts = postsByRank[ranks[rankIndex + 1]];
      const nextTotalCardsWidth = (nextRankPosts.length * cardWidth) + ((nextRankPosts.length - 1) * cardSpacing);
      const nextStartX = margin + (availableWidth - nextTotalCardsWidth) / 2;
      
      doc.setDrawColor(100, 100, 100);
      doc.setLineWidth(0.3);
      
      // Only draw a few strategic connecting lines to avoid clutter
      const maxConnections = Math.min(rankPosts.length, 3);
      const step = Math.max(1, Math.floor(rankPosts.length / maxConnections));
      
      for (let i = 0; i < maxConnections; i++) {
        const postIndex = i * step;
        if (postIndex < rankPosts.length) {
          const currentCardX = startX + (postIndex * (cardWidth + cardSpacing)) + cardWidth / 2;
          const currentCardY = currentY + cardHeight;
          
          // Find the closest card in the next rank
          const nextCardIndex = Math.min(i, nextRankPosts.length - 1);
          const nextCardX = nextStartX + (nextCardIndex * (cardWidth + cardSpacing)) + cardWidth / 2;
          const nextCardY = currentY + rowHeight;
          
          doc.line(currentCardX, currentCardY, nextCardX, nextCardY);
        }
      }
    }
    
    currentY += rowHeight;
  });
  
  // Add page number
  doc.setFontSize(8);
  doc.text(`Page 1 of 1`, margin, pageHeight - 10);
};

// Helper function to draw cards in the app's design style
const drawAppStyleCard = (
  doc: jsPDF,
  cardX: number,
  cardY: number,
  cardWidth: number,
  cardHeight: number,
  post: PrefectoralPost,
  activeAssignment: PostAssignment | undefined,
  getPupilName: (pupilId: string) => string,
  getPupilClass: (pupilId: string) => string,
  getPupilPhoto?: (pupilId: string) => string
) => {
  // Draw golden border (rounded rectangle effect)
  doc.setDrawColor(255, 215, 0); // Golden color
  doc.setLineWidth(2);
  doc.roundedRect(cardX, cardY, cardWidth, cardHeight, 3, 3, 'S');
  
  // Draw white background
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(cardX + 1, cardY + 1, cardWidth - 2, cardHeight - 2, 2, 2, 'F');
  
  if (activeAssignment) {
    // Calculate image dimensions (smaller photo to leave space for text)
    const imageSize = Math.min(cardWidth * 0.5, cardHeight * 0.5); // 50% of card size
    const imageX = cardX + (cardWidth - imageSize) / 2;
    const imageY = cardY + 8; // Small margin from top
    
    // Try to add pupil image if available
    if (getPupilPhoto) {
      try {
        const pupilPhoto = getPupilPhoto(activeAssignment.pupilId);
        if (pupilPhoto && (pupilPhoto.startsWith('data:') || pupilPhoto.startsWith('http'))) {
          doc.addImage(pupilPhoto, 'JPEG', imageX, imageY, imageSize, imageSize, undefined, 'FAST');
        }
      } catch (error) {
        console.warn('Failed to add pupil image:', error);
      }
    }
    
    // Draw green dot in top-left corner
    doc.setFillColor(0, 255, 0); // Bright green
    doc.circle(cardX + 8, cardY + 8, 3, 'F');
    
    // Draw crown icon in top-right corner
    doc.setFillColor(255, 215, 0); // Golden crown
    doc.setFontSize(8);
    doc.text('👑', cardX + cardWidth - 12, cardY + 8);
    
    // Calculate text area below image
    const textStartY = imageY + imageSize + 5;
    const availableHeight = cardHeight - textStartY - 5;
    
    // Draw post name (bold, larger)
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    const postName = post.postName.length > 15 ? post.postName.substring(0, 13) + '...' : post.postName;
    doc.text(postName, cardX + cardWidth/2, textStartY + 4, { align: 'center' });
    
    // Draw pupil name (normal weight)
    doc.setFontSize(6);
    doc.setFont('helvetica', 'normal');
    const pupilName = getPupilName(activeAssignment.pupilId);
    const displayName = pupilName.length > 18 ? pupilName.substring(0, 16) + '...' : pupilName;
    doc.text(displayName, cardX + cardWidth/2, textStartY + 12, { align: 'center' });
    
    // Draw class (smaller)
    doc.setFontSize(5);
    const pupilClass = getPupilClass(activeAssignment.pupilId);
    doc.text(pupilClass, cardX + cardWidth/2, textStartY + 18, { align: 'center' });
    
  } else {
    // Vacant position - draw placeholder
    doc.setFillColor(240, 240, 240);
    doc.roundedRect(cardX + 2, cardY + 2, cardWidth - 4, cardHeight - 4, 2, 2, 'F');
    
    // Draw vacant text
    doc.setFontSize(8);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(150, 150, 150);
    doc.text('VACANT', cardX + cardWidth/2, cardY + cardHeight/2, { align: 'center' });
    
    // Reset text color
    doc.setTextColor(0, 0, 0);
  }
};
