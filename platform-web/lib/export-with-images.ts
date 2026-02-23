import ExcelJS from "exceljs";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

// Extend jsPDF type to include autoTable
declare module "jspdf" {
  interface jsPDF {
    lastAutoTable: {
      finalY: number;
    };
  }
}

// Cache for Thai font base64
let thaiFontBase64Cache: string | null = null;

/**
 * Load Thai font (Google Sans) for PDF export
 */
async function loadThaiFont(): Promise<string | null> {
  if (thaiFontBase64Cache) {
    return thaiFontBase64Cache;
  }

  try {
    const response = await fetch("/GoogleSans-VariableFont.ttf");
    if (!response.ok) {
      console.error("Failed to load Thai font:", response.status);
      return null;
    }

    const arrayBuffer = await response.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    let binary = "";
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    thaiFontBase64Cache = btoa(binary);
    return thaiFontBase64Cache;
  } catch (error) {
    console.error("Failed to load Thai font:", error);
    return null;
  }
}

/**
 * Register Thai font to jsPDF document
 */
async function registerThaiFont(doc: jsPDF): Promise<boolean> {
  const fontBase64 = await loadThaiFont();
  if (!fontBase64) {
    return false;
  }

  try {
    doc.addFileToVFS("GoogleSans.ttf", fontBase64);
    doc.addFont("GoogleSans.ttf", "GoogleSans", "normal");
    return true;
  } catch (error) {
    console.error("Failed to register Thai font:", error);
    return false;
  }
}

// Simple export item for commission page
export interface SimpleCountingExportItem {
  id: string;
  productSKU: string;
  productName: string;
  branchName: string;
  userName: string;
  userRole?: string;
  beforeCount: number;
  finalCount: number;
  variance: number;
  status: string;
  imageUrl?: string;
  remarks?: string;
  createdAt: string;
}

export interface CountingExportItem {
  index: number;
  productSKU: string;
  productName: string;
  branchName: string;
  userName: string;
  beforeCountQty: number;
  currentCountQty: number;
  variance: number;
  imageUrl?: string;
  watermarkData?: {
    location?: string;
    coordinates?: { lat: number; lng: number };
    timestamp?: string;
    employeeName?: string;
    employeeId?: string;
  };
  createdAt?: Date;
}

export interface ExportWithImagesMetadata {
  companyName: string;
  branchName: string;
  userName: string;
  period: string;
  exportDate: string;
  commissionRate: number;
  deductionRate: number;
}

export interface CommissionSummary {
  totalItems: number;
  totalVariance: number;
  lossCount: number;
  lossAmount: number;
  salesAmount: number;
  commissionEarned: number;
  deductionAmount: number;
  netPay: number;
}

/**
 * Parse watermark data from remarks JSON string
 * Used to extract location, coordinates, timestamp from counting session remarks
 */
export function parseWatermarkFromRemarks(
  remarks?: string,
): CountingExportItem["watermarkData"] | undefined {
  if (!remarks) return undefined;

  try {
    const data = JSON.parse(remarks);
    return {
      location: data.location,
      coordinates: data.coordinates,
      timestamp: data.timestamp,
      employeeName: data.employeeName,
      employeeId: data.employeeId,
    };
  } catch {
    return undefined;
  }
}

/**
 * เพิ่ม watermark บนรูปภาพ (client-side canvas)
 */
async function addWatermarkToImage(
  imageUrl: string,
  watermarkData: CountingExportItem["watermarkData"],
): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";

    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext("2d");

        if (!ctx) {
          resolve(imageUrl); // Return original if can't get context
          return;
        }

        // Draw original image
        ctx.drawImage(img, 0, 0);

        // Prepare watermark text
        const lines: string[] = [];
        if (watermarkData?.timestamp) {
          const date = new Date(watermarkData.timestamp);
          lines.push(
            `📅 ${date.toLocaleDateString("th-TH")} ${date.toLocaleTimeString("th-TH")}`,
          );
        }
        if (watermarkData?.location) {
          lines.push(`📍 ${watermarkData.location}`);
        }
        if (
          watermarkData?.coordinates?.lat &&
          watermarkData?.coordinates?.lng
        ) {
          lines.push(
            `🌐 ${watermarkData.coordinates.lat.toFixed(6)}, ${watermarkData.coordinates.lng.toFixed(6)}`,
          );
        }
        if (watermarkData?.employeeName) {
          const branchLabel =
            watermarkData?.branchName || watermarkData?.employeeId || "";
          lines.push(
            `👤 ${watermarkData.employeeName}${branchLabel ? ` (${branchLabel})` : ""}`,
          );
        }

        if (lines.length === 0) {
          resolve(imageUrl); // No watermark data
          return;
        }

        // Watermark settings
        const fontSize = Math.max(14, Math.floor(img.width / 40));
        const padding = 10;
        const lineHeight = fontSize + 4;
        const boxHeight = lines.length * lineHeight + padding * 2;

        // Draw watermark background at bottom
        ctx.fillStyle = "rgba(0, 0, 0, 0.65)";
        ctx.fillRect(0, img.height - boxHeight, img.width, boxHeight);

        // Draw text
        ctx.font = `${fontSize}px sans-serif`;
        ctx.fillStyle = "#FFFF00"; // Yellow
        ctx.textBaseline = "top";

        lines.forEach((line, index) => {
          const y = img.height - boxHeight + padding + index * lineHeight;
          ctx.fillText(line, padding, y);
        });

        // Convert to base64
        resolve(canvas.toDataURL("image/jpeg", 0.9));
      } catch {
        resolve(imageUrl);
      }
    };

    img.onerror = () => resolve(imageUrl);
    img.src = imageUrl;
  });
}

