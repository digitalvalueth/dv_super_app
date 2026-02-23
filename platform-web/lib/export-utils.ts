import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";

// Extend jsPDF type to include autoTable
declare module "jspdf" {
  interface jsPDF {
    lastAutoTable: {
      finalY: number;
    };
  }
}

export type CommissionExportItem = {
  period: string;
  userName: string;
  userId: string;
  branchName: string;
  salesAmount: number;
  commissionRate: number;
  commissionEarned: number;
  lossCount: number;
  lossAmount: number;
  deductionAmount: number;
  netPay: number;
  status: string;
};

export type ExportMetadata = {
  companyName: string;
  exportDate: string;
  filterPeriod: string;
  filterBranch: string;
};

/**
 * Export ค่าคอมมิชชั่นเป็น Excel
 */
export function exportCommissionToExcel(
  data: CommissionExportItem[],
  metadata: ExportMetadata,
  totals: {
    totalCommission: number;
    totalDeduction: number;
    totalNetPay: number;
  },
  filename: string = "commission-report.xlsx",
) {
  // สร้าง workbook
  const wb = XLSX.utils.book_new();

  // สร้าง worksheet data
  const wsData: (string | number)[][] = [
    // Header metadata
    ["รายงานค่าคอมมิชชั่น & การหักเงิน"],
    [],
    ["บริษัท:", metadata.companyName],
    ["วันที่ส่งออก:", metadata.exportDate],
    ["ช่วงเวลา:", metadata.filterPeriod],
    ["สาขา:", metadata.filterBranch],
    [],
    // Summary
    ["สรุปรวม"],
    ["ค่าคอมมิชชั่นรวม:", totals.totalCommission],
    ["ยอดหักรวม:", totals.totalDeduction],
    ["เงินสุทธิรวม:", totals.totalNetPay],
    [],
    // Column headers
    [
      "ช่วงเวลา",
      "พนักงาน",
      "รหัสพนักงาน",
      "สาขา",
      "ยอดขาย (บาท)",
      "อัตราคอมฯ (%)",
      "ค่าคอมมิชชั่น (บาท)",
      "จำนวนสินค้าหาย",
      "มูลค่าสินค้าหาย (บาท)",
      "ยอดหัก (บาท)",
      "เงินสุทธิ (บาท)",
      "สถานะ",
    ],
  ];

  // เพิ่มข้อมูล
  data.forEach((item) => {
    const statusText =
      item.status === "pending"
        ? "รอดำเนินการ"
        : item.status === "approved"
          ? "อนุมัติแล้ว"
          : "จ่ายแล้ว";

    wsData.push([
      item.period,
      item.userName,
      item.userId,
      item.branchName,
      item.salesAmount,
      item.commissionRate,
      item.commissionEarned,
      item.lossCount,
      item.lossAmount,
      item.deductionAmount,
      item.netPay,
      statusText,
    ]);
  });

  // สร้าง worksheet
  const ws = XLSX.utils.aoa_to_sheet(wsData);

  // กำหนดความกว้างของคอลัมน์
  ws["!cols"] = [
    { wch: 18 }, // ช่วงเวลา
    { wch: 20 }, // พนักงาน
    { wch: 15 }, // รหัสพนักงาน
    { wch: 20 }, // สาขา
    { wch: 15 }, // ยอดขาย
    { wch: 12 }, // อัตราคอมฯ
    { wch: 18 }, // ค่าคอมมิชชั่น
    { wch: 15 }, // จำนวนสินค้าหาย
    { wch: 18 }, // มูลค่าสินค้าหาย
    { wch: 15 }, // ยอดหัก
    { wch: 15 }, // เงินสุทธิ
    { wch: 15 }, // สถานะ
  ];

  // Merge cells for title
  ws["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 5 } }];

  // เพิ่ม worksheet เข้า workbook
  XLSX.utils.book_append_sheet(wb, ws, "Commission Report");

  // บันทึกไฟล์
  XLSX.writeFile(wb, filename);
}

/**
 * Export ค่าคอมมิชชั่นเป็น PDF
 */
export function exportCommissionToPDF(
  data: CommissionExportItem[],
  metadata: ExportMetadata,
  totals: {
    totalCommission: number;
    totalDeduction: number;
    totalNetPay: number;
  },
  filename: string = "commission-report.pdf",
) {
  const doc = new jsPDF("landscape");
  const pageWidth = doc.internal.pageSize.getWidth();
  let currentY = 15;

  // ===== Header =====
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text("Commission & Deduction Report", pageWidth / 2, currentY, {
    align: "center",
  });

  currentY += 10;
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`Company: ${metadata.companyName}`, 15, currentY);
  doc.text(`Export Date: ${metadata.exportDate}`, pageWidth - 60, currentY);
  currentY += 6;
  doc.text(`Period: ${metadata.filterPeriod}`, 15, currentY);
  doc.text(`Branch: ${metadata.filterBranch}`, pageWidth - 60, currentY);
  currentY += 10;

  // ===== Summary Cards =====
  doc.setFillColor(240, 253, 244); // Light green
  doc.roundedRect(15, currentY, 80, 25, 3, 3, "F");
  doc.setFillColor(254, 242, 242); // Light red
  doc.roundedRect(105, currentY, 80, 25, 3, 3, "F");
  doc.setFillColor(239, 246, 255); // Light blue
  doc.roundedRect(195, currentY, 80, 25, 3, 3, "F");

  doc.setFontSize(9);
  doc.setTextColor(34, 197, 94); // Green
  doc.text("Total Commission", 20, currentY + 8);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text(`฿${totals.totalCommission.toLocaleString()}`, 20, currentY + 18);

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(239, 68, 68); // Red
  doc.text("Total Deduction", 110, currentY + 8);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text(`฿${totals.totalDeduction.toLocaleString()}`, 110, currentY + 18);

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(59, 130, 246); // Blue
  doc.text("Net Pay", 200, currentY + 8);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text(`฿${totals.totalNetPay.toLocaleString()}`, 200, currentY + 18);

  doc.setTextColor(0, 0, 0);
  currentY += 35;

  // ===== Table =====
  const tableData = data.map((item) => {
    const statusText =
      item.status === "pending"
        ? "Pending"
        : item.status === "approved"
          ? "Approved"
          : "Paid";

    return [
      item.period,
      item.userName,
      item.branchName,
      `฿${item.salesAmount.toLocaleString()}`,
      `${item.commissionRate}%`,
      `฿${item.commissionEarned.toLocaleString()}`,
      item.lossCount > 0 ? `${item.lossCount} pcs` : "-",
      item.deductionAmount > 0
        ? `-฿${item.deductionAmount.toLocaleString()}`
        : "-",
      `฿${item.netPay.toLocaleString()}`,
      statusText,
    ];
  });

  autoTable(doc, {
    startY: currentY,
    head: [
      [
        "Period",
        "Employee",
        "Branch",
        "Sales",
        "Rate",
        "Commission",
        "Loss",
        "Deduction",
        "Net Pay",
        "Status",
      ],
    ],
    body: tableData,
    theme: "striped",
    headStyles: {
      fillColor: [59, 130, 246],
      textColor: [255, 255, 255],
      fontSize: 8,
      fontStyle: "bold",
    },
    styles: { fontSize: 8, cellPadding: 3 },
    columnStyles: {
      0: { cellWidth: 25 },
      1: { cellWidth: 30 },
      2: { cellWidth: 30 },
      3: { cellWidth: 25, halign: "right" },
      4: { cellWidth: 15, halign: "center" },
      5: { cellWidth: 28, halign: "right" },
      6: { cellWidth: 18, halign: "center" },
      7: { cellWidth: 25, halign: "right" },
      8: { cellWidth: 28, halign: "right" },
      9: { cellWidth: 20, halign: "center" },
    },
    didParseCell: (data) => {
      // Style commission column (green)
      if (data.column.index === 5 && data.section === "body") {
        data.cell.styles.textColor = [34, 197, 94];
        data.cell.styles.fontStyle = "bold";
      }
      // Style deduction column (red)
      if (data.column.index === 7 && data.section === "body") {
        const text = data.cell.text[0] || "";
        if (text.includes("-")) {
          data.cell.styles.textColor = [239, 68, 68];
          data.cell.styles.fontStyle = "bold";
        }
      }
      // Style net pay column (blue)
      if (data.column.index === 8 && data.section === "body") {
        data.cell.styles.textColor = [59, 130, 246];
        data.cell.styles.fontStyle = "bold";
      }
      // Style status column
      if (data.column.index === 9 && data.section === "body") {
        const text = data.cell.text[0] || "";
        if (text === "Pending") {
          data.cell.styles.textColor = [234, 179, 8];
        } else if (text === "Approved") {
          data.cell.styles.textColor = [59, 130, 246];
        } else if (text === "Paid") {
          data.cell.styles.textColor = [34, 197, 94];
        }
      }
    },
  });

  // Footer
  const finalY = doc.lastAutoTable.finalY + 10;
  doc.setFontSize(8);
  doc.setTextColor(128, 128, 128);
  doc.text(
    `Generated on ${new Date().toLocaleString("th-TH")}`,
    pageWidth / 2,
    finalY,
    { align: "center" },
  );

  // บันทึกไฟล์
  doc.save(filename);
}