/**
 * Fetch image as base64 for PDF
 * Used internally for adding images to PDF documents
 */
export async function fetchImageAsBase64ForPDF(
  imageUrl: string,
): Promise<string | null> {
  try {
    const response = await fetch(imageUrl);
    const blob = await response.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

/**
 * Export รายการนับสินค้าเป็น Excel พร้อมรูปภาพและ watermark (Full version with metadata)
 */
export async function exportCountingToExcelWithImagesFull(
  data: CountingExportItem[],
  metadata: ExportWithImagesMetadata,
  summary: CommissionSummary,
  filename: string = "counting-report.xlsx",
) {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Counting Report");

  // Set column widths
  worksheet.columns = [
    { width: 6 }, // #
    { width: 15 }, // SKU
    { width: 35 }, // Product Name
    { width: 20 }, // Branch
    { width: 20 }, // User
    { width: 12 }, // Before Qty
    { width: 12 }, // Current Qty
    { width: 12 }, // Variance
    { width: 20 }, // Image
  ];

  // Header metadata
  worksheet.mergeCells("A1:I1");
  worksheet.getCell("A1").value = "รายงานการนับสินค้า / Stock Count Report";
  worksheet.getCell("A1").font = { bold: true, size: 16 };
  worksheet.getCell("A1").alignment = { horizontal: "center" };

  worksheet.getCell("A3").value = "บริษัท:";
  worksheet.getCell("B3").value = metadata.companyName;
  worksheet.getCell("A4").value = "สาขา:";
  worksheet.getCell("B4").value = metadata.branchName;
  worksheet.getCell("A5").value = "พนักงาน:";
  worksheet.getCell("B5").value = metadata.userName;
  worksheet.getCell("A6").value = "ช่วงเวลา:";
  worksheet.getCell("B6").value = metadata.period;
  worksheet.getCell("A7").value = "วันที่ส่งออก:";
  worksheet.getCell("B7").value = metadata.exportDate;

  // Summary section
  worksheet.getCell("E3").value = "สรุป:";
  worksheet.getCell("E3").font = { bold: true };
  worksheet.getCell("E4").value = "รายการทั้งหมด:";
  worksheet.getCell("F4").value = summary.totalItems;
  worksheet.getCell("E5").value = "สินค้าหาย:";
  worksheet.getCell("F5").value = `${summary.lossCount} ชิ้น`;
  worksheet.getCell("E6").value = "มูลค่าหาย:";
  worksheet.getCell("F6").value = `฿${summary.lossAmount.toLocaleString()}`;
  worksheet.getCell("E7").value = "ค่าคอมฯ สุทธิ:";
  worksheet.getCell("F7").value = `฿${summary.netPay.toLocaleString()}`;
  worksheet.getCell("F7").font = { bold: true, color: { argb: "FF0000FF" } };

  // Column headers (row 9)
  const headerRow = worksheet.getRow(9);
  headerRow.values = [
    "#",
    "SKU",
    "ชื่อสินค้า",
    "สาขา",
    "ผู้นับ",
    "ก่อนนับ",
    "นับได้",
    "ผลต่าง",
    "รูปภาพ",
  ];
  headerRow.font = { bold: true };
  headerRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF4472C4" }, // Blue
  };
  headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
  headerRow.alignment = { vertical: "middle", horizontal: "center" };

  // Add data rows with images
  for (let i = 0; i < data.length; i++) {
    const item = data[i];
    const rowIndex = 10 + i;
    const row = worksheet.getRow(rowIndex);

    // Set row height for images
    row.height = 60;

    row.values = [
      item.index,
      item.productSKU,
      item.productName,
      item.branchName,
      item.userName,
      item.beforeCountQty,
      item.currentCountQty,
      item.variance,
      "", // Image placeholder
    ];

    // Style variance cell based on value
    const varianceCell = row.getCell(8);
    if (item.variance < 0) {
      varianceCell.font = { bold: true, color: { argb: "FFFF0000" } }; // Red
    } else if (item.variance > 0) {
      varianceCell.font = { bold: true, color: { argb: "FF0000FF" } }; // Blue
    } else {
      varianceCell.font = { bold: true, color: { argb: "FF00AA00" } }; // Green
    }

    // Center align
    row.getCell(1).alignment = { vertical: "middle", horizontal: "center" };
    row.getCell(6).alignment = { vertical: "middle", horizontal: "center" };
    row.getCell(7).alignment = { vertical: "middle", horizontal: "center" };
    row.getCell(8).alignment = { vertical: "middle", horizontal: "center" };

    // Add image with watermark if available
    if (item.imageUrl) {
      try {
        // First add watermark to image (canvas)
        const watermarkedImageBase64 = await addWatermarkToImage(
          item.imageUrl,
          item.watermarkData,
        );

        // Convert base64 to buffer
        const base64Data = watermarkedImageBase64.split(",")[1];
        const binaryString = atob(base64Data);
        const bytes = new Uint8Array(binaryString.length);
        for (let j = 0; j < binaryString.length; j++) {
          bytes[j] = binaryString.charCodeAt(j);
        }

        const imageId = workbook.addImage({
          // @ts-expect-error ExcelJS accepts Uint8Array but types expect Buffer
          buffer: bytes,
          extension: "jpeg",
        });

        // Use cell reference for image position
        worksheet.addImage(imageId, `I${rowIndex}:I${rowIndex}`);
      } catch (error) {
        console.error(`Failed to add image for row ${rowIndex}:`, error);
      }
    }
  }

  // Commission summary section
  const summaryStartRow = 10 + data.length + 2;
  worksheet.mergeCells(`A${summaryStartRow}:C${summaryStartRow}`);
  worksheet.getCell(`A${summaryStartRow}`).value = "สรุปค่าคอมมิชชั่น";
  worksheet.getCell(`A${summaryStartRow}`).font = { bold: true, size: 14 };

  const commissionData = [
    ["ยอดขายรวม", `฿${summary.salesAmount.toLocaleString()}`],
    ["อัตราคอมมิชชั่น", `${metadata.commissionRate}%`],
    ["ค่าคอมมิชชั่นที่ได้", `฿${summary.commissionEarned.toLocaleString()}`],
    [
      "สินค้าหาย",
      `${summary.lossCount} ชิ้น (฿${summary.lossAmount.toLocaleString()})`,
    ],
    ["ยอดหัก", `-฿${summary.deductionAmount.toLocaleString()}`],
    ["เงินสุทธิ", `฿${summary.netPay.toLocaleString()}`],
  ];

  commissionData.forEach((rowData, idx) => {
    const rowNum = summaryStartRow + 1 + idx;
    worksheet.getCell(`A${rowNum}`).value = rowData[0];
    worksheet.getCell(`B${rowNum}`).value = rowData[1];

    if (idx === 4) {
      // Deduction row - red
      worksheet.getCell(`B${rowNum}`).font = {
        bold: true,
        color: { argb: "FFFF0000" },
      };
    }
    if (idx === 5) {
      // Net pay row - blue
      worksheet.getCell(`B${rowNum}`).font = {
        bold: true,
        size: 12,
        color: { argb: "FF0000FF" },
      };
    }
  });

  // Download file
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  window.URL.revokeObjectURL(url);
}

/**
 * Export รายการนับสินค้าเป็น PDF พร้อมรูปภาพและ watermark (Full version with metadata)
 */
export async function exportCountingToPDFWithImagesFull(
  data: CountingExportItem[],
  metadata: ExportWithImagesMetadata,
  summary: CommissionSummary,
  filename: string = "counting-report.pdf",
) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // ===== Cover Page =====
  let currentY = 20;
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.text("Stock Count Report", pageWidth / 2, currentY, { align: "center" });
  doc.text("รายงานการนับสินค้า", pageWidth / 2, currentY + 8, {
    align: "center",
  });

  currentY += 25;
  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.text(`Company: ${metadata.companyName}`, 15, currentY);
  currentY += 7;
  doc.text(`Branch: ${metadata.branchName}`, 15, currentY);
  currentY += 7;
  doc.text(`Employee: ${metadata.userName}`, 15, currentY);
  currentY += 7;
  doc.text(`Period: ${metadata.period}`, 15, currentY);
  currentY += 7;
  doc.text(`Export Date: ${metadata.exportDate}`, 15, currentY);
  currentY += 15;

  // Summary Cards
  doc.setFillColor(240, 253, 244); // Light green
  doc.roundedRect(15, currentY, 55, 25, 3, 3, "F");
  doc.setFillColor(254, 242, 242); // Light red
  doc.roundedRect(80, currentY, 55, 25, 3, 3, "F");
  doc.setFillColor(239, 246, 255); // Light blue
  doc.roundedRect(145, currentY, 55, 25, 3, 3, "F");

  doc.setFontSize(9);
  doc.setTextColor(34, 197, 94);
  doc.text("Commission", 20, currentY + 8);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text(`฿${summary.commissionEarned.toLocaleString()}`, 20, currentY + 18);

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(239, 68, 68);
  doc.text("Deduction", 85, currentY + 8);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text(`-฿${summary.deductionAmount.toLocaleString()}`, 85, currentY + 18);

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(59, 130, 246);
  doc.text("Net Pay", 150, currentY + 8);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text(`฿${summary.netPay.toLocaleString()}`, 150, currentY + 18);

  doc.setTextColor(0, 0, 0);
  currentY += 35;

  // Summary Table
  const tableData = data
    .slice(0, 30)
    .map((item, idx) => [
      (idx + 1).toString(),
      item.productSKU,
      item.productName.substring(0, 30) +
        (item.productName.length > 30 ? "..." : ""),
      item.beforeCountQty.toString(),
      item.currentCountQty.toString(),
      item.variance.toString(),
    ]);

  autoTable(doc, {
    startY: currentY,
    head: [["#", "SKU", "Product", "Before", "Count", "Variance"]],
    body: tableData,
    theme: "striped",
    headStyles: { fillColor: [59, 130, 246], fontSize: 8 },
    styles: { fontSize: 7, cellPadding: 2 },
    columnStyles: {
      0: { cellWidth: 10 },
      1: { cellWidth: 25 },
      2: { cellWidth: 70 },
      3: { cellWidth: 20, halign: "center" },
      4: { cellWidth: 20, halign: "center" },
      5: { cellWidth: 20, halign: "center" },
    },
    didParseCell: (cellData) => {
      if (cellData.column.index === 5 && cellData.section === "body") {
        const variance = parseInt(cellData.cell.text[0] || "0");
        if (variance < 0) {
          cellData.cell.styles.textColor = [255, 0, 0];
          cellData.cell.styles.fontStyle = "bold";
        } else if (variance > 0) {
          cellData.cell.styles.textColor = [0, 0, 255];
        }
      }
    },
  });

  // ===== Detail Pages with Images =====
  // Show 2 items per page with large images
  for (let i = 0; i < Math.min(data.length, 20); i++) {
    const item = data[i];
    const isFirstOnPage = i % 2 === 0;

    if (isFirstOnPage) {
      doc.addPage();
      currentY = 15;
    } else {
      currentY = pageHeight / 2 + 5;
    }

    // Item header
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text(`Item #${i + 1}: ${item.productSKU}`, 15, currentY);
    currentY += 8;

    // Load and add image with watermark
    const imageX = 15;
    const imageY = currentY;
    const imageWidth = 70;
    const imageHeight = 70;

    if (item.imageUrl) {
      try {
        const watermarkedImage = await addWatermarkToImage(
          item.imageUrl,
          item.watermarkData,
        );
        doc.addImage(
          watermarkedImage,
          "JPEG",
          imageX,
          imageY,
          imageWidth,
          imageHeight,
        );
      } catch {
        // Draw placeholder
        doc.setDrawColor(200, 200, 200);
        doc.rect(imageX, imageY, imageWidth, imageHeight);
        doc.setFontSize(8);
        doc.text(
          "No Image",
          imageX + imageWidth / 2,
          imageY + imageHeight / 2,
          { align: "center" },
        );
      }
    } else {
      doc.setDrawColor(200, 200, 200);
      doc.rect(imageX, imageY, imageWidth, imageHeight);
      doc.setFontSize(8);
      doc.text("No Image", imageX + imageWidth / 2, imageY + imageHeight / 2, {
        align: "center",
      });
    }

    // Item details on right side
    const dataX = imageX + imageWidth + 10;
    let dataY = imageY;

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(`Product: ${item.productName.substring(0, 40)}`, dataX, dataY);
    dataY += 6;
    doc.text(`Branch: ${item.branchName}`, dataX, dataY);
    dataY += 6;
    doc.text(`Counted by: ${item.userName}`, dataX, dataY);
    dataY += 10;

    doc.setFont("helvetica", "bold");
    doc.text(`Before Qty: ${item.beforeCountQty}`, dataX, dataY);
    dataY += 6;
    doc.text(`Count Qty: ${item.currentCountQty}`, dataX, dataY);
    dataY += 6;

    // Variance with color
    if (item.variance < 0) {
      doc.setTextColor(255, 0, 0);
    } else if (item.variance > 0) {
      doc.setTextColor(0, 0, 255);
    } else {
      doc.setTextColor(0, 128, 0);
    }
    doc.text(`Variance: ${item.variance}`, dataX, dataY);
    doc.setTextColor(0, 0, 0);
    dataY += 10;

    // Watermark info
    if (item.watermarkData) {
      doc.setFontSize(7);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(100, 100, 100);
      if (item.watermarkData.timestamp) {
        doc.text(
          `Time: ${new Date(item.watermarkData.timestamp).toLocaleString("th-TH")}`,
          dataX,
          dataY,
        );
        dataY += 4;
      }
      if (item.watermarkData.location) {
        doc.text(
          `Location: ${item.watermarkData.location.substring(0, 35)}`,
          dataX,
          dataY,
        );
        dataY += 4;
      }
      doc.setTextColor(0, 0, 0);
    }
  }

  // ===== Commission Summary Page =====
  doc.addPage();
  currentY = 20;

  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text("Commission Summary", pageWidth / 2, currentY, { align: "center" });
  currentY += 15;

  const commissionTableData = [
    ["Sales Amount", `฿${summary.salesAmount.toLocaleString()}`],
    ["Commission Rate", `${metadata.commissionRate}%`],
    ["Commission Earned", `+฿${summary.commissionEarned.toLocaleString()}`],
    ["", ""],
    ["Loss Count", `${summary.lossCount} items`],
    ["Loss Amount", `฿${summary.lossAmount.toLocaleString()}`],
    ["Deduction Rate", `${metadata.deductionRate}%`],
    ["Deduction Amount", `-฿${summary.deductionAmount.toLocaleString()}`],
    ["", ""],
    ["NET PAY", `฿${summary.netPay.toLocaleString()}`],
  ];

  autoTable(doc, {
    startY: currentY,
    body: commissionTableData,
    theme: "grid",
    styles: { fontSize: 11, cellPadding: 5 },
    columnStyles: {
      0: { cellWidth: 60, fontStyle: "bold" },
      1: { cellWidth: 60, halign: "right" },
    },
    didParseCell: (cellData) => {
      if (cellData.section === "body") {
        // Commission earned - green
        if (cellData.row.index === 2 && cellData.column.index === 1) {
          cellData.cell.styles.textColor = [34, 197, 94];
          cellData.cell.styles.fontStyle = "bold";
        }
        // Deduction - red
        if (cellData.row.index === 7 && cellData.column.index === 1) {
          cellData.cell.styles.textColor = [239, 68, 68];
          cellData.cell.styles.fontStyle = "bold";
        }
        // Net pay - blue, larger
        if (cellData.row.index === 9) {
          cellData.cell.styles.fillColor = [239, 246, 255];
          cellData.cell.styles.fontSize = 14;
          cellData.cell.styles.fontStyle = "bold";
          if (cellData.column.index === 1) {
            cellData.cell.styles.textColor = [59, 130, 246];
          }
        }
      }
    },
  });

  // Footer
  const finalY = doc.lastAutoTable.finalY + 15;
  doc.setFontSize(8);
  doc.setTextColor(128, 128, 128);
  doc.text(
    `Generated on ${new Date().toLocaleString("th-TH")}`,
    pageWidth / 2,
    finalY,
    { align: "center" },
  );

  // Save
  doc.save(filename);
}

// ============================================
// SIMPLIFIED EXPORT FUNCTIONS FOR COMMISSION PAGE
// ============================================

/**
 * Get proxy URL for Firebase Storage images to avoid CORS issues
 */
function getProxyImageUrl(imageUrl: string): string {
  // Use our API proxy to fetch Firebase Storage images
  return `/api/proxy-image?url=${encodeURIComponent(imageUrl)}`;
}

/**
 * Fetch image and add watermark, convert to base64
 */
async function fetchImageWithWatermark(
  imageUrl: string,
  watermarkData: CountingExportItem["watermarkData"],
): Promise<string | null> {
  try {
    // Use proxy for Firebase Storage URLs
    const proxyUrl = getProxyImageUrl(imageUrl);
    const response = await fetch(proxyUrl);

    if (!response.ok) {
      console.error("Proxy fetch failed:", response.status);
      return null;
    }

    const blob = await response.blob();
    const base64 = await new Promise<string | null>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });

    if (!base64 || !watermarkData) {
      return base64;
    }

    // Add watermark to image
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        try {
          const canvas = document.createElement("canvas");
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext("2d");

          if (!ctx) {
            resolve(base64);
            return;
          }

          // Draw original image
          ctx.drawImage(img, 0, 0);

          // Prepare watermark text
          const lines: string[] = [];
          if (watermarkData?.timestamp) {
            const date = new Date(watermarkData.timestamp);
            lines.push(
              `📅 ${date.toLocaleDateString("th-TH")} ${date.toLocaleTimeString("th-TH")}`,
            );
          }
          if (watermarkData?.location) {
            lines.push(`📍 ${watermarkData.location}`);
          }
          if (
            watermarkData?.coordinates?.lat &&
            watermarkData?.coordinates?.lng
          ) {
            lines.push(
              `🌐 ${watermarkData.coordinates.lat.toFixed(6)}, ${watermarkData.coordinates.lng.toFixed(6)}`,
            );
          }
          if (watermarkData?.employeeName) {
            const branchLabel =
              watermarkData?.branchName || watermarkData?.employeeId || "";
            lines.push(
              `👤 ${watermarkData.employeeName}${branchLabel ? ` (${branchLabel})` : ""}`,
            );
          }

          if (lines.length > 0) {
            // Watermark settings
            const fontSize = Math.max(14, Math.floor(img.width / 40));
            const padding = 10;
            const lineHeight = fontSize + 4;
            const boxHeight = lines.length * lineHeight + padding * 2;

            // Draw watermark background at bottom
            ctx.fillStyle = "rgba(0, 0, 0, 0.65)";
            ctx.fillRect(0, img.height - boxHeight, img.width, boxHeight);

            // Draw text
            ctx.font = `${fontSize}px sans-serif`;
            ctx.fillStyle = "#FFFF00"; // Yellow
            ctx.textBaseline = "top";

            lines.forEach((line, index) => {
              const y = img.height - boxHeight + padding + index * lineHeight;
              ctx.fillText(line, padding, y);
            });
          }

          // Convert to base64
          resolve(canvas.toDataURL("image/jpeg", 0.9));
        } catch {
          resolve(base64);
        }
      };

      img.onerror = () => resolve(base64);
      img.src = base64;
    });
  } catch (error) {
    console.error("Failed to fetch image with watermark:", error);
    return null;
  }
}

/**
 * Simple Excel export with images for commission page
 * Format: Seller, Super, Location, Date header + table with IMAGE column
 */
export async function exportCountingToExcelWithImages(
  data: SimpleCountingExportItem[],
  filename: string = "counting-report.xlsx",
  metadata?: {
    sellerName?: string;
    supervisorName?: string;
    supervisorRole?: string;
    location?: string;
    date?: string;
  },
) {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Counting Report");

  // Set column widths - matching the example image
  worksheet.columns = [
    { width: 6 }, // A: #
    { width: 15 }, // B: ITEM (SKU)
    { width: 45 }, // C: DESCRIPTION
    { width: 18 }, // D: BARCODE
    { width: 15 }, // E: SELLER CODE
    { width: 12 }, // F: BEFORE QTY
    { width: 12 }, // G: AI COUNT
    { width: 12 }, // H: VARIANCE
    { width: 14 }, // I: REMARKS
    { width: 25 }, // J: IMAGE
  ];

  // Header metadata (row 1-4)
  worksheet.getCell("A1").value = "Seller:";
  worksheet.getCell("B1").value =
    metadata?.sellerName || data[0]?.userName || "";
  worksheet.getCell("A2").value = "Super:";
  // Use supervisorName with role if available
  const supervisorDisplay = metadata?.supervisorName
    ? metadata?.supervisorRole
      ? `${metadata.supervisorName} (${metadata.supervisorRole})`
      : metadata.supervisorName
    : data[0]?.userRole || "Staff";
  worksheet.getCell("B2").value = supervisorDisplay;
  worksheet.getCell("A3").value = "Location:";
  worksheet.getCell("B3").value =
    metadata?.location || data[0]?.branchName || "";
  worksheet.getCell("A4").value = "Date:";
  worksheet.getCell("B4").value =
    metadata?.date || new Date().toLocaleDateString("th-TH");

  // Style header labels
  ["A1", "A2", "A3", "A4"].forEach((cell) => {
    worksheet.getCell(cell).font = { bold: true };
  });

  // Column headers (row 6) - Yellow background like the example
  const headerRow = worksheet.getRow(6);
  headerRow.values = [
    "#",
    "ITEM",
    "DESCRIPTION",
    "BARCODE",
    "SELLER CODE",
    "BEFORE QTY",
    "AI COUNT",
    "VARIANCE",
    "REMARKS",
    "IMAGE",
  ];
  headerRow.font = { bold: true };
  headerRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFFFFF00" }, // Yellow like the example
  };
  headerRow.alignment = { vertical: "middle", horizontal: "center" };
  headerRow.height = 20;

  // Add borders to header
  headerRow.eachCell((cell) => {
    cell.border = {
      top: { style: "thin" },
      left: { style: "thin" },
      bottom: { style: "thin" },
      right: { style: "thin" },
    };
  });

  // Add data rows with images
  for (let i = 0; i < data.length; i++) {
    const item = data[i];
    const rowIndex = 7 + i; // Each item takes 1 row (compact layout)
    const row = worksheet.getRow(rowIndex);

    // Calculate correct variance (finalCount - beforeCount)
    const calculatedVariance = item.finalCount - item.beforeCount;

    // Determine remarks based on calculated variance
    const remarks =
      calculatedVariance < 0
        ? "สินค้าหาย"
        : calculatedVariance > 0
          ? "สินค้าเกิน"
          : "";

    row.values = [
      i + 1,
      item.productSKU,
      item.productName,
      "", // BARCODE - can be added if available
      "", // SELLER CODE - can be added if available
      item.beforeCount,
      item.finalCount,
      calculatedVariance, // Use calculated variance
      remarks,
      "", // IMAGE placeholder
    ];

    // Set row height for images (60 pixels for compact view)
    row.height = 60;

    // Style variance cell based on calculated value
    const varianceCell = row.getCell(8);
    if (calculatedVariance < 0) {
      varianceCell.font = { bold: true, color: { argb: "FFFF0000" } }; // Red
    } else if (calculatedVariance > 0) {
      varianceCell.font = { bold: true, color: { argb: "FF0000FF" } }; // Blue
    }

    // Style remarks cell
    const remarksCell = row.getCell(9);
    if (calculatedVariance < 0) {
      remarksCell.font = { color: { argb: "FFFF0000" } }; // Red for loss
    }

    // Center align cells
    row.eachCell((cell, colNumber) => {
      cell.alignment = {
        vertical: "middle",
        horizontal: colNumber <= 1 || colNumber >= 6 ? "center" : "left",
      };
      cell.border = {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" },
      };
    });

    // Add image with watermark if available
    if (item.imageUrl) {
      try {
        // Parse watermark data from remarks
        const watermarkData = parseWatermarkFromRemarks(item.remarks);

        // Fetch image with watermark
        const base64Image = await fetchImageWithWatermark(item.imageUrl, {
          location: item.branchName,
          timestamp: item.createdAt,
          employeeName: item.userName,
          employeeId: item.userRole,
          ...watermarkData, // Override with actual watermark data if available
        });

        if (base64Image) {
          // Convert base64 to buffer
          const base64Data = base64Image.split(",")[1];
          const binaryString = atob(base64Data);
          const bytes = new Uint8Array(binaryString.length);
          for (let j = 0; j < binaryString.length; j++) {
            bytes[j] = binaryString.charCodeAt(j);
          }

          const imageId = workbook.addImage({
            // @ts-expect-error ExcelJS accepts Uint8Array but types expect Buffer
            buffer: bytes,
            extension: "jpeg",
          });

          // Add image to cell J with proper positioning (single row)
          worksheet.addImage(imageId, {
            tl: { col: 9, row: rowIndex - 1 + 0.05 } as ExcelJS.Anchor,
            br: { col: 10, row: rowIndex - 0.05 } as ExcelJS.Anchor,
            editAs: "oneCell",
          });
        }
      } catch (error) {
        console.error(`Failed to add image for row ${rowIndex}:`, error);
      }
    }
  }

  // Summary section - use calculated variance
  const summaryRow = 7 + data.length + 2; // Adjusted for compact layout
  const totalLoss = data
    .map((d) => d.finalCount - d.beforeCount)
    .filter((v) => v < 0)
    .reduce((sum, v) => sum + Math.abs(v), 0);
  worksheet.getCell(`A${summaryRow}`).value = "สรุป:";
  worksheet.getCell(`A${summaryRow}`).font = { bold: true };
  worksheet.getCell(`A${summaryRow + 1}`).value =
    `สินค้าหายรวม: ${totalLoss} ชิ้น`;
  worksheet.getCell(`A${summaryRow + 1}`).font = {
    bold: true,
    color: { argb: "FFFF0000" },
  };

  // Download file
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  window.URL.revokeObjectURL(url);
}

/**
 * Simple PDF export with images for commission page
 * Includes product images like the Excel version
 */

export async function exportCountingToPDFWithImages(
  data: SimpleCountingExportItem[],
  _companyName: string = "Company", // Kept for backwards compatibility
  filename: string = "counting-report.pdf",
  metadata?: {
    sellerName?: string;
    supervisorName?: string;
    location?: string;
    date?: string;
  },
) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // Register Thai font
  const hasThaiFond = await registerThaiFont(doc);
  const fontName = hasThaiFond ? "GoogleSans" : "helvetica";

  // ===== Cover Page =====
  // Title
  doc.setFontSize(20);
  doc.setFont(fontName, "normal");
  doc.text("รายงานการนับสต็อก", pageWidth / 2, 25, { align: "center" });

  // Header metadata
  doc.setFontSize(11);
  let headerY = 45;
  doc.text(
    `ผู้ขาย: ${metadata?.sellerName || data[0]?.userName || "N/A"}`,
    15,
    headerY,
  );
  headerY += 7;
  doc.text(`ผู้ตรวจสอบ: ${metadata?.supervisorName || "Manager"}`, 15, headerY);
  headerY += 7;
  doc.text(
    `สถานที่: ${metadata?.location || data[0]?.branchName || "N/A"}`,
    15,
    headerY,
  );
  headerY += 7;
  doc.text(
    `วันที่: ${metadata?.date || new Date().toLocaleDateString("th-TH")}`,
    15,
    headerY,
  );
  headerY += 7;
  doc.text(`จำนวนรายการ: ${data.length}`, 15, headerY);
  headerY += 15;

  // Summary - recalculate variance correctly
  const dataWithCorrectVariance = data.map((d) => ({
    ...d,
    calculatedVariance: d.finalCount - d.beforeCount,
  }));

  const totalLoss = dataWithCorrectVariance
    .filter((d) => d.calculatedVariance < 0)
    .reduce((sum, d) => sum + Math.abs(d.calculatedVariance), 0);
  const totalExcess = dataWithCorrectVariance
    .filter((d) => d.calculatedVariance > 0)
    .reduce((sum, d) => sum + d.calculatedVariance, 0);

  doc.setFillColor(254, 242, 242); // Light red
  doc.roundedRect(15, headerY, 85, 20, 2, 2, "F");
  doc.setFillColor(239, 246, 255); // Light blue
  doc.roundedRect(110, headerY, 85, 20, 2, 2, "F");

  doc.setFontSize(9);
  doc.setTextColor(220, 38, 38);
  doc.setFont(fontName, "normal");
  doc.text("สินค้าหาย (Loss)", 20, headerY + 8);
  doc.setFontSize(12);
  doc.text(`${totalLoss} ชิ้น`, 20, headerY + 15);

  doc.setFontSize(9);
  doc.setTextColor(59, 130, 246);
  doc.text("สินค้าเกิน (Excess)", 115, headerY + 8);
  doc.setFontSize(12);
  doc.text(`${totalExcess} ชิ้น`, 115, headerY + 15);

  doc.setTextColor(0, 0, 0);

  // ===== Detail Pages with Images =====
  // Show 3 items per page with images
  const itemsPerPage = 3;
  const itemHeight = (pageHeight - 40) / itemsPerPage;

  for (let i = 0; i < dataWithCorrectVariance.length; i++) {
    const item = dataWithCorrectVariance[i];
    const positionOnPage = i % itemsPerPage;

    if (positionOnPage === 0 && i >= 0) {
      doc.addPage();
    }

    const startY = 15 + positionOnPage * itemHeight;
    const imageSize = 50;
    const imageX = 15;
    const imageY = startY + 5;

    // Draw border around item
    doc.setDrawColor(200, 200, 200);
    doc.rect(10, startY, pageWidth - 20, itemHeight - 5);

    // Item number and SKU
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(0, 0, 0);
    doc.text(`#${i + 1}  ${item.productSKU}`, imageX, startY + 3);

    // Add image with watermark
    if (item.imageUrl) {
      try {
        // Parse watermark data from remarks
        const watermarkData = parseWatermarkFromRemarks(item.remarks);

        // Fetch image with watermark
        const base64Image = await fetchImageWithWatermark(item.imageUrl, {
          location: item.branchName,
          timestamp: item.createdAt,
          employeeName: item.userName,
          employeeId: item.userRole,
          ...watermarkData, // Override with actual watermark data if available
        });

        if (base64Image) {
          doc.addImage(
            base64Image,
            "JPEG",
            imageX,
            imageY,
            imageSize,
            imageSize,
          );
        } else {
          // Draw placeholder
          doc.setDrawColor(180, 180, 180);
          doc.setFillColor(245, 245, 245);
          doc.rect(imageX, imageY, imageSize, imageSize, "FD");
          doc.setFontSize(8);
          doc.setTextColor(150, 150, 150);
          doc.text("No Image", imageX + imageSize / 2, imageY + imageSize / 2, {
            align: "center",
          });
        }
      } catch {
        // Draw placeholder on error
        doc.setDrawColor(180, 180, 180);
        doc.setFillColor(245, 245, 245);
        doc.rect(imageX, imageY, imageSize, imageSize, "FD");
        doc.setFontSize(8);
        doc.setTextColor(150, 150, 150);
        doc.text("Error", imageX + imageSize / 2, imageY + imageSize / 2, {
          align: "center",
        });
      }
    } else {
      // Draw placeholder
      doc.setDrawColor(180, 180, 180);
      doc.setFillColor(245, 245, 245);
      doc.rect(imageX, imageY, imageSize, imageSize, "FD");
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.text("No Image", imageX + imageSize / 2, imageY + imageSize / 2, {
        align: "center",
      });
    }

    // Item details on right side
    const detailX = imageX + imageSize + 10;
    let detailY = imageY;

    doc.setFontSize(10);
    doc.setFont(fontName, "normal");
    doc.setTextColor(0, 0, 0);

    // Product name (truncate if too long)
    const maxNameLength = 45;
    const productName =
      item.productName.length > maxNameLength
        ? item.productName.substring(0, maxNameLength) + "..."
        : item.productName;
    doc.text(`สินค้า: ${productName}`, detailX, detailY);
    detailY += 7;

    doc.text(`สาขา: ${item.branchName}`, detailX, detailY);
    detailY += 7;
    doc.text(`ผู้นับ: ${item.userName}`, detailX, detailY);
    detailY += 10;

    // Quantity info
    doc.text(`ก่อนนับ: ${item.beforeCount}`, detailX, detailY);
    doc.text(`นับได้: ${item.finalCount}`, detailX + 50, detailY);
    detailY += 8;

    // Use calculated variance
    const calcVariance = item.calculatedVariance;

    // Variance with color and remarks
    const remarks =
      calcVariance < 0 ? "สินค้าหาย" : calcVariance > 0 ? "สินค้าเกิน" : "ตรง";
    if (calcVariance < 0) {
      doc.setTextColor(220, 38, 38); // Red for loss
    } else if (calcVariance > 0) {
      doc.setTextColor(59, 130, 246); // Blue for excess
    } else {
      doc.setTextColor(34, 197, 94); // Green
    }
    doc.setFontSize(12);
    doc.text(`ส่วนต่าง: ${calcVariance}  (${remarks})`, detailX, detailY);

    doc.setTextColor(0, 0, 0);
  }

  // ===== Summary Page =====
  doc.addPage();
  doc.setFontSize(16);
  doc.setFont(fontName, "normal");
  doc.text("สรุปผลการนับ", pageWidth / 2, 25, { align: "center" });

  // Summary table - use calculated variance
  const summaryTableData = [
    ["จำนวนรายการทั้งหมด", dataWithCorrectVariance.length.toString()],
    [
      "สินค้าหาย (รายการ)",
      dataWithCorrectVariance
        .filter((d) => d.calculatedVariance < 0)
        .length.toString(),
    ],
    ["สินค้าหาย (จำนวน)", `${totalLoss} ชิ้น`],
    [
      "สินค้าเกิน (รายการ)",
      dataWithCorrectVariance
        .filter((d) => d.calculatedVariance > 0)
        .length.toString(),
    ],
    ["สินค้าเกิน (จำนวน)", `${totalExcess} ชิ้น`],
    [
      "สินค้าตรง (รายการ)",
      dataWithCorrectVariance
        .filter((d) => d.calculatedVariance === 0)
        .length.toString(),
    ],
  ];

  autoTable(doc, {
    startY: 35,
    body: summaryTableData,
    theme: "grid",
    styles: {
      fontSize: 11,
      cellPadding: 6,
      font: fontName, // Use Thai font
    },
    columnStyles: {
      0: { cellWidth: 80 },
      1: { cellWidth: 60, halign: "right" },
    },
    didParseCell: (cellData) => {
      if (cellData.section === "body") {
        // Loss rows - red
        if (
          (cellData.row.index === 1 || cellData.row.index === 2) &&
          cellData.column.index === 1
        ) {
          cellData.cell.styles.textColor = [220, 38, 38];
        }
        // Excess rows - blue
        if (
          (cellData.row.index === 3 || cellData.row.index === 4) &&
          cellData.column.index === 1
        ) {
          cellData.cell.styles.textColor = [59, 130, 246];
        }
        // Match row - green
        if (cellData.row.index === 5 && cellData.column.index === 1) {
          cellData.cell.styles.textColor = [34, 197, 94];
        }
      }
    },
  });

  // Footer
  const footerY = doc.lastAutoTable.finalY + 20;
  doc.setFontSize(8);
  doc.setFont(fontName, "normal");
  doc.setTextColor(128, 128, 128);
  doc.text(
    `สร้างเมื่อ ${new Date().toLocaleString("th-TH")}`,
    pageWidth / 2,
    footerY,
    { align: "center" },
  );

  // Save
  doc.save(filename);
}
